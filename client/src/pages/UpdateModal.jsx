import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Bug, Palette, Zap, Star, EyeOff, Eye } from 'lucide-react';

const UPDATES = [
  {
    date: '02.03.2026',
    title: 'Глобальное обновление дизайна',
    icon: <Sparkles size={20} />,
    changes: [
      'Полностью переработан дизайн чата: стеклянные панели с backdrop-blur и градиентами',
      'Анимированная нижняя панель: shimmer-эффекты, пульсирующая кнопка отправки',
      'Улучшенная боковая панель: градиентный логотип с пульсацией, мерцающий badge',
      'Эффект печати сообщений: текст появляется постепенно, как в ChatGPT',
      'Улучшенные сообщения: градиентные аватары, переливающийся ник нейросети',
      'Глобальный чат: обновлённый дизайн панели и кнопки',
      'Квота AI: анимированный прогресс-бар с вращающимся фоном',
      'Улучшенная форма профиля: аватар, имя и почта в едином стиле',
      'Dropdown меню: с вращающимся conic-градиентом',
      'Кастомные скроллбары с градиентной темой',
    ],
  },
  {
    date: '26.02.2026',
    title: 'Исправление ошибок и улучшение профиля',
    icon: <Bug size={18} />,
    changes: [
      'Исправлен баг: опыт теперь сохраняется после удаления чатов',
      'Обновлён профиль: компактный вид с основной статистикой',
    ],
  },
];

const STORAGE_KEY = 'michaelgpt_last_update_seen';
const STORAGE_DISABLE_KEY = 'michaelgpt_disable_updates';

export default function UpdateModal({ isOpen, onClose }) {
  const [disableUpdates, setDisableUpdates] = useState(false);

  useEffect(() => {
    const isDisabled = localStorage.getItem(STORAGE_DISABLE_KEY);
    setDisableUpdates(Boolean(isDisabled));
  }, []);

  useEffect(() => {
    if (isOpen) {
      localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    }
  }, [isOpen]);

  const handleToggleDisable = () => {
    const newValue = !disableUpdates;
    setDisableUpdates(newValue);
    if (newValue) {
      localStorage.setItem(STORAGE_DISABLE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_DISABLE_KEY);
    }
  };

  const latestUpdate = UPDATES[0];

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
              onClick={(e) => e.stopPropagation()}
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
                        <span className="update-item-icon">{update.icon}</span>
                        <div className="update-item-info">
                          <span className="update-item-date">{update.date}</span>
                          <span className="update-item-title">{update.title}</span>
                        </div>
                      </div>
                      <ul className="update-item-list">
                        {update.changes.map((change, i) => (
                          <li key={i}>{change}</li>
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
