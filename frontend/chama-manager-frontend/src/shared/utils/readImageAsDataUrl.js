export function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(
        new Error("No image selected.")
      );
      return;
    }

    if (!file.type.startsWith("image/")) {
      reject(
        new Error(
          "Please select a valid image."
        )
      );
      return;
    }

    const maxSize =
      2 * 1024 * 1024;

    if (file.size > maxSize) {
      reject(
        new Error(
          "Image must be smaller than 2MB."
        )
      );
      return;
    }

    const reader =
      new FileReader();

    reader.onload = () => {
      resolve(reader.result);
    };

    reader.onerror = () => {
      reject(
        new Error(
          "Unable to read image."
        )
      );
    };

    reader.readAsDataURL(file);
  });
}