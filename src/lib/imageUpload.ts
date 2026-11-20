export interface ImageUploadOptions {
  maxDimension?: number;
  preserveTransparency?: boolean;
  quality?: number;
  maxFileSizeMb?: number;
}

const ACCEPTED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
]);

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Lecture du fichier image impossible.'));
      }
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier.'));
    reader.readAsDataURL(file);
  });
}

export async function processUploadedImage(
  file: File,
  options: ImageUploadOptions = {},
): Promise<string> {
  const {
    maxDimension = 512,
    preserveTransparency = false,
    quality = 0.86,
    maxFileSizeMb = 5,
  } = options;

  if (!ACCEPTED_MIME_TYPES.has(file.type)) {
    throw new Error('Format non supporté (PNG, JPG, WebP ou SVG requis).');
  }

  if (file.size > maxFileSizeMb * 1024 * 1024) {
    throw new Error(`Image trop volumineuse (max ${maxFileSizeMb} Mo).`);
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  if (file.type === 'image/svg+xml') {
    return rawDataUrl;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const largest = Math.max(img.width || 1, img.height || 1);
        const scale = largest > maxDimension ? maxDimension / largest : 1;
        const targetW = Math.max(1, Math.round((img.width || maxDimension) * scale));
        const targetH = Math.max(1, Math.round((img.height || maxDimension) * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }

        if (!preserveTransparency) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, targetW, targetH);
        } else {
          ctx.clearRect(0, 0, targetW, targetH);
        }

        ctx.drawImage(img, 0, 0, targetW, targetH);
        const outputMime = preserveTransparency ? 'image/png' : 'image/jpeg';
        const compressed = canvas.toDataURL(outputMime, quality);
        resolve(compressed);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => reject(new Error('Fichier image invalide ou corrompu.'));
    img.src = rawDataUrl;
  });
}
