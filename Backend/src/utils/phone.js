export const formatPhone = (phone) => {
  if (!phone) {
    throw new Error(
      'Phone number is required'
    );
  }

  let formattedPhone =
    phone.trim();

  // +254712345678
  //      ↓
  // 254712345678
  if (
    formattedPhone.startsWith('+254')
  ) {
    formattedPhone =
      formattedPhone.slice(1);
  }

  // 0712345678
  //      ↓
  // 254712345678
  if (
    formattedPhone.startsWith('0')
  ) {
    formattedPhone =
      `254${formattedPhone.slice(1)}`;
  }

  return formattedPhone;
};


export const isValidKenyanPhone = (
  phone
) => {
  return /^254\d{9}$/.test(phone);
};