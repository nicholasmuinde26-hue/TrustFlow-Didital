import axios from "axios";

import {
  readDeskToken,
  requestStepUpToken,
  invalidateDeskSession,
  DESK_SESSION_DEAD_CODES,
  STEP_UP_CODES,
} from "@/modules/leadership/session/leadershipSessionBridge";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Helper to clear stored auth data
const clearAuthStorage = () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("access_token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("refresh_token");
};

// Queue state for handling simultaneous requests during a token refresh
let isRefreshing = false;
let failedQueue = [];

const getDeviceId = () => {
  const key = "securityDeviceId";
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.() || `browser-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
};

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// ----------------------------------------------------------------------
// Request Interceptor: Attach Bearer Token
// ----------------------------------------------------------------------
api.interceptors.request.use((config) => {
  // A pseudonymous per-browser identifier lets Security correlate anomalous
  // auth activity without making a browser fingerprint part of authentication.
  config.headers["X-Device-Id"] = config.headers["X-Device-Id"] || getDeviceId();
  const token =
    localStorage.getItem("accessToken") ||
    localStorage.getItem("access_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  // Leadership Desk second factor. Deliberately NOT read from
  // localStorage: the desk is supposed to re-lock whenever the leader
  // navigates away, and a token sitting in storage would survive that
  // (and survive the tab being left open on a shared phone). It lives
  // in React state only — see LeadershipSessionProvider.
  //
  // A request that already carries its own leadership token (a step-up
  // retry) keeps it; the desk token must not overwrite a step-up.
  if (!config.headers["X-Leadership-Token"]) {
    const leadershipToken = readDeskToken();
    if (leadershipToken) {
      config.headers["X-Leadership-Token"] = leadershipToken;
    }
  }

  return config;
});

// ----------------------------------------------------------------------
// Response Interceptor: Auto-Refresh Expired Tokens on 401
// ----------------------------------------------------------------------
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ------------------------------------------------------------------
    // Leadership Desk PIN handling
    //
    // Runs BEFORE the access-token refresh block below, because these
    // are also 401s — without this ordering, a "your PIN is needed"
    // response would be misread as an expired access token, trigger a
    // pointless refresh, and retry into the same 401 forever.
    //
    // Handling it here (rather than in each calling page) is what lets
    // pages outside the Leadership Desk — the standalone Loans page
    // disbursing a loan, say — get the PIN prompt for free.
    // ------------------------------------------------------------------
    const leadershipCode = error.response?.data?.code;

    if (leadershipCode && STEP_UP_CODES.includes(leadershipCode)) {
      if (originalRequest._leadershipStepUpRetried) {
        return Promise.reject(error);
      }

      const action =
        error.response?.data?.stepUpAction || originalRequest._stepUpAction;

      // The step-up has to be minted against the same Chama the failed
      // call was aimed at. Reading it off the URL keeps this working for
      // callers outside the Leadership Desk, where no desk session (and
      // so no remembered chamaId) exists.
      const chamaId = originalRequest.url?.match(/\/chamas\/([^/]+)/)?.[1];

      try {
        const stepUpToken = await requestStepUpToken({
          action,
          chamaId,
          message: error.response?.data?.message,
        });

        originalRequest._leadershipStepUpRetried = true;
        originalRequest.headers = {
          ...originalRequest.headers,
          "X-Leadership-Token": stepUpToken,
        };

        return api(originalRequest);
      } catch (promptError) {
        // The leader dismissed the PIN prompt — that is a decision, not
        // a failure. Surface the original error so the calling page can
        // quietly stop rather than showing a scary message.
        promptError.leadershipCancelled = true;
        return Promise.reject(promptError);
      }
    }

    if (leadershipCode && DESK_SESSION_DEAD_CODES.includes(leadershipCode)) {
      invalidateDeskSession(leadershipCode);
      return Promise.reject(error);
    }

    // Do not attempt refresh if request was to any public auth route
    const isAuthRoute =
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/register") ||
      originalRequest.url?.includes("/auth/send-otp") ||
      originalRequest.url?.includes("/auth/verify-otp");

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      if (isRefreshing) {
        // If a refresh is already in progress, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken =
        localStorage.getItem("refreshToken") ||
        localStorage.getItem("refresh_token");

      if (!refreshToken) {
        isRefreshing = false;
        clearAuthStorage();
        return Promise.reject(error);
      }

      try {
        const baseURL = import.meta.env.VITE_API_URL || "/api";

        // Issue raw refresh request using independent axios instance
        const { data } = await axios.post(`${baseURL}/auth/refresh`, {
          refreshToken,
        });

        const newAccessToken =
          data?.data?.accessToken || data?.accessToken;
        const newRefreshToken =
          data?.data?.refreshToken || data?.refreshToken;

        if (newAccessToken) {
          localStorage.setItem("accessToken", newAccessToken);
          localStorage.setItem("access_token", newAccessToken);

          if (newRefreshToken) {
            localStorage.setItem("refreshToken", newRefreshToken);
            localStorage.setItem("refresh_token", newRefreshToken);
          }

          api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

          processQueue(null, newAccessToken);
          return api(originalRequest);
        } else {
          throw new Error("No access token returned from refresh endpoint");
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        clearAuthStorage();
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
