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

export async function loadSpriteSheet(url) {
  const image = new Image();
  image.decoding = 'async';
  const loaded = new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => reject(new Error('Não foi possível carregar a folha de sprites.'));
  });
  image.src = url;
  await loaded;
  frameRect(image.naturalWidth, image.naturalHeight, 'down');
  const frames = new Map();
  return {
    image,
    frame(direction, index = 0) {
      const key = `${direction}:${index}`;
      if (frames.has(key)) return frames.get(key);
      const source = frameRect(image.naturalWidth, image.naturalHeight, direction, index);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, 64, 64);
      frames.set(key, canvas);
      return canvas;
    },
  };
}
