import {
  registerUser,
  loginUser,
  getCurrentUser
} from './auth.service.js';


// ========================================
// REGISTER USER
// ========================================

export const registerController = async (
  req,
  res,
  next
) => {

  try {

    // ----------------------------------------
    // Only accept public registration fields
    // ----------------------------------------
    //
    // The client cannot control:
    //
    // - role
    // - chama_id
    // - payout_position
    // - status
    //
    // Chama-specific roles and membership
    // will be managed through ChamaMembership.
    // ----------------------------------------

    const {
      name,
      phone,
      password
    } = req.body;


    // ----------------------------------------
    // Register User
    // ----------------------------------------

    const result =
      await registerUser({
        name,
        phone,
        password
      });


    // ----------------------------------------
    // Send response
    // ----------------------------------------

    res.status(201).json({

      success: true,

      message:
        'Registration successful',

      data: result

    });

  } catch (error) {

    next(error);

  }

};



// ========================================
// LOGIN USER
// ========================================

export const loginController = async (
  req,
  res,
  next
) => {

  try {

    // ----------------------------------------
    // Only accept login fields
    // ----------------------------------------

    const {
      phone,
      password
    } = req.body;


    // ----------------------------------------
    // Login User
    // ----------------------------------------

    const result =
      await loginUser({
        phone,
        password
      });


    // ----------------------------------------
    // Send response
    // ----------------------------------------

    res.status(200).json({

      success: true,

      message:
        'Login successful',

      data: result

    });

  } catch (error) {

    next(error);

  }

};



// ========================================
// GET CURRENT USER
// ========================================

export const getMeController = async (
  req,
  res,
  next
) => {

  try {

    // ----------------------------------------
    // Get authenticated User
    // ----------------------------------------
    //
    // auth.middleware.js should attach
    // the authenticated user's ID to:
    //
    // req.user._id
    //
    // ----------------------------------------

    const user =
      await getCurrentUser(
        req.user._id
      );


    // ----------------------------------------
    // Send response
    // ----------------------------------------

    res.status(200).json({

      success: true,

      data: {
        user
      }

    });

  } catch (error) {

    next(error);

  }

};