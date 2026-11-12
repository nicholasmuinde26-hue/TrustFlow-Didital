import axios from "axios";
import { API_URL } from "./config";

// Public, cookie-less client. The marketplace is a separate origin from
// ChamaManager, so it deliberately shares no login, tokens or storage with it.
// Shoppers check out as guests; merchants manage listings in ChamaManager.
const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
  withCredentials: false,
  timeout: 30000,
});

export default api;
