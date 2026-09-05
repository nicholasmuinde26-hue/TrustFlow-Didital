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

  // Set by LoginPage/RegisterPage right before they authenticate the
  // user (verifyOtp), and cleared once they've finished routing the
  // person themselves (workspace picker or /home fallback). While
  // true, GuestRoute must NOT auto-redirect on its own — otherwise it
  // races the page's own post-auth navigation and yanks the user
  // straight to /home the instant isAuthenticated flips true, before
  // the workspace-type/workspace picker ever gets a chance to render.
  const [suppressGuestRedirect, setSuppressGuestRedirect] = useState(false);

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

  async function getOtpChannels(phone) {
    return authService.getOtpChannels(phone);
  }

  //-----------------------------------------------------

  async function logout() {
    try {
      await authService.logout();
    } finally {
      localStorage.removeItem("access_token");
      setUser(null);
      setSuppressGuestRedirect(false);
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
      getOtpChannels,
      logout,
      refresh: loadUser,
      suppressGuestRedirect,
      setSuppressGuestRedirect,
    }),
    [user, loading, suppressGuestRedirect]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}