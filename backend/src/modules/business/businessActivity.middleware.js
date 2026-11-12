import BusinessActivity from "../../models/BusinessActivity.js";

export function trackBusinessActivity(action) {
  return (request, response, next) => {
    response.on("finish", () => {
      if (response.statusCode < 200 || response.statusCode >= 300 || !request.params.businessId || !request.user) return;
      BusinessActivity.create({
        business_id: request.params.businessId,
        actor_id: request.user._id || request.user.id,
        action,
        detail: String(request.body?.description || request.body?.name || "").slice(0, 240),
        status_code: response.statusCode,
      }).catch((error) => console.warn("[business activity] Could not record action:", error.message));
    });
    next();
  };
}
