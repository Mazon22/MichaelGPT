import api from '../utils/api';

export const GLOBAL_CHAT_MESSAGES_LIMIT = 80;

export const globalChatQueryKeys = {
  latestMessage: () => ['global-chat', 'latest-message'],
  messages: (limit = GLOBAL_CHAT_MESSAGES_LIMIT) => ['global-chat', 'messages', limit],
  online: () => ['global-chat', 'online'],
  myStatus: () => ['global-chat', 'my-status'],
  userProfile: (userId) => ['global-chat', 'user-profile', userId],
};

export async function fetchGlobalChatMessages(limit = GLOBAL_CHAT_MESSAGES_LIMIT) {
  const { data } = await api.get(`/global-chat/messages?limit=${limit}`);
  return data?.messages || [];
}

export async function fetchGlobalChatLatestMessage() {
  const messages = await fetchGlobalChatMessages(1);
  return messages[0] || null;
}

export async function fetchGlobalChatStatus() {
  const { data } = await api.get('/global-chat/me/status');

  return {
    banInfo: data?.isBanned ? data?.ban || null : null,
    cooldown: data?.cooldown || null,
  };
}

export async function fetchGlobalChatOnline() {
  const { data } = await api.get('/global-chat/online');
  return {
    count: Number(data?.count) || 0,
    windowMinutes: Number.isFinite(Number(data?.windowMinutes)) ? Number(data.windowMinutes) : 2,
  };
}

export async function sendGlobalChatMessage(content) {
  const { data } = await api.post('/global-chat/messages', { content });
  return data?.message || null;
}

export async function deleteGlobalChatMessage(messageId) {
  await api.delete(`/global-chat/messages/${messageId}`);
  return messageId;
}

export async function fetchGlobalChatUserProfile(userId) {
  const { data } = await api.get(`/global-chat/users/${userId}/profile`);
  return data?.profile || null;
}
