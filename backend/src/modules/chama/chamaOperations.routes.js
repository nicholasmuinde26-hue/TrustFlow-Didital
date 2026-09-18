import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { requireChamaMember } from "../../middleware/chama.middleware.js";
import {
  requireLeadershipSession,
  requireLeadershipStepUp,
  STEP_UP_ACTIONS
} from "../../middleware/leadershipSession.middleware.js";
import * as controller from "./chamaOperations.controller.js";
const router = express.Router({ mergeParams: true });
// NOTE: intentionally NOT `router.use(protect, requireChamaMember)` here.
// This router is mounted at app.js as:
//   app.use("/api/v1/chamas/:chamaId", chamaOperationsRoutes)
// A path-less `router.use(...)` runs for EVERY request under that prefix,
// including ones this file doesn't own (/trust-timeline, /audit-logs,
// /loans, /mgr, ...), since Express tries this router before falling
// through to the sibling routers registered later in app.js. That meant
// requireChamaMember (a DB-hitting check) ran twice per request for every
// other /:chamaId/* endpoint in the app, and was the source of the
// intermittent "Invalid Chama ID" 400s on GET /trust-timeline — by the
// time the (redundant) fall-through reached audit.routes.js, req.params
// had been clobbered by the other unrelated /api/v1/chamas routers it
// passed through on the way. Attaching the middleware per-route instead
// means it only ever runs once a route defined in *this* file actually
// matches; anything else falls through immediately, untouched.
const guard = [protect, requireChamaMember];

// Governance mutations that used to live in the Command Center now live
// in the Leadership Desk, behind the PIN — so they demand an unlocked
// leadership session here too, not just a role.
const leaderGuard = [...guard, requireLeadershipSession];
router.get("/command-center", ...guard, controller.getCommandCenter);
router.get("/profile", ...guard, controller.getProfile);
// saveProfile writes the M-Pesa shortcode and bank account the group's
// money flows into — repointing those is effectively a theft primitive,
// so it takes a fresh PIN rather than just an unlocked desk.
router.put("/profile", ...guard, requireLeadershipStepUp(STEP_UP_ACTIONS.UPDATE_PAYMENT_DETAILS), controller.saveProfile);
router.put("/officials/:membershipId", ...guard, requireLeadershipStepUp(STEP_UP_ACTIONS.CHANGE_MEMBER_ROLE), controller.setOfficial);
router.post("/goals", ...leaderGuard, controller.addGoal);
router.post("/kyc", ...guard, controller.submitKyc);
router.put("/kyc/:membershipId", ...leaderGuard, controller.verifyKyc);
router.post("/invitations", ...leaderGuard, controller.makeInvite);
// Loans moved to modules/loans/loan.routes.js (mounted at /api/v1/chamas/:chamaId/loans)
router.post("/meeting-records", ...guard, controller.createMeetingRecord);
router.post("/meeting-records/:meetingId/check-in", ...guard, controller.checkInMeeting);
router.post("/meeting-records/:meetingId/votes", ...guard, controller.castVote);
router.put("/meeting-records/:meetingId", ...guard, controller.saveMeetingRecord);
export default router;