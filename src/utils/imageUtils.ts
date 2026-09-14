/**
 * Utility to compress and resize image files (from camera capture or file inputs)
 * Scales down large images to maxDim (default 1280px) and applies JPEG compression (default 0.75).
 * Converts 5MB-15MB camera photos to lightweight ~150KB-250KB base64 strings.
 */
export function compressImageFile(file: File | Blob, maxDim = 1280, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const resultStr = e.target?.result as string;
      if (!resultStr) {
        resolve('');
        return;
      }

      if (typeof window === 'undefined' || typeof document === 'undefined') {
        resolve(resultStr);
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(resultStr);
      img.onload = () => {
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
        if (!ctx) {
          resolve(resultStr);
          return;
        }

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}
