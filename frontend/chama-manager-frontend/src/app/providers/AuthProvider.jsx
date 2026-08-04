import {
  useEffect,
  useMemo,
  useState,
} from "react";

import AuthContext from "../store/auth.store";

import authService from "@/modules/auth/services/auth.service";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  //-----------------------------------------------------

  async function loadUser() {
    const token = localStorage.getItem("access_token");

    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await authService.me();
      setUser(data.user ?? data);
    } catch {
      localStorage.removeItem("access_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUser();
  }, []);

  //-----------------------------------------------------

  async function login(credentials) {
    const data = await authService.login(credentials);
    const token = data.access_token || data.token;

    if (token) {
      localStorage.setItem("access_token", token);
    }

    setUser(data.user ?? null);

    return data;
  }

  //-----------------------------------------------------

  async function register(payload) {
    const data = await authService.register(payload);
    const token = data.access_token || data.token;

    if (token) {
      localStorage.setItem("access_token", token);
      setUser(data.user ?? null);
    }

    return data;
  }

  //-----------------------------------------------------

  async function logout() {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem("access_token");
      setUser(null);
    }
  }

  //-----------------------------------------------------

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
      refresh: loadUser,
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}