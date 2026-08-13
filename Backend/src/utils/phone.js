/**
 * ============================================================
 * PHONE UTILS - KENYA M-PESA FORMAT
 * ============================================================
 * Always returns: 2547XXXXXXXX or 2541XXXXXXXX
 */

export const formatPhone = (phone) => {
  if (!phone) {
    throw new Error('Phone number is required');
  }

  // 1. Strip everything except digits and +
  let formattedPhone = String(phone).trim().replace(/[\s\-()]/g, "");

  // 2. +254712345678 -> 254712345678
  if (formattedPhone.startsWith('+254')) {
    formattedPhone = formattedPhone.slice(1);
  }

  // 3. 0712345678 or 0112345678 -> 254712345678
  if (formattedPhone.startsWith('0')) {
    formattedPhone = `254${formattedPhone.slice(1)}`;
  }

  // 4. 254712345678 is already good
  // 5. 712345678 -> 254712345678
  if (/^[71]\d{8}$/.test(formattedPhone)) {
    formattedPhone = `254${formattedPhone}`;
  }

  // Final validation
  if (!isValidKenyanPhone(formattedPhone)) {
    throw new Error(`Invalid Kenyan phone number. Got: ${phone}. Expected: 2547XXXXXXXX or 2541XXXXXXXX`);
  }

  return formattedPhone;
};

export const isValidKenyanPhone = (phone) => {
  // Must be 254 + 9 digits, and must start with 7 or 1
  return /^254[71]\d{8}$/.test(phone);
};

/**
 * Alias for mpesa.service compatibility
 */
export const normalize = formatPhone;
export default { formatPhone, isValidKenyanPhone, normalize };