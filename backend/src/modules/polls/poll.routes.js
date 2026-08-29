import express from "express";

import { protect } from "../../middleware/auth.middleware.js";
import * as controller from "./poll.controller.js";

const router = express.Router();

router.use(protect);

router.get("/:workspaceId/polls", controller.listPolls);
router.post("/:workspaceId/polls", controller.createPoll);
router.get("/:workspaceId/polls/:pollId", controller.getPoll);
router.put("/:workspaceId/polls/:pollId/publish", controller.publishPoll);
router.post("/:workspaceId/polls/:pollId/votes", controller.castVote);
router.put("/:workspaceId/polls/:pollId/close", controller.closePoll);
router.delete("/:workspaceId/polls/:pollId", controller.cancelPoll);

export default router;
