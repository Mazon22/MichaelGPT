import axios from 'axios';
import { clearStoredToken, getStoredToken } from './authToken';

const host = window.location.hostname;
const isLocalHost = host === 'localhost' || host === '127.0.0.1';
const rawApiUrl =
  import.meta.env.VITE_API_URL ||
  (isLocalHost
    ? `${window.location.protocol}//${host}:5000`
    : window.location.origin);

const API_URL = rawApiUrl.endsWith('/api') ? rawApiUrl : `${rawApiUrl}/api`;
const shouldLogRequests = import.meta.env.DEV;
let isRedirectingAfterAuthError = false;

const publicRoutes = new Set([
  '/auth/login',
  '/auth/register',
  '/global-chat/messages',
  '/global-chat/online',
]);

const publicRouteMatchers = [
  /^\/global-chat\/users\/\d+\/profile$/,
];

function normalizeUrlPath(url = '') {
  const path = url.startsWith('http')
    ? new URL(url).pathname
    : url;

  return path.replace(/\/api(?=\/)/, '').split('?')[0];
}

function shouldAttachAuthHeader(config) {
  if (config.skipAuth) return false;

  const path = normalizeUrlPath(config.url);
  if (publicRoutes.has(path)) return false;
  return !publicRouteMatchers.some((matcher) => matcher.test(path));
}

const api = axios.create({
  baseURL: API_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token && shouldAttachAuthHeader(config)) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (shouldLogRequests) {
    console.log('API Request:', config.method, config.url);
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (shouldLogRequests) {
      console.log('API Response:', response.status);
    }
    return response;
  },
  (error) => {
    if (shouldLogRequests) {
      console.error('API Error:', error.message, error.response?.data);
    }

    if (error.response?.status === 401) {
      clearStoredToken();

      const isAuthPage = window.location.pathname === '/login' || window.location.pathname === '/register';
      if (!isAuthPage && !isRedirectingAfterAuthError) {
        isRedirectingAfterAuthError = true;
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
