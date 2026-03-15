import { AlertCircle, File, FileSpreadsheet, FileText, ImageIcon, Loader2, X } from 'lucide-react';
import { formatFileSize, getAttachmentTypeLabel, isImageAttachment } from '../utils/chatAttachments';

function AttachmentIcon({ attachment }) {
  if (attachment.viewUrl && isImageAttachment(attachment)) {
    return <img className="chat-attachment-thumb" src={attachment.viewUrl} alt={attachment.filename} />;
  }

  if (isImageAttachment(attachment)) return <ImageIcon size={16} />;
  if (attachment.kind === 'csv') return <FileSpreadsheet size={16} />;
  if (attachment.kind === 'pdf' || attachment.kind === 'docx' || attachment.kind === 'txt' || attachment.kind === 'json') {
    return <FileText size={16} />;
  }

  return <File size={16} />;
}

function getAttachmentSubtitle(attachment) {
  if (attachment.status === 'uploading') {
    return `Загрузка ${attachment.progress}%`;
  }

  if (attachment.status === 'error') {
    return 'Ошибка загрузки';
  }

  return getAttachmentTypeLabel(attachment);
}

export default function ChatAttachmentList({
  attachments,
  variant = 'composer',
  onRemove,
  onPreview,
  onOpen,
}) {
  if (!attachments.length) return null;

  const openAttachment = (attachment) => {
    if (attachment.viewUrl && onOpen) {
      onOpen(attachment);
      return;
    }

    if (attachment.content && onPreview) {
      onPreview(attachment);
    }
  };

  return (
    <div className={`chat-attachment-list ${variant}`}>
      {attachments.map((attachment) => {
        const isUploading = attachment.status === 'uploading';
        const isError = attachment.status === 'error';
        const isImage = isImageAttachment(attachment);
        const canOpen = Boolean(onOpen && attachment.viewUrl);
        const canPreview = Boolean(onPreview && attachment.content);
        const isInteractive = !isUploading && !isError && (canOpen || canPreview);

        return (
          <article
            key={attachment.fingerprint || attachment.id}
            className={`chat-attachment-card ${variant} ${isImage ? 'image' : ''} ${isError ? 'error' : ''} ${isUploading ? 'uploading' : ''} ${isInteractive ? 'interactive' : ''}`}
            onClick={isInteractive ? () => openAttachment(attachment) : undefined}
            onKeyDown={
              isInteractive
                ? (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      openAttachment(attachment);
                    }
                  }
                : undefined
            }
            role={isInteractive ? 'button' : undefined}
            tabIndex={isInteractive ? 0 : undefined}
          >
            {variant === 'composer' && onRemove ? (
              <button
                type="button"
                className="chat-attachment-remove"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(attachment.id);
                }}
                aria-label={`Удалить файл ${attachment.filename}`}
                title="Удалить файл"
              >
                <X size={14} />
              </button>
            ) : null}

            <div className="chat-attachment-main">
              <span className="chat-attachment-icon">
                {isUploading ? <Loader2 size={16} className="spin" /> : <AttachmentIcon attachment={attachment} />}
              </span>
              <div className="chat-attachment-copy">
                <strong>{attachment.filename}</strong>
                <span>{getAttachmentSubtitle(attachment)}</span>
              </div>
              {variant !== 'composer' && !isUploading ? (
                <span className="chat-attachment-size">{formatFileSize(attachment.size)}</span>
              ) : null}
            </div>

            {isUploading ? (
              <div className="chat-attachment-progress">
                <div style={{ width: `${attachment.progress}%` }} />
              </div>
            ) : null}

            {attachment.error ? (
              <div className="chat-attachment-error">
                <AlertCircle size={14} />
                <span>{attachment.error}</span>
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
