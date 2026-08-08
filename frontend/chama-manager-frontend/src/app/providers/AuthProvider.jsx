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
    // OTP-first flow: this only verifies phone+password and triggers
    // an SMS OTP. It returns { otpRequired, phone, message } — no
    // token yet. Tokens are only issued after verifyOtp() succeeds.
    return authService.login(credentials);
  }

  //-----------------------------------------------------

  async function register(payload) {
    // Same as login: creates an unverified account and sends the OTP.
    // No token until verifyOtp() completes the flow.
    return authService.register(payload);
  }

  //-----------------------------------------------------

  async function verifyOtp(payload) {
    const data = await authService.verifyOtp(payload);

    // authService.verifyOtp already persists accessToken/refreshToken
    // to localStorage — just sync the user into context here.
    setUser(data.user ?? null);

    return data;
  }

  //-----------------------------------------------------

  async function sendOtp(payload) {
    return authService.sendOtp(payload);
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
      verifyOtp,
      sendOtp,
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