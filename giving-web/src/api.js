import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20_000,
});

export async function getCause(joinCode) {
  const { data } = await api.get(`/giving/${encodeURIComponent(joinCode)}`);
  return data.data || data;
}

export async function donate(joinCode, payload) {
  const { data } = await api.post(`/giving/${encodeURIComponent(joinCode)}/donations`, payload);
  return data.data || data;
}

export async function reportCause(joinCode, payload) {
  const { data } = await api.post(`/giving/${encodeURIComponent(joinCode)}/reports`, payload);
  return data.data || data;
}

export async function getDonationStatus(token) {
  const { data } = await api.get(`/giving/payments/${encodeURIComponent(token)}`);
  return data.data || data;
}
