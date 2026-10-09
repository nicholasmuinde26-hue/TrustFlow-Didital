import AppError from "./AppError.js";

// ========================================
// IMAGE DATA URI VALIDATION
// ========================================
//
// This project stores images inline as base64 data URIs (no object
// storage yet — see User.avatar_url). Every image field that arrives from
// a client goes through here so a bad string can never be stored and later
// rendered or opened by someone else.
//
// ========================================

const PREFIX = /^data:image\/(png|jpe?g|webp);base64,/i;
const BASE64_BODY = /^[A-Za-z0-9+/]+={0,2}$/;

export const IMAGE_LIMITS = {
  // KYC documents are read by reviewers, so they keep more detail.
  kyc: 1_400_000,
  // Public images are shown to everyone, so they stay small and fast.
  publicAvatar: 450_000,
  publicCover: 900_000,
  logo: 450_000,
  certificate: 1_400_000,
};

export function assertImageDataUri(value, { label = "Image", maxChars = IMAGE_LIMITS.kyc, required = true } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) throw new AppError(`${label} is required`, 400);
    return null;
  }
  if (typeof value !== "string" || !PREFIX.test(value)) {
    throw new AppError(`${label} must be a PNG, JPEG or WEBP image`, 400);
  }
  if (value.length > maxChars) {
    throw new AppError(`${label} is too large. Use a smaller photo.`, 413);
  }
  const body = value.slice(value.indexOf(",") + 1);
  if (!BASE64_BODY.test(body)) throw new AppError(`${label} is not a valid image`, 400);
  return value;
}

export const cleanText = (value, max) => String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim().slice(0, max);

export function cleanUrl(value, max = 300) {
  const text = cleanText(value, max);
  if (!text) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return ["http:", "https:"].includes(url.protocol) ? url.toString().slice(0, max) : "";
  } catch {
    return "";
  }
}
