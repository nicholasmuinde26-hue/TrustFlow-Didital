import express from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { cancelMeeting, createMeeting, listMeetings } from "./meetings.controller.js";

import { requireModule } from '../../middleware/module.middleware.js';
const router = express.Router();

router.use(protect);
router.use("/:workspaceId/meetings", requireModule("meetings"));
router.get("/:workspaceId/meetings", listMeetings);
router.post("/:workspaceId/meetings", createMeeting);
router.delete("/:workspaceId/meetings/:meetingId", cancelMeeting);

export default router;
