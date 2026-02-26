import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Crown, Globe, MessageCircle, Send, Shield, Trash2, User, X } from 'lucide-react';
import api from '../utils/api';
import ModerationPanel from './moderation/ModerationPanel';
import ChatUserProfileModal from './global-chat/ChatUserProfileModal';
import './GlobalChatWidget.css';

function formatTime(value) {
  return new Date(Number(value)).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  return new Date(Number(value)).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function roleBadge(role) {
  if (role === 'owner') return { label: 'owner', icon: <Crown size={11} />, className: 'owner' };
  if (role === 'moderator') return { label: 'mod', icon: <Shield size={11} />, className: 'moderator' };
  return null;
}

export default function GlobalChatWidget({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [banInfo, setBanInfo] = useState(null);
  const [cooldown, setCooldown] = useState(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [onlineCount, setOnlineCount] = useState(0);
  const [onlineWindowMinutes, setOnlineWindowMinutes] = useState(2);
  const [isModerationOpen, setIsModerationOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const listRef = useRef(null);
  const lastSeenIdRef = useRef(0);
  const pollTimerRef = useRef(null);

  const canWrite = Boolean(user?.id);
  const canOpenModeration = user?.role === 'owner' || user?.role === 'moderator';

  const cooldownRemainingMs =
    cooldown && !cooldown.hasUnlimited && cooldown.resetAtMs
      ? Math.max(0, Number(cooldown.resetAtMs) - nowMs)
      : 0;
  const isCooldownActive = cooldownRemainingMs > 0;

  const fetchMessages = async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const { data } = await api.get('/global-chat/messages?limit=80');
      const nextMessages = data?.messages || [];
      const prevLastId = lastSeenIdRef.current;
      const nextLastId = nextMessages.length ? nextMessages[nextMessages.length - 1].id : 0;

      setMessages(nextMessages);

      if (!isOpen && nextLastId > prevLastId && prevLastId > 0) {
        setUnreadCount((prev) => prev + 1);
      }

      if (nextLastId > 0) lastSeenIdRef.current = nextLastId;
      setError('');
    } catch (_error) {
      if (!isSilent) setError('Не удалось загрузить глобальный чат');
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  const fetchMyStatus = async () => {
    if (!canWrite) {
      setBanInfo(null);
      setCooldown(null);
      return;
    }
    try {
      const { data } = await api.get('/global-chat/me/status');
      setBanInfo(data?.isBanned ? data?.ban || null : null);
      setCooldown(data?.cooldown || null);
    } catch (_error) {
      setBanInfo(null);
      setCooldown(null);
    }
  };

  const fetchOnlineCount = async () => {
    try {
      const { data } = await api.get('/global-chat/online');
      setOnlineCount(Number(data?.count) || 0);
      const windowMinutes = Number(data?.windowMinutes);
      if (Number.isFinite(windowMinutes)) {
        setOnlineWindowMinutes(windowMinutes);
      }
    } catch (_error) {
      setOnlineCount(0);
    }
  };

  useEffect(() => {
    if (!isOpen) return undefined;

    setUnreadCount(0);
    fetchMessages();
    fetchMyStatus();
    fetchOnlineCount();

    pollTimerRef.current = setInterval(() => {
      fetchMessages(true);
      fetchMyStatus();
      fetchOnlineCount();
    }, 3000);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchOnlineCount();
    const timer = setInterval(() => {
      fetchOnlineCount();
    }, 5000);
    return () => clearInterval(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Прокрутка вниз при открытии чата
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const container = listRef.current;
    // Ждём рендер сообщений и скроллим вниз
    setTimeout(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    }, 200);
  }, [isOpen]);

  // Прокрутка вниз при новых сообщениях (только если пользователь внизу)
  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const container = listRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    if (isAtBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const groupedMessages = useMemo(() => {
    const rows = [];
    let lastDate = '';

    for (const message of messages) {
      const dateLabel = formatDate(message.createdAtMs);
      if (dateLabel !== lastDate) {
        rows.push({ type: 'date', id: `date-${dateLabel}`, dateLabel });
        lastDate = dateLabel;
      }
      rows.push({ type: 'message', ...message });
    }
    return rows;
  }, [messages]);

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || !canWrite || isSending || banInfo || isCooldownActive) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      userId: user.id,
      userName: user.name || 'Вы',
      userRole: user.role || 'user',
      isVerified: user.isVerified ? 1 : 0,
      content,
      createdAtMs: Date.now(),
      isPending: true,
    };

    setInputValue('');
    setIsSending(true);
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { data } = await api.post('/global-chat/messages', { content });
      const realMessage = data?.message;
      if (!realMessage) throw new Error('Пустой ответ сервера');
      setMessages((prev) => prev.map((m) => (m.id === tempId ? realMessage : m)));
      lastSeenIdRef.current = Math.max(lastSeenIdRef.current, realMessage.id || 0);
      setError('');
      await fetchMyStatus();
    } catch (requestError) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      const serverError = requestError?.response?.data?.error;
      setError(serverError || 'Не удалось отправить сообщение');
      if (requestError?.response?.data?.cooldown) {
        setCooldown(requestError.response.data.cooldown);
      }
      await fetchMyStatus();
    } finally {
      setIsSending(false);
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await api.delete(`/global-chat/messages/${messageId}`);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (_error) {
      setError('Не удалось удалить сообщение');
    }
  };

  const openUserProfile = async (userId) => {
    try {
      const { data } = await api.get(`/global-chat/users/${userId}/profile`);
      setSelectedProfile(data?.profile || null);
      setIsProfileOpen(true);
    } catch (_error) {
      setError('Не удалось открыть профиль пользователя');
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="global-chat-root">
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.section
            className="global-chat-panel"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
          >
            <header className="global-chat-header">
              <div className="global-chat-title">
                <Globe size={18} />
                <div>
                  <div className="global-chat-title-row">
                    <strong>Глобальный чат</strong>
                    <span
                      className="global-chat-online"
                      title={`Активные за последние ${onlineWindowMinutes} мин.`}
                    >
                      <i className="global-chat-online-dot" />
                      Онлайн: {onlineCount}
                    </span>
                  </div>
                  <span>Время сообщений: ваш локальный компьютер</span>
                </div>
              </div>
              <div className="global-chat-actions">
                {canOpenModeration && (
                  <button className="global-chat-mod-btn" onClick={() => setIsModerationOpen(true)}>
                    <Shield size={14} />
                    <span>Панель</span>
                  </button>
                )}
                <button className="global-chat-close" onClick={() => setIsOpen(false)}>
                  <X size={16} />
                </button>
              </div>
            </header>

            <div className="global-chat-messages" ref={listRef}>
              {isLoading ? (
                <div className="global-chat-empty">Загрузка...</div>
              ) : groupedMessages.length === 0 ? (
                <div className="global-chat-empty">Пока сообщений нет. Начни первым.</div>
              ) : (
                groupedMessages.map((row) => {
                  if (row.type === 'date') {
                    return (
                      <div key={row.id} className="global-chat-date">
                        <span>{row.dateLabel}</span>
                      </div>
                    );
                  }

                  const isMine = row.userId === user?.id;
                  const tag = roleBadge(row.userRole);
                  const canDelete = isMine || user?.role === 'moderator' || user?.role === 'owner';

                  return (
                    <article
                      key={row.id}
                      className={`global-chat-message ${isMine ? 'mine' : ''} ${row.isPending ? 'pending' : ''}`}
                    >
                      <div className="global-chat-message-meta">
                        <span className="global-chat-avatar">
                          {row.avatarUrl || row.avatar_url ? (
                            <img src={row.avatarUrl || row.avatar_url} alt={row.userName || 'Avatar'} />
                          ) : (
                            <User size={14} />
                          )}
                        </span>
                        <button
                          className="author author-clickable"
                          onClick={() => openUserProfile(row.userId)}
                          title="Открыть профиль"
                        >
                          {isMine ? 'Вы' : row.userName}
                        </button>
                        {tag && (
                          <span className={`name-tag ${tag.className}`}>
                            {tag.icon}
                            <span>{tag.label}</span>
                          </span>
                        )}
                        {Number(row.isVerified) === 1 && (
                          <span className="name-verified" title="Подтвержденный участник">
                            <BadgeCheck size={12} />
                          </span>
                        )}
                        <span className="time">{formatTime(row.createdAtMs)}</span>
                        {canDelete && !row.isPending && (
                          <button className="message-delete-btn" onClick={() => deleteMessage(row.id)} title="Удалить сообщение">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p>{row.content}</p>
                    </article>
                  );
                })
              )}
            </div>

            {error ? <div className="global-chat-error">{error}</div> : null}

            <div className="global-chat-input">
              {canWrite ? (
                banInfo ? (
                  <p className="global-chat-ban">
                    Вы заблокированы модератором <b>{banInfo.moderatorName}</b>
                  </p>
                ) : (
                  <>
                    {isCooldownActive && (
                      <div className="global-chat-cooldown">
                        Можно отправить следующее сообщение через <b>{Math.ceil(cooldownRemainingMs / 1000)} сек</b>
                      </div>
                    )}
                    <textarea
                      value={inputValue}
                      onChange={(event) => setInputValue(event.target.value)}
                      onKeyDown={handleKeyDown}
                      rows={1}
                      placeholder="Написать в глобальный чат..."
                      disabled={isSending}
                    />
                    <button className="global-chat-send" onClick={handleSend} disabled={!inputValue.trim() || isSending || isCooldownActive}>
                      <Send size={16} />
                    </button>
                  </>
                )
              ) : null}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <button className="global-chat-toggle" onClick={() => setIsOpen((prev) => !prev)}>
        <MessageCircle size={20} />
        <span>Глобальный чат</span>
        <span className="global-chat-toggle-online" title={`Активные за последние ${onlineWindowMinutes} мин.`}>
          <span className="global-chat-online-dot" />
          {onlineCount}
        </span>
        {unreadCount > 0 && <i>{unreadCount > 9 ? '9+' : unreadCount}</i>}
      </button>

      <ModerationPanel isOpen={isModerationOpen} onClose={() => setIsModerationOpen(false)} currentUser={user} />

      <ChatUserProfileModal
        isOpen={isProfileOpen}
        profile={selectedProfile}
        onClose={() => {
          setIsProfileOpen(false);
          setSelectedProfile(null);
        }}
      />
    </div>
  );
}
