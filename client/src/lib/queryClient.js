import { QueryClient } from '@tanstack/react-query';

function retryDelay(attemptIndex) {
  return Math.min(1000 * 2 ** attemptIndex, 30000);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      retryDelay,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function getAdaptiveRefetchInterval(baseMs, maxMs) {
  return (query) => {
    const failureCount = query.state.fetchFailureCount || 0;
    return Math.min(baseMs * 2 ** failureCount, maxMs);
  };
}
