require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const {
  isAllowedOrigin,
  resolveRegistrationRole,
} = require("./config/appConfig");
const db = require("./database");
const authMiddleware = require("./middleware/auth");
const createGlobalChatRouter = require("./routes/globalChat");
const createModerationRouter = require("./routes/moderation");
const { getAiQuota } = require("./services/chatPolicies");
const {
  BLOCKED_MESSAGE_RESPONSE,
  checkMessageContent,
} = require("./services/contentFilter");
const {
  MAX_FILES_PER_UPLOAD,
  MAX_UPLOAD_FILE_SIZE,
  processUploadedFiles,
  upload,
} = require("./services/fileUploadService");
const {
  buildMessagePromptContent,
  mapMessageRow,
  normalizeAttachmentsInput,
  serializeAttachments,
} = require("./services/messageAttachments");

const PORT = Number(process.env.PORT || 5000);
const JWT_SECRET = process.env.JWT_SECRET;
const OLLAMA_LOW_MEMORY_MODEL =
  process.env.OLLAMA_LOW_MEMORY_MODEL || "qwen2.5:0.5b";
const OLLAMA_BASE_URL = String(
  process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434",
).replace(/\/+$/, "");
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || OLLAMA_LOW_MEMORY_MODEL;
const OLLAMA_KEEP_ALIVE = process.env.OLLAMA_KEEP_ALIVE || "2m";
const OLLAMA_LOW_MEMORY_MODE = process.env.OLLAMA_LOW_MEMORY_MODE !== "false";
const OLLAMA_NUM_CTX = normalizePositiveInteger(process.env.OLLAMA_NUM_CTX, 1536);
const OLLAMA_MAX_HISTORY_MESSAGES = normalizePositiveInteger(
  process.env.OLLAMA_MAX_HISTORY_MESSAGES,
  8,
);
const OLLAMA_MAX_HISTORY_CHARS = normalizePositiveInteger(
  process.env.OLLAMA_MAX_HISTORY_CHARS,
  9000,
);
const OLLAMA_CHAT_API_URL = `${OLLAMA_BASE_URL}/api/chat`;
const OLLAMA_TAGS_API_URL = `${OLLAMA_BASE_URL}/api/tags`;
const CLIENT_DIST_PATH = path.resolve(__dirname, "../client/dist");
const CLIENT_INDEX_PATH = path.join(CLIENT_DIST_PATH, "index.html");
const SYSTEM_PROMPT =
  "\u0422\u044b MichaelGPT - \u0443\u043c\u043d\u044b\u0439, \u0434\u0440\u0443\u0436\u0435\u043b\u044e\u0431\u043d\u044b\u0439 \u0438 \u043f\u043e\u043b\u0435\u0437\u043d\u044b\u0439 AI-\u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043d\u0442. \u041e\u0442\u0432\u0435\u0447\u0430\u0439 \u043f\u043e\u0434\u0440\u043e\u0431\u043d\u043e \u0438 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0442\u0438\u0432\u043d\u043e.";

function normalizeResponseMode(value) {
  const mode = String(value || "")
    .trim()
    .toLowerCase();
  if (mode === "short") return "short";
  if (mode === "deep") return "deep";
  return "balanced";
}

function getModeInstruction(mode) {
  if (mode === "short") {
    return [
      "Режим: КРАТКО.",
      "Отвечай очень коротко и по сути.",
      "Цель: 1-3 коротких предложения.",
      "Без длинных объяснений, списков и примеров, если их не просили отдельно.",
    ].join(" ");
  }
  if (mode === "deep") {
    return [
      "Режим: ГЛУБОКО.",
      "Отвечай максимально подробно и структурированно.",
      "Минимум 6-10 развернутых абзацев, если запрос не просит обратного.",
      "Добавляй шаги, пояснения, примеры, нюансы, ограничения и практические выводы.",
      "Не сокращай ответ и не ограничивайся кратким резюме.",
    ].join(" ");
  }
  return [
    "Режим: СТАНДАРТ.",
    "Отвечай сбалансированно: понятно и по делу.",
    "Сам выбирай оптимальную длину ответа.",
  ].join(" ");
}

function getModeSettings(mode) {
  if (mode === "short") {
    return { maxTokens: 120, temperature: 0.35 };
  }
  if (mode === "deep") {
    return { maxTokens: 768, temperature: 0.6 };
  }
  return { maxTokens: 320, temperature: 0.5 };
}

function enforceModeOutput(text, mode) {
  const normalized = String(text || "").trim();
  if (!normalized || mode !== "short") return normalized;

  const flat = normalized
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!flat) return normalized;

  const sentences = flat
    .match(/[^.!?]+[.!?]?/g)
    ?.map((part) => part.trim())
    .filter(Boolean) || [flat];

  let shortText = sentences.slice(0, 2).join(" ");
  if (shortText.length > 240) {
    shortText = `${shortText.slice(0, 237).trimEnd()}...`;
  }
  return shortText;
}

function isDeepTooShort(text) {
  const normalized = String(text || "")
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return true;
  const sentenceCount = normalized
    .split(/[.!?]+/)
    .map((x) => x.trim())
    .filter(Boolean).length;
  return normalized.length < 650 || sentenceCount < 6;
}

function isBalancedTooShort(text) {
  const normalized = String(text || "")
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return true;
  const sentenceCount = normalized
    .split(/[.!?]+/)
    .map((x) => x.trim())
    .filter(Boolean).length;
  return normalized.length < 90 || sentenceCount < 2;
}

function isCasualGreetingPrompt(text) {
  const normalized = String(text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized || normalized.length > 40) return false;
  return /^(привет|хай|hello|hi|здравствуй|здравствуйте|добрый день|доброе утро|добрый вечер|йо|ку)\b/.test(
    normalized,
  );
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

const app = express();
const hasClientBuild = fs.existsSync(CLIENT_INDEX_PATH);

app.set("trust proxy", 1);

if (!OLLAMA_BASE_URL) {
  console.warn(
    "Warning: OLLAMA_BASE_URL is empty — AI requests will fail until it is configured.",
  );
}

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      return callback(createError(403, "CORS origin is not allowed"));
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use("/api/global-chat", createGlobalChatRouter(db, authMiddleware));
app.use("/api/mod", authMiddleware, createModerationRouter(db));

function createError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function sanitizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function formatUploadError(error) {
  if (!error) return null;
  if (error.code === "LIMIT_FILE_SIZE") {
    return `Файл слишком большой. Максимальный размер: ${Math.round(MAX_UPLOAD_FILE_SIZE / 1024 / 1024)}MB`;
  }
  if (error.code === "LIMIT_FILE_COUNT") {
    return `Можно загрузить не более ${MAX_FILES_PER_UPLOAD} файлов за один раз`;
  }
  if (String(error.message || "").includes("Unsupported file type")) {
    return "Недопустимый тип файла. Разрешены документы, изображения и файлы кода: PDF, TXT, DOCX, CSV, JSON, PNG, JPG, JS, TS, PY, JAVA, C, C++, C#, PHP, GO, SQL, HTML, CSS, XML, YAML и другие текстовые исходники";
  }
  return error.message || "Ошибка загрузки файла";
}

function uploadFilesMiddleware(req, res, next) {
  upload.array("files", MAX_FILES_PER_UPLOAD)(req, res, (error) => {
    if (error) {
      return next(createError(400, formatUploadError(error)));
    }

    return next();
  });
}

function buildToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: "7d",
  });
}

async function getChatById(chatId, userId) {
  return db.get("SELECT * FROM chats WHERE id = ? AND user_id = ?", [
    chatId,
    userId,
  ]);
}

function buildOllamaMessages(messages, responseMode) {
  const preparedMessages = [];
  const recentMessages = Array.isArray(messages)
    ? messages.slice(-OLLAMA_MAX_HISTORY_MESSAGES)
    : [];
  let remainingChars = OLLAMA_MAX_HISTORY_CHARS;

  for (let index = recentMessages.length - 1; index >= 0; index -= 1) {
    const message = recentMessages[index];
    const promptContent = String(buildMessagePromptContent(message) || "").trim();
    if (!promptContent) continue;
    if (remainingChars <= 0) break;

    const content =
      promptContent.length > remainingChars
        ? `${promptContent.slice(0, Math.max(80, remainingChars - 24)).trimEnd()}\n...[context trimmed]`
        : promptContent;

    preparedMessages.unshift({
      role: message.role === "assistant" ? "assistant" : "user",
      content,
    });
    remainingChars -= content.length;
  }

  return [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: getModeInstruction(responseMode) },
    {
      role: "system",
      content: `Ограничения сервера: держи ответ компактным и практичным. Используй только недавний контекст чата.`,
    },
    ...preparedMessages,
  ];
}

function isOllamaMemoryError(details) {
  const text = String(details || "").toLowerCase();
  return (
    text.includes("requires more system memory") ||
    text.includes("available") && text.includes("memory") ||
    text.includes("not enough memory") ||
    text.includes("insufficient memory")
  );
}

function formatOllamaError(error) {
  const responseError = error?.response?.data?.error;
  if (responseError) {
    const message = String(responseError);
    if (isOllamaMemoryError(message)) {
      return `На сервере не хватает RAM для модели "${OLLAMA_MODEL}". Для этого VPS будет использоваться облегченный профиль. Установите модель "${OLLAMA_LOW_MEMORY_MODEL}" командой "ollama pull ${OLLAMA_LOW_MEMORY_MODEL}".`;
    }
    return message;
  }
  if (error?.response?.data?.message) {
    return String(error.response.data.message);
  }
  if (error?.code === "ECONNREFUSED") {
    return `Не удалось подключиться к Ollama по адресу ${OLLAMA_BASE_URL}. Проверьте, что Ollama запущена.`;
  }
  if (error?.code === "ECONNABORTED") {
    return "Ollama отвечает слишком долго. Попробуйте меньшую модель или повторите запрос.";
  }
  return error?.message || "Неизвестная ошибка Ollama";
}

async function requestOllamaWithModel(
  model,
  messages,
  responseMode = "balanced",
) {
  const modeSettings = getModeSettings(responseMode);

  const response = await axios.post(
    OLLAMA_CHAT_API_URL,
    {
      model,
      messages: buildOllamaMessages(messages, responseMode),
      stream: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: {
        temperature: modeSettings.temperature,
        num_predict: modeSettings.maxTokens,
        num_ctx: OLLAMA_NUM_CTX,
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 180000,
    },
  );

  const content = String(response?.data?.message?.content || "").trim();
  if (!content) {
    throw createError(502, "Пустой ответ от Ollama");
  }

  return content;
}

async function requestOllama(messages, responseMode = "balanced") {
  try {
    return await requestOllamaWithModel(OLLAMA_MODEL, messages, responseMode);
  } catch (error) {
    const details =
      error?.details ||
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      "";

    if (
      isOllamaMemoryError(details) &&
      OLLAMA_MODEL !== OLLAMA_LOW_MEMORY_MODEL
    ) {
      try {
        console.warn(
          `Model "${OLLAMA_MODEL}" exceeded memory limits. Retrying with "${OLLAMA_LOW_MEMORY_MODEL}".`,
        );
        return await requestOllamaWithModel(
          OLLAMA_LOW_MEMORY_MODEL,
          messages,
          responseMode,
        );
      } catch (fallbackError) {
        throw createError(
          502,
          "Ошибка получения ответа от AI",
          formatOllamaError(fallbackError),
        );
      }
    }

    throw createError(502, "Ошибка получения ответа от AI", formatOllamaError(error));
  }
}

async function probeOllama() {
  try {
    const response = await axios.get(OLLAMA_TAGS_API_URL, { timeout: 5000 });
    const models = Array.isArray(response?.data?.models) ? response.data.models : [];
    const hasConfiguredModel = models.some((model) => model?.name === OLLAMA_MODEL);
    const hasLowMemoryModel = models.some(
      (model) => model?.name === OLLAMA_LOW_MEMORY_MODEL,
    );

    if (hasConfiguredModel) {
      console.log(`Ollama is reachable. Model ready: ${OLLAMA_MODEL}`);
    } else {
      console.warn(
        `Ollama is reachable, but model "${OLLAMA_MODEL}" is not installed yet. Run "ollama pull ${OLLAMA_MODEL}".`,
      );
    }

    if (!hasLowMemoryModel) {
      console.warn(
        `Low-memory model "${OLLAMA_LOW_MEMORY_MODEL}" is not installed yet. Run "ollama pull ${OLLAMA_LOW_MEMORY_MODEL}".`,
      );
    }
  } catch (error) {
    console.warn(`Ollama probe failed: ${formatOllamaError(error)}`);
  }
}

app.post(
  "/api/auth/register",
  asyncHandler(async (req, res) => {
    const email = sanitizeText(req.body?.email).toLowerCase();
    const password = sanitizeText(req.body?.password);
    const name = sanitizeText(req.body?.name);

    if (!email || !password || !name) {
      throw createError(400, "Р’СЃРµ РїРѕР»СЏ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹");
    }

    if (password.length < 6) {
      throw createError(
        400,
        "РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ СЃРѕРґРµСЂР¶Р°С‚СЊ РјРёРЅРёРјСѓРј 6 СЃРёРјРІРѕР»РѕРІ",
      );
    }

    const existingByName = await db.get(
      "SELECT id FROM users WHERE LOWER(name) = LOWER(?) LIMIT 1",
      [name],
    );
    if (existingByName) {
      throw createError(400, "РРјСЏ СѓР¶Рµ Р·Р°РЅСЏС‚Рѕ");
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = resolveRegistrationRole(email);

    try {
      const result = await db.run(
        "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)",
        [email, hashedPassword, name, role],
      );

      const user = {
        id: result.lastID,
        email,
        name,
        role,
        isVerified: 0,
        avatarUrl: null,
      };
      const token = buildToken(user);

      return res.json({
        message: "Р РµРіРёСЃС‚СЂР°С†РёСЏ СѓСЃРїРµС€РЅР°",
        token,
        user,
      });
    } catch (error) {
      if (String(error.message).includes("UNIQUE constraint failed")) {
        throw createError(400, "Email СѓР¶Рµ Р·Р°СЂРµРіРёСЃС‚СЂРёСЂРѕРІР°РЅ");
      }
      throw error;
    }
  }),
);

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const email = sanitizeText(req.body?.email).toLowerCase();
    const password = sanitizeText(req.body?.password);

    if (!email || !password) {
      throw createError(400, "Email Рё РїР°СЂРѕР»СЊ РѕР±СЏР·Р°С‚РµР»СЊРЅС‹");
    }

    const user = await db.get("SELECT * FROM users WHERE email = ?", [email]);
    if (!user) {
      throw createError(401, "РќРµРІРµСЂРЅС‹Р№ email РёР»Рё РїР°СЂРѕР»СЊ");
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw createError(401, "РќРµРІРµСЂРЅС‹Р№ email РёР»Рё РїР°СЂРѕР»СЊ");
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role || "user",
      isVerified: Number(user.is_verified) || 0,
      avatarUrl: user.avatar_url || null,
    };
    const token = buildToken(safeUser);

    return res.json({
      message: "Р’С…РѕРґ РІС‹РїРѕР»РЅРµРЅ",
      token,
      user: safeUser,
    });
  }),
);

app.get(
  "/api/health",
  asyncHandler(async (_req, res) => {
    return res.json({
      ok: true,
      aiProvider: "ollama",
      model: OLLAMA_MODEL,
      lowMemoryModel: OLLAMA_LOW_MEMORY_MODEL,
      numCtx: OLLAMA_NUM_CTX,
    });
  }),
);
app.get(
  "/api/ai/status",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const quota = await getAiQuota(db, req.user.id, req.user);
    return res.json({ quota });
  }),
);
app.get(
  "/api/auth/me",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const user = await db.get(
      "SELECT id, email, name, role, is_verified AS isVerified, avatar_url AS avatarUrl, created_at FROM users WHERE id = ?",
      [req.user.id],
    );

    if (!user) {
      throw createError(404, "РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ");
    }

    return res.json({ user });
  }),
);

app.get(
  "/api/auth/ping",
  authMiddleware,
  asyncHandler(async (_req, res) => {
    return res.json({ ok: true });
  }),
);

app.post(
  "/api/auth/logout",
  authMiddleware,
  asyncHandler(async (req, res) => {
    await db.run(
      `UPDATE users SET last_seen_at = datetime('now', '-1 day') WHERE id = ?`,
      [req.user.id],
    );
    return res.json({ ok: true });
  }),
);

app.post(
  "/api/upload",
  authMiddleware,
  uploadFilesMiddleware,
  asyncHandler(async (req, res) => {
    const files = Array.isArray(req.files) ? req.files : [];
    if (!files.length) {
      throw createError(400, "Нужно выбрать хотя бы один файл");
    }

    const parsedFiles = await processUploadedFiles(files);
    if (!parsedFiles.length) {
      throw createError(400, "Не удалось обработать загруженные файлы");
    }

    return res.json({ files: parsedFiles });
  }),
);

app.get(
  "/api/chats",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const chats = await db.all(
      "SELECT * FROM chats WHERE user_id = ? ORDER BY updated_at DESC",
      [req.user.id],
    );
    return res.json({ chats });
  }),
);

app.post(
  "/api/chats",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const title = sanitizeText(req.body?.title) || "РќРѕРІС‹Р№ С‡Р°С‚";

    const result = await db.run(
      "INSERT INTO chats (user_id, title) VALUES (?, ?)",
      [req.user.id, title],
    );
    const chat = await db.get("SELECT * FROM chats WHERE id = ?", [
      result.lastID,
    ]);

    return res.json({ chat });
  }),
);

app.put(
  "/api/chats/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const chatId = Number(req.params.id);
    const title = sanitizeText(req.body?.title);

    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw createError(400, "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID С‡Р°С‚Р°");
    }

    if (!title) {
      throw createError(
        400,
        "РќР°Р·РІР°РЅРёРµ С‡Р°С‚Р° РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј",
      );
    }

    const result = await db.run(
      "UPDATE chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
      [title, chatId, req.user.id],
    );

    if (!result.changes) {
      throw createError(404, "Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ");
    }

    const chat = await db.get("SELECT * FROM chats WHERE id = ?", [chatId]);
    return res.json({ chat });
  }),
);

app.delete(
  "/api/chats/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const chatId = Number(req.params.id);

    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw createError(400, "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID С‡Р°С‚Р°");
    }

    const result = await db.run(
      "DELETE FROM chats WHERE id = ? AND user_id = ?",
      [chatId, req.user.id],
    );

    if (!result.changes) {
      throw createError(404, "Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ");
    }

    return res.json({ message: "Р§Р°С‚ СѓРґР°Р»С‘РЅ" });
  }),
);

app.get(
  "/api/chats/:id/messages",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const chatId = Number(req.params.id);

    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw createError(400, "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID С‡Р°С‚Р°");
    }

    const chat = await getChatById(chatId, req.user.id);
    if (!chat) {
      throw createError(404, "Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ");
    }

    const messageRows = await db.all(
      "SELECT * FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
      [chatId],
    );
    const messages = messageRows.map(mapMessageRow);
    return res.json({ messages });
  }),
);

app.post(
  "/api/chats/:id/messages",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const chatId = Number(req.params.id);
    const content = sanitizeText(req.body?.content);
    const responseMode = normalizeResponseMode(req.body?.responseMode);
    const attachments = normalizeAttachmentsInput(req.body?.attachments);

    if (!Number.isInteger(chatId) || chatId <= 0) {
      throw createError(400, "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID С‡Р°С‚Р°");
    }

    if (!content && attachments.length === 0) {
      throw createError(
        400,
        "РЎРѕРѕР±С‰РµРЅРёРµ РЅРµ РјРѕР¶РµС‚ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј",
      );
    }

    const chat = await getChatById(chatId, req.user.id);
    if (!chat) {
      throw createError(404, "Р§Р°С‚ РЅРµ РЅР°Р№РґРµРЅ");
    }

    if (checkMessageContent(content)) {
      return res.status(422).json({
        error: BLOCKED_MESSAGE_RESPONSE,
        blocked: true,
      });
    }

    const quota = await getAiQuota(db, req.user.id, req.user);
    if (!quota.hasUnlimited && quota.remaining <= 0) {
      return res.status(429).json({
        error: "Лимит сообщений к ИИ исчерпан (10 за 24 часа)",
        quota,
      });
    }
    const serializedAttachments = serializeAttachments(attachments);
    const userInsert = await db.run(
      "INSERT INTO messages (chat_id, role, content, attachments_json) VALUES (?, ?, ?, ?)",
      [chatId, "user", content, serializedAttachments],
    );
    const userMessageRow = await db.get("SELECT * FROM messages WHERE id = ?", [
      userInsert.lastID,
    ]);
    const userMessage = mapMessageRow(userMessageRow);

    // Начисляем XP пользователю за сообщение
    await db.run(
      "INSERT INTO user_xp_logs (user_id, xp_amount, source) VALUES (?, ?, ?)",
      [req.user.id, 15, "message"],
    );

    const history = await db.all(
      "SELECT role, content, attachments_json AS attachmentsJson FROM messages WHERE chat_id = ? ORDER BY created_at ASC",
      [chatId],
    );
    const aiHistory = history.map((message) => ({
      role: message.role,
      content: message.content,
      attachmentsJson: message.attachmentsJson,
    }));

    const rawAiText = await requestOllama(aiHistory, responseMode);
    let aiText = enforceModeOutput(rawAiText, responseMode);
    const isCasualGreeting = isCasualGreetingPrompt(content);
    if (!OLLAMA_LOW_MEMORY_MODE && responseMode === "deep" && isDeepTooShort(aiText)) {
      const expansionPrompt = isCasualGreeting
        ? "Пользователь поздоровался. Ответь дружелюбно и развернуто в 3-5 предложений, без списков и без искусственных секций."
        : [
            `Пользователь спросил: "${content}".`,
            "Дай максимально подробный, структурированный ответ по этому запросу.",
            "Добавь шаги, примеры, нюансы, ограничения и практический итог.",
            'Не описывай "прошлый ответ" и не используй шаблонные секции ради секций.',
          ].join(" ");

      aiText = await requestOllama(
        [
          ...aiHistory,
          { role: "assistant", content: aiText },
          { role: "user", content: expansionPrompt },
        ],
        "deep",
      );
    }
    if (
      !OLLAMA_LOW_MEMORY_MODE &&
      responseMode === "balanced" &&
      isBalancedTooShort(aiText)
    ) {
      const expansionPrompt = isCasualGreeting
        ? "Пользователь поздоровался. Дай теплый стандартный ответ в 2-3 предложениях, без списков."
        : [
            `Пользователь спросил: "${content}".`,
            "Сделай стандартный ответ: не слишком коротко и не слишком длинно.",
            "Нужно 2-4 предложения по делу, можно добавить короткое уточнение или полезный следующий шаг.",
          ].join(" ");
      aiText = await requestOllama(
        [
          ...aiHistory,
          { role: "assistant", content: aiText },
          { role: "user", content: expansionPrompt },
        ],
        "balanced",
      );
    }

    const aiInsert = await db.run(
      "INSERT INTO messages (chat_id, role, content, attachments_json) VALUES (?, ?, ?, ?)",
      [chatId, "assistant", aiText, null],
    );
    const aiMessageRow = await db.get("SELECT * FROM messages WHERE id = ?", [
      aiInsert.lastID,
    ]);
    const aiMessage = mapMessageRow(aiMessageRow);

    await db.run(
      "UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [chatId],
    );

    return res.json({ userMessage, aiMessage });
  }),
);

app.delete(
  "/api/messages/:id",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const messageId = Number(req.params.id);

    if (!Number.isInteger(messageId) || messageId <= 0) {
      throw createError(400, "РќРµРєРѕСЂСЂРµРєС‚РЅС‹Р№ ID СЃРѕРѕР±С‰РµРЅРёСЏ");
    }

    const message = await db.get("SELECT * FROM messages WHERE id = ?", [
      messageId,
    ]);
    if (!message) {
      throw createError(404, "РЎРѕРѕР±С‰РµРЅРёРµ РЅРµ РЅР°Р№РґРµРЅРѕ");
    }

    const chat = await getChatById(message.chat_id, req.user.id);
    if (!chat) {
      throw createError(
        403,
        "РќРµС‚ РґРѕСЃС‚СѓРїР° Рє СЌС‚РѕРјСѓ СЃРѕРѕР±С‰РµРЅРёСЋ",
      );
    }

    await db.run("DELETE FROM messages WHERE id = ?", [messageId]);
    return res.json({ message: "РЎРѕРѕР±С‰РµРЅРёРµ СѓРґР°Р»РµРЅРѕ" });
  }),
);

app.get(
  "/api/user/stats",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const row = await db.get(
      `SELECT
         SUM(xp_amount) AS totalXp,
         COUNT(*) AS totalMessages
       FROM user_xp_logs
       WHERE user_id = ? AND source = 'message'`,
      [userId],
    );

    const totalMessages = row?.totalMessages || 0;
    const xp = row?.totalXp || 0;
    const level = Math.min(Math.floor(xp / 150) + 1, 100);

    const ranks = {
      1: "РќРѕРІРёС‡РѕРє",
      5: "РђРєС‚РёРІРЅС‹Р№",
      10: "Р—РЅР°СЋС‰РёР№",
      15: "РџСЂРѕРґРІРёРЅСѓС‚С‹Р№",
      20: "РђРЅР°Р»РёС‚РёРє",
      25: "РРЅС‚РµР»Р»РµРєС‚СѓР°Р»",
      30: "Р’РёР·РёРѕРЅРµСЂ",
      35: "Р›РёРґРµСЂ",
      40: "РЎС‚СЂР°С‚РµРі",
      45: "РўР°РєС‚РёРє",
      50: "Р­Р»РёС‚Р°",
      55: "РђРІС‚РѕСЂРёС‚РµС‚",
      60: "РњСѓРґСЂРµС†",
      65: "Р“РµРЅРёР№",
      70: "Р’РёСЂС‚СѓРѕР·",
      75: "РўРёС‚Р°РЅ",
      80: "РњР°РіРёСЃС‚СЂ",
      85: "Р¤РµРЅРѕРјРµРЅ",
      90: "Р›РµРіРµРЅРґР°",
      95: "Р“СЂР°РЅРґРјР°СЃС‚РµСЂ",
      100: "РРјРїРµСЂР°С‚РѕСЂ",
    };

    const rankThreshold = Math.max(
      ...Object.keys(ranks)
        .map(Number)
        .filter((k) => k <= level),
    );
    const rank = ranks[rankThreshold];

    const xpForCurrentLevel = (level - 1) * 150;
    const xpProgress = xp - xpForCurrentLevel;
    const xpToNextLevel = level < 100 ? 150 - xpProgress : 0;

    const rankRow = await db.get(
      `SELECT COUNT(*) + 1 AS worldRank
       FROM (
         SELECT user_id, SUM(xp_amount) AS userXp
         FROM user_xp_logs
         WHERE source = 'message'
         GROUP BY user_id
       ) AS leaderboard
       WHERE leaderboard.userXp > ?`,
      [xp],
    );

    return res.json({
      totalMessages,
      xp,
      level,
      rank,
      xpProgress,
      xpToNextLevel,
      memberSince: row?.memberSince || null,
      worldRank: rankRow?.worldRank || 1,
    });
  }),
);

app.post(
  "/api/user/avatar",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const dataUrl = String(req.body?.dataUrl || "").trim();
    if (!dataUrl) {
      return res.status(400).json({ error: "Нужно выбрать изображение" });
    }
    if (!dataUrl.startsWith("data:image/")) {
      return res.status(400).json({ error: "Недопустимый формат изображения" });
    }
    if (dataUrl.length > 350000) {
      return res
        .status(400)
        .json({ error: "Файл слишком большой (макс ~250KB)" });
    }

    await db.run("UPDATE users SET avatar_url = ? WHERE id = ?", [
      dataUrl,
      req.user.id,
    ]);
    return res.json({ avatarUrl: dataUrl });
  }),
);

if (hasClientBuild) {
  app.use(express.static(CLIENT_DIST_PATH));

  app.get(/^(?!\/api(?:\/|$)).*/, (req, res, next) => {
    const acceptsHtml = req.accepts(["html", "json", "text"]) === "html";
    const looksLikeFileRequest = path.extname(req.path) !== "";

    if (!acceptsHtml || looksLikeFileRequest) {
      return next();
    }

    return res.sendFile(CLIENT_INDEX_PATH);
  });
}

app.use((_req, res) => {
  res.status(404).json({ error: "РњР°СЂС€СЂСѓС‚ РЅРµ РЅР°Р№РґРµРЅ" });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const payload = { error: error.message || "РћС€РёР±РєР° СЃРµСЂРІРµСЂР°" };

  if (error.details) {
    payload.details = error.details;
  }

  if (status >= 500) {
    console.error("Server error:", error);
  }

  res.status(status).json(payload);
});

async function start() {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET РЅРµ Р·Р°РґР°РЅ РІ .env");
  }

  await db.initDatabase();

  console.log(`AI provider: Ollama`);
  console.log(`Ollama URL: ${OLLAMA_BASE_URL}`);
  console.log(`Ollama model: ${OLLAMA_MODEL}`);
  console.log(`Ollama low-memory model: ${OLLAMA_LOW_MEMORY_MODEL}`);
  console.log(`Ollama low-memory mode: ${OLLAMA_LOW_MEMORY_MODE}`);
  console.log(`Ollama num_ctx: ${OLLAMA_NUM_CTX}`);
  console.log(
    `Ollama history budget: ${OLLAMA_MAX_HISTORY_MESSAGES} messages / ${OLLAMA_MAX_HISTORY_CHARS} chars`,
  );
  await probeOllama();

  if (hasClientBuild) {
    console.log(`Serving client build from ${CLIENT_DIST_PATH}`);
  } else {
    console.warn(
      `Client build not found at ${CLIENT_INDEX_PATH}. Build the frontend with "npm run build" in /client before production deploy.`,
    );
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server started on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error("Startup error:", error.message);
  process.exit(1);
});
