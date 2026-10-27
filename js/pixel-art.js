// Original local pixel sprites. No image downloads, APIs or sprite CDNs.
const cache = new Map();
function painter(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  const rect = (x, y, w, h, color) => { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const ellipse = (cx, cy, rx, ry, color) => {
    for (let y = -ry; y <= ry; y++) {
      const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y / ry) ** 2)));
      rect(cx - half, cy + y, half * 2 + 1, 1, color);
    }
  };
  const poly = (points, color) => {
    for (let y = Math.min(...points.map(p => p[1])); y <= Math.max(...points.map(p => p[1])); y++) {
      const xs = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) xs.push(a[0] + (y - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) rect(Math.ceil(xs[i]), y, Math.floor(xs[i + 1]) - Math.ceil(xs[i]) + 1, 1, color);
    }
  };
  return { canvas, ctx, rect, ellipse, poly };
}
export function pokemonArt(id, back = false) {
  const key = `${id}:${back}`;
  if (cache.has(key)) return cache.get(key);
  const { canvas, rect: r, ellipse: e, poly: p } = painter(48, 48);
  const eye = (x, y, color = '#2d3340') => { r(x, y, 4, 6, '#ffefd5'); r(x + 1, y + 1, 3, 5, color); r(x + 1, y + 1, 1, 2, '#ffffff'); };
  if (id === 'bulbasaur') {
    e(27, 32, 16, 10, '#244b42'); e(27, 31, 15, 9, '#64aa88');
    r(12, 35, 7, 9, '#28574a'); r(13, 35, 5, 8, '#78bc92'); r(32, 35, 7, 9, '#28574a'); r(33, 35, 5, 8, '#72b58c');
    p([[23, 26], [18, 13], [22, 5], [28, 12], [32, 7], [37, 15], [36, 27]], '#264e3c');
    p([[24, 24], [21, 14], [23, 9], [28, 17], [32, 11], [35, 17], [34, 25]], '#749b48');
    r(27, 16, 2, 10, '#4a773f'); e(16, 29, 12, 10, '#28574a');
    p([[5, 26], [4, 17], [12, 21], [24, 20], [28, 16], [28, 29]], '#28574a');
    p([[7, 27], [7, 21], [12, 24], [24, 23], [26, 21], [26, 30]], '#86c69d'); e(16, 30, 11, 8, '#7fc59a');
    r(10, 21, 3, 3, '#56a086'); r(17, 25, 4, 3, '#4d9478'); r(33, 30, 4, 3, '#428b71');
    if (!back) { eye(7, 28, '#bd4f68'); eye(22, 27, '#bd4f68'); r(14, 35, 6, 1, '#315a49'); r(16, 36, 3, 1, '#315a49'); }
  } else if (id === 'charmander') {
    p([[28, 35], [36, 33], [39, 25], [42, 26], [42, 35], [38, 40], [30, 41]], '#8a5135');
    p([[29, 36], [37, 35], [40, 29], [40, 35], [36, 38], [29, 39]], '#e89c4f');
    p([[38, 29], [36, 23], [39, 18], [39, 12], [43, 17], [46, 22], [44, 28]], '#bf553a');
    p([[39, 27], [39, 22], [41, 17], [44, 22], [43, 27]], '#ffc85c'); r(40, 23, 2, 4, '#fff0a3');
    e(23, 31, 9, 12, '#8a5135'); e(23, 31, 8, 11, '#eaa15d'); e(23, 33, 5, 8, '#f6d795');
    r(12, 27, 5, 8, '#d8884e'); r(29, 27, 5, 8, '#d8884e');
    r(13, 40, 9, 5, '#8a5135'); r(14, 40, 7, 4, '#f0aa65'); r(26, 40, 9, 5, '#8a5135'); r(27, 40, 7, 4, '#f0aa65');
    e(22, 17, 10, 12, '#8a5135'); e(22, 17, 9, 11, '#efa761'); r(17, 8, 6, 2, '#f8bc78');
    if (!back) { eye(15, 15, '#3d7475'); eye(26, 15, '#3d7475'); r(18, 24, 8, 1, '#8a5135'); r(20, 25, 4, 1, '#8a5135'); }
  } else if (id === 'squirtle') {
    e(37, 36, 7, 7, '#3a6570'); e(37, 35, 5, 5, '#91c6cb'); r(37, 34, 3, 4, '#5d97a3');
    e(28, 31, 12, 13, '#5d5742'); e(28, 30, 11, 12, '#bc9460'); e(28, 30, 9, 10, '#987345');
    r(27, 20, 2, 21, '#d7b37b'); r(19, 28, 18, 2, '#d7b37b'); r(21, 35, 14, 2, '#d7b37b');
    r(12, 40, 9, 5, '#3a6570'); r(13, 40, 7, 4, '#8cc4c5'); r(28, 40, 8, 5, '#3a6570'); r(29, 40, 6, 4, '#8cc4c5');
    e(21, 32, 9, 10, '#3a6570'); e(21, 32, 8, 9, back ? '#aa8452' : '#ead49b');
    r(17, 27, 2, 13, '#c1ac76'); r(14, 32, 15, 1, '#c1ac76'); r(16, 37, 12, 1, '#c1ac76');
    r(8, 26, 7, 8, '#77afba'); r(29, 26, 7, 8, '#77afba');
    e(21, 16, 11, 11, '#3a6570'); e(21, 16, 10, 10, '#94cdd0'); r(16, 8, 7, 2, '#b4e0d7');
    if (!back) { eye(13, 14, '#7e5351'); eye(26, 14, '#7e5351'); r(18, 24, 7, 1, '#3a6570'); }
  } else if (id === 'pikachu') {
    p([[33, 32], [40, 25], [37, 20], [44, 14], [47, 24], [42, 28], [44, 32], [35, 39]], '#a47b35');
    p([[34, 33], [42, 31], [40, 27], [45, 23], [43, 18], [39, 21], [42, 25]], '#f1c553');
    r(10, 4, 5, 17, '#524534'); r(12, 9, 4, 12, '#f5cf5c'); r(29, 3, 5, 17, '#524534'); r(29, 9, 4, 12, '#f5cf5c');
    e(23, 33, 11, 10, '#a47b35'); e(23, 32, 10, 10, '#edc456'); r(11, 40, 10, 4, '#f5cf5c'); r(26, 40, 10, 4, '#f5cf5c');
    e(22, 23, 14, 11, '#a47b35'); e(22, 23, 13, 10, '#f5cf5c');
    if (!back) { r(14, 21, 3, 4, '#3e3c39'); r(28, 21, 3, 4, '#3e3c39'); r(14, 21, 1, 1, '#fffbe6'); r(28, 21, 1, 1, '#fffbe6'); r(10, 27, 5, 4, '#d5775a'); r(30, 27, 5, 4, '#d5775a'); r(21, 26, 3, 1, '#69523c'); r(20, 29, 5, 1, '#69523c'); }
    else { r(14, 28, 15, 2, '#aa7e3c'); r(15, 33, 14, 2, '#aa7e3c'); }
  } else if (id === 'caterpie') {
    for (const [x, y, size] of [[12, 36, 7], [19, 33, 8], [27, 29, 9]]) { e(x, y, size, size, '#4f7041'); e(x, y - 1, size - 1, size - 1, '#a6bd66'); e(x - 1, y, 3, 4, '#e4cb74'); }
    r(10, 42, 4, 3, '#c4a65e'); r(23, 39, 4, 3, '#c4a65e');
    e(29, 19, 12, 14, '#4f7041'); e(29, 19, 11, 13, '#a6c674');
    p([[26, 7], [23, 2], [26, 1], [29, 5], [33, 1], [36, 2], [32, 8]], '#c47762');
    if (!back) { e(23, 17, 4, 7, '#f2db9a'); e(35, 17, 4, 7, '#f2db9a'); e(24, 18, 2, 5, '#354a38'); e(35, 18, 2, 5, '#354a38'); r(23, 15, 1, 2, '#fff'); r(34, 15, 1, 2, '#fff'); r(27, 28, 5, 1, '#4f7041'); }
  } else if (id === 'pidgey') {
    p([[13, 31], [3, 37], [11, 38], [5, 42], [19, 38]], '#826244'); e(26, 31, 12, 11, '#765d45'); e(26, 30, 11, 10, '#b09464'); e(30, 32, 7, 8, '#ead8a6');
    e(20, 31, 10, 6, '#94754e'); r(13, 32, 12, 2, '#b39969'); r(15, 35, 9, 1, '#775f42');
    e(30, 17, 10, 11, '#765d45'); e(30, 17, 9, 10, '#bc9d6e'); p([[24, 9], [21, 3], [29, 7], [33, 3], [34, 10]], '#bc9d6e');
    if (!back) { r(24, 14, 5, 8, '#f1dfae'); r(34, 14, 5, 8, '#f1dfae'); r(27, 15, 2, 6, '#3d3b32'); r(34, 15, 2, 6, '#3d3b32'); p([[28, 23], [36, 23], [32, 28]], '#ce975d'); }
    r(22, 41, 2, 4, '#c39560'); r(31, 41, 2, 4, '#c39560'); r(20, 44, 6, 1, '#c39560'); r(29, 44, 6, 1, '#c39560');
  } else if (id === 'oddish') {
    p([[23, 22], [9, 12], [7, 4], [14, 5], [24, 19], [19, 5], [23, 0], [29, 4], [27, 18], [35, 4], [42, 4], [39, 13], [30, 23]], '#426344');
    p([[22, 20], [11, 9], [11, 7], [17, 11], [25, 22], [24, 5], [26, 4], [26, 22], [37, 8], [39, 7], [35, 16], [28, 24]], '#7e9e54');
    r(9, 40, 12, 5, '#5c7c9b'); r(28, 40, 12, 5, '#5c7c9b');
    e(24, 32, 14, 12, '#3f5672'); e(24, 31, 13, 11, '#7897b0'); e(20, 27, 7, 4, '#8fa9b9');
    if (!back) { r(17, 30, 2, 4, '#344153'); r(30, 30, 2, 4, '#344153'); r(22, 36, 5, 3, '#9d6678'); r(23, 39, 3, 1, '#344153'); }
  }
  cache.set(key, canvas);
  return canvas;
}

export function trainerArt(kind = 'trainer', direction = 'down', frame = 0) {
  const key = `${kind}:${direction}:${frame}`;
  if (cache.has(key)) return cache.get(key);
  const { canvas, rect: r } = painter(32, 48);
  const back = direction === 'up';
  const side = direction === 'left' || direction === 'right';
  const coat = kind === 'professor' || kind === 'nurse' ? '#ece7d4' : kind === 'scout' ? '#83a06a' : '#4c697e';
  const shade = kind === 'professor' || kind === 'nurse' ? '#a4b7b1' : '#354957';
  const hat = kind === 'nurse' ? '#f0d7bc' : kind === 'professor' ? '#7b776b' : '#bd6355';
  const stride = frame ? 2 : 0;
  r(10, 34, 5, 10 - stride, '#344457'); r(18, 34, 5, 8 + stride, '#344457');
  r(8, 42 - stride, 8, 4, '#343d42'); r(18, 40 + stride, 8, 4, '#343d42');
  r(9, 22, 15, 15, shade); r(11, 22, 11, 13, coat); r(7, 25 + stride, 4, 10, coat); r(22, 25 - stride, 4, 10, coat);
  r(7, 33 + stride, 4, 3, '#e8b58b'); r(22, 33 - stride, 4, 3, '#e8b58b');
  r(9, 7, 15, 16, '#564439'); r(11, 11, 12, 11, '#e9bb92'); r(13, 21, 7, 3, '#d49a7b');
  if (kind === 'nurse') { r(8, 8, 17, 7, '#be8076'); r(11, 4, 11, 7, '#f4e4cf'); r(15, 5, 3, 5, '#bf615d'); r(14, 6, 5, 2, '#bf615d'); }
  else if (kind === 'professor') { r(8, 7, 16, 6, hat); r(10, 4, 13, 5, '#a39c85'); r(21, 10, 3, 5, '#7b776b'); }
  else { r(8, 7, 17, 5, hat); r(11, 3, 13, 6, hat); r(back ? 9 : 15, 9, 13, 3, '#ece5cf'); r(14, 4, 5, 3, '#e2b394'); }
  if (!back) {
    r(side ? 12 : 12, 15, 2, 3, '#353c41'); if (!side) r(20, 15, 2, 3, '#353c41');
    r(16, 20, 3, 1, '#986d57');
    if (kind === 'professor') { r(10, 14, 6, 5, '#8a9e97'); r(18, 14, 6, 5, '#8a9e97'); r(11, 15, 4, 2, '#d6d5c2'); r(19, 15, 4, 2, '#d6d5c2'); }
    r(15, 25, 3, 7, '#e6ce9e');
  } else { r(10, 12, 13, 8, '#564439'); r(11, 26, 11, 10, '#b38a61'); r(13, 27, 7, 6, '#ceb281'); r(15, 31, 3, 1, '#685641'); }
  if (direction === 'right') {
    const copy = document.createElement('canvas'); copy.width = 32; copy.height = 48;
    const ctx = copy.getContext('2d'); ctx.translate(32, 0); ctx.scale(-1, 1); ctx.drawImage(canvas, 0, 0);
    cache.set(key, copy); return copy;
  }
  cache.set(key, canvas); return canvas;
}

export function treeArt(variant = 0) {
  const key = `tree:${variant}`;
  if (cache.has(key)) return cache.get(key);
  const { canvas, rect: r, ellipse: e } = painter(64, 88);
  const random = (x, y) => { const n = Math.sin(x * 73.3 + y * 127.1 + variant * 17) * 43758.5; return n - Math.floor(n); };
  r(28, 54, 9, 31, '#5a5742'); r(30, 53, 4, 30, '#7d7451'); r(26, 83, 14, 4, '#5a5742');
  for (const [x, y, rx, ry] of [[32, 22, 17, 19], [19, 37, 17, 21], [44, 36, 17, 22], [31, 47, 24, 21]]) {
    e(x, y, rx, ry, '#293f36'); e(x, y - 3, rx - 1, ry - 3, variant ? '#567d51' : '#477b57');
    e(x - 3, y - 8, rx - 5, ry - 8, variant ? '#7f9657' : '#6b985e');
  }
  for (let y = 8; y < 63; y += 3) for (let x = 4; x < 60; x += 3) {
    const pixel = canvas.getContext('2d').getImageData(x, y, 1, 1).data;
    if (pixel[3] && random(x, y) > .65) r(x, y, 2, 2, random(y, x) > .5 ? '#9baa68' : '#3b694b');
  }
  cache.set(key, canvas); return canvas;
}
export function grassArt() {
  if (cache.has('grass')) return cache.get('grass');
  const { canvas, rect: r, poly: p } = painter(24, 20);
  p([[0, 20], [1, 9], [5, 14], [6, 3], [11, 14], [13, 0], [17, 13], [22, 6], [23, 20]], '#3e7150');
  p([[2, 20], [3, 12], [7, 16], [7, 8], [11, 18], [14, 5], [16, 16], [20, 12], [21, 20]], '#689856');
  r(7, 12, 1, 5, '#a9ba6c'); r(14, 8, 1, 6, '#b3c275');
  cache.set('grass', canvas); return canvas;
}
export function spriteURL(id) { return pokemonArt(id).toDataURL(); }
