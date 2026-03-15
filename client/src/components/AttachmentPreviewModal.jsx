import { AnimatePresence, motion } from 'framer-motion';
import { FileText, X } from 'lucide-react';

export default function AttachmentPreviewModal({ attachment, onClose }) {
  return (
    <AnimatePresence>
      {attachment && (
        <>
          <motion.div
            className="attachment-preview-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            className="attachment-preview-modal"
            initial={{ opacity: 0, y: 18, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
          >
            <header className="attachment-preview-header">
              <div>
                <div className="attachment-preview-title">
                  <FileText size={18} />
                  <strong>{attachment.filename}</strong>
                </div>
                <span>{attachment.mimeType || attachment.kind}</span>
              </div>
              <button type="button" className="attachment-preview-close" onClick={onClose}>
                <X size={16} />
              </button>
            </header>

            <div className="attachment-preview-content">
              <pre>{attachment.content || 'Пустое содержимое'}</pre>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
