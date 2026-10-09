import { useCallback, useEffect, useState } from "react";

import financeService from "../services/finance.service";

// ============================================================
// WORKSPACE PERMISSIONS
// ============================================================
//
// Asks the API what the current user may actually do, instead of the UI
// keeping its own copy of the role matrix.
//
// This distinction matters most on Record Contribution. Only the
// treasurer holds `contributions.record` at 'all' scope; a chairperson's
// grant is deliberately 'own' (see DEFAULT_ROLE_PERMISSIONS on the
// backend), and createPayment 403s any non-'all' scope that isn't an
// M-Pesa push to the member's own phone. A hardcoded role list in the
// frontend drifts from that and ends up offering people buttons the API
// rejects.
//
// Returns:
//   can(key)        - does the caller hold this permission at all
//   scopeOf(key)    - 'all' | 'own' | 'limited' | null
//   canForOthers(k) - does the caller hold it at 'all' scope
//
// ============================================================

export default function useWorkspacePermissions(workspaceId) {
  const [state, setState] = useState({
    role: null,
    permissions: {},
    membershipId: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!workspaceId) {
      setState({ role: null, permissions: {}, membershipId: null });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const result = await financeService.getPermissions(workspaceId);
      setState({
        role: result.role,
        permissions: result.permissions || {},
        membershipId: result.membership_id,
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  const scopeOf = useCallback(
    (key) => state.permissions?.[key] ?? null,
    [state.permissions]
  );

  const can = useCallback((key) => Boolean(scopeOf(key)), [scopeOf]);

  const canForOthers = useCallback((key) => scopeOf(key) === "all", [scopeOf]);

  return {
    role: state.role,
    membershipId: state.membershipId,
    permissions: state.permissions,
    isLoading,
    can,
    scopeOf,
    canForOthers,
    refetch: load,
  };
}