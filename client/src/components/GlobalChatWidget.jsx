import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { BadgeCheck, Crown, Globe, MessageCircle, Send, Shield, Trash2, User, X } from 'lucide-react';
import useDocumentVisibility from '../hooks/useDocumentVisibility';
import { getAdaptiveRefetchInterval } from '../lib/queryClient';
import {
  deleteGlobalChatMessage,
  fetchGlobalChatLatestMessage,
  fetchGlobalChatMessages,
  fetchGlobalChatOnline,
  fetchGlobalChatStatus,
  fetchGlobalChatUserProfile,
  globalChatQueryKeys,
  GLOBAL_CHAT_MESSAGES_LIMIT,
  sendGlobalChatMessage,
} from '../services/globalChatService';
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
  const queryClient = useQueryClient();
  const isDocumentVisible = useDocumentVisibility();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [nowMs, setNowMs] = useState(Date.now());
  const [isModerationOpen, setIsModerationOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const listRef = useRef(null);
  const lastSeenIdRef = useRef(0);

  const canWrite = Boolean(user?.id);
  const canOpenModeration = user?.role === 'owner' || user?.role === 'moderator';
  const messagesQueryKey = useMemo(
    () => globalChatQueryKeys.messages(GLOBAL_CHAT_MESSAGES_LIMIT),
    []
  );
  const latestMessageQueryKey = useMemo(() => globalChatQueryKeys.latestMessage(), []);
  const onlineQueryKey = useMemo(() => globalChatQueryKeys.online(), []);
  const statusQueryKey = useMemo(() => globalChatQueryKeys.myStatus(), []);

  const messagesQuery = useQuery({
    queryKey: messagesQueryKey,
    queryFn: () => fetchGlobalChatMessages(GLOBAL_CHAT_MESSAGES_LIMIT),
    enabled: isOpen,
    staleTime: 5000,
    placeholderData: (previousData) => previousData ?? [],
    retry: 1,
    refetchInterval: (query) => {
      if (!isOpen || !isDocumentVisible) return false;
      return getAdaptiveRefetchInterval(12000, 60000)(query);
    },
    refetchIntervalInBackground: false,
  });

  const latestMessageQuery = useQuery({
    queryKey: latestMessageQueryKey,
    queryFn: fetchGlobalChatLatestMessage,
    enabled: !isOpen,
    staleTime: 15000,
    retry: 1,
    refetchInterval: (query) => {
      if (isOpen || !isDocumentVisible) return false;
      return getAdaptiveRefetchInterval(45000, 180000)(query);
    },
    refetchIntervalInBackground: false,
  });

  const onlineQuery = useQuery({
    queryKey: onlineQueryKey,
    queryFn: fetchGlobalChatOnline,
    staleTime: 15000,
    retry: 1,
    refetchInterval: (query) => {
      if (!isDocumentVisible) return false;
      return isOpen
        ? getAdaptiveRefetchInterval(20000, 120000)(query)
        : getAdaptiveRefetchInterval(60000, 300000)(query);
    },
    refetchIntervalInBackground: false,
  });

  const statusQuery = useQuery({
    queryKey: statusQueryKey,
    queryFn: fetchGlobalChatStatus,
    enabled: isOpen && canWrite,
    staleTime: 10000,
    retry: 1,
    refetchInterval: (query) => {
      if (!isOpen || !canWrite || !isDocumentVisible) return false;
      return getAdaptiveRefetchInterval(20000, 120000)(query);
    },
    refetchIntervalInBackground: false,
  });

  const messages = messagesQuery.data ?? [];
  const onlineCount = onlineQuery.data?.count ?? 0;
  const onlineWindowMinutes = onlineQuery.data?.windowMinutes ?? 2;
  const banInfo = statusQuery.data?.banInfo ?? null;
  const cooldown = statusQuery.data?.cooldown ?? null;
  const isLoading = messagesQuery.isLoading;

  const cooldownRemainingMs =
    cooldown && !cooldown.hasUnlimited && cooldown.resetAtMs
      ? Math.max(0, Number(cooldown.resetAtMs) - nowMs)
      : 0;
  const isCooldownActive = cooldownRemainingMs > 0;

  useEffect(() => {
    const hasFetchError = Boolean(messagesQuery.error || onlineQuery.error || statusQuery.error);
    if (hasFetchError) {
      setError('Не удалось обновить глобальный чат');
      return;
    }

    setError((currentError) =>
      currentError === 'Не удалось обновить глобальный чат' ? '' : currentError
    );
  }, [messagesQuery.error, onlineQuery.error, statusQuery.error]);

  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      const lastMessageId = messages.length ? messages[messages.length - 1].id : 0;
      if (lastMessageId > 0) {
        lastSeenIdRef.current = lastMessageId;
      }
    }
  }, [isOpen, messages]);

  useEffect(() => {
    const latestMessageId = latestMessageQuery.data?.id || 0;
    if (isOpen || latestMessageId === 0) return;

    if (lastSeenIdRef.current > 0 && latestMessageId > lastSeenIdRef.current) {
      setUnreadCount((prev) => prev + 1);
    }

    lastSeenIdRef.current = latestMessageId;
  }, [isOpen, latestMessageQuery.data]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return undefined;

    const container = listRef.current;
    const timer = window.setTimeout(() => {
      container.scrollTo({ top: container.scrollHeight, behavior: 'auto' });
    }, 200);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;

    const container = listRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    if (isAtBottom) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
  }, [isOpen, messages]);

  useEffect(() => {
    if (!isOpen || !isCooldownActive) return undefined;

    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [isCooldownActive, isOpen]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content) => {
      const message = await sendGlobalChatMessage(content);
      if (!message) {
        throw new Error('Пустой ответ сервера');
      }
      return message;
    },
    onMutate: async (content) => {
      setError('');
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });

      const previousMessages = queryClient.getQueryData(messagesQueryKey) || [];
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage = {
        id: tempId,
        userId: user.id,
        userName: user.name || 'Вы',
        userRole: user.role || 'user',
        isVerified: user.isVerified ? 1 : 0,
        content,
        createdAtMs: Date.now(),
        isPending: true,
      };

      queryClient.setQueryData(messagesQueryKey, [...previousMessages, optimisticMessage]);

      return { previousMessages, tempId };
    },
    onSuccess: (realMessage, _content, context) => {
      queryClient.setQueryData(messagesQueryKey, (current = []) =>
        current.map((message) => (message.id === context.tempId ? realMessage : message))
      );
      queryClient.setQueryData(latestMessageQueryKey, realMessage);
      lastSeenIdRef.current = Math.max(lastSeenIdRef.current, realMessage.id || 0);
      queryClient.invalidateQueries({ queryKey: statusQueryKey });
    },
    onError: (requestError, _content, context) => {
      queryClient.setQueryData(messagesQueryKey, context?.previousMessages || []);
      setError(requestError?.response?.data?.error || 'Не удалось отправить сообщение');

      if (requestError?.response?.data?.cooldown) {
        queryClient.setQueryData(statusQueryKey, (previous) => ({
          banInfo: previous?.banInfo || null,
          cooldown: requestError.response.data.cooldown,
        }));
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      queryClient.invalidateQueries({ queryKey: statusQueryKey });
      queryClient.invalidateQueries({ queryKey: onlineQueryKey });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: deleteGlobalChatMessage,
    onMutate: async (messageId) => {
      setError('');
      await queryClient.cancelQueries({ queryKey: messagesQueryKey });

      const previousMessages = queryClient.getQueryData(messagesQueryKey) || [];
      queryClient.setQueryData(messagesQueryKey, (current = []) =>
        current.filter((message) => message.id !== messageId)
      );

      return { previousMessages };
    },
    onError: (_error, _messageId, context) => {
      queryClient.setQueryData(messagesQueryKey, context?.previousMessages || []);
      setError('Не удалось удалить сообщение');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
      queryClient.invalidateQueries({ queryKey: latestMessageQueryKey });
    },
  });

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
    if (!content || !canWrite || sendMessageMutation.isPending || banInfo || isCooldownActive) return;

    setInputValue('');
    await sendMessageMutation.mutateAsync(content);
  };

  const deleteMessage = (messageId) => {
    deleteMessageMutation.mutate(messageId);
  };

  const openUserProfile = async (userId) => {
    try {
      const profile = await queryClient.fetchQuery({
        queryKey: globalChatQueryKeys.userProfile(userId),
        queryFn: () => fetchGlobalChatUserProfile(userId),
        staleTime: 5 * 60 * 1000,
      });
      setError('');
      setSelectedProfile(profile);
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
                          <button
                            className="message-delete-btn"
                            onClick={() => deleteMessage(row.id)}
                            title="Удалить сообщение"
                          >
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
                      disabled={sendMessageMutation.isPending}
                    />
                    <button
                      className="global-chat-send"
                      onClick={handleSend}
                      disabled={!inputValue.trim() || sendMessageMutation.isPending || isCooldownActive}
                    >
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
