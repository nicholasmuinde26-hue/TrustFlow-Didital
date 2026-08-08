import express from "express";

import { protect } from "../../middleware/auth.middleware.js";
import { cancelMeeting, createMeeting, listMeetings } from "./meetings.controller.js";

const router = express.Router();

router.use(protect);
router.get("/:workspaceId/meetings", listMeetings);
router.post("/:workspaceId/meetings", createMeeting);
router.delete("/:workspaceId/meetings/:meetingId", cancelMeeting);

export default router;
