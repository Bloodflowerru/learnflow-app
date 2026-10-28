const MAX_IMAGE_DIMENSION = 1600;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
const IMAGE_TARGET_BYTES = 400 * 1024;

export async function fileToDataURL(file: File): Promise<string> {
  if (file.type.startsWith('image/')) return await processImage(file);
  if (file.type.startsWith('video/')) return await processVideo(file);
  throw new Error('Неподдерживаемый тип: ' + file.type);
}

async function processImage(file: File): Promise<string> {
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Изображение больше ${MAX_IMAGE_BYTES / 1024 / 1024} МБ`);
  }
  const raw = await rawFileToDataURL(file);
  const img = await loadImage(raw);

  let { width, height } = img;
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    const scale = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas не поддерживается');
  // белый фон — чтобы прозрачные PNG не становились чёрными в JPEG
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  let quality = 0.85;
  let out = canvas.toDataURL('image/jpeg', quality);
  // длина base64 ≈ 1.37 × размера бинарника
  while (out.length > IMAGE_TARGET_BYTES * 1.37 && quality > 0.4) {
    quality -= 0.1;
    out = canvas.toDataURL('image/jpeg', quality);
  }
  console.log(
    `[compress] ${file.name}: ${Math.round(file.size / 1024)}KB → ` +
    `${Math.round(out.length / 1024)}KB (q=${quality.toFixed(2)})`
  );
  return out;
}

async function processVideo(file: File): Promise<string> {
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error(
      `Видео больше ${MAX_VIDEO_BYTES / 1024 / 1024} МБ. Для больших файлов нужен серверный upload.`
    );
  }
  return await rawFileToDataURL(file);
}

function rawFileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось загрузить изображение'));
    img.src = src;
  });
}