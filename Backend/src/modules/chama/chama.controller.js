import {
  createChama,
  getChamaById,
  getChamaMembers,
  updateChama,
  deleteChama
} from './chama.service.js';


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