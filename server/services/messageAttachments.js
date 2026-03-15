const { MAX_FILE_TEXT_CHARS, sanitizeFileName } = require('./fileUploadService');

const MAX_ATTACHMENTS_PER_MESSAGE = 5;
const MAX_IMAGE_DATA_URL_LENGTH = 14 * 1024 * 1024;

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

function sanitizeImageDataUrl(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length > MAX_IMAGE_DATA_URL_LENGTH) return '';

  const isSupportedImageDataUrl = /^data:image\/(?:png|jpeg|jpg);base64,[a-z0-9+/=\r\n]+$/i.test(normalized);
  return isSupportedImageDataUrl ? normalized : '';
}

function isImageAttachment(attachment) {
  return String(attachment?.mimeType || '').startsWith('image/') || attachment?.kind === 'image';
}

function normalizeAttachmentsInput(value) {
  if (!Array.isArray(value)) return [];

  return value
    .slice(0, MAX_ATTACHMENTS_PER_MESSAGE)
    .map((attachment) => {
      const sanitized = sanitizeAttachmentContent(attachment?.content);
      const imageDataUrl = sanitizeImageDataUrl(attachment?.imageDataUrl);
      const mimeType = String(attachment?.mimeType || 'application/octet-stream').slice(0, 120);
      const kind = String(attachment?.kind || 'file').slice(0, 24);

      return {
        id: String(attachment?.id || '').slice(0, 64),
        filename: sanitizeFileName(attachment?.filename || 'attachment'),
        mimeType,
        size: Number(attachment?.size) || 0,
        kind,
        content: sanitized.content,
        truncated: Boolean(attachment?.truncated || sanitized.truncated),
        originalLength: Number(attachment?.originalLength) || sanitized.originalLength,
        imageDataUrl,
      };
    })
    .filter((attachment) => attachment.filename && (attachment.content || attachment.imageDataUrl));
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
      const lines = [
        `Attachment ${index + 1}: ${attachment.filename}`,
        `Type: ${attachment.mimeType || attachment.kind}`,
      ];

      if (isImageAttachment(attachment)) {
        lines.push('Image attached for visual analysis.');
        if (attachment.content) {
          lines.push('Extracted text from image:');
          lines.push(attachment.content);
        }
      } else {
        lines.push('Content:');
        lines.push(attachment.content);
      }

      return lines.join('\n');
    })
    .join('\n\n');
}

function buildMessagePromptContent(message) {
  const attachments = Array.isArray(message.attachments)
    ? normalizeAttachmentsInput(message.attachments)
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

function buildResponsesMessageInput(message) {
  const attachments = Array.isArray(message.attachments)
    ? normalizeAttachmentsInput(message.attachments)
    : parseAttachmentsJson(message.attachments_json || message.attachmentsJson);
  const textContent = buildMessagePromptContent(message);
  const role = message.role === 'assistant' ? 'assistant' : 'user';
  const imageAttachments = attachments.filter((attachment) => attachment.imageDataUrl);

  const content = [];

  if (textContent) {
    content.push({
      type: 'input_text',
      text: textContent,
    });
  }

  imageAttachments.forEach((attachment) => {
    content.push({
      type: 'input_image',
      image_url: attachment.imageDataUrl,
    });
  });

  if (!content.length) {
    content.push({
      type: 'input_text',
      text: '',
    });
  }

  return {
    role,
    content,
  };
}

function historyHasVisionAttachments(messages) {
  return messages.some((message) => {
    const attachments = Array.isArray(message.attachments)
      ? normalizeAttachmentsInput(message.attachments)
      : parseAttachmentsJson(message.attachments_json || message.attachmentsJson);

    return attachments.some((attachment) => attachment.imageDataUrl);
  });
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
  buildResponsesMessageInput,
  historyHasVisionAttachments,
  mapMessageRow,
  normalizeAttachmentsInput,
  parseAttachmentsJson,
  serializeAttachments,
};
