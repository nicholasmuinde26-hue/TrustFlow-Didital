import { QueryClient } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,

      refetchOnWindowFocus: false,

      refetchOnReconnect: true,

      staleTime: 1000 * 60 * 5, // 5 minutes

      gcTime: 1000 * 60 * 30, // 30 minutes
    },

    mutations: {
      retry: 1,
    },
  },
});

export default queryClient;