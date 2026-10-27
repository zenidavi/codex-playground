// Shared sheet layout: down, left, right, up; four walking frames per row.
export const SHEET_DIRECTIONS = Object.freeze(['down', 'left', 'right', 'up']);

export function frameRect(width, height, direction, frame = 0) {
  if (!Number.isInteger(width) || width < 64 || width > 4096 || width !== height || width % 4) {
    throw new Error('A folha deve ser quadrada, dividida em 4 × 4, com até 4096 pixels por lado.');
  }
  const row = SHEET_DIRECTIONS.indexOf(direction);
  if (row < 0 || !Number.isInteger(frame) || frame < 0 || frame > 3) throw new Error('Quadro de animação inválido.');
  const size = width / 4;
  return { x: frame * size, y: row * size, width: size, height: size };
}

export function walkingFrame(seconds, moving, reducedMotion = false) {
  return moving && !reducedMotion ? Math.floor(Math.max(0, seconds) * 8) % 4 : 0;
}

export function movementDirection(dx, dz, previous = 'down') {
  if (Math.hypot(dx, dz) < .001) return previous;
  return Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up');
}

// Preview-time background key. Only neutral light pixels connected to the border
// are hidden; enclosed highlights remain intact. The original file is untouched.
export function backgroundMask(pixels, width, height) {
  if (pixels.length !== width * height * 4) throw new Error('Pixels inválidos.');
  const mask = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let head = 0, tail = 0;
  const visit = index => {
    if (mask[index]) return;
    const offset = index * 4;
    const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
    if (pixels[offset + 3] > 0 && (Math.min(r, g, b) < 150 || Math.max(r, g, b) - Math.min(r, g, b) > 30)) return;
    mask[index] = 1; queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width;
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (index >= width) visit(index - width);
    if (index + width < width * height) visit(index + width);
  }
  return mask;
}

export async function loadSpriteSheet(url, { hideBackground = false } = {}) {
  const image = new Image();
  image.decoding = 'async';
  const loaded = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Não foi possível carregar a folha de sprites.'));
  });
  image.src = url;
  await loaded;
  frameRect(image.naturalWidth, image.naturalHeight, 'down');
  if (image.naturalWidth > 2048) throw new Error('Use uma imagem de até 2048 × 2048 pixels.');
  let sourceImage = image;
  if (hideBackground) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const mask = backgroundMask(pixels.data, canvas.width, canvas.height);
    for (let i = 0; i < mask.length; i++) if (mask[i]) pixels.data[i * 4 + 3] = 0;
    ctx.putImageData(pixels, 0, 0); sourceImage = canvas;
  }
  const frames = new Map();
  return {
    image,
    frames,
    frame(direction, index = 0) {
      const key = `${direction}:${index}`;
      if (frames.has(key)) return frames.get(key);
      const source = frameRect(image.naturalWidth, image.naturalHeight, direction, index);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(sourceImage, source.x, source.y, source.width, source.height, 0, 0, 64, 64);
      frames.set(key, canvas);
      return canvas;
    },
  };
}

export async function loadSpriteFile(file, options) {
  if (!(file instanceof Blob) || !file.size) throw new Error('Escolha uma imagem PNG, WebP ou JPEG.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Escolha uma imagem de até 8 MB.');
  if (!['image/png', 'image/webp', 'image/jpeg'].includes(file.type)) throw new Error('Use um arquivo PNG, WebP ou JPEG.');
  const url = URL.createObjectURL(file);
  try { return await loadSpriteSheet(url, options); }
  finally { URL.revokeObjectURL(url); }
}
