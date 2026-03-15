import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bug, Eye, EyeOff, Paperclip, Sparkles, Star, X } from 'lucide-react';
import {
  CURRENT_UPDATE_VERSION,
  UPDATE_MODAL_DISABLE_KEY,
  UPDATE_MODAL_SEEN_VERSION_KEY,
  UPDATES,
} from '../utils/updateAnnouncements';

const ICONS_BY_KEY = {
  bug: <Bug size={18} />,
  paperclip: <Paperclip size={20} />,
  sparkles: <Sparkles size={20} />,
};

export default function UpdateModal({ isOpen, onClose }) {
  const [disableUpdates, setDisableUpdates] = useState(false);

  useEffect(() => {
    const isDisabled = localStorage.getItem(UPDATE_MODAL_DISABLE_KEY);
    setDisableUpdates(Boolean(isDisabled));
  }, []);

  useEffect(() => {
    if (isOpen) {
      localStorage.setItem(UPDATE_MODAL_SEEN_VERSION_KEY, CURRENT_UPDATE_VERSION);
    }
  }, [isOpen]);

  const handleToggleDisable = () => {
    const nextValue = !disableUpdates;
    setDisableUpdates(nextValue);

    if (nextValue) {
      localStorage.setItem(UPDATE_MODAL_DISABLE_KEY, 'true');
    } else {
      localStorage.removeItem(UPDATE_MODAL_DISABLE_KEY);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="update-backdrop"
            className="update-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          >
            <motion.div
              key="update-modal"
              className="update-modal"
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              transition={{ type: 'spring', damping: 22, stiffness: 300 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="update-modal-header">
                <div className="update-modal-title-row">
                  <Sparkles size={24} className="update-modal-icon" />
                  <h2 className="update-modal-title">Обновления</h2>
                </div>
                <div className="update-modal-header-actions">
                  <button className="update-modal-toggle-small" onClick={handleToggleDisable}>
                    {disableUpdates ? (
                      <>
                        <Eye size={14} />
                        <span>Включить</span>
                      </>
                    ) : (
                      <>
                        <EyeOff size={14} />
                        <span>Не показывать</span>
                      </>
                    )}
                  </button>
                  <button className="update-modal-close" onClick={onClose}>
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="update-modal-content">
                <div className="updates-list">
                  {UPDATES.map((update, index) => (
                    <div key={index} className="update-item">
                      <div className="update-item-header">
                        <span className="update-item-icon">{ICONS_BY_KEY[update.icon] ?? <Sparkles size={20} />}</span>
                        <div className="update-item-info">
                          <span className="update-item-date">{update.date}</span>
                          <span className="update-item-title">{update.title}</span>
                        </div>
                      </div>
                      <ul className="update-item-list">
                        {update.changes.map((change, changeIndex) => (
                          <li key={changeIndex}>{change}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="update-modal-footer">
                  <Star size={16} />
                  <span>Хорошего времяпрепровождения на сайте!</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
