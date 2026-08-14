import authApi from "../api/auth.api";

// Helper to store tokens across both key conventions
const setAuthTokens = (accessToken, refreshToken) => {
  if (accessToken) {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("access_token", accessToken);
  }
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("refresh_token", refreshToken);
  }
};

// Helper to clear stored tokens
const clearAuthTokens = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("access_token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("refresh_token");
};

const authService = {
  // Step 1: Login with Phone & Password (Triggers SMS OTP)
  async login(credentials) {
    const { data } = await authApi.login(credentials);
    return data.data || data;
  },

  // Step 1: Register Account (Triggers SMS OTP)
  async register(payload) {
    const { data } = await authApi.register(payload);
    return data.data || data;
  },

  // Step 2: Finalize Auth by Verifying 6-Digit OTP (Saves Tokens & Returns User)
  async verifyOtp(payload) {
    const { data } = await authApi.verifyOtp(payload);
    const result = data.data || data;

    if (result?.accessToken) {
      setAuthTokens(result.accessToken, result.refreshToken);
    }

    return result;
  },

  // Standalone or Resend OTP
  async sendOtp(payload) {
    const { data } = await authApi.sendOtp(payload);
    return data.data || data;
  },

  // Which channels (sms/email/whatsapp) can this phone number receive an OTP on
  async getOtpChannels(phone) {
    const { data } = await authApi.getOtpChannels(phone);
    return data.data || data;
  },

  // Rotate Access Token using Refresh Token
  async refresh(refreshToken) {
    const { data } = await authApi.refresh(refreshToken);
    const result = data.data || data;

    if (result?.accessToken) {
      setAuthTokens(result.accessToken, result.refreshToken);
    }

    return result;
  },

  // Fetch current authenticated user
  async me() {
    const { data } = await authApi.me();
    return data.data || data;
  },

  async updateProfile(payload) {
    const { data } = await authApi.updateProfile(payload);
    const result = data.data || data;
    return result.user || result;
  },

  // Client-side token clearing
  async logout() {
    clearAuthTokens();
    return Promise.resolve();
  },
};

export default authService;