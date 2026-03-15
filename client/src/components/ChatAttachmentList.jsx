import { AlertCircle, Eye, File, FileSpreadsheet, FileText, ImageIcon, Loader2, Trash2 } from 'lucide-react';
import { formatFileSize, isImageAttachment } from '../utils/chatAttachments';

function AttachmentIcon({ attachment }) {
  if (isImageAttachment(attachment)) return <ImageIcon size={16} />;
  if (attachment.kind === 'csv') return <FileSpreadsheet size={16} />;
  if (attachment.kind === 'pdf' || attachment.kind === 'docx' || attachment.kind === 'txt' || attachment.kind === 'json') {
    return <FileText size={16} />;
  }
  return <File size={16} />;
}

export default function ChatAttachmentList({
  attachments,
  variant = 'composer',
  onRemove,
  onPreview,
  onOpen,
}) {
  if (!attachments.length) return null;

  return (
    <div className={`chat-attachment-list ${variant}`}>
      {attachments.map((attachment) => {
        const canOpen = Boolean(onOpen && attachment.viewUrl);
        const canPreview = Boolean(onPreview && attachment.content);
        const isUploading = attachment.status === 'uploading';
        const isError = attachment.status === 'error';

        return (
          <article
            key={attachment.fingerprint || attachment.id}
            className={`chat-attachment-card ${isError ? 'error' : ''} ${isUploading ? 'uploading' : ''}`}
          >
            <div className="chat-attachment-main">
              <span className="chat-attachment-icon">
                {isUploading ? <Loader2 size={16} className="spin" /> : <AttachmentIcon attachment={attachment} />}
              </span>
              <div className="chat-attachment-copy">
                <strong>{attachment.filename}</strong>
                <span>
                  {formatFileSize(attachment.size)}
                  {attachment.status === 'ready' ? ' · готово' : ''}
                  {isUploading ? ` · ${attachment.progress}%` : ''}
                  {isError ? ' · ошибка' : ''}
                </span>
              </div>
            </div>

            {attachment.previewText ? (
              <p className="chat-attachment-preview">{attachment.previewText}</p>
            ) : null}

            {isUploading && (
              <div className="chat-attachment-progress">
                <div style={{ width: `${attachment.progress}%` }} />
              </div>
            )}

            {attachment.error ? (
              <div className="chat-attachment-error">
                <AlertCircle size={14} />
                <span>{attachment.error}</span>
              </div>
            ) : null}

            <div className="chat-attachment-actions">
              {canOpen && (
                <button type="button" className="attachment-action-btn" onClick={() => onOpen(attachment)}>
                  <Eye size={14} />
                  Открыть
                </button>
              )}
              {canPreview && (
                <button type="button" className="attachment-action-btn" onClick={() => onPreview(attachment)}>
                  <FileText size={14} />
                  Текст
                </button>
              )}
              {variant === 'composer' && onRemove && (
                <button type="button" className="attachment-action-btn danger" onClick={() => onRemove(attachment.id)}>
                  <Trash2 size={14} />
                  Удалить
                </button>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
