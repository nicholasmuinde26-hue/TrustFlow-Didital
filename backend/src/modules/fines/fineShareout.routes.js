import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireChamaMember, requireChamaChairperson, requireChamaTreasurer, requireChamaTreasurerOrChairperson } from '../../middleware/chama.middleware.js';
import * as controller from './fineShareout.controller.js';

const router = express.Router();
router.use(protect);
router.get('/:id/fine-shareouts', requireChamaMember, controller.list);
router.post('/:id/fine-shareouts', requireChamaMember, requireChamaTreasurerOrChairperson, controller.create);
router.patch('/:id/fine-shareouts/:shareoutId/approve', requireChamaMember, requireChamaChairperson, controller.approve);
router.patch('/:id/fine-shareouts/:shareoutId/items/:itemId/pay', requireChamaMember, requireChamaTreasurer, controller.payItem);
router.patch('/:id/fine-shareouts/:shareoutId/items/pay-bulk', requireChamaMember, requireChamaTreasurer, controller.payItems);
router.patch('/:id/fine-shareouts/:shareoutId/cancel', requireChamaMember, requireChamaTreasurerOrChairperson, controller.cancel);
export default router;
