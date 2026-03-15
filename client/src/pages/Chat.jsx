import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Suspense, lazy } from 'react';
import { chatService } from '../services/chatService';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import {
  MessageSquare,
  Plus,
  Menu,
  Edit2,
  Trash2,
  Copy,
  Check,
  LogOut,
  User,
  Sparkles,
  MoreVertical,
  ChevronDown,
  X,
  Bell,
} from 'lucide-react';
import './Chat.css';
import { copyToClipboard } from '../utils/copyToClipboard';
import { BLOCKED_MESSAGE_WARNING, checkMessageContent } from '../utils/contentFilter';

const ProfileModal = lazy(() => import('./ProfileModal'));
const UpdateModal = lazy(() => import('./UpdateModal'));
const GlobalChatWidget = lazy(() => import('../components/GlobalChatWidget'));
const UPDATE_MODAL_DELAY_MS = 1000;
const modeOptions = [
  { value: 'balanced', label: 'Стандарт' },
  { value: 'short', label: 'Кратко' },
  { value: 'deep', label: 'Глубоко' },
];

function createLocalMessageId(prefix = 'local') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function waitNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function formatMessageTime(value) {
  if (!value) return '';
  const raw = String(value);
  const normalized = raw.includes('T') || raw.endsWith('Z') ? raw : raw.replace(' ', 'T') + 'Z';
  return new Date(normalized).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

const Message = memo(function Message({ message, index, copiedId, copyMessage, copiedCodeKey, copyCode, currentUser, streamingContent }) {
  const displayContent = streamingContent !== undefined ? streamingContent : message.content;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={`message ${message.role}`}
    >
      <div className="message-avatar">
        {message.role === 'user' ? (
          <div className="user-avatar-small">
            {currentUser?.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser?.name || 'User'} />
            ) : (
              <User size={20} />
            )}
          </div>
        ) : (
          <div className="ai-avatar">
            <Sparkles size={20} />
          </div>
        )}
      </div>
      <div className="message-content">
        <div className="message-header">
          <span className="message-author">
            {message.role === 'user' ? 'Вы' : 'MichaelGPT'}
          </span>
          <span className="message-time">
            {formatMessageTime(message.created_at)}
          </span>
        </div>
        <div className="message-text">
          {message.role === 'assistant' ? (
            <ReactMarkdown
              components={{
                code({ node, inline, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || '');
                  const code = String(children).replace(/\n$/, '');
                  const codeKey = `${message.id}-${index}`;

                  if (!inline && match) {
                    return (
                      <div className="code-block-wrapper">
                        <div className="code-block-header">
                          <span className="code-language">{match[1]}</span>
                          <button
                            className="copy-code-btn"
                            onClick={() => copyCode(code, codeKey)}
                          >
                            {copiedCodeKey === codeKey ? (
                              <>
                                <Check size={14} />
                                <span>Скопировано</span>
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                <span>Копировать</span>
                              </>
                            )}
                          </button>
                        </div>
                        <SyntaxHighlighter
                          style={oneDark}
                          language={match[1]}
                          PreTag="div"
                          {...props}
                        >
                          {code}
                        </SyntaxHighlighter>
                      </div>
                    );
                  }
                  return (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  );
                }
              }}
            >
              {displayContent}
            </ReactMarkdown>
          ) : (
            displayContent
          )}
        </div>
        {streamingContent === undefined && (
          <div className="message-actions">
            <button
              className="message-action-btn"
              onClick={() => copyMessage(message.content, message.id)}
            >
              {copiedId === message.id ? (
                <Check size={14} color="var(--success)" />
              ) : (
                <Copy size={14} />
              )}
              {copiedId === message.id ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});

export default function Chat() {
  const { user, logout, updateUser } = useAuth();
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.innerWidth <= 768);
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [profileStats, setProfileStats] = useState(null);
  const [profileStatsLoading, setProfileStatsLoading] = useState(false);
  const [responseMode, setResponseMode] = useState('balanced');
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  const [aiQuota, setAiQuota] = useState(null);
  const [quotaNowMs, setQuotaNowMs] = useState(Date.now());
  const [streamingMessage, setStreamingMessage] = useState(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const userMenuRef = useRef(null);
  const modeMenuRef = useRef(null);
  const profileModalRef = useRef(null);
  const currentChatIdRef = useRef(null);
  const messagesRequestSeqRef = useRef(0);
  const backgroundRef = useRef(null);
  const isMountedRef = useRef(true);
  const timeoutIdsRef = useRef(new Set());
  const streamSessionRef = useRef(0);

  const scheduleTimeout = useCallback((callback, delay) => {
    const timeoutId = window.setTimeout(() => {
      timeoutIdsRef.current.delete(timeoutId);
      callback();
    }, delay);

    timeoutIdsRef.current.add(timeoutId);
    return timeoutId;
  }, []);

  const clearScheduledTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIdsRef.current.clear();
  }, []);

  const waitForDelay = useCallback(
    (delay) =>
      new Promise((resolve) => {
        scheduleTimeout(resolve, delay);
      }),
    [scheduleTimeout]
  );

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, []);

  const stopStreaming = useCallback(() => {
    streamSessionRef.current += 1;
    setStreamingMessage(null);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      streamSessionRef.current += 1;
      clearScheduledTimeouts();
    };
  }, [clearScheduledTimeouts]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 768px)');

    const applyViewportState = (matches) => {
      setIsMobileViewport(matches);
      setSidebarOpen((prev) => (matches ? false : prev || true));
    };

    applyViewportState(mediaQuery.matches);

    const handleChange = (event) => {
      applyViewportState(event.matches);
    };

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }, []);

  useEffect(() => {
    if (!isMobileViewport || !sidebarOpen) {
      document.body.classList.remove('sidebar-mobile-open');
      return undefined;
    }

    document.body.classList.add('sidebar-mobile-open');
    return () => document.body.classList.remove('sidebar-mobile-open');
  }, [isMobileViewport, sidebarOpen]);

  useEffect(() => {
    currentChatIdRef.current = currentChat?.id ?? null;
  }, [currentChat?.id]);

  useEffect(() => {
    loadChats();
    loadAiQuota();
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!modeMenuOpen) return undefined;

    const handleClickOutside = (event) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(event.target)) {
        setModeMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modeMenuOpen]);

  useEffect(() => {
    if (!profileModalOpen) return undefined;

    const handleClickOutside = (event) => {
      if (profileModalRef.current && !profileModalRef.current.contains(event.target)) {
        setProfileModalOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileModalOpen]);

  useEffect(() => {
    stopStreaming();
    setMessages([]);

    if (currentChat?.id) {
      loadMessages(currentChat.id);
      setUserMenuOpen(false);
    }
  }, [currentChat?.id, stopStreaming]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom, streamingMessage]);

  useEffect(() => {
    if (!aiQuota?.resetAtMs) return undefined;

    const timer = window.setInterval(() => setQuotaNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [aiQuota?.resetAtMs]);

  useEffect(() => {
    const node = backgroundRef.current;
    if (!node) return undefined;

    const handleMove = (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 2;
      const y = (event.clientY / window.innerHeight - 0.5) * 2;
      node.style.setProperty('--mx', x.toFixed(3));
      node.style.setProperty('--my', y.toFixed(3));
    };

    window.addEventListener('pointermove', handleMove, { passive: true });
    return () => window.removeEventListener('pointermove', handleMove);
  }, []);

  const openProfileModal = useCallback(async () => {
    setProfileModalOpen(true);
    if (profileStats) return;

    setProfileStatsLoading(true);
    try {
      const { data } = await chatService.getProfileStats();
      if (isMountedRef.current) {
        setProfileStats(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      if (isMountedRef.current) {
        setProfileStatsLoading(false);
      }
    }
  }, [profileStats]);

  const openUpdateModal = useCallback(() => {
    setUpdateModalOpen(true);
  }, []);

  useEffect(() => {
    const isDisabled = localStorage.getItem('michaelgpt_disable_updates');
    if (isDisabled) return undefined;

    const lastSeen = localStorage.getItem('michaelgpt_last_update_seen');

    scheduleTimeout(() => {
      if (!isMountedRef.current) return;

      setUpdateModalOpen(true);

      if (!lastSeen) {
        localStorage.setItem('michaelgpt_last_update_seen', new Date().toISOString());
      }
    }, UPDATE_MODAL_DELAY_MS);

    return undefined;
  }, [scheduleTimeout]);

  const loadAiQuota = useCallback(async () => {
    try {
      const { data } = await chatService.getAiQuota();
      if (isMountedRef.current) {
        setAiQuota(data?.quota || null);
      }
    } catch (_error) {
      if (isMountedRef.current) {
        setAiQuota(null);
      }
    }
  }, []);

  const loadChats = useCallback(async () => {
    try {
      const { data } = await chatService.getChats();
      const nextChats = data?.chats || [];

      if (!isMountedRef.current) return;

      setChats(nextChats);
      setCurrentChat((prev) => prev || nextChats[0] || null);
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    }
  }, []);

  const loadMessages = useCallback(async (chatId) => {
    const requestSeq = ++messagesRequestSeqRef.current;

    try {
      const { data } = await chatService.getMessages(chatId);
      if (!isMountedRef.current) return;
      if (currentChatIdRef.current !== chatId) return;
      if (messagesRequestSeqRef.current !== requestSeq) return;

      setMessages(data?.messages || []);
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
    }
  }, []);

  const createNewChat = useCallback(async () => {
    try {
      const { data } = await chatService.createChat();
      if (!isMountedRef.current) return;

      setChats((prev) => [data.chat, ...prev]);
      setCurrentChat(data.chat);
      setMessages([]);
      if (isMobileViewport) {
        setSidebarOpen(false);
      }
      setUserMenuOpen(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    } catch (error) {
      console.error('Ошибка создания чата:', error);
    }
  }, [isMobileViewport]);

  const deleteChat = useCallback(
    async (chatId, event) => {
      event.stopPropagation();

      try {
        await chatService.deleteChat(chatId);
        if (!isMountedRef.current) return;

        const nextChats = chats.filter((chat) => chat.id !== chatId);
        setChats(nextChats);

        if (currentChat?.id === chatId) {
          setCurrentChat(nextChats[0] || null);
          setMessages([]);
        }
      } catch (error) {
        console.error('Ошибка удаления чата:', error);
      }
    },
    [chats, currentChat?.id]
  );

  const startEditingChat = useCallback((chat, event) => {
    event.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  }, []);

  const saveChatTitle = useCallback(async () => {
    const trimmedTitle = editTitle.trim();
    if (!trimmedTitle || !currentChat) return;

    try {
      const { data } = await chatService.updateChat(currentChat.id, trimmedTitle);
      if (!isMountedRef.current) return;

      setChats((prev) => prev.map((chat) => (chat.id === currentChat.id ? data.chat : chat)));
      setCurrentChat(data.chat);
      setEditingChatId(null);
    } catch (error) {
      console.error('Ошибка обновления чата:', error);
    }
  }, [currentChat, editTitle]);

  const cancelEditing = useCallback(() => {
    setEditingChatId(null);
    setEditTitle('');
  }, []);

  const selectChat = useCallback((chat) => {
    setCurrentChat(chat);
    if (isMobileViewport) {
      setSidebarOpen(false);
    }
  }, [isMobileViewport]);

  const formatHms = (seconds) => {
    const s = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const sendMessage = useCallback(async () => {
    const content = inputValue.trim();
    const aiQuotaReached =
      aiQuota && !aiQuota.hasUnlimited && Number(aiQuota.remaining) <= 0;

    if (!content || !currentChat || isLoading || aiQuotaReached) return;

    const nowIso = new Date().toISOString();
    const activeChatId = currentChat.id;
    const localId = createLocalMessageId('local-user');
    const wasFirstPersistedMessage = !messages.some((message) => {
      const messageId = Number(message.id);
      return Number.isInteger(messageId) && messageId > 0 && !message.isLocalOnly;
    });

    const userMessage = {
      id: localId,
      localId,
      role: 'user',
      content,
      created_at: nowIso,
      isPending: true,
    };

    const makeAssistantMessage = (text, options = {}) => ({
      id: createLocalMessageId(options.idPrefix || 'local-assistant'),
      role: 'assistant',
      content: text,
      created_at: new Date().toISOString(),
      isError: Boolean(options.isError),
      isLocalOnly: Boolean(options.isLocalOnly),
    });

    const getErrorText = (error) => {
      if (error?.response?.data?.details) return error.response.data.details;
      if (error?.response?.data?.error) return error.response.data.error;
      if (error?.message) return error.message;
      return 'Ошибка соединения с сервером';
    };

    if (checkMessageContent(content)) {
      setInputValue('');

      flushSync(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: createLocalMessageId('local-blocked-user'),
            role: 'user',
            content,
            created_at: nowIso,
            isLocalOnly: true,
          },
          makeAssistantMessage(BLOCKED_MESSAGE_WARNING, {
            idPrefix: 'local-blocked-warning',
            isLocalOnly: true,
          }),
        ]);
      });

      await waitNextFrame();
      inputRef.current?.focus();
      return;
    }

    const streamSessionId = streamSessionRef.current + 1;
    streamSessionRef.current = streamSessionId;

    setInputValue('');

    flushSync(() => {
      setMessages((prev) => [...prev, userMessage]);
    });

    await waitNextFrame();
    if (!isMountedRef.current) return;

    setIsLoading(true);

    try {
      const { data } = await chatService.sendMessage(activeChatId, {
        content,
        responseMode,
      });

      if (!isMountedRef.current || currentChatIdRef.current !== activeChatId) return;

      const aiMessage = data.aiMessage;

      setMessages((prev) => {
        const replaced = prev.map((message) =>
          message.localId === localId
            ? { ...data.userMessage, localId, isPending: false }
            : message
        );
        const hasAiMessage = replaced.some((message) => message.id === aiMessage.id);

        if (hasAiMessage) {
          return replaced;
        }

        return [...replaced, { ...aiMessage, isStreaming: true }];
      });

      const words = aiMessage.content.split(/(?=\s+)/);
      let currentContent = '';

      setStreamingMessage({ id: aiMessage.id, content: '' });

      for (const word of words) {
        await waitForDelay(8 + Math.random() * 12);

        if (
          !isMountedRef.current ||
          streamSessionRef.current !== streamSessionId ||
          currentChatIdRef.current !== activeChatId
        ) {
          return;
        }

        currentContent += word;
        setStreamingMessage({ id: aiMessage.id, content: currentContent });
      }

      if (
        !isMountedRef.current ||
        streamSessionRef.current !== streamSessionId ||
        currentChatIdRef.current !== activeChatId
      ) {
        return;
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === aiMessage.id ? { ...message, isStreaming: false } : message
        )
      );
      setStreamingMessage(null);

      if (wasFirstPersistedMessage) {
        const newTitle = `${content.slice(0, 30)}${content.length > 30 ? '...' : ''}`;
        const { data: chatData } = await chatService.updateChat(activeChatId, newTitle);

        if (isMountedRef.current && currentChatIdRef.current === activeChatId) {
          setCurrentChat(chatData.chat);
          setChats((prev) =>
            prev.map((chat) => (chat.id === activeChatId ? chatData.chat : chat))
          );
        }
      }

      setProfileStats(null);
      await loadAiQuota();
    } catch (error) {
      if (isMountedRef.current && currentChatIdRef.current === activeChatId) {
        const errText = getErrorText(error);
        const isRateLimit = errText.includes('Rate limit') || errText.includes('rate_limit');
        const isBlocked = error?.response?.data?.blocked === true;
        const displayText = isBlocked
          ? BLOCKED_MESSAGE_WARNING
          : isRateLimit
            ? 'Превышен лимит запросов к AI. Попробуйте через несколько минут.'
            : errText;

        setMessages((prev) => {
          const nextMessages = prev.map((message) =>
            message.localId === localId ? { ...message, isPending: false, isError: true } : message
          );

          return [
            ...nextMessages,
            makeAssistantMessage(isBlocked ? displayText : `⚠️ ${displayText}`, {
              isError: !isBlocked,
            }),
          ];
        });
      }

      if (error?.response?.data?.quota && isMountedRef.current) {
        setAiQuota(error.response.data.quota);
      } else {
        await loadAiQuota();
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [aiQuota, currentChat, inputValue, isLoading, loadAiQuota, messages, responseMode, waitForDelay]);

  const copyMessage = useCallback(async (content, id) => {
    try {
      await copyToClipboard(content);
      setCopiedId(id);
      scheduleTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Ошибка копирования:', error);
    }
  }, [scheduleTimeout]);

  const copyCode = useCallback(async (code, key) => {
    try {
      await copyToClipboard(code);
      setCopiedCodeKey(key);
      scheduleTimeout(() => setCopiedCodeKey(null), 2000);
    } catch (error) {
      console.error('Ошибка копирования кода:', error);
    }
  }, [scheduleTimeout]);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const msgsLength = messages.length;
  const aiQuotaReached =
    aiQuota && !aiQuota.hasUnlimited && Number(aiQuota.remaining) <= 0;
  const aiQuotaRemainingPercent =
    aiQuota && !aiQuota.hasUnlimited && aiQuota.limit
      ? Math.min((aiQuota.remaining / aiQuota.limit) * 100, 100)
      : 0;
  const aiQuotaResetSeconds =
    aiQuota?.resetAtMs
      ? Math.max(0, Math.ceil((Number(aiQuota.resetAtMs) - quotaNowMs) / 1000))
      : 0;
  const renderedMessages = useMemo(
    () =>
      messages.map((message, index) => {
        const streamingContent =
          streamingMessage && message.id === streamingMessage.id
            ? streamingMessage.content
            : undefined;
        
        return (
          <Message
            key={message.id}
            message={message}
            index={index}
            copiedId={copiedId}
            copyMessage={copyMessage}
            copiedCodeKey={copiedCodeKey}
            copyCode={copyCode}
            currentUser={user}
            streamingContent={streamingContent}
          />
        );
      }),
    [messages, copiedId, copyMessage, copiedCodeKey, copyCode, streamingMessage, user]
  );
  const selectedModeLabel = modeOptions.find((item) => item.value === responseMode)?.label || 'Стандарт';

  return (
    <div className="chat-container">
      <div className="animated-background" ref={backgroundRef}>
        <div className="aurora-layer">
          <span className="aurora-shape shape-1"></span>
          <span className="aurora-shape shape-2"></span>
          <span className="aurora-shape shape-3"></span>
        </div>
        <div className="particles">
          {[...Array(18)].map((_, i) => (
            <div key={i} className="particle"></div>
          ))}
        </div>
        <div className="waves">
          <div className="wave"></div>
          <div className="wave"></div>
          <div className="wave"></div>
        </div>
      </div>

      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {isMobileViewport && (
              <motion.button
                type="button"
                className="sidebar-mobile-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                onClick={() => setSidebarOpen(false)}
                aria-label="Закрыть боковую панель"
              />
            )}
            <motion.aside
              initial={isMobileViewport ? { x: '-100%', opacity: 1 } : { width: 0, opacity: 0 }}
              animate={isMobileViewport ? { x: 0, opacity: 1 } : { width: 300, opacity: 1 }}
              exit={isMobileViewport ? { x: '-100%', opacity: 1 } : { width: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
              className={`sidebar ${sidebarOpen ? 'open' : ''} ${isMobileViewport ? 'mobile-drawer' : ''}`}
            >
            <div className="sidebar-header">
              <div className="logo">
                <div className="logo-icon">
                  <Sparkles size={24} color="white" />
                </div>
                <span className="logo-text">MichaelGPT</span>
                <span className="logo-badge">beta test</span>
              </div>
              {isMobileViewport && (
                <button
                  type="button"
                  className="sidebar-mobile-close"
                  onClick={() => setSidebarOpen(false)}
                  aria-label="Закрыть меню"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <button className="btn btn-primary new-chat-btn" onClick={createNewChat}>
              <Plus size={20} />
              Новый чат
            </button>

            <div className="chats-list">
              {chats.map((chat) => (
                <motion.div
                  key={chat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`chat-item ${currentChat?.id === chat.id ? 'active' : ''}`}
                  onClick={() => selectChat(chat)}
                >
                  {editingChatId === chat.id ? (
                    <div className="chat-edit-mode" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="text"
                        className="chat-edit-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveChatTitle();
                          if (e.key === 'Escape') cancelEditing();
                        }}
                        autoFocus
                      />
                      <div className="chat-edit-actions">
                        <button
                          className="chat-action-btn save"
                          onClick={saveChatTitle}
                          title="Сохранить"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          className="chat-action-btn cancel"
                          onClick={cancelEditing}
                          title="Отмена"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <MessageSquare size={18} className="chat-icon" />
                      <span className="chat-title">{chat.title}</span>
                      <div className="chat-actions">
                        <button
                          className="chat-action-btn"
                          onClick={(e) => startEditingChat(chat, e)}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          className="chat-action-btn delete"
                          onClick={(e) => deleteChat(chat.id, e)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))}
              {chats.length === 0 && (
                <div className="no-chats">
                  <MessageSquare size={40} color="var(--text-muted)" />
                  <p>Нет чатов</p>
                  <span>Создайте первый чат</span>
                </div>
              )}
            </div>

            <div className="sidebar-footer">
              <div className="user-info">
                <div className="user-avatar clickable" onClick={openProfileModal} title="Открыть профиль">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user?.name || 'User'} />
                  ) : (
                    <User size={20} />
                  )}
                </div>
                <div className="user-details clickable" onClick={openProfileModal}>
                  <div className="user-name-wrapper">
                    <span className="user-name">{user?.name}</span>
                  </div>
                  <span className="user-email">
                    {user?.email}
                  </span>
                </div>
                <div className="user-menu" ref={userMenuRef}>
                  <button
                    className="btn btn-icon btn-ghost"
                    onClick={() => setUserMenuOpen(!userMenuOpen)}
                  >
                    <MoreVertical size={18} />
                  </button>
                  <AnimatePresence>
                    {userMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="user-menu-dropdown"
                      >
                        <button className="dropdown-item" onClick={openUpdateModal}>
                          <Bell size={16} />
                          Обновления
                        </button>
                        <button className="dropdown-item" onClick={logout}>
                          <LogOut size={16} />
                          Выйти
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="main-content">
        <header className="chat-header">
          <button
            className="btn btn-icon btn-ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu size={20} />
          </button>
          <div className="header-title">
            {currentChat ? (
              <>
                <span className="header-chat-title">{currentChat.title}</span>
                <span className="header-messages-count">
                  {messages.length} сообщений
                </span>
              </>
            ) : (
              <span>Выберите чат или создайте новый</span>
            )}
          </div>
        </header>

        <div className="messages-container">
          {!currentChat ? (
            <div className="welcome-screen">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 20 }}
                className="welcome-icon"
              >
                <Sparkles size={64} color="var(--primary-light)" />
              </motion.div>
              <h1>Добро пожаловать в MichaelGPT</h1>
              <p>Ваш персональный AI-ассистент</p>
              <button className="btn btn-primary" onClick={createNewChat}>
                <Plus size={20} />
                Начать новый чат
              </button>
            </div>
          ) : msgsLength === 0 ? (
            <div className="empty-chat">
              <MessageSquare size={64} color="var(--text-muted)" />
              <h3>Начните беседу</h3>
              <p>Задайте вопрос или обсудите любую тему</p>
            </div>
          ) : (
            <>
              {renderedMessages}
              {isLoading && !streamingMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="message assistant"
                >
                  <div className="message-avatar">
                    <div className="ai-avatar">
                      <Sparkles size={20} />
                    </div>
                  </div>
                  <div className="message-content">
                    <div className="message-text">
                      <span>Печатает...</span>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="input-container">
          {aiQuota && !aiQuota.hasUnlimited && (
            <div className="ai-quota-box">
              <div className="ai-quota-top">
                <span>
                  Осталось сообщений: <b>{aiQuota.remaining}</b> из {aiQuota.limit}
                  <span className="ai-quota-timer"> · сброс через {formatHms(aiQuotaResetSeconds)}</span>
                </span>
                <span>{aiQuota.remaining}/{aiQuota.limit}</span>
              </div>
              <div className="ai-quota-track">
                <div
                  className={`ai-quota-fill ${aiQuotaReached ? 'danger' : ''}`}
                  style={{ width: `${aiQuotaRemainingPercent}%` }}
                />
              </div>
            </div>
          )}
          <div className="input-wrapper">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите сообщение..."
              rows={1}
              disabled={!currentChat || isLoading || aiQuotaReached}
            />
            <div className="response-mode-box" ref={modeMenuRef}>
              <button
                type="button"
                className="response-mode-toggle"
                onClick={() => setModeMenuOpen((prev) => !prev)}
                disabled={isLoading}
                title="Режим ответа"
              >
                <span>{selectedModeLabel}</span>
                <ChevronDown size={15} />
              </button>
              <AnimatePresence>
                {modeMenuOpen && (
                  <motion.div
                    className="response-mode-menu"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.12 }}
                  >
                    {modeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`response-mode-item ${responseMode === option.value ? 'active' : ''}`}
                        onClick={() => {
                          setResponseMode(option.value);
                          setModeMenuOpen(false);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              className="btn btn-primary send-btn"
              onClick={sendMessage}
              disabled={
                !inputValue.trim() || !currentChat || isLoading || aiQuotaReached
              }
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m22 2-7 20-4-9-9-4Z" />
                <path d="M22 2 11 13" />
              </svg>
            </button>
          </div>
          <p className="input-hint">
            MichaelGPT может допускать ошибки. Проверяйте важную информацию.
          </p>
        </div>
      </main>

      <Suspense fallback={null}>
        <ProfileModal
          isOpen={profileModalOpen}
          onClose={() => setProfileModalOpen(false)}
          user={user}
          stats={profileStats}
          isLoading={profileStatsLoading}
          modalRef={profileModalRef}
          updateUser={updateUser}
        />
      </Suspense>

      <Suspense fallback={null}>
        <UpdateModal
          isOpen={updateModalOpen}
          onClose={() => setUpdateModalOpen(false)}
        />
      </Suspense>

      <Suspense fallback={null}>
        <GlobalChatWidget user={user} />
      </Suspense>
    </div>
  );
}
