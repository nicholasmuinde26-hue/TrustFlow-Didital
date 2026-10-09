import ChamaAsset from "../models/ChamaAsset.js";

// ======================================================================
// ASSET PAYMENT REFERENCE CODE
// ======================================================================
//
// The account number a tenant/lessee types into their M-Pesa Paybill
// screen to pay a specific chama-owned asset directly — as opposed to a
// member contributing to the chama itself, which is matched by phone
// number (see mpesaC2b/c2bReconciliation.service.js#matchBillRefNumber).
//
// Format: "AST" + 6 uppercase alphanumeric characters, e.g. "AST7K4M2Q".
// Deliberately:
//   - Prefixed with letters so it can never be mistaken for (or parsed
//     as) a phone number — matchBillRefNumber's phone parsing and this
//     code's format are mutually exclusive by construction.
//   - Short enough for a tenant to type correctly into a Paybill screen
//     from a printed rent notice or a WhatsApp message.
//   - Drawn from an alphabet that excludes visually-ambiguous characters
//     (0/O, 1/I) since a typo here silently misdirects real money.
// ======================================================================

const CODE_LENGTH = 6;
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
const PREFIX = "AST";
const ASSET_PAYMENT_CODE_RE = new RegExp(`^${PREFIX}[${ALPHABET}]{${CODE_LENGTH}}$`);

function randomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${PREFIX}${code}`;
}

// Whether a BillRefNumber string is shaped like an asset payment code at
// all — used by c2bReconciliation.service.js to route a confirmation to
// the asset-income path BEFORE trying to parse it as a phone number.
// This does NOT check whether the code belongs to a real asset.
export function isAssetPaymentCode(value) {
  return ASSET_PAYMENT_CODE_RE.test(String(value || "").trim().toUpperCase());
}

// Generates a code guaranteed not to collide with any ChamaAsset already
// holding one (payment_ref_code has a sparse unique index as a backstop —
// see models/ChamaAsset.js — but checking here avoids relying on a
// duplicate-key error as the normal path).
export async function generateUniqueAssetPaymentCode() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = randomCode();
    // eslint-disable-next-line no-await-in-loop
    const existing = await ChamaAsset.findOne({ payment_ref_code: candidate }).select("_id").lean();
    if (!existing) return candidate;
  }
  throw new Error("Could not generate a unique asset payment code after 20 attempts");
}

export default { isAssetPaymentCode, generateUniqueAssetPaymentCode };