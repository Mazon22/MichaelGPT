import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import { X, User, Zap, MessageSquare, Globe, Calendar, BadgeCheck } from 'lucide-react';
import api from '../utils/api';

const RANK_NAMES = [
  'Новичок',
  'Активный',
  'Знающий',
  'Продвинутый',
  'Аналитик',
  'Интеллектуал',
  'Визионер',
  'Лидер',
  'Стратег',
  'Тактик',
  'Элита',
  'Авторитет',
  'Мудрец',
  'Гений',
  'Виртуоз',
  'Титан',
  'Магистр',
  'Феномен',
  'Легенда',
  'Грандмастер',
  'Император',
];

const RANK_ICON_LIST = [
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22V12"/>
      <path d="M12 12C12 7 7 4 3 5c0 4 3 7 9 7z"/>
      <path d="M12 12C12 7 17 4 21 5c0 4-3 7-9 7z"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="10" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="8" cy="10" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="16" cy="10" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 22 8.5 12 15 2 8.5 12 2"/>
      <path d="M6 12v5c0 2 3 4 6 4s6-2 6-4v-5"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7"/>
      <path d="m21 21-4.35-4.35"/>
      <path d="M8 11h6M11 8v6" strokeWidth="2.5"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v.5a3 3 0 0 0-3 3 3 3 0 0 0 .6 1.8A4 4 0 0 0 4 12a4 4 0 0 0 2 3.5V17a3 3 0 0 0 3 3h1"/>
      <path d="M14.5 2A2.5 2.5 0 0 1 17 4.5v.5a3 3 0 0 1 3 3 3 3 0 0 1-.6 1.8A4 4 0 0 1 20 12a4 4 0 0 1-2 3.5V17a3 3 0 0 1-3 3h-1"/>
      <path d="M10 20h4"/>
      <path d="M10 17h4"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19 4l1.5-1.5M21 8l1.5-.5" strokeWidth="1.5"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="13" width="4" height="8" rx="1"/>
      <rect x="10" y="8" width="4" height="13" rx="1"/>
      <rect x="17" y="3" width="4" height="18" rx="1"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12l4 6-10 13L2 9z"/>
      <path d="M2 9h20M12 3l4 6-4 13-4-13 4-6"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polygon points="12 8 13.3 11 17 11.4 14.5 13.8 15.2 17.5 12 15.8 8.8 17.5 9.5 13.8 7 11.4 10.7 11 12 8" fill="currentColor" stroke="none"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <circle cx="12" cy="12" r="6"/>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeWidth="1.5"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2A2.5 2.5 0 0 0 7 4.5v.5a3 3 0 0 0-3 3 3 3 0 0 0 .6 1.8A4 4 0 0 0 4 12a4 4 0 0 0 2 3.5V17a3 3 0 0 0 3 3h1"/>
      <path d="M14.5 2A2.5 2.5 0 0 1 17 4.5v.5a3 3 0 0 1 3 3 3 3 0 0 1-.6 1.8A4 4 0 0 1 20 12a4 4 0 0 1-2 3.5V17a3 3 0 0 1-3 3h-1"/>
      <path d="M10 20h4"/>
      <path d="M10 17h4"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20 L12 4 L21 20 Z"/>
      <path d="M3 20h18"/>
      <path d="M6.5 14h11"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="12" y2="17"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" fill="currentColor" stroke="none"/>
      <path d="M4 20l3-8" strokeWidth="1.5" opacity="0.6"/>
      <path d="M3 22l2-6" strokeWidth="1" opacity="0.4"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 12c-2-2.5-4-4-6-4a4 4 0 0 0 0 8c2 0 4-1.5 6-4z"/>
      <path d="M12 12c2 2.5 4 4 6 4a4 4 0 0 0 0-8c-2 0-4 1.5-6 4z"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"/>
    </svg>
  ),
  (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 19h20v2H2z" fill="currentColor" stroke="none"/>
      <path d="M2 19L5 8l5 5 2-6 2 6 5-5 3 11H2z"/>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="5.5" cy="10.5" r="1" fill="currentColor" stroke="none"/>
      <circle cx="18.5" cy="10.5" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
];

const RANK_ICONS = Object.fromEntries(
  RANK_NAMES.map((name, index) => [name, RANK_ICON_LIST[index]])
);

const RANKS = {
  1: 'Новичок', 5: 'Активный', 10: 'Знающий', 15: 'Продвинутый',
  20: 'Аналитик', 25: 'Интеллектуал', 30: 'Визионер', 35: 'Лидер',
  40: 'Стратег', 45: 'Тактик', 50: 'Элита', 55: 'Авторитет',
  60: 'Мудрец', 65: 'Гений', 70: 'Виртуоз', 75: 'Титан',
  80: 'Магистр', 85: 'Феномен', 90: 'Легенда', 95: 'Грандмастер',
  100: 'Император',
};

function getRankName(level) {
  const thresholds = Object.keys(RANKS).map(Number).filter((k) => k <= level);
  return RANKS[Math.max(...thresholds)];
}

function getRankColor(level) {
  if (level >= 95) return '#ffd700';
  if (level >= 75) return '#e879f9';
  if (level >= 55) return '#38bdf8';
  if (level >= 35) return '#34d399';
  if (level >= 15) return '#818cf8';
  return '#a1a1aa';
}

export default function ProfileModal({ isOpen, onClose, user, stats, isLoading, modalRef, updateUser }) {
  const level = stats?.level ?? 1;
  const xp = stats?.xp ?? 0;
  const xpProgress = stats?.xpProgress ?? 0;
  const xpToNextLevel = stats?.xpToNextLevel ?? 150;
  const progressPercent = level < 100 ? (xpProgress / 150) * 100 : 100;
  const rankName = getRankName(level);
  const rankColor = getRankColor(level);
  const rankIcon = RANK_ICONS[rankName] || RANK_ICONS['Новичок'];
  const isAdmin = user?.role === 'owner';
  const memberSinceLabel = stats?.memberSince
    ? new Intl.DateTimeFormat('ru-RU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
        .format(new Date(stats.memberSince))
        .replace(' ?.', '')
    : '—';
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  useEffect(() => {
    if (imageSrc) {
      document.body.classList.add('cropper-open');
    } else {
      document.body.classList.remove('cropper-open');
    }
    return () => document.body.classList.remove('cropper-open');
  }, [imageSrc]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 250 * 1024) return;

    try {
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('file_read_failed'));
        reader.readAsDataURL(file);
      });
      setImageSrc(String(dataUrl));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    } catch (_error) {
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCropComplete = (_croppedArea, croppedPixels) => {
    setCroppedAreaPixels(croppedPixels);
  };

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (err) => reject(err));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImage = async (source, cropPixels) => {
    const image = await createImage(source);
    const canvas = document.createElement('canvas');
    canvas.width = cropPixels.width;
    canvas.height = cropPixels.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(
      image,
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height,
      0,
      0,
      cropPixels.width,
      cropPixels.height
    );
    let quality = 0.9;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    while (dataUrl.length > 340000 && quality > 0.5) {
      quality -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', quality);
    }
    return dataUrl;
  };

  const handleCropCancel = () => {
    setImageSrc(null);
    setCroppedAreaPixels(null);
  };

  const handleCropSave = async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    setAvatarUploading(true);
    try {
      const dataUrl = await getCroppedImage(imageSrc, croppedAreaPixels);
      const { data } = await api.post('/user/avatar', { dataUrl });
      updateUser?.({ avatarUrl: data?.avatarUrl || dataUrl });
      setImageSrc(null);
      setCroppedAreaPixels(null);
    } catch (_error) {
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="profile-backdrop"
            className="profile-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            key="profile-modal"
            ref={modalRef}
            className="profile-modal"
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
          >
            <button className="profile-modal-close" onClick={onClose}>
              <X size={18} />
            </button>

            {isLoading ? (
              <div className="profile-modal-loading">
                <div className="profile-loading-spinner" />
                <span>Загрузка профиля...</span>
              </div>
            ) : (
              <>
                <div className="profile-avatar-section">
                  <div
                    className="profile-avatar-large"
                    style={{ '--rank-color': rankColor }}
                  >
                    {user?.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user?.name || 'Avatar'} />
                    ) : (
                      <User size={40} />
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="profile-avatar-input"
                    onChange={handleAvatarChange}
                  />
                  <button
                    className="profile-avatar-action"
                    onClick={handleAvatarClick}
                    disabled={avatarUploading}
                  >
                    {avatarUploading ? 'Загрузка...' : 'Изменить аватар'}
                  </button>
                  {imageSrc && (
                    <div className="profile-cropper">
                      <div className="profile-cropper-area">
                        <Cropper
                          image={imageSrc}
                          crop={crop}
                          zoom={zoom}
                          aspect={1}
                          onCropChange={setCrop}
                          onZoomChange={setZoom}
                          onCropComplete={handleCropComplete}
                        />
                      </div>
                      <div className="profile-cropper-controls">
                        <input
                          type="range"
                          min={1}
                          max={3}
                          step={0.05}
                          value={zoom}
                          onChange={(e) => setZoom(Number(e.target.value))}
                        />
                        <div className="profile-cropper-actions">
                          <button onClick={handleCropSave} disabled={avatarUploading}>
                            Сохранить
                          </button>
                          <button onClick={handleCropCancel} disabled={avatarUploading}>
                            Отмена
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="profile-username-row">
                    <h2 className="profile-username">{user?.name}</h2>
                    {isAdmin && (
                      <span className="profile-admin-badge" title="Администратор MichaelGPT">
                        <BadgeCheck size={14} />
                      </span>
                    )}
                  </div>
                  <p className="profile-email">{user?.email}</p>
                </div>

                <div className="profile-rank-row">
                  <span className="profile-rank-icon" style={{ color: rankColor }}>
                    {rankIcon}
                  </span>
                  <div className="profile-rank-info">
                    <span className="profile-rank-name" style={{ color: rankColor }}>
                      {rankName}
                    </span>
                    <span className="profile-level">Уровень {level}</span>
                  </div>
                </div>

                <div className="profile-xp-section">
                  <div className="profile-xp-label">
                    <Zap size={14} color={rankColor} />
                    <span>{xp} XP</span>
                    {level < 100 && (
                      <span className="profile-xp-next">+{xpToNextLevel} до ур. {level + 1}</span>
                    )}
                  </div>
                  <div className="profile-xp-bar-track">
                    <motion.div
                      className="profile-xp-bar-fill"
                      style={{ '--rank-color': rankColor }}
                      initial={{ width: 0 }}
                      animate={{ width: `${progressPercent}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                    />
                  </div>
                </div>

                <div className="profile-stats-grid">
                  <div className="profile-stat-card">
                    <MessageSquare size={20} color="var(--primary-light)" />
                    <span className="profile-stat-value">{stats?.totalMessages ?? 0}</span>
                    <span className="profile-stat-label">Сообщений</span>
                  </div>
                  <div className="profile-stat-card">
                    <Globe size={20} color={rankColor} />
                    <span className="profile-stat-value">#{stats?.worldRank ?? '—'}</span>
                    <span className="profile-stat-label">в мире</span>
                  </div>
                  <div className="profile-stat-card">
                    <Calendar size={20} color="#f59e0b" />
                    <span className="profile-stat-value profile-stat-date">
                      {memberSinceLabel}
                    </span>
                    <span className="profile-stat-label">С нами с</span>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
