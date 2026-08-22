import api from "@/app/services/api";

// Matches backend/src/modules/auth/auth.routes.js:
// POST /auth/login      { phone, password }        -> Step 1: Validates pass, sends OTP
// POST /auth/register   { name, phone, password }  -> Step 1: Creates account, sends OTP
// POST /auth/verify-otp { phone, otpCode }         -> Step 2: Verifies code, returns JWT tokens
// POST /auth/send-otp   { phone }                  -> Resend/Standalone OTP
// POST /auth/refresh    { refreshToken }           -> Silent token rotation
// GET  /auth/me                                    -> Current user profile
//
// Client-side logout clears localStorage tokens.
const authApi = {
  login(credentials) {
    return api.post("/auth/login", credentials);
  },

  register(payload) {
    return api.post("/auth/register", payload);
  },

  verifyOtp(payload) {
    return api.post("/auth/verify-otp", payload);
  },

  sendOtp(payload) {
    return api.post("/auth/send-otp", payload);
  },

  // GET /auth/otp-channels?identifier=... -> { availableChannels: [{channel,label}] }
  getOtpChannels(identifier) {
    const params = typeof identifier === "object" ? identifier : { identifier };
    return api.get("/auth/otp-channels", { params });
  },

  refresh(refreshToken) {
    return api.post("/auth/refresh", { refreshToken });
  },

  me() {
    return api.get("/auth/me");
  },

  updateProfile(payload) {
    return api.patch("/auth/me", payload);
  },
};

export default authApi;