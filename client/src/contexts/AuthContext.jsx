import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { clearStoredToken, getStoredToken, setStoredToken } from '../utils/authToken';

const AuthContext = createContext(null);
const authQueryKey = (token) => ['auth', 'me', token ?? 'guest'];

async function fetchCurrentUser() {
  const { data } = await api.get('/auth/me');
  return data.user;
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState(() => getStoredToken());

  const {
    data: user = null,
    isLoading,
    isFetching,
    isError,
  } = useQuery({
    queryKey: authQueryKey(token),
    queryFn: fetchCurrentUser,
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (!token || !isError) return;

    clearStoredToken();
    setToken(null);
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
  }, [isError, queryClient, token]);

  const loading = Boolean(token) && (isLoading || (isFetching && !user));

  const login = useCallback(async (email, password) => {
    const existingToken = getStoredToken();
    if (existingToken) {
      try {
        await api.post('/auth/logout');
      } catch (_error) {}
    }

    const { data } = await api.post('/auth/login', { email, password });
    setStoredToken(data.token);
    setToken(data.token);
    queryClient.setQueryData(authQueryKey(data.token), data.user);
    return data;
  }, [queryClient]);

  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    setStoredToken(data.token);
    setToken(data.token);
    queryClient.setQueryData(authQueryKey(data.token), data.user);
    return data;
  }, [queryClient]);

  const logout = useCallback(() => {
    api.post('/auth/logout').catch(() => {});
    clearStoredToken();
    setToken(null);
    queryClient.removeQueries({ queryKey: ['auth', 'me'] });
  }, [queryClient]);

  const updateUser = useCallback((patch) => {
    if (!token) return;

    queryClient.setQueryData(authQueryKey(token), (previousUser) =>
      previousUser ? { ...previousUser, ...patch } : previousUser
    );
  }, [queryClient, token]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateUser }),
    [user, loading, login, register, logout, updateUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
