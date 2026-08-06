import { QueryClient } from "@tanstack/react-query";

/**
 * Global React Query client. Sensible defaults for a mobile app:
 * - retry only network errors (not 4xx)
 * - stale after 30s for lists, always refetch on app focus
 * - long GC time so navigating between tabs keeps data warm
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.response?.status && error.response.status >= 400 && error.response.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: false,
    },
  },
});
