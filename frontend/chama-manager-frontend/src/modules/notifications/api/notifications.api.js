import api from "@/app/services/api";

const notificationsApi = {
  getNotifications(params) {
    return api.get("/notifications", { params });
  },

  markRead(id) {
    return api.patch(`/notifications/${id}/read`);
  },

  markAllRead() {
    return api.post("/notifications/mark-all-read");
  },
};

export default notificationsApi;
