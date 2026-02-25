import axios from 'axios';

const host = window.location.hostname;
const defaultApiHost = host === 'localhost' || host === '127.0.0.1' ? host : '127.0.0.1';
const rawApiUrl =
  import.meta.env.VITE_API_URL ||
  `${window.location.protocol}//${defaultApiHost}:5000`;

const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('API Request:', config.method, config.url);
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log('API Response:', response.status);
    return response;
  },
  (error) => {
    console.error('API Error:', error.message, error.response?.data);
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
