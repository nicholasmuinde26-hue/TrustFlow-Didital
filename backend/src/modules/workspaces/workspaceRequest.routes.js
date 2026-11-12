import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { rateLimit } from '../../middleware/rateLimit.middleware.js';
import {
  createWorkspaceRequest,
  getMyWorkspaceRequests,
  updateMyContributionGroupRequest,
} from './workspaceRequest.controller.js';

const router = express.Router();
const contributionGroupRequestLimiter = rateLimit({
  windowMs: 24 * 60 * 60_000,
  max: 3,
  keyGenerator: (req) => String(req.user?._id || req.ip || 'unknown'),
  message: 'Too many fundraiser requests. Please try again tomorrow.',
});

router.use(protect);

router.post('/', (req, res, next) => req.body?.entityType === 'contribution_group' ? contributionGroupRequestLimiter(req, res, next) : next(), createWorkspaceRequest);
router.get('/my', getMyWorkspaceRequests);
router.patch('/my/:requestId', contributionGroupRequestLimiter, updateMyContributionGroupRequest);

export default router;
