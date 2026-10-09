import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import workspaceModulesApi from "../api/workspaceModules.api";

const CATALOG_KEY = ["workspace-modules", "catalog"];
const settingsKey = (chamaId) => ["workspace-modules", "settings", chamaId];

/** The module + preset catalog. Static, so cache it for the whole session. */
export function useModuleCatalog() {
  return useQuery({
    queryKey: CATALOG_KEY,
    queryFn: workspaceModulesApi.catalog,
    staleTime: Infinity,
  });
}

/** Current setup, what blocks switching things off, and any pending request. */
export function useModuleSettings(chamaId, enabled = true) {
  return useQuery({
    queryKey: settingsKey(chamaId),
    queryFn: () => workspaceModulesApi.settings(chamaId),
    enabled: Boolean(chamaId) && enabled,
    refetchOnWindowFocus: true,
  });
}

// Requests stay pending until platform administration applies the change.
export function useModuleChangeMutations(chamaId) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: settingsKey(chamaId) });

  const request = useMutation({
    mutationFn: ({ modules, note }) => workspaceModulesApi.request(chamaId, { modules, note }),
    onSuccess: refresh,
  });

  const cancel = useMutation({
    mutationFn: ({ requestId, reason }) => workspaceModulesApi.cancel(chamaId, requestId, reason),
    onSuccess: refresh,
  });

  return { request, cancel };
}
