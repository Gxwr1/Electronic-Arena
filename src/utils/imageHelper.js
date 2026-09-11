/**
 * Processes and compresses uploaded image files up to 25MB
 * Automatically scales down large high-res photos to high-quality crisp avatars (512x512)
 * @param {File} file - User uploaded image file
 * @param {number} maxSizeMB - Max allowable file size in Megabytes (default 25MB)
 * @returns {Promise<string>} Base64 Data URL
 */
export function processImageUpload(file, maxSizeMB = 25) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No file provided'));
      return;
    }

    if (file.size > maxSizeMB * 1024 * 1024) {
      reject(new Error(`Image file must be under ${maxSizeMB}MB (Current size: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (event) => {
      const src = event.target?.result;
      if (!src) {
        reject(new Error('Empty image payload'));
        return;
      }

      // If already SVG or tiny image, return directly
      if (typeof src === 'string' && (src.startsWith('data:image/svg+xml') || src.length < 50000)) {
        resolve(src);
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(src); // fallback to raw data URL
      img.onload = () => {
        try {
          const maxDim = 512;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const compressed = canvas.toDataURL('image/jpeg', 0.88);
          resolve(compressed);
        } catch (e) {
          resolve(src); // fallback if canvas fails
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
