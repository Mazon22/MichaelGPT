import api from '../utils/api';

export const chatService = {
  getChats() {
    return api.get('/chats');
  },
  createChat(title = 'Новый чат') {
    return api.post('/chats', { title });
  },
  updateChat(chatId, title) {
    return api.put(`/chats/${chatId}`, { title });
  },
  deleteChat(chatId) {
    return api.delete(`/chats/${chatId}`);
  },
  getMessages(chatId) {
    return api.get(`/chats/${chatId}/messages`);
  },
  sendMessage(chatId, payload) {
    return api.post(`/chats/${chatId}/messages`, payload);
  },
  getAiQuota() {
    return api.get('/ai/status');
  },
  getProfileStats() {
    return api.get('/user/stats');
  },
};
