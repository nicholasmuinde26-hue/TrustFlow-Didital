import { MutationCache, QueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

/**
 * Global feedback for every mutation (create / update / delete) in the app.
 *
 *  - A mutation that FAILS and has no onError of its own used to fail silently.
 *    It now shows one error popup, so the user always learns that a change
 *    did not go through. Opt out with `meta: { silent: true }`.
 *  - A mutation can ask for a success popup with `meta: { successMessage: "Saved" }`
 *    (a function receiving the result is also accepted). Mutations that already
 *    toast on success are unaffected - this is opt-in so nothing shows twice.
 */
const errorMessage = (error) =>
  error?.response?.data?.message ||
  (error?.code === "ERR_NETWORK" ? "You appear to be offline. Check your connection and try again." : null) ||
  error?.message ||
  "That change could not be saved. Please try again.";

const mutationCache = new MutationCache({
  onSuccess: (data, variables, _context, mutation) => {
    const message = mutation.meta?.successMessage;
    if (!message) return;
    toast.success(typeof message === "function" ? message(data, variables) : message);
  },
  onError: (error, _variables, _context, mutation) => {
    if (mutation.meta?.silent) return;
    if (typeof mutation.options?.onError === "function") return;
    toast.error(mutation.meta?.errorMessage || errorMessage(error), { id: "mutation-error" });
  },
});

const queryClient = new QueryClient({
  mutationCache,
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
