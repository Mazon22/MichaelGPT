import { Calendar, Mail, MessageSquare, Shield, User, X } from 'lucide-react';

function formatLastSeen(lastSeenAtMs) {
  if (!lastSeenAtMs) return '—';
  return new Date(lastSeenAtMs).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UserProfileCard({ profile, onClose, canDeleteAccount, onDeleteAccount }) {
  if (!profile) return null;

  return (
    <div className="mod-user-profile">
      <div className="mod-user-profile-header">
        <strong>Профиль участника</strong>
        <button onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <div className="mod-user-profile-grid">
        <div><User size={13} /> {profile.user.name}</div>
        <div><Mail size={13} /> {profile.user.email}</div>
        <div><Shield size={13} /> Роль: {profile.user.role}</div>
        <div className="mod-user-status">
          <span className={profile.user.isOnline ? 'online' : 'offline'}>
            <i className="status-dot" />
            {profile.user.isOnline ? 'онлайн' : `был: ${formatLastSeen(profile.user.lastSeenAtMs)}`}
          </span>
        </div>
        <div><MessageSquare size={13} /> Сообщений: {profile.stats.totalMessages}</div>
        <div><Calendar size={13} /> С нами: {new Date(profile.user.createdAt).toLocaleDateString('ru-RU')}</div>
      </div>

      {canDeleteAccount && (
        <button className="mod-danger-btn" onClick={() => onDeleteAccount(profile.user.id)}>
          Удалить аккаунт
        </button>
      )}
    </div>
  );
}
