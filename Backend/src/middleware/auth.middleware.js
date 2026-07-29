import User from '../models/User.js';
import { verifyToken } from '../utils/jwt.js';


// ========================================
// PROTECT ROUTES
// ========================================

export const protect = async (
  req,
  res,
  next
) => {

  try {

    let token;


    // ========================================
    // 1. GET TOKEN FROM AUTHORIZATION HEADER
    // ========================================

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith(
        'Bearer '
      )
    ) {

      token =
        req.headers.authorization
          .split(' ')[1];

    }


    // ========================================
    // 2. CHECK TOKEN EXISTS
    // ========================================

    if (!token) {

      return res.status(401).json({

        success: false,

        message:
          'Authentication required'

      });

    }


    // ========================================
    // 3. VERIFY JWT TOKEN
    // ========================================

    const decoded =
      verifyToken(token);


    // ========================================
    // 4. CHECK DECODED TOKEN
    // ========================================

    if (
      !decoded ||
      !decoded.id
    ) {

      return res.status(401).json({

        success: false,

        message:
          'Invalid authentication token'

      });

    }


    // ========================================
    // 5. FIND USER
    // ========================================

    const user =
      await User.findById(
        decoded.id
      )
        .select('-password');


    // ========================================
    // 6. CHECK USER EXISTS
    // ========================================

    if (!user) {

      return res.status(401).json({

        success: false,

        message:
          'User no longer exists'

      });

    }


    // ========================================
    // 7. CHECK USER ACCOUNT STATUS
    // ========================================

    if (
      user.status === 'inactive'
    ) {

      return res.status(403).json({

        success: false,

        message:
          'User account is inactive'

      });

    }


    if (
      user.status === 'suspended'
    ) {

      return res.status(403).json({

        success: false,

        message:
          'User account has been suspended'

      });

    }


    // ========================================
    // 8. ATTACH AUTHENTICATED USER
    // ========================================
    //
    // IMPORTANT:
    //
    // req.user now represents the global
    // User account.
    //
    // It does NOT contain:
    //
    // - chama_id
    // - role
    // - payout_position
    //
    // Those are resolved through:
    //
    // ChamaMembership
    //
    // Example:
    //
    // req.user
    //     │
    //     ▼
    // User
    //     │
    //     ▼
    // ChamaMembership
    //     │
    //     ├── Chama A → Treasurer
    //     ├── Chama B → Member
    //     └── Chama C → Auditor
    //
    // ========================================

    req.user = user;


    // ========================================
    // 9. CONTINUE REQUEST
    // ========================================

    next();

  } catch (error) {

    // ========================================
    // AUTHENTICATION ERROR
    // ========================================

    console.error(
      'AUTH MIDDLEWARE ERROR:',
      error.message
    );


    return res.status(401).json({

      success: false,

      message:
        'Invalid or expired token'

    });

  }

};