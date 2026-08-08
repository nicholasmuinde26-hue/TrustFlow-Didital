import {
  createChama,
  getChamaById,
  getChamaMembers,
  updateChama,
  deleteChama
} from './chama.service.js';
import PaymentIntent from '../../models/PaymentIntent.js';
import { getMgrOverview, initiateSavingsDeposit, reconcileSavingsIntent, recordMgrReminder, upsertMgrSettings } from './chamaFinance.service.js';


// ========================================
// CREATE CHAMA
// ========================================
//
// POST /api/chamas
//
// Requires:
// - Authentication
//
// The authenticated User becomes:
// - Chama creator
// - Treasurer
// - Active member
//
// ========================================

export const createChamaController = async (
  req,
  res,
  next
) => {

  try {

    // ----------------------------------------
    // 1. Get authenticated User ID
    // ----------------------------------------

    const userId =
      req.user._id;


    // ----------------------------------------
    // 2. Get request body
    // ----------------------------------------

    const {
      name,
      monthlySavings
    } = req.body;


    // ----------------------------------------
    // 3. Create Chama
    // ----------------------------------------

    const chama =
      await createChama({
        name,
        monthlySavings,
        userId
      });


    // ----------------------------------------
    // 4. Send response
    // ----------------------------------------

    return res.status(201).json({

      success: true,

      message:
        'Chama created successfully',

      data: {
        chama
      }

    });

  } catch (error) {

    next(error);

  }

};



// ========================================
// GET CHAMA MEMBERS
// ========================================
//
// GET /api/chamas/:id/members
//
// Requires:
// - Authentication
// - Active Chama membership
//
// Returns:
// - Active Chama memberships
// - User details
// - Chama role
// - Membership status
// - Payout position
//
// ========================================

export const getChamaMembersController = async (
  req,
  res,
  next
) => {

  try {

    // ----------------------------------------
    // 1. Get Chama ID
    // ----------------------------------------

    const {
      id: chamaId
    } = req.params;


    // ----------------------------------------
    // 2. Get Chama members
    // ----------------------------------------

    const memberships =
      await getChamaMembers(
        chamaId
      );


    // ----------------------------------------
    // 3. Send response
    // ----------------------------------------

    return res.status(200).json({

      success: true,

      data: {
        members: memberships
      }

    });

  } catch (error) {

    next(error);

  }

};



// ========================================
// GET CHAMA BY ID
// ========================================
//
// GET /api/chamas/:id
//
// Requires:
// - Authentication
// - Active Chama membership
//
// ========================================

export const getChamaController = async (
  req,
  res,
  next
) => {

  try {

    // ----------------------------------------
    // 1. Get Chama ID
    // ----------------------------------------

    const {
      id: chamaId
    } = req.params;


    // ----------------------------------------
    // 2. Get authenticated User ID
    // ----------------------------------------

    const userId =
      req.user._id;


    // ----------------------------------------
    // 3. Get Chama
    // ----------------------------------------

    const chama =
      await getChamaById(
        chamaId,
        userId
      );


    // ----------------------------------------
    // 4. Send response
    // ----------------------------------------

    return res.status(200).json({

      success: true,

      data: {
        chama
      }

    });

  } catch (error) {

    next(error);

  }

};



// ========================================
// UPDATE CHAMA
// ========================================
//
// PATCH /api/chamas/:id
//
// Requires:
// - Authentication
// - Active Chama membership
// - Treasurer role
//
// Allowed fields:
// - name
// - monthly_savings
//
// ========================================

export const updateChamaController = async (
  req,
  res,
  next
) => {

  try {

    // ----------------------------------------
    // 1. Get Chama ID
    // ----------------------------------------

    const {
      id: chamaId
    } = req.params;


    // ----------------------------------------
    // 2. Get authenticated User ID
    // ----------------------------------------

    const userId =
      req.user._id;


    // ----------------------------------------
    // 3. Update Chama
    // ----------------------------------------

    const chama =
      await updateChama(
        chamaId,
        userId,
        req.body
      );


    // ----------------------------------------
    // 4. Send response
    // ----------------------------------------

    return res.status(200).json({

      success: true,

      message:
        'Chama updated successfully',

      data: {
        chama
      }

    });

  } catch (error) {

    next(error);

  }

};



// ========================================
// DELETE CHAMA
// ========================================
//
// DELETE /api/chamas/:id
//
// Requires:
// - Authentication
// - Active Chama membership
// - Treasurer role
//
// Deletes:
// - Chama
// - All ChamaMembership records
//
// ========================================

export const deleteChamaController = async (
  req,
  res,
  next
) => {

  try {

    // ----------------------------------------
    // 1. Get Chama ID
    // ----------------------------------------

    const {
      id: chamaId
    } = req.params;


    // ----------------------------------------
    // 2. Get authenticated User ID
    // ----------------------------------------

    const userId =
      req.user._id;


    // ----------------------------------------
    // 3. Delete Chama
    // ----------------------------------------

    await deleteChama(
      chamaId,
      userId
    );


    // ----------------------------------------
    // 4. Send response
    // ----------------------------------------

    return res.status(200).json({

      success: true,

      message:
        'Chama deleted successfully'

    });

  } catch (error) {

    next(error);

  }

};

export const initiateSavingsDepositController = async (req, res, next) => {
  try {
    const { amount, phoneNumber } = req.body;
    const result = await initiateSavingsDeposit({
      chama: req.chama, membership: req.membership, userId: req.user._id, amount, phoneNumber,
      idempotencyKey: req.get('Idempotency-Key') || req.body.idempotencyKey,
    });
    res.status(result.reused ? 200 : 201).json({ success: true, message: result.reused ? 'Existing payment request returned' : 'M-Pesa prompt sent', data: { paymentIntent: result.intent, stk: result.stk || null } });
  } catch (error) { next(error); }
};

export const getPaymentIntentController = async (req, res, next) => {
  try {
    const intent = await PaymentIntent.findOne({ _id: req.params.paymentIntentId, owner_type: 'Chama', owner_id: req.chama._id, participant_id: req.membership._id });
    if (!intent) return res.status(404).json({ success: false, message: 'Payment intent not found' });
    res.json({ success: true, data: { paymentIntent: intent } });
  } catch (error) { next(error); }
};

export const reconcilePaymentIntentController = async (req, res, next) => {
  try {
    const intent = await reconcileSavingsIntent({ intentId: req.params.paymentIntentId, chamaId: req.chama._id });
    if (!intent || String(intent.participant_id) !== String(req.membership._id)) return res.status(404).json({ success: false, message: 'Payment intent not found' });
    res.json({ success: true, data: { paymentIntent: intent } });
  } catch (error) { next(error); }
};

export const updateMgrSettingsController = async (req, res, next) => {
  try {
    const plan = await upsertMgrSettings({ chama: req.chama, userId: req.user._id, ...req.body });
    res.json({ success: true, message: 'MGR settings saved', data: { plan } });
  } catch (error) { next(error); }
};

export const getMgrOverviewController = async (req, res, next) => {
  try {
    const overview = await getMgrOverview(req.chama._id);
    res.json({ success: true, data: overview });
  } catch (error) { next(error); }
};

export const recordMgrReminderController = async (req, res, next) => {
  try {
    const reminder = await recordMgrReminder({
      chamaId: req.chama._id,
      obligationId: req.body.obligationId,
      channel: req.body.channel,
      message: req.body.message,
      userId: req.user._id,
    });
    res.status(201).json({ success: true, data: { reminder } });
  } catch (error) { next(error); }
};
