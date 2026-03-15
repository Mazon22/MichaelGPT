import { AnimatePresence, motion } from 'framer-motion';
import { FileText, ImageIcon, X } from 'lucide-react';
import { getAttachmentTypeLabel, isImageAttachment } from '../utils/chatAttachments';

export default function AttachmentPreviewModal({ attachment, onClose }) {
  const isImage = attachment && isImageAttachment(attachment) && attachment.viewUrl;

  return (
    <AnimatePresence>
      {attachment && (
        <motion.div
          className="attachment-preview-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            className="attachment-preview-modal"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="attachment-preview-header">
              <div>
                <div className="attachment-preview-title">
                  {isImage ? <ImageIcon size={18} /> : <FileText size={18} />}
                  <strong>{attachment.filename}</strong>
                </div>
                <span>{getAttachmentTypeLabel(attachment)}</span>
              </div>
              <button type="button" className="attachment-preview-close" onClick={onClose}>
                <X size={16} />
              </button>
            </header>

            <div className={`attachment-preview-content ${isImage ? 'image' : ''}`}>
              {isImage ? (
                <img src={attachment.viewUrl} alt={attachment.filename} className="attachment-preview-image" />
              ) : (
                <pre>{attachment.content || 'Пустое содержимое'}</pre>
              )}
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
