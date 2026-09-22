/**
 * Utilitário avançado de compressão e redimensionamento inteligente de imagens.
 * Desenvolvido para prevenir erros de quota (LocalStorage) em telemóveis e tablets,
 * convertendo fotos pesadas de câmara (3MB-15MB) em imagens nítidas de inspeção técnica
 * com peso controlado (~40KB a 80KB).
 */

export interface ImageCompressionOptions {
  maxDim?: number;        // Dimensão máxima (largura/altura) em pixels (default: 1024px)
  quality?: number;       // Qualidade JPEG inicial (0.1 a 1.0) (default: 0.65)
  maxSizeBytes?: number;  // Tamanho máximo pretendido do Base64 final (default: 85 * 1024 = ~85KB)
}

/**
 * Comprime um ficheiro de imagem ou Blob de forma progressiva.
 */
export function compressImageFile(
  file: File | Blob,
  maxDimOrOptions: number | ImageCompressionOptions = 1024,
  legacyQuality = 0.65
): Promise<string> {
  let maxDim = 1024;
  let quality = 0.65;
  let maxSizeBytes = 85 * 1024;

  if (typeof maxDimOrOptions === 'number') {
    maxDim = maxDimOrOptions;
    quality = legacyQuality;
  } else if (typeof maxDimOrOptions === 'object' && maxDimOrOptions !== null) {
    maxDim = maxDimOrOptions.maxDim ?? 1024;
    quality = maxDimOrOptions.quality ?? 0.65;
    maxSizeBytes = maxDimOrOptions.maxSizeBytes ?? 85 * 1024;
  }

  return new Promise((resolve, reject) => {
    if (!file) {
      resolve('');
      return;
    }

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

        // 1. Redimensionamento mantendo a proporção de aspeto
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

        // Fundo branco para preservar transparência caso seja PNG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // 2. Compressão progressiva: se o Base64 for maior que maxSizeBytes, ajusta qualidade
        let currentQuality = quality;
        let dataUrl = canvas.toDataURL('image/jpeg', currentQuality);

        // O tamanho em bytes do base64 é aproximadamente (length * 3 / 4)
        let approxBytes = (dataUrl.length * 3) / 4;
        let attempts = 0;

        while (approxBytes > maxSizeBytes && currentQuality > 0.35 && attempts < 3) {
          attempts++;
          currentQuality = Math.max(0.35, currentQuality - 0.15);
          dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
          approxBytes = (dataUrl.length * 3) / 4;
        }

        // Se mesmo assim exceder, reduz as dimensões do canvas em 25%
        if (approxBytes > maxSizeBytes * 1.5 && width > 600 && height > 600) {
          const smallCanvas = document.createElement('canvas');
          smallCanvas.width = Math.round(width * 0.75);
          smallCanvas.height = Math.round(height * 0.75);
          const sCtx = smallCanvas.getContext('2d');
          if (sCtx) {
            sCtx.fillStyle = '#ffffff';
            sCtx.fillRect(0, 0, smallCanvas.width, smallCanvas.height);
            sCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
            dataUrl = smallCanvas.toDataURL('image/jpeg', 0.55);
          }
        }

        resolve(dataUrl);
      };
      img.src = resultStr;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime uma lista de ficheiros concorrentemente.
 */
export async function compressImageFiles(
  files: (File | Blob)[],
  options?: ImageCompressionOptions
): Promise<string[]> {
  const promises = Array.from(files).map((f) => compressImageFile(f, options));
  return Promise.all(promises);
}
