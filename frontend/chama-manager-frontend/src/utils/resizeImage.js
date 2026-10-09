// ========================================
// RESIZE IMAGE -> DATA URI
// ========================================
//
// Photos are stored inline as base64 data URIs (see User.avatar_url), and
// the API caps both the request body (5 MB) and each image field. A modern
// phone photo is 3-8 MB, so sending it untouched is what made KYC uploads
// fail. This shrinks the picture in the browser until it fits `maxChars`
// (the length of the final data URI), trying smaller sizes and lower
// quality as needed.
//
// ========================================

const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file could not be read as an image.")); };
    img.src = url;
  });
}

export async function imageFileToDataUri(file, { maxDim = 1024, maxChars = 450_000 } = {}) {
  if (!file) return null;
  if (!ALLOWED.includes(file.type)) throw new Error("Only PNG, JPEG or WEBP images are accepted.");
  if (file.size > 25 * 1024 * 1024) throw new Error("That photo is too large. Choose one under 25 MB.");

  const img = await loadImage(file);
  let dim = maxDim;
  let quality = 0.85;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(1, dim / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; // PNG transparency would turn black in JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUri = canvas.toDataURL("image/jpeg", quality);
    if (dataUri.length <= maxChars) return dataUri;
    if (quality > 0.55) quality -= 0.1;
    else dim = Math.round(dim * 0.8);
  }
  throw new Error("Could not make that photo small enough. Try a different one.");
}
