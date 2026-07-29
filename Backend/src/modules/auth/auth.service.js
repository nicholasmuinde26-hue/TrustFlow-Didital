import bcrypt from 'bcryptjs';
import User from '../../models/User.js';

import { generateToken } from '../../utils/jwt.js';

import AppError from '../../utils/AppError.js';

import {
  formatPhone,
  isValidKenyanPhone
} from '../../utils/phone.js';


// ========================================
// REGISTER USER
// ========================================

export const registerUser = async ({
  name,
  phone,
  password
}) => {

  // ----------------------------------------
  // 1. Validate name
  // ----------------------------------------

  if (!name || !name.trim()) {
    throw new AppError(
      'Name is required',
      400
    );
  }


  // ----------------------------------------
  // 2. Validate phone
  // ----------------------------------------

  if (!phone || !phone.trim()) {
    throw new AppError(
      'Phone number is required',
      400
    );
  }


  // ----------------------------------------
  // 3. Validate password
  // ----------------------------------------

  if (!password) {
    throw new AppError(
      'Password is required',
      400
    );
  }


  if (password.length < 8) {
    throw new AppError(
      'Password must be at least 8 characters',
      400
    );
  }


  // ----------------------------------------
  // 4. Format phone number
  // ----------------------------------------

  const formattedPhone =
    formatPhone(phone);


  // ----------------------------------------
  // 5. Validate Kenyan phone number
  // ----------------------------------------

  if (
    !isValidKenyanPhone(
      formattedPhone
    )
  ) {
    throw new AppError(
      'Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX',
      400
    );
  }


  // ----------------------------------------
  // 6. Check if User already exists
  // ----------------------------------------

  const existingUser =
    await User.findOne({
      phone: formattedPhone
    });


  if (existingUser) {
    throw new AppError(
      'A user with this phone number already exists',
      409
    );
  }


  // ----------------------------------------
  // 7. Hash password
  // ----------------------------------------

  const hashedPassword =
    await bcrypt.hash(
      password,
      10
    );


  // ----------------------------------------
  // 8. Create User
  // ----------------------------------------
  //
  // IMPORTANT:
  //
  // User only stores account information.
  //
  // Chama-specific information such as:
  //
  // - role
  // - chama_id
  // - payout_position
  //
  // belongs to ChamaMembership.
  //
  // Therefore, these fields are NOT
  // stored in the User document.
  // ----------------------------------------

  const user =
    await User.create({

      name:
        name.trim(),

      phone:
        formattedPhone,

      password:
        hashedPassword,

      status:
        'active'
    });


  // ----------------------------------------
  // 9. Generate JWT
  // ----------------------------------------

  const token =
    generateToken(
      user._id
    );


  // ----------------------------------------
  // 10. Remove password
  // ----------------------------------------

  const userResponse =
    user.toObject();

  delete userResponse.password;


  // ----------------------------------------
  // 11. Return User and Token
  // ----------------------------------------

  return {
    user: userResponse,
    token
  };
};



// ========================================
// LOGIN USER
// ========================================

export const loginUser = async ({
  phone,
  password
}) => {

  // ----------------------------------------
  // 1. Validate phone
  // ----------------------------------------

  if (!phone || !phone.trim()) {
    throw new AppError(
      'Phone number is required',
      400
    );
  }


  // ----------------------------------------
  // 2. Validate password
  // ----------------------------------------

  if (!password) {
    throw new AppError(
      'Password is required',
      400
    );
  }


  // ----------------------------------------
  // 3. Format phone number
  // ----------------------------------------

  const formattedPhone =
    formatPhone(phone);


  // ----------------------------------------
  // 4. Validate Kenyan phone number
  // ----------------------------------------

  if (
    !isValidKenyanPhone(
      formattedPhone
    )
  ) {
    throw new AppError(
      'Invalid phone number. Use 07XXXXXXXX or 2547XXXXXXXX',
      400
    );
  }


  // ----------------------------------------
  // 5. Find User
  // ----------------------------------------
  //
  // Password is select: false in User.js.
  //
  // Therefore, we explicitly request it
  // when authenticating.
  // ----------------------------------------

  const user =
    await User.findOne({
      phone: formattedPhone
    })
      .select('+password');


  // ----------------------------------------
  // 6. Prevent account enumeration
  // ----------------------------------------

  if (!user) {
    throw new AppError(
      'Invalid phone number or password',
      401
    );
  }


  // ----------------------------------------
  // 7. Compare password
  // ----------------------------------------

  const isPasswordCorrect =
    await bcrypt.compare(
      password,
      user.password
    );


  if (!isPasswordCorrect) {
    throw new AppError(
      'Invalid phone number or password',
      401
    );
  }


  // ----------------------------------------
  // 8. Check account status
  // ----------------------------------------

  if (
    user.status === 'inactive'
  ) {
    throw new AppError(
      'This user account is inactive',
      403
    );
  }


  if (
    user.status === 'suspended'
  ) {
    throw new AppError(
      'This user account has been suspended',
      403
    );
  }


  // ----------------------------------------
  // 9. Generate JWT
  // ----------------------------------------

  const token =
    generateToken(
      user._id
    );


  // ----------------------------------------
  // 10. Remove password
  // ----------------------------------------

  const userResponse =
    user.toObject();

  delete userResponse.password;


  // ----------------------------------------
  // 11. Return User and Token
  // ----------------------------------------

  return {
    user: userResponse,
    token
  };
};



// ========================================
// GET CURRENT USER
// ========================================

export const getCurrentUser = async (
  userId
) => {

  // ----------------------------------------
  // 1. Find current User
  // ----------------------------------------

  const user =
    await User.findById(
      userId
    )
      .select('-password');


  // ----------------------------------------
  // 2. Check User exists
  // ----------------------------------------

  if (!user) {
    throw new AppError(
      'User not found',
      404
    );
  }


  // ----------------------------------------
  // 3. Check account status
  // ----------------------------------------

  if (
    user.status === 'inactive'
  ) {
    throw new AppError(
      'This user account is inactive',
      403
    );
  }


  if (
    user.status === 'suspended'
  ) {
    throw new AppError(
      'This user account has been suspended',
      403
    );
  }


  // ----------------------------------------
  // 4. Return User
  // ----------------------------------------

  return user;
};