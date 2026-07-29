import express from 'express';

import {
  registerController,
  loginController,
  getMeController
} from './auth.controller.js';

import { protect } from '../../middleware/auth.middleware.js';

const router = express.Router();


// ========================================
// PUBLIC ROUTES
// ========================================

router.post(
  '/register',
  registerController
);

router.post(
  '/login',
  loginController
);


// ========================================
// PROTECTED ROUTES
// ========================================

router.get(
  '/me',
  protect,
  getMeController
);


export default router;