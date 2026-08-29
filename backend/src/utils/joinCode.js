import crypto from 'node:crypto';
import Chama from '../models/Chama.js';

/**
 * Generates a random 6-character alphanumeric join code.
 * @returns {string} The generated code.
 */
function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  // Generate random bytes and use them to pick characters
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

/**
 * Generates a guaranteed unique join code for a Chama.
 * It will retry up to 10 times if a collision occurs.
 * @returns {Promise<string>} A unique join code.
 */
export const generateUniqueJoinCode = async () => {
  let isUnique = false;
  let code = '';
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    code = generateCode();
    const existingChama = await Chama.findOne({ join_code: code });
    if (!existingChama) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error('Could not generate a unique join code after multiple attempts.');
  }

  return code;
};
