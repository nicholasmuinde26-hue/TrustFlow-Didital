async function loadUser() {
  const token = localStorage.getItem("access_token");

  if (!token) {
    setUser(null);
    setLoading(false);
    return;
  }

  try {
    const { data } = await api.get("/auth/me");
    setUser(data.user);
  } catch {
    localStorage.removeItem("access_token");
    setUser(null);
  } finally {
    setLoading(false);
  }
}