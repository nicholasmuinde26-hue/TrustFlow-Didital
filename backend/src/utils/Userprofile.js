import User from '../models/User.js';
import AppError from './AppError.js';
import { formatPhone, isValidKenyanPhone } from './phone.js';


// ========================================
// CONSTANTS
// ========================================

const EMAIL_REGEX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Accept PNG / JPEG / WEBP data URIs only.
const AVATAR_DATA_URI_REGEX =
  /^data:image\/(png|jpe?g|webp);base64,/i;

// ~2MB of decoded image data, expressed as a
// base64 string length ceiling (base64 inflates
// size by ~4/3, plus the data URI prefix).
const MAX_AVATAR_STRING_LENGTH =
  2_800_000;

export const PROFILE_UPDATE_FIELDS = [
  'name',
  'phone',
  'email',
  'id_number',
  'avatar_url'
];


// ========================================
// BUILD USER PROFILE UPDATES
// ========================================
//
// Validates whichever of the allowed profile
// fields are present in `updates`, and returns
// a $set-ready object of ONLY the fields that
// changed / were provided.
//
// Does NOT save — callers are responsible for
// applying the returned object to the target
// User document and calling .save().
//
// ========================================

export const buildUserProfileUpdates = async ({
  targetUser,
  updates
}) => {

  if (
    !updates ||
    typeof updates !== 'object' ||
    Array.isArray(updates)
  ) {

    throw new AppError(
      'Update data is required',
      400
    );

  }


  const set = {};


  // --------------------------------------
  // NAME
  // --------------------------------------

  if (
    updates.name !== undefined
  ) {

    if (
      typeof updates.name !== 'string' ||
      !updates.name.trim()
    ) {

      throw new AppError(
        'Name must be a non-empty string',
        400
      );

    }


    const name =
      updates.name.trim();


    if (
      name.length < 2 ||
      name.length > 100
    ) {

      throw new AppError(
        'Name must be between 2 and 100 characters',
        400
      );

    }


    set.name = name;

  }


  // --------------------------------------
  // PHONE
  // --------------------------------------
  //
  // Changing phone resets isPhoneVerified —
  // the number must be re-verified via OTP
  // on next login, since it doubles as the
  // login identity.
  //
  // --------------------------------------

  if (
    updates.phone !== undefined &&
    updates.phone !== null &&
    String(updates.phone).trim() !== ''
  ) {

    const formattedPhone =
      formatPhone(
        String(updates.phone)
      );


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


    if (
      formattedPhone !==
      targetUser.phone
    ) {

      const existingUser =
        await User.findOne({

          phone:
            formattedPhone,

          _id: {
            $ne:
              targetUser._id
          }

        });


      if (existingUser) {

        throw new AppError(
          'This phone number is already in use by another account',
          409
        );

      }


      set.phone =
        formattedPhone;

      set.isPhoneVerified =
        false;

    }

  }


  // --------------------------------------
  // EMAIL
  // --------------------------------------

  if (
    updates.email !== undefined
  ) {

    if (
      updates.email === null ||
      String(updates.email).trim() === ''
    ) {

      set.email = null;

    } else {

      const email =
        String(updates.email)
          .trim()
          .toLowerCase();


      if (
        !EMAIL_REGEX.test(email)
      ) {

        throw new AppError(
          'Enter a valid email address',
          400
        );

      }


      set.email = email;

    }

  }


  // --------------------------------------
  // ID NUMBER
  // --------------------------------------

  if (
    updates.id_number !== undefined
  ) {

    if (
      updates.id_number === null ||
      String(updates.id_number).trim() === ''
    ) {

      set.id_number = null;

    } else {

      const idNumber =
        String(updates.id_number)
          .trim();


      if (
        idNumber.length < 4 ||
        idNumber.length > 20
      ) {

        throw new AppError(
          'ID number must be between 4 and 20 characters',
          400
        );

      }


      set.id_number = idNumber;

    }

  }


  // --------------------------------------
  // AVATAR / PHOTO
  // --------------------------------------

  if (
    updates.avatar_url !== undefined
  ) {

    if (
      updates.avatar_url === null ||
      String(updates.avatar_url).trim() === ''
    ) {

      set.avatar_url = null;

    } else {

      const avatar =
        String(updates.avatar_url);


      if (
        !AVATAR_DATA_URI_REGEX.test(avatar)
      ) {

        throw new AppError(
          'Photo must be a PNG, JPEG, or WEBP image',
          400
        );

      }


      if (
        avatar.length >
        MAX_AVATAR_STRING_LENGTH
      ) {

        throw new AppError(
          'Photo is too large. Please use an image under 2MB',
          400
        );

      }


      set.avatar_url = avatar;

    }

  }


  // --------------------------------------
  // PREVENT EMPTY UPDATES
  // --------------------------------------

  if (
    Object.keys(set).length === 0
  ) {

    throw new AppError(
      'No valid profile fields provided for update',
      400
    );

  }


  return set;

};