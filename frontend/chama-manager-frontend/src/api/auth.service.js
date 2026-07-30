import api from "@/api/client";

export async function login(credentials) {
  // expects { email, password }
  const res = await api.post("/auth/login", credentials);
  if (res?.data?.access_token || res?.data?.token) {
    const token = res.data.access_token || res.data.token;
    localStorage.setItem("access_token", token);
  }
  return res.data;
}

export async function register(payload) {
  const res = await api.post("/auth/register", payload);
  return res.data;
}

export async function getCurrentUser() {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch (e) {
    // ignore
  }
  localStorage.removeItem("access_token");
}
