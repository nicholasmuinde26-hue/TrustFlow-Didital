// Everything environment-specific lives here, so the marketplace never needs
// to know where the ChamaManager app is hosted beyond one URL.
const strip = (v) => String(v || "").replace(/\/+$/, "");

// Marketplace API (same backend today, can be its own service tomorrow).
export const API_URL = strip(import.meta.env.VITE_API_URL) || "/api/v1";

// Where merchants go to log in and manage their business.
export const CHAMAMANAGER_URL =
  strip(import.meta.env.VITE_CHAMAMANAGER_URL) || "http://localhost:5173";
