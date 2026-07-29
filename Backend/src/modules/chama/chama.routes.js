import express from 'express';

import {
  createChamaController,
  getChamaController,
  getChamaMembersController,
  updateChamaController,
  deleteChamaController
} from './chama.controller.js';

import {
  protect
} from '../../middleware/auth.middleware.js';

import {
  requireChamaMember,
  requireChamaTreasurer
} from '../../middleware/chama.middleware.js';


const router =
  express.Router();


// ========================================
// CREATE CHAMA
// ========================================

router.post(
  '/',
  protect,
  createChamaController
);


// ========================================
// GET CHAMA MEMBERS
// ========================================

router.get(
  '/:id/members',
  protect,
  requireChamaMember,
  getChamaMembersController
);


// ========================================
// GET CHAMA
// ========================================

router.get(
  '/:id',
  protect,
  requireChamaMember,
  getChamaController
);


// ========================================
// UPDATE CHAMA
// ========================================

router.patch(
  '/:id',
  protect,
  requireChamaMember,
  requireChamaTreasurer,
  updateChamaController
);


// ========================================
// DELETE CHAMA
// ========================================

router.delete(
  '/:id',
  protect,
  requireChamaMember,
  requireChamaTreasurer,
  deleteChamaController
);


export default router;