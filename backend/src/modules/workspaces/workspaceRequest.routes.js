import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import {
  createWorkspaceRequest,
  getMyWorkspaceRequests,
} from './workspaceRequest.controller.js';

const router = express.Router();

router.use(protect);

router.post('/', createWorkspaceRequest);
router.get('/my', getMyWorkspaceRequests);

export default router;
