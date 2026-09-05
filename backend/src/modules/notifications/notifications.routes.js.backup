import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import {
  getNotificationsController,
  markReadController,
  markAllReadController,
} from './notifications.controller.js';

const router = express.Router();

router.use(protect);

router.get('/', getNotificationsController);
router.patch('/:id/read', markReadController);
router.post('/mark-all-read', markAllReadController);

export default router;
