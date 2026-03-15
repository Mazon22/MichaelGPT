import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  Ban,
  Database,
  Eye,
  HardDrive,
  RefreshCw,
  Shield,
  ShieldCheck,
  Trash2,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react';
import api from '../../utils/api';
import UserProfileCard from './UserProfileCard';
import './ModerationPanel.css';

function canModerate(role) {
  return role === 'moderator' || role === 'owner';
}

function formatLastSeen(lastSeenAtMs) {
  if (!lastSeenAtMs) return '-';
  return new Date(lastSeenAtMs).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function ModerationPanel({ isOpen, onClose, currentUser }) {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [storage, setStorage] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [storageActionLoading, setStorageActionLoading] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [error, setError] = useState('');

  const isOwner = currentUser?.role === 'owner';

  const fetchUsers = useCallback(async () => {
    const { data } = await api.get('/mod/users');
    setUsers(data.users || []);
  }, []);

  const fetchLogs = useCallback(async () => {
    const { data } = await api.get('/mod/audit');
    setLogs(data.logs || []);
  }, []);

  const fetchStorage = useCallback(async () => {
    if (!isOwner) return;
    const { data } = await api.get('/mod/storage');
    setStorage(data.storage || null);
  }, [isOwner]);

  const reloadPanelData = useCallback(async () => {
    const requests = [fetchUsers(), fetchLogs()];
    if (isOwner) {
      requests.push(fetchStorage());
    }
    await Promise.all(requests);
  }, [fetchLogs, fetchStorage, fetchUsers, isOwner]);

  useEffect(() => {
    if (!isOpen || !canModerate(currentUser?.role)) return;

    (async () => {
      setLoading(true);
      try {
        await reloadPanelData();
        setError('');
      } catch (_error) {
        setError('Не удалось загрузить данные модерации');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentUser?.role, isOpen, reloadPanelData]);

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

  const safeAction = useCallback(
    async (action) => {
      try {
        await action();
        await reloadPanelData();
        setError('');
      } catch (requestError) {
        setError(requestError?.response?.data?.error || 'Операция не выполнена');
      }
    },
    [reloadPanelData]
  );

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

  const runStorageCleanup = async (action) => {
    const confirmations = {
      audit_logs: 'Удалить все записи аудита?',
      all: 'Выполнить полную очистку: временные файлы, аудит и сжатие базы?',
    };

    if (confirmations[action] && !window.confirm(confirmations[action])) {
      return;
    }

    setStorageActionLoading(action);
    try {
      const { data } = await api.post('/mod/storage/cleanup', { action });
      setStorage(data.storage || null);
      await fetchLogs();
      setError('');
    } catch (requestError) {
      setError(requestError?.response?.data?.error || 'Не удалось выполнить очистку');
    } finally {
      setStorageActionLoading('');
    }
  };

  if (!canModerate(currentUser?.role)) return null;

  const storageUsedPercent =
    storage?.totalBytes && storage.totalBytes > 0
      ? Math.min((storage.usedBytes / storage.totalBytes) * 100, 100)
      : 0;
  const appUsedPercent =
    storage?.totalBytes && storage.totalBytes > 0
      ? Math.min((storage.appBytes / storage.totalBytes) * 100, 100)
      : 0;

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
                <span>Управление участниками, аудитом и диском сервера</span>
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
              {isOwner && (
                <button className={tab === 'storage' ? 'active' : ''} onClick={() => setTab('storage')}>
                  Память
                </button>
              )}
            </div>

            {tab === 'users' && (
              <div className="mod-search-wrap">
                <input
                  className="mod-search"
                  type="text"
                  placeholder="Поиск: имя, email, роль..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
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
                          {user.activeBanId ? <i className="banned">ban: {user.bannedByName}</i> : null}
                        </div>
                      </div>
                      <div className="mod-user-actions">
                        <button onClick={() => openProfile(user.id)} title="Профиль">
                          <Eye size={14} />
                        </button>
                        {isOwner && (
                          <button onClick={() => toggleVerify(user)} title="Верификация">
                            <UserRoundCheck size={14} />
                          </button>
                        )}
                        {isOwner && user.role !== 'owner' && (
                          <button onClick={() => toggleRole(user)} title="Выдать или снять модератора">
                            <ShieldCheck size={14} />
                          </button>
                        )}
                        {user.role !== 'owner' && (
                          <button onClick={() => banOrUnban(user)} title="Бан или разбан">
                            {user.activeBanId ? <UserRoundX size={14} /> : <Ban size={14} />}
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                  {!filteredUsers.length && <div className="mod-empty">Ничего не найдено</div>}
                </div>
              ) : tab === 'audit' ? (
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
              ) : (
                <div className="mod-storage-view">
                  {storage ? (
                    <>
                      <div className="mod-storage-summary">
                        <article className="mod-storage-card">
                          <span className="mod-storage-label">
                            <HardDrive size={14} />
                            Всего на диске
                          </span>
                          <strong>{formatBytes(storage.totalBytes)}</strong>
                        </article>
                        <article className="mod-storage-card">
                          <span className="mod-storage-label">
                            <Database size={14} />
                            Занято
                          </span>
                          <strong>{formatBytes(storage.usedBytes)}</strong>
                        </article>
                        <article className="mod-storage-card">
                          <span className="mod-storage-label">
                            <RefreshCw size={14} />
                            Осталось
                          </span>
                          <strong>{formatBytes(storage.freeBytes)}</strong>
                        </article>
                        <article className="mod-storage-card">
                          <span className="mod-storage-label">
                            <Shield size={14} />
                            Сайт занимает
                          </span>
                          <strong>{formatBytes(storage.appBytes)}</strong>
                        </article>
                      </div>

                      <div className="mod-storage-bars">
                        <div className="mod-storage-bar-card">
                          <div className="mod-storage-bar-head">
                            <span>Заполненность диска</span>
                            <b>{storageUsedPercent.toFixed(1)}%</b>
                          </div>
                          <div className="mod-storage-bar-track">
                            <div className="mod-storage-bar-fill system" style={{ width: `${storageUsedPercent}%` }} />
                          </div>
                        </div>
                        <div className="mod-storage-bar-card">
                          <div className="mod-storage-bar-head">
                            <span>Доля сайта на диске</span>
                            <b>{appUsedPercent.toFixed(1)}%</b>
                          </div>
                          <div className="mod-storage-bar-track">
                            <div className="mod-storage-bar-fill app" style={{ width: `${appUsedPercent}%` }} />
                          </div>
                        </div>
                      </div>

                      <div className="mod-storage-breakdown">
                        {storage.breakdown.map((item) => (
                          <article key={item.key} className="mod-storage-row">
                            <span>{item.label}</span>
                            <strong>{formatBytes(item.bytes)}</strong>
                          </article>
                        ))}
                      </div>

                      <div className="mod-storage-actions">
                        <button
                          type="button"
                          className="mod-storage-btn"
                          onClick={fetchStorage}
                          disabled={storageActionLoading !== ''}
                        >
                          <RefreshCw size={14} />
                          Обновить
                        </button>
                        <button
                          type="button"
                          className="mod-storage-btn"
                          onClick={() => runStorageCleanup('temp_uploads')}
                          disabled={storageActionLoading !== ''}
                        >
                          <Trash2 size={14} />
                          Очистить временные
                        </button>
                        <button
                          type="button"
                          className="mod-storage-btn"
                          onClick={() => runStorageCleanup('audit_logs')}
                          disabled={storageActionLoading !== ''}
                        >
                          <Trash2 size={14} />
                          Очистить аудит
                        </button>
                        <button
                          type="button"
                          className="mod-storage-btn"
                          onClick={() => runStorageCleanup('vacuum')}
                          disabled={storageActionLoading !== ''}
                        >
                          <Database size={14} />
                          Сжать БД
                        </button>
                        <button
                          type="button"
                          className="mod-storage-btn danger"
                          onClick={() => runStorageCleanup('all')}
                          disabled={storageActionLoading !== ''}
                        >
                          <Trash2 size={14} />
                          Полная очистка
                        </button>
                      </div>

                      <p className="mod-storage-note">
                        Полная очистка удаляет временные файлы, очищает аудит и выполняет сжатие базы. Пользователи,
                        чаты и сообщения не удаляются.
                      </p>
                    </>
                  ) : (
                    <div className="mod-empty">Статистика диска пока не загружена</div>
                  )}
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
