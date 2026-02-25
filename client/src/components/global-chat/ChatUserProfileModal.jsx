import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Crown, MessageSquare, Shield, User, X } from 'lucide-react';
import './ChatUserProfileModal.css';

function roleLabel(role) {
  if (role === 'owner') return 'OWNER';
  if (role === 'moderator') return 'MOD';
  return 'USER';
}

function roleIcon(role) {
  if (role === 'owner') return <Crown size={12} />;
  if (role === 'moderator') return <Shield size={12} />;
  return <User size={12} />;
}

function formatLastSeen(lastSeenAtMs) {
  if (!lastSeenAtMs) return '—';
  return new Date(lastSeenAtMs).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ChatUserProfileModal({ isOpen, profile, onClose }) {
  const progressPercent =
    profile && profile.level < 100 ? Math.min((profile.xpProgress / 150) * 100, 100) : 100;
  const avatarUrl = profile?.avatarUrl || profile?.avatar_url || null;
  const isOnline = profile?.isOnline === true || Number(profile?.isOnline) === 1;

  return (
    <AnimatePresence>
      {isOpen && profile && (
        <>
          <motion.div
            className="gc-profile-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="gc-profile-modal"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
          >
            <button className="gc-profile-close" onClick={onClose}>
              <X size={14} />
            </button>

            <div className="gc-profile-head">
              <div className="gc-profile-avatar-wrap">
                <div className="gc-profile-avatar">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={profile.name || 'Avatar'} />
                  ) : (
                    <User size={24} />
                  )}
                </div>
              </div>

              <div className="gc-profile-name-row">
                <h4>{profile.name}</h4>
                <span className={`gc-role ${profile.role || 'user'}`}>
                  {roleIcon(profile.role)}
                  <span>{roleLabel(profile.role)}</span>
                </span>
                {Number(profile.isVerified) === 1 && (
                  <span className="gc-verified" title="Подтвержденный">
                    <BadgeCheck size={13} />
                  </span>
                )}
              </div>

              <p className="gc-profile-date">
                С нами: {new Date(profile.createdAt).toLocaleDateString('ru-RU')}
              </p>

              <p className="gc-profile-status">
                {isOnline ? (
                  <span className="gc-status-online">
                    <i className="gc-status-dot" />
                    Онлайн
                  </span>
                ) : (
                  <span className="gc-status-offline">Был(а): {formatLastSeen(profile.lastSeenAtMs)}</span>
                )}
              </p>
            </div>

            <div className="gc-profile-stats">
              <div className="gc-rank-pill">
                <span>Ранг: {profile.rank}</span>
                <span>#{profile.worldRank} в мире</span>
              </div>

              <div className="gc-level-row">
                <span>Уровень {profile.level}</span>
                <span>{profile.xp} XP</span>
              </div>

              <div className="gc-progress-track">
                <motion.div
                  className="gc-progress-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>

              {profile.level < 100 && (
                <div className="gc-next-level">+{profile.xpToNextLevel} XP до следующего уровня</div>
              )}

              <div className="gc-profile-grid">
                <div className="gc-stat-card">
                  <MessageSquare size={14} />
                  <b>{profile.globalMessages}</b>
                  <span>В глобальном</span>
                </div>
                <div className="gc-stat-card">
                  <MessageSquare size={14} />
                  <b>{profile.totalMessages}</b>
                  <span>Всего сообщ.</span>
                </div>
                <div className="gc-stat-card">
                  <Shield size={14} />
                  <b>{roleLabel(profile.role)}</b>
                  <span>Статус</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
