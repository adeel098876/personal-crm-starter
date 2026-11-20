import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Cache successful responses for 30 seconds to avoid refetch on navigation
        staleTime: 30_000,
        // Keep unused cache for 5 minutes before garbage collection
        gcTime: 5 * 60 * 1000,
        // Retry failed queries once before showing error
        retry: 1,
        // Don't refetch on window focus if data is fresh
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
