const AI_MESSAGE_LIMIT = 10;
const AI_WINDOW_HOURS = 24;
const GLOBAL_CHAT_COOLDOWN_MS = 30 * 1000;

function parseSqliteDateUtc(value) {
  if (!value) return null;
  const normalized = String(value).replace(' ', 'T');
  const date = new Date(`${normalized}Z`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function hasUnlimitedAccess(user) {
  if (!user) return false;
  const role = user.role || 'user';
  if (role === 'moderator' || role === 'owner') return true;
  if (Number(user.isVerified) === 1) return true;
  return false;
}

async function getAiQuota(db, userId, user) {
  if (hasUnlimitedAccess(user)) {
    return {
      hasUnlimited: true,
      limit: null,
      used: 0,
      remaining: null,
      windowHours: AI_WINDOW_HOURS,
      resetAtMs: null,
    };
  }

  const usage = await db.get(
    `SELECT
       COUNT(*) AS used,
       MIN(created_at) AS oldestInWindow
     FROM user_xp_logs
     WHERE user_id = ?
       AND source = 'message'
       AND created_at >= datetime('now', '-24 hours')`,
    [userId]
  );

  const used = Number(usage?.used || 0);
  const remaining = Math.max(0, AI_MESSAGE_LIMIT - used);

  let resetAtMs = null;
  if (usage?.oldestInWindow) {
    const oldest = parseSqliteDateUtc(usage.oldestInWindow);
    if (oldest) {
      resetAtMs = oldest.getTime() + AI_WINDOW_HOURS * 60 * 60 * 1000;
    }
  }

  return {
    hasUnlimited: false,
    limit: AI_MESSAGE_LIMIT,
    used,
    remaining,
    windowHours: AI_WINDOW_HOURS,
    resetAtMs,
  };
}

async function getGlobalChatCooldown(db, userId, user) {
  if (hasUnlimitedAccess(user)) {
    return {
      hasUnlimited: true,
      cooldownMs: 0,
      remainingMs: 0,
      resetAtMs: null,
      canSend: true,
    };
  }

  const lastMessage = await db.get(
    `SELECT created_at AS createdAt
     FROM global_messages
     WHERE user_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [userId]
  );

  if (!lastMessage?.createdAt) {
    return {
      hasUnlimited: false,
      cooldownMs: GLOBAL_CHAT_COOLDOWN_MS,
      remainingMs: 0,
      resetAtMs: null,
      canSend: true,
    };
  }

  const lastAt = parseSqliteDateUtc(lastMessage.createdAt);
  if (!lastAt) {
    return {
      hasUnlimited: false,
      cooldownMs: GLOBAL_CHAT_COOLDOWN_MS,
      remainingMs: 0,
      resetAtMs: null,
      canSend: true,
    };
  }

  const nowMs = Date.now();
  const resetAtMs = lastAt.getTime() + GLOBAL_CHAT_COOLDOWN_MS;
  const remainingMs = Math.max(0, resetAtMs - nowMs);

  return {
    hasUnlimited: false,
    cooldownMs: GLOBAL_CHAT_COOLDOWN_MS,
    remainingMs,
    resetAtMs: remainingMs > 0 ? resetAtMs : null,
    canSend: remainingMs <= 0,
  };
}

module.exports = {
  AI_MESSAGE_LIMIT,
  AI_WINDOW_HOURS,
  GLOBAL_CHAT_COOLDOWN_MS,
  hasUnlimitedAccess,
  getAiQuota,
  getGlobalChatCooldown,
};
