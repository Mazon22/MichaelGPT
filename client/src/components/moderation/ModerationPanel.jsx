import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Ban, Eye, Shield, ShieldCheck, UserRoundCheck, UserRoundX, X } from 'lucide-react';
import api from '../../utils/api';
import UserProfileCard from './UserProfileCard';
import './ModerationPanel.css';

function canModerate(role) {
  return role === 'moderator' || role === 'owner';
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

export default function ModerationPanel({ isOpen, onClose, currentUser }) {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [error, setError] = useState('');

  const isOwner = currentUser?.role === 'owner';

  const fetchUsers = async () => {
    const { data } = await api.get('/mod/users');
    setUsers(data.users || []);
  };

  const fetchLogs = async () => {
    const { data } = await api.get('/mod/audit');
    setLogs(data.logs || []);
  };

  useEffect(() => {
    if (!isOpen || !canModerate(currentUser?.role)) return;

    (async () => {
      setLoading(true);
      try {
        await Promise.all([fetchUsers(), fetchLogs()]);
        setError('');
      } catch (_error) {
        setError('Не удалось загрузить данные модерации');
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) => {
        const roleScore = { owner: 3, moderator: 2, user: 1 };
        return (roleScore[b.role] || 0) - (roleScore[a.role] || 0) || b.id - a.id;
      }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedUsers;
    return sortedUsers.filter((user) => {
      const role = String(user.role || '').toLowerCase();
      return (
        String(user.name || '').toLowerCase().includes(q) ||
        String(user.email || '').toLowerCase().includes(q) ||
        role.includes(q)
      );
    });
  }, [sortedUsers, search]);

  const safeAction = async (action) => {
    try {
      await action();
      await Promise.all([fetchUsers(), fetchLogs()]);
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Операция не выполнена');
    }
  };

  const toggleVerify = (user) =>
    safeAction(() => api.patch(`/mod/users/${user.id}/verify`, { verified: !user.isVerified }));

  const toggleRole = (user) => {
    const nextRole = user.role === 'moderator' ? 'user' : 'moderator';
    return safeAction(() => api.patch(`/mod/users/${user.id}/role`, { role: nextRole }));
  };

  const banOrUnban = (user) => {
    if (user.activeBanId) {
      return safeAction(() => api.post(`/mod/users/${user.id}/unban`));
    }
    return safeAction(() => api.post(`/mod/users/${user.id}/ban`, { reason: 'Нарушение правил чата' }));
  };

  const openProfile = async (userId) => {
    try {
      const { data } = await api.get(`/mod/users/${userId}/profile`);
      setSelectedProfile(data);
    } catch (_error) {
      setError('Не удалось открыть профиль');
    }
  };

  const deleteAccount = (userId) =>
    safeAction(async () => {
      await api.delete(`/mod/users/${userId}`);
      setSelectedProfile(null);
    });

  if (!canModerate(currentUser?.role)) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="mod-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.section
            className="mod-panel"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97 }}
          >
            <header className="mod-header">
              <div>
                <strong>Панель модерации</strong>
                <span>Управление участниками и аудит действий</span>
              </div>
              <button onClick={onClose}>
                <X size={16} />
              </button>
            </header>

            <div className="mod-tabs">
              <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')}>
                Участники
              </button>
              <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>
                Аудит
              </button>
            </div>

            {tab === 'users' && (
              <div className="mod-search-wrap">
                <input
                  className="mod-search"
                  type="text"
                  placeholder="Поиск: имя, email, роль..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}

            {error ? <div className="mod-error">{error}</div> : null}

            <div className="mod-content">
              {loading ? (
                <div className="mod-empty">Загрузка...</div>
              ) : tab === 'users' ? (
                <div className="mod-users-list">
                  {filteredUsers.map((user) => (
                    <article key={user.id} className="mod-user-row">
                      <div className="mod-user-main">
                        <div className="mod-user-name-row">
                          <span className="mod-user-avatar">
                            {user.avatarUrl || user.avatar_url ? (
                              <img src={user.avatarUrl || user.avatar_url} alt={user.name || 'Avatar'} />
                            ) : (
                              <span className="mod-user-avatar-placeholder">{user.name?.[0] || '?'}</span>
                            )}
                          </span>
                          <strong>{user.name}</strong>
                        </div>
                        <span>{user.email}</span>
                        <div className="mod-user-tags">
                          <i>{user.role}</i>
                          {Number(user.isVerified) === 1 && (
                            <i className="verified">
                              <BadgeCheck size={11} />
                              verified
                            </i>
                          )}
                          <i className={user.isOnline ? 'online' : 'offline'}>
                            {user.isOnline ? 'онлайн' : `был: ${formatLastSeen(user.lastSeenAtMs)}`}
                          </i>
                          {user.activeBanId ? (
                            <i className="banned">ban: {user.bannedByName}</i>
                          ) : null}
                        </div>
                      </div>
                      <div className="mod-user-actions">
                        <button onClick={() => openProfile(user.id)} title="Профиль">
                          <Eye size={14} />
                        </button>
                        {isOwner && (
                          <button onClick={() => toggleVerify(user)} title="/ ">
                            <UserRoundCheck size={14} />
                          </button>
                        )}
                        {isOwner && user.role !== 'owner' && (
                          <button onClick={() => toggleRole(user)} title="Выдать/снять модератора">
                            <ShieldCheck size={14} />
                          </button>
                        )}
                        {user.role !== 'owner' && (
                          <button onClick={() => banOrUnban(user)} title="Бан/разбан">
                            {user.activeBanId ? <UserRoundX size={14} /> : <Ban size={14} />}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {!filteredUsers.length && <div className="mod-empty">Ничего не найдено</div>}
                </div>
              ) : (
                <div className="mod-audit-list">
                  {logs.map((log) => (
                    <article key={log.id} className="mod-audit-row">
                      <div className="line-1">
                        <Shield size={12} />
                        <strong>{log.actorName}</strong>
                        <span>{log.action}</span>
                        {log.targetUserName ? <b>{log.targetUserName}</b> : null}
                      </div>
                      <div className="line-2">
                        <time>{new Date(log.createdAt).toLocaleString('ru-RU')}</time>
                      </div>
                    </article>
                  ))}
                  {!logs.length && <div className="mod-empty">Логов пока нет</div>}
                </div>
              )}
            </div>

            <UserProfileCard
              profile={selectedProfile}
              onClose={() => setSelectedProfile(null)}
              canDeleteAccount={isOwner && selectedProfile?.user?.role !== 'owner'}
              onDeleteAccount={deleteAccount}
            />
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}

