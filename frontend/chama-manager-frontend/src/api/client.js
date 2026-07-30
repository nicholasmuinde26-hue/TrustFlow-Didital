import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
  },
  // We are using token-based auth stored in localStorage. withCredentials is false for tokens.
  withCredentials: false,
});

// Attach Authorization header when token is present in localStorage
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    // ignore
  }
  return config;
});

// Optional global response handling
api.interceptors.response.use(
  (res) => res,
  (err) => {
    // You can add global error handling here (e.g., redirect on 401)
    return Promise.reject(err);
  }
);

export default api;
