import {
  getPayoutHistory,
  getCurrentPayout,
  getPayoutById,
  startPayout,
  markPayoutPaid,
  cancelPayout
} from './payout.service.js';


// ========================================
// GET PAYOUT HISTORY
// ========================================

export const getPayoutHistoryController = async (
  req,
  res,
  next
) => {

  try {

    const payouts =
      await getPayoutHistory(
        req.params.id
      );

    res.status(200).json({

      success: true,

      data: {
        payouts
      }

    });

  } catch (error) {

    next(error);

  }

};


// ========================================
// GET CURRENT PAYOUT
// ========================================

export const getCurrentPayoutController = async (
  req,
  res,
  next
) => {

  try {

    const payout =
      await getCurrentPayout(
        req.params.id
      );

    res.status(200).json({

      success: true,

      data: {
        payout
      }

    });

  } catch (error) {

    next(error);

  }

};


// ========================================
// GET SINGLE PAYOUT
// ========================================

export const getPayoutController = async (
  req,
  res,
  next
) => {

  try {

    const payout =
      await getPayoutById(
        req.params.id,
        req.params.payoutId
      );

    res.status(200).json({

      success: true,

      data: {
        payout
      }

    });

  } catch (error) {

    next(error);

  }

};


// ========================================
// START PAYOUT
// TREASURER ONLY
// ========================================

export const startPayoutController = async (
  req,
  res,
  next
) => {

  try {

    const payout =
      await startPayout({
        chamaId: req.params.id,
        created_by: req.user._id
      });

    res.status(201).json({

      success: true,

      message:
        'Payout started successfully',

      data: {
        payout
      }

    });

  } catch (error) {

    next(error);

  }

};


// ========================================
// MARK PAYOUT AS PAID
// TREASURER ONLY
// ========================================
//
// The treasurer confirms they have ALREADY
// disbursed the funds themselves — this
// endpoint records that fact, it does not
// trigger any transfer.
//
// Expected body:
//
// {
//   "disbursement_method": "mpesa" | "bank" | "cash" | "mobile_money" | "other",
//   "external_reference": "QGH7XXXX" (optional)
// }
//
// ========================================

export const markPayoutPaidController = async (
  req,
  res,
  next
) => {

  try {

    const {
      disbursement_method,
      external_reference
    } = req.body;

    const payout =
      await markPayoutPaid({
        chamaId: req.params.id,
        payoutId: req.params.payoutId,
        disbursement_method,
        external_reference,
        created_by: req.user._id
      });

    res.status(200).json({

      success: true,

      message:
        'Payout marked as paid successfully',

      data: {
        payout
      }

    });

  } catch (error) {

    next(error);

  }

};


// ========================================
// CANCEL PAYOUT
// TREASURER ONLY
// ========================================

export const cancelPayoutController = async (
  req,
  res,
  next
) => {

  try {

    const { reason } = req.body;

    const payout =
      await cancelPayout({
        chamaId: req.params.id,
        payoutId: req.params.payoutId,
        reason,
        created_by: req.user._id
      });

    res.status(200).json({

      success: true,

      message:
        'Payout cancelled successfully',

      data: {
        payout
      }

    });

  } catch (error) {

    next(error);

  }

};