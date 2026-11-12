import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, tokens } from './organizerApi.js';

const AuthContext = createContext(null);
export const useOrganizerAuth = () => useContext(AuthContext);

export function OrganizerAuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(tokens.access));
  const [handoffPending, setHandoffPending] = useState(false);

  useEffect(() => {
    if (!tokens.access) return undefined;
    let active = true;
    authApi.me()
      .then((data) => { if (active) setUser(data?.user ?? data); })
      .catch(() => { tokens.clear(); if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const onSignedOut = () => setUser(null);
    window.addEventListener('giving:signed-out', onSignedOut);
    return () => window.removeEventListener('giving:signed-out', onSignedOut);
  }, []);

  const verifyOtp = useCallback(async (payload) => {
    const result = await authApi.verifyOtp(payload);
    setUser(result?.user ?? null);
    return result;
  }, []);

  const logout = useCallback(() => { tokens.clear(); setUser(null); }, []);

  const value = useMemo(() => ({
    user, loading, isAuthenticated: Boolean(user), verifyOtp, logout, handoffPending, setHandoffPending,
    login: authApi.login, register: authApi.register, sendOtp: authApi.sendOtp,
  }), [user, loading, verifyOtp, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
