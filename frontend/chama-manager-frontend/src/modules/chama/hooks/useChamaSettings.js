import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import chamaService from "../services/chama.service";

function chamaSettingsKey(chamaId) {
  return ["chama-settings", chamaId];
}

export function useChamaSettings(chamaId) {
  return useQuery({
    queryKey: chamaSettingsKey(chamaId),
    queryFn: async () => {
      const [chama, profile] = await Promise.all([
        chamaService.get(chamaId),
        chamaService.getProfile(chamaId),
      ]);

      return { chama, profile: profile || {} };
    },
    enabled: Boolean(chamaId),
  });
}

export function useUpdateChamaSettings(chamaId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ chamaUpdates, profileUpdates }) => {
      const tasks = [];

      if (chamaUpdates && Object.keys(chamaUpdates).length > 0) {
        tasks.push(chamaService.update(chamaId, chamaUpdates));
      }

      if (profileUpdates && Object.keys(profileUpdates).length > 0) {
        tasks.push(chamaService.saveProfile(chamaId, profileUpdates));
      }

      await Promise.all(tasks);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: chamaSettingsKey(chamaId) });
    },
  });
}
