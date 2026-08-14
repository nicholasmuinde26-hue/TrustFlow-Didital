import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import {
  listAnnouncements,
  createAnnouncement,
  togglePinAnnouncement,
  deleteAnnouncement,
} from "./announcement.controller.js";

const router = express.Router();

// Apply auth middleware to all announcement endpoints
router.use(protect);

// Routes mapped under /api/v1/workspaces
router.get("/:workspaceId/announcements", listAnnouncements);
router.post("/:workspaceId/announcements", createAnnouncement);
router.patch("/:workspaceId/announcements/:announcementId/pin", togglePinAnnouncement);
router.delete("/:workspaceId/announcements/:announcementId", deleteAnnouncement);

export default router;
