import express from 'express';
import { protect } from '../../middleware/auth.middleware.js';
import { requireContributionGroupMember, requireContributionGroupManager } from '../../middleware/contributionGroup.middleware.js';
import { updateFundDetails, extendFund, createOrUpdateMyPledge, listPledges, initiatePledgeStk, recordCashPledgePayment, sendPledgeReminders, getFundDashboard } from './contributionFund.controller.js';

const router = express.Router({ mergeParams: true });
router.use(protect, requireContributionGroupMember);
router.get('/dashboard', getFundDashboard);
router.get('/pledges', listPledges);
router.post('/pledges', createOrUpdateMyPledge);
router.post('/pledges/:pledgeId/payments/stk', initiatePledgeStk);
router.patch('/details', requireContributionGroupManager, updateFundDetails);
router.post('/extend', requireContributionGroupManager, extendFund);
router.post('/pledges/:pledgeId/payments/cash', recordCashPledgePayment);
router.post('/reminders', requireContributionGroupManager, sendPledgeReminders);
export default router;
