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
  uploadFile(file, onProgress) {
    const formData = new FormData();
    formData.append('files', file);

    return api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress(event) {
        if (!onProgress || !event.total) return;
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress(progress);
      },
    });
  },
  getAiQuota() {
    return api.get('/ai/status');
  },
  getProfileStats() {
    return api.get('/user/stats');
  },
};
