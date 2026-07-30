import api from "@/api/client";

export async function getMembers(params) {
  const res = await api.get("/members", { params });
  return res.data;
}

export async function getMember(id) {
  const res = await api.get(`/members/${id}`);
  return res.data;
}

export async function createMember(payload) {
  const res = await api.post(`/members`, payload);
  return res.data;
}

export async function updateMember(id, payload) {
  const res = await api.put(`/members/${id}`, payload);
  return res.data;
}

export async function deleteMember(id) {
  const res = await api.delete(`/members/${id}`);
  return res.data;
}
