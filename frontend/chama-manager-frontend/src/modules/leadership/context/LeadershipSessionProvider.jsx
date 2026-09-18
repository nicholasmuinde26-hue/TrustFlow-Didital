import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import leadershipApi from "../api/leadership.api";
import { registerLeadershipSession } from "../session/leadershipSessionBridge";
import StepUpPinModal from "../components/StepUpPinModal";

// ========================================
// LEADERSHIP SESSION PROVIDER
// ========================================
//
// Holds the desk token for the Leadership Desk, IN MEMORY ONLY.
//
// That is the whole implementation of "re-locks every time you navigate
// away and back": the token lives in React state, the Leadership Desk
// clears it on unmount, and a full page reload starts from nothing.
// Putting it in localStorage/sessionStorage would quietly defeat the
// feature — and on a shared phone (very much the norm for a Kenyan
// chama treasurer) a persisted unlock is the exact failure mode the PIN
// exists to prevent.
//
// The provider also owns the global step-up prompt. Any API call
// anywhere in the app that comes back with LEADERSHIP_STEP_UP_REQUIRED
// causes the axios interceptor to call requestStepUp() here; we render
// a modal, await the PIN, and hand the interceptor a token to retry
// with. Calling pages need to know nothing about it.
//
// ========================================

const LeadershipSessionContext = createContext(null);

export function LeadershipSessionProvider({ children }) {
  // { token, expiresAt, chamaId } | null
  const [session, setSession] = useState(null);

  // Why the session ended, so the gate can explain itself ("your PIN
  // changed", "your role changed") rather than silently re-prompting.
  const [invalidationReason, setInvalidationReason] = useState(null);

  // The in-flight step-up request, if any. Held in a ref because the
  // axios interceptor resolves it from outside the React tree.
  const [stepUpRequest, setStepUpRequest] = useState(null);
  const stepUpResolvers = useRef(null);

  // Mirror of `session` for the bridge: the axios request interceptor is
  // synchronous and runs outside render, so it reads the ref rather than
  // a state value captured in a stale closure.
  const sessionRef = useRef(null);
  sessionRef.current = session;

  const clearSession = useCallback((reason = null) => {
    setSession(null);
    setInvalidationReason(reason);
  }, []);

  const adoptSession = useCallback((minted, chamaId) => {
    if (!minted?.token) return;
    setSession({
      token: minted.token,
      expiresAt: minted.expiresAt || null,
      chamaId: String(chamaId),
    });
    setInvalidationReason(null);
  }, []);

  // ----------------------------------------------------------------
  // Step-up prompt, driven by the API layer
  // ----------------------------------------------------------------

  const requestStepUp = useCallback(({ action, chamaId, message }) => {
    return new Promise((resolve, reject) => {
      // Only one step-up can be pending at a time. A second concurrent
      // request (two risky calls fired together) is rejected rather than
      // silently stacking modals the user can't tell apart.
      if (stepUpResolvers.current) {
        reject(new Error("Another confirmation is already in progress"));
        return;
      }

      stepUpResolvers.current = { resolve, reject };
      setStepUpRequest({ action, chamaId, message });
    });
  }, []);

  const resolveStepUp = useCallback((token) => {
    const resolvers = stepUpResolvers.current;
    stepUpResolvers.current = null;
    setStepUpRequest(null);
    resolvers?.resolve(token);
  }, []);

  const cancelStepUp = useCallback(() => {
    const resolvers = stepUpResolvers.current;
    stepUpResolvers.current = null;
    setStepUpRequest(null);
    resolvers?.reject(new Error("Confirmation cancelled"));
  }, []);

  // ----------------------------------------------------------------
  // Register with the axios bridge
  // ----------------------------------------------------------------

  useEffect(() => {
    return registerLeadershipSession({
      getToken: () => sessionRef.current?.token || null,
      requestStepUp,
      invalidate: (reason) => clearSession(reason),
    });
  }, [requestStepUp, clearSession]);

  // ----------------------------------------------------------------
  // Expire on schedule
  //
  // The server enforces the real TTL; this timer just means the UI
  // re-gates at the right moment instead of letting the leader fill in
  // a long settings form against a token that died five minutes ago.
  // ----------------------------------------------------------------

  useEffect(() => {
    if (!session?.expiresAt) return undefined;

    const msRemaining = new Date(session.expiresAt).getTime() - Date.now();
    if (msRemaining <= 0) {
      clearSession("LEADERSHIP_SESSION_EXPIRED");
      return undefined;
    }

    const timer = setTimeout(
      () => clearSession("LEADERSHIP_SESSION_EXPIRED"),
      msRemaining
    );

    return () => clearTimeout(timer);
  }, [session?.expiresAt, clearSession]);

  const value = useMemo(
    () => ({
      session,
      invalidationReason,
      adoptSession,
      clearSession,
      // Unlocked for THIS chama specifically — a desk token minted for
      // one chama must never be treated as an unlock for another.
      isUnlockedFor: (chamaId) =>
        Boolean(session?.token) && String(session.chamaId) === String(chamaId),
    }),
    [session, invalidationReason, adoptSession, clearSession]
  );

  return (
    <LeadershipSessionContext.Provider value={value}>
      {children}

      {stepUpRequest && (
        <StepUpPinModal
          action={stepUpRequest.action}
          serverMessage={stepUpRequest.message}
          chamaId={stepUpRequest.chamaId || session?.chamaId}
          onConfirmed={resolveStepUp}
          onCancel={cancelStepUp}
          onSubmitPin={async (pin, chamaId) => {
            const minted = await leadershipApi.stepUp(chamaId, {
              pin,
              action: stepUpRequest.action,
            });
            return minted.token;
          }}
        />
      )}
    </LeadershipSessionContext.Provider>
  );
}

export function useLeadershipSession() {
  const context = useContext(LeadershipSessionContext);

  if (!context) {
    throw new Error(
      "useLeadershipSession must be used inside a LeadershipSessionProvider"
    );
  }

  return context;
}

export default LeadershipSessionProvider;
