const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

export function readImageAsDataUri(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("No file selected"));
      return;
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      reject(new Error("Photo must be a PNG, JPEG, or WEBP image"));
      return;
    }

    if (file.size > MAX_BYTES) {
      reject(new Error("Photo is too large. Please use an image under 2MB"));
      return;
    }

    const reader = new FileReader();

    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read the selected photo"));
    reader.readAsDataURL(file);
  });
}
