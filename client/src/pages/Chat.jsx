import { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { flushSync } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import api from '../utils/api';
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
import ProfileModal from './ProfileModal';
import UpdateModal from './UpdateModal';
import GlobalChatWidget from '../components/GlobalChatWidget';

function formatMessageTime(value) {
  if (!value) return '';
  const raw = String(value);
  const normalized = raw.includes('T') || raw.endsWith('Z') ? raw : raw.replace(' ', 'T') + 'Z';
  return new Date(normalized).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

const Message = memo(function Message({ message, index, copiedId, copyMessage, copiedCodeKey, copyCode, currentUser }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: message.role === 'assistant' ? 8 : 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.12 }}
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
              {message.content}
            </ReactMarkdown>
          ) : (
            message.content
          )}
        </div>
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
      </div>
    </motion.div>
  );
});

export default function Chat() {
  const { user, logout, updateUser } = useAuth();
  const [chats, setChats] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const userMenuRef = useRef(null);
  const modeMenuRef = useRef(null);
  const profileModalRef = useRef(null);
  const currentChatIdRef = useRef(null);
  const messagesRequestSeqRef = useRef(0);
  const backgroundRef = useRef(null);

  useEffect(() => {
    currentChatIdRef.current = currentChat?.id ?? null;
  }, [currentChat?.id]);

  useEffect(() => {
    loadChats();
    loadAiQuota();
  }, []);

  useEffect(() => {
    if (!userMenuOpen) return;
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!modeMenuOpen) return;
    const handleClickOutside = (e) => {
      if (modeMenuRef.current && !modeMenuRef.current.contains(e.target)) {
        setModeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [modeMenuOpen]);

  useEffect(() => {
    if (!profileModalOpen) return;
    const handle = (e) => {
      if (profileModalRef.current && !profileModalRef.current.contains(e.target)) {
        setProfileModalOpen(false);
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [profileModalOpen]);

  useEffect(() => {
    if (currentChat?.id) {
      loadMessages(currentChat.id);
      setUserMenuOpen(false);
    }
  }, [currentChat?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    if (!aiQuota?.resetAtMs) return undefined;
    const timer = setInterval(() => setQuotaNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  const openProfileModal = async () => {
    setProfileModalOpen(true);
    if (profileStats) return;
    setProfileStatsLoading(true);
    try {
      const { data } = await api.get('/user/stats');
      setProfileStats(data);
    } catch (error) {
      console.error('Ошибка загрузки статистики:', error);
    } finally {
      setProfileStatsLoading(false);
    }
  };

  const openUpdateModal = () => {
    console.log('UpdateModal: opening manually');
    setUpdateModalOpen(true);
  };

  useEffect(() => {
    const isDisabled = localStorage.getItem('michaelgpt_disable_updates');
    console.log('UpdateModal: isDisabled =', isDisabled);
    if (!isDisabled) {
      const lastSeen = localStorage.getItem('michaelgpt_last_update_seen');
      console.log('UpdateModal: lastSeen =', lastSeen);
      if (!lastSeen) {
        console.log('UpdateModal: first visit, showing modal');
        setTimeout(() => {
          setUpdateModalOpen(true);
          localStorage.setItem('michaelgpt_last_update_seen', new Date().toISOString());
          console.log('UpdateModal: modal opened');
        }, 1000);
      } else {
        console.log('UpdateModal: not first visit, showing modal anyway');
        setTimeout(() => {
          setUpdateModalOpen(true);
        }, 1000);
      }
    } else {
      console.log('UpdateModal: updates disabled by user');
    }
  }, []);

  const loadAiQuota = async () => {
    try {
      const { data } = await api.get('/ai/status');
      setAiQuota(data?.quota || null);
    } catch (_error) {
      setAiQuota(null);
    }
  };

  const loadChats = async () => {
    try {
      const { data } = await api.get('/chats');
      setChats(data.chats);
      if (data.chats.length > 0 && !currentChat) {
        setCurrentChat(data.chats[0]);
      }
    } catch (error) {
      console.error('Ошибка загрузки чатов:', error);
    }
  };

  const loadMessages = async (chatId) => {
    const requestSeq = ++messagesRequestSeqRef.current;
    try {
      const { data } = await api.get(`/chats/${chatId}/messages`);
      if (currentChatIdRef.current !== chatId) return;
      if (messagesRequestSeqRef.current !== requestSeq) return;
      setMessages((prev) => {
        const pendingMessages = prev.filter((m) => m.isPending);
        if (!pendingMessages.length) return data.messages;
        return [...data.messages, ...pendingMessages];
      });
    } catch (error) {
      console.error('Ошибка загрузки сообщений:', error);
    }
  };

  const createNewChat = async () => {
    try {
      const { data } = await api.post('/chats', { title: 'Новый чат' });
      setChats([data.chat, ...chats]);
      setCurrentChat(data.chat);
      setMessages([]);
      setUserMenuOpen(false);
      inputRef.current?.focus();
    } catch (error) {
      console.error('Ошибка создания чата:', error);
    }
  };

  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    try {
      await api.delete(`/chats/${chatId}`);
      setChats(chats.filter((c) => c.id !== chatId));
      if (currentChat?.id === chatId) {
        setCurrentChat(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Ошибка удаления чата:', error);
    }
  };

  const displayChats = chats;

  const startEditingChat = (chat, e) => {
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const saveChatTitle = async () => {
    if (!editTitle.trim() || !currentChat) return;

    try {
      const { data } = await api.put(`/chats/${currentChat.id}`, { title: editTitle });
      setChats(chats.map((c) => (c.id === currentChat.id ? data.chat : c)));
      setCurrentChat(data.chat);
      setEditingChatId(null);
    } catch (error) {
      console.error('Ошибка обновления чата:', error);
    }
  };

  const cancelEditing = () => {
    setEditingChatId(null);
    setEditTitle('');
  };

  const waitNextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

  const formatHms = (seconds) => {
    const s = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const sendMessage = async () => {
    const content = inputValue.trim();
    const aiQuotaReached =
      aiQuota && !aiQuota.hasUnlimited && Number(aiQuota.remaining) <= 0;
    if (!content || isLoading || aiQuotaReached) return;

    const nowIso = new Date().toISOString();
    const localId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const makeUserMessage = () => ({
      id: localId,
      localId,
      role: 'user',
      content,
      created_at: nowIso,
      isPending: true,
    });

    const makeErrorMessage = (text) => ({
      id: `local-error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'assistant',
      content: `⚠️ ${text}`,
      created_at: new Date().toISOString(),
      isError: true,
    });

    const getErrorText = (error) => {
      if (error?.response?.data?.details) return error.response.data.details;
      if (error?.response?.data?.error) return error.response.data.error;
      if (error?.message) return error.message;
      return 'Ошибка соединения с сервером';
    };

    const pushAuthed = (msg) => setMessages((prev) => [...prev, msg]);

    setInputValue('');

    if (!currentChat) {
      setIsLoading(false);
      return;
    }

    const wasFirstMessage = messages.length === 0;
    const userMessage = makeUserMessage();
    flushSync(() => {
      pushAuthed(userMessage);
    });
    await waitNextFrame();
    setIsLoading(true);

    try {
      const { data } = await api.post(`/chats/${currentChat.id}/messages`, {
        content,
        responseMode,
      });

      setMessages((prev) => {
        const replaced = prev.map((m) =>
          m.localId === localId ? { ...data.userMessage, localId, isPending: false } : m
        );
        const hasAiMessage = replaced.some((m) => m.id === data.aiMessage.id);
        if (hasAiMessage) return replaced;
        return [...replaced, data.aiMessage];
      });

      if (wasFirstMessage) {
        const newTitle = content.slice(0, 30) + (content.length > 30 ? '...' : '');
        const { data: chatData } = await api.put(`/chats/${currentChat.id}`, { title: newTitle });
        setCurrentChat(chatData.chat);
        setChats((chats) => chats.map((c) => (c.id === currentChat.id ? chatData.chat : c)));
      }

      setProfileStats(null);
      await loadAiQuota();
    } catch (error) {
      const errText = getErrorText(error);
      const isRateLimit = errText.includes('Rate limit') || errText.includes('rate_limit');
      const displayText = isRateLimit
        ? 'Превышен лимит запросов к AI. Попробуйте через несколько минут.'
        : errText;
      setMessages((prev) =>
        prev.map((m) => (m.localId === localId ? { ...m, isPending: false, isError: true } : m))
      );
      pushAuthed(makeErrorMessage(displayText));
      if (error?.response?.data?.quota) {
        setAiQuota(error.response.data.quota);
      } else {
        await loadAiQuota();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const copyMessage = useCallback(async (content, id) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = content;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Ошибка копирования:', err);
    }
  }, []);

  const copyCode = useCallback(async (code, key) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCodeKey(key);
      setTimeout(() => setCopiedCodeKey(null), 2000);
    } catch (err) {
      console.error('Ошибка копирования кода:', err);
    }
  }, []);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const msgs = messages;
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
      msgs.map((message, index) => (
        <Message
          key={message.id}
          message={message}
          index={index}
          copiedId={copiedId}
          copyMessage={copyMessage}
          copiedCodeKey={copiedCodeKey}
          copyCode={copyCode}
          currentUser={user}
        />
      )),
    [msgs, copiedId, copyMessage, copiedCodeKey, copyCode]
  );
  const modeOptions = [
    { value: 'balanced', label: 'Стандарт' },
    { value: 'short', label: 'Кратко' },
    { value: 'deep', label: 'Глубоко' },
  ];
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
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
            className="sidebar"
          >
            <div className="sidebar-header">
              <div className="logo">
                <div className="logo-icon">
                  <Sparkles size={24} color="white" />
                </div>
                <span className="logo-text">MichaelGPT</span>
                <span className="logo-badge">beta test</span>
              </div>
            </div>

            <button className="btn btn-primary new-chat-btn" onClick={createNewChat}>
              <Plus size={20} />
              Новый чат
            </button>

            <div className="chats-list">
              {displayChats.map((chat) => (
                <motion.div
                  key={chat.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`chat-item ${currentChat?.id === chat.id ? 'active' : ''}`}
                  onClick={() => setCurrentChat(chat)}
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
              {displayChats.length === 0 && (
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
              {isLoading && (
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
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
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

      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        stats={profileStats}
        isLoading={profileStatsLoading}
        modalRef={profileModalRef}
        updateUser={updateUser}
      />

      <UpdateModal
        isOpen={updateModalOpen}
        onClose={() => setUpdateModalOpen(false)}
      />

      <GlobalChatWidget user={user} />
    </div>
  );
}






