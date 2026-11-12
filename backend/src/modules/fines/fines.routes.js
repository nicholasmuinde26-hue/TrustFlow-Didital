import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { createFine, listFines, remindFine } from './fines.controller.js';

const router = express.Router();
router.use(protect);
router.get('/:workspaceId/fines', listFines);
router.post('/:workspaceId/fines', createFine);
router.post('/:workspaceId/fines/:fineId/remind', remindFine);

export default router;
