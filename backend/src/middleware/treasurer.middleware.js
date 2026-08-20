// ========================================
// TREASURER AUTHORIZATION
// ========================================

export const requireTreasurer = (
  req,
  res,
  next
) => {

  try {

    // ----------------------------------------
    // 1. Make sure user is authenticated
    // ----------------------------------------

    if (!req.user) {

      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });

    }


    // ----------------------------------------
    // 2. Make sure user has a Chama
    // ----------------------------------------

    if (!req.user.chama_id) {

      return res.status(403).json({
        success: false,
        message: 'You do not belong to any Chama'
      });

    }


    // ----------------------------------------
    // 3. Check user role
    // ----------------------------------------

    if (req.user.role !== 'treasurer') {

      return res.status(403).json({
        success: false,
        message: 'Only the treasurer can perform this action'
      });

    }


    // ----------------------------------------
    // 4. Authorization successful
    // ----------------------------------------

    next();

  } catch (error) {

    next(error);

  }

};