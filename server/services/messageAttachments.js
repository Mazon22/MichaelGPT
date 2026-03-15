const { MAX_FILE_TEXT_CHARS, sanitizeFileName } = require('./fileUploadService');

const MAX_ATTACHMENTS_PER_MESSAGE = 5;

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function sanitizeAttachmentContent(value) {
  const normalized = String(value || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();

  if (normalized.length <= MAX_FILE_TEXT_CHARS) {
    return {
      content: normalized,
      truncated: false,
      originalLength: normalized.length,
    };
  }

  return {
    content: `${normalized.slice(0, MAX_FILE_TEXT_CHARS).trimEnd()}\n...[truncated]`,
    truncated: true,
    originalLength: normalized.length,
  };
}

function normalizeAttachmentsInput(value) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
    .map((attachment) => {
      const sanitized = sanitizeAttachmentContent(attachment?.content);
      return {
        id: String(attachment?.id || '').slice(0, 64),
        filename: sanitizeFileName(attachment?.filename || 'attachment'),
        mimeType: String(attachment?.mimeType || 'application/octet-stream').slice(0, 120),
        size: Number(attachment?.size) || 0,
        kind: String(attachment?.kind || 'file').slice(0, 24),
        content: sanitized.content,
        truncated: Boolean(attachment?.truncated || sanitized.truncated),
        originalLength: Number(attachment?.originalLength) || sanitized.originalLength,
      };
    })
    .filter((attachment) => attachment.filename && attachment.content);
}

function parseAttachmentsJson(value) {
  const attachments = safeJsonParse(value, []);
  return normalizeAttachmentsInput(attachments);
}

function serializeAttachments(attachments) {
  const normalized = normalizeAttachmentsInput(attachments);
  return normalized.length ? JSON.stringify(normalized) : null;
}

function buildPromptAttachmentBlock(attachments) {
  if (!attachments.length) return '';

  return attachments
    .map((attachment, index) => {
      const parts = [
        `Attachment ${index + 1}: ${attachment.filename}`,
        `Type: ${attachment.mimeType || attachment.kind}`,
        `Content:`,
        attachment.content,
      ];

      return parts.join('\n');
    })
    .join('\n\n');
}

function buildMessagePromptContent(message) {
  const attachments = Array.isArray(message.attachments)
    ? message.attachments
    : parseAttachmentsJson(message.attachments_json || message.attachmentsJson);
  const textContent = String(message.content || '').trim();
  const attachmentBlock = buildPromptAttachmentBlock(attachments);

  if (!attachmentBlock) {
    return textContent;
  }

  if (!textContent) {
    return `User attached files for analysis.\n\n${attachmentBlock}`;
  }

  return `${textContent}\n\nAttached files:\n${attachmentBlock}`;
}

function mapMessageRow(row) {
  const attachments = parseAttachmentsJson(row.attachments_json || row.attachmentsJson);
  return {
    ...row,
    attachments,
  };
}

module.exports = {
  MAX_ATTACHMENTS_PER_MESSAGE,
  buildMessagePromptContent,
  mapMessageRow,
  normalizeAttachmentsInput,
  parseAttachmentsJson,
  serializeAttachments,
};
