export const CHAT_FILE_ACCEPT = '.pdf,.txt,.docx,.csv,.json,.png,.jpg,.jpeg';
export const MAX_CHAT_ATTACHMENTS = 5;
export const MAX_CHAT_FILE_SIZE = 10 * 1024 * 1024;

export function createAttachmentFingerprint(file) {
  return [file.name, file.size, file.lastModified].join(':');
}

export function formatFileSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

export function isImageAttachment(attachment) {
  return String(attachment?.mimeType || '').startsWith('image/');
}

export function buildAttachmentPreview(content) {
  const text = String(content || '').trim();
  if (!text) return '';
  return text.length > 240 ? `${text.slice(0, 240).trimEnd()}...` : text;
}

export function createLocalUploadingAttachment(file) {
  const fingerprint = createAttachmentFingerprint(file);
  const viewUrl = URL.createObjectURL(file);

  return {
    id: `upload-${fingerprint}`,
    fingerprint,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    kind: isImageAttachment({ mimeType: file.type }) ? 'image' : 'file',
    content: '',
    previewText: '',
    truncated: false,
    originalLength: 0,
    status: 'uploading',
    progress: 0,
    error: '',
    viewUrl,
  };
}

export function mergeUploadedAttachment(localAttachment, uploadedFile) {
  return {
    ...localAttachment,
    id: uploadedFile.id || localAttachment.id,
    filename: uploadedFile.filename || localAttachment.filename,
    mimeType: uploadedFile.mimeType || localAttachment.mimeType,
    size: uploadedFile.size || localAttachment.size,
    kind: uploadedFile.kind || localAttachment.kind,
    content: uploadedFile.content || '',
    previewText: buildAttachmentPreview(uploadedFile.content),
    truncated: Boolean(uploadedFile.truncated),
    originalLength: Number(uploadedFile.originalLength) || 0,
    status: 'ready',
    progress: 100,
    error: '',
  };
}

export function serializeAttachmentForRequest(attachment) {
  return {
    id: attachment.id,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    kind: attachment.kind,
    content: attachment.content,
    truncated: attachment.truncated,
    originalLength: attachment.originalLength,
  };
}

export function normalizeMessageAttachment(attachment) {
  return {
    id: attachment.id || attachment.filename,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    kind: attachment.kind || 'file',
    content: attachment.content || '',
    previewText: buildAttachmentPreview(attachment.content),
    truncated: Boolean(attachment.truncated),
    originalLength: Number(attachment.originalLength) || String(attachment.content || '').length,
    status: 'ready',
    progress: 100,
    error: '',
  };
}

export function normalizeMessageAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments.map(normalizeMessageAttachment);
}

export function revokeAttachmentUrls(attachments) {
  attachments.forEach((attachment) => {
    if (attachment?.viewUrl) {
      URL.revokeObjectURL(attachment.viewUrl);
    }
  });
}
