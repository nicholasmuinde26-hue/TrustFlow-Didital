import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { acceptInvite, previewInvite, getMyPendingRequests } from "./chamaOperations.service.js";
const router = express.Router();

// ========================================
// GET /api/v1/chama-invitations/mine/pending
// ========================================
//
// Two path segments ("mine/pending"), so it can't collide with the
// single-segment "/:token" route below regardless of declaration
// order — kept first here for readability.
//
// Requires auth: lets a user who requested to join a Chama check
// whether they're still waiting on Treasurer/Chairperson approval.
//
// ========================================

router.get("/mine/pending", protect, async (req, res, next) => {
  try {
    const requests = await getMyPendingRequests(req.user._id);
    res.json({ success: true, data: { requests } });
  } catch (error) {
    next(error);
  }
});

// ========================================
// GET /api/v1/chama-invitations/:token
// ========================================
//
// PUBLIC — deliberately no `protect` middleware. This is what the
// join-link landing page calls BEFORE the visitor has logged in, so
// it can show "You've been invited to join <Chama name>" and decide
// whether to offer "Create Account" or "Log In".
//
// ========================================

router.get("/:token", async (req, res, next) => {
  try {
    const preview = await previewInvite(req.params.token);
    res.json({ success: true, data: preview });
  } catch (error) {
    next(error);
  }
});

// ========================================
// POST /api/v1/chama-invitations/:token/accept
// ========================================
//
// Requires auth. Creates a PENDING ChamaMembership (a join request) —
// it does not grant membership immediately. See acceptInvite() in
// chamaOperations.service.js for why.
//
// ========================================

router.post("/:token/accept", protect, async (req, res, next) => {
  try {
    const membership = await acceptInvite(req.params.token, req.user._id);
    res.status(201).json({ success: true, data: { membership } });
  } catch (error) {
    next(error);
  }
});

export default router;
