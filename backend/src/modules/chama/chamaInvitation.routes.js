import express from "express";
import { protect } from "../../middleware/auth.middleware.js";
import { acceptInvite } from "./chamaOperations.service.js";
const router = express.Router();
router.post("/:token/accept", protect, async (req, res, next) => {
  try { const membership = await acceptInvite(req.params.token, req.user._id); res.status(201).json({ success: true, data: { membership } }); }
  catch (error) { next(error); }
});
export default router;
