import { useMutation, useQueryClient } from "@tanstack/react-query";

import useAuth from "@/app/hooks/useAuth";
import authService from "../services/auth.service";

export default function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();

  return useMutation({
    mutationFn: (payload) => authService.updateProfile(payload),

    onSuccess: async (updatedUser) => {
      queryClient.setQueryData(["auth", "me"], updatedUser);
      queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });

      if (refresh) {
        await refresh();
      }
    },
  });
}
