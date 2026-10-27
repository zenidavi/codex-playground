// The same deterministic map drives the 3D scenery, collision and minimap.
export const WORLD = { width: 32, height: 28 };
export const START_POSITION = { x: 15.5, z: 23.4 };
export const NPCS = [
  { id: 'professor', name: 'Prof.ª Lia', x: 11, z: 22.3, kind: 'professor' },
  { id: 'nurse', name: 'Enfermeira Clara', x: 20.3, z: 22.3, kind: 'nurse' },
  { id: 'scout', name: 'Treinador Theo', x: 18, z: 15, kind: 'scout' },
  { id: 'sign', name: 'Placa da Rota 01', x: 16.8, z: 12.8, kind: 'sign' },
];
export const BUILDINGS = [
  { x: 10.8, z: 19.4, width: 4.2, depth: 3.2, kind: 'lab' },
  { x: 20.3, z: 19.4, width: 4.2, depth: 3.2, kind: 'center' },
];
export const FENCES = [[7.5, 12.5, 24.6], [18, 22, 24.6], [5, 12.5, 5]];

export function seededRandom(seed = 27) {
  let value = seed >>> 0;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}
export function terrainAt(x, z) {
  if (x < 1.4 || x > 30.6 || z < 1.4 || z > 26.6) return 'edge';
  if (BUILDINGS.some(b => Math.abs(x - b.x) < b.width / 2 + .15 && Math.abs(z - b.z) < b.depth / 2 + .15)) return 'building';
  if (x >= 23.5 && x <= 30 && z >= 9.5 && z <= 24) return z >= 15.3 && z <= 16.7 ? 'bridge' : 'water';
  if ((x >= 14.3 && x <= 16.7) || (z >= 15.3 && z <= 16.7 && x > 5) || (z >= 21.8 && z <= 23.3 && x > 8 && x < 23)) return 'path';
  if ((x >= 5 && x <= 12.9 && z >= 6 && z <= 14) || (x >= 18 && x <= 22.5 && z >= 5 && z <= 13)) return 'tall-grass';
  return 'grass';
}

const random = seededRandom();
export const TREES = [];
for (let z = 1; z < 28; z += 2.4) {
  for (let x = 1; x < 32; x += 2.35) {
    const position = { x: x + random() * .65, z: z + random() * .65, scale: .83 + random() * .43 };
    const boundary = x < 4 || x > 29 || z < 4 || z > 25;
    const interior = x < 13 && z > 14 && z < 18 || x > 18 && x < 23 && z < 5;
    if ((boundary || interior) && !['path', 'bridge', 'water', 'building'].includes(terrainAt(position.x, position.z))) TREES.push(position);
  }
}
export function canWalk(x, z) {
  const radius = .22;
  for (const [dx, dz] of [[-radius, -radius], [radius, -radius], [-radius, radius], [radius, radius]]) {
    if (['edge', 'building', 'water'].includes(terrainAt(x + dx, z + dz))) return false;
  }
  return !FENCES.some(([left, right, fenceZ]) => x > left - radius && x < right + radius && Math.abs(z - fenceZ) < radius + .08)
    && !TREES.some(tree => Math.hypot(x - tree.x, z - tree.z) < .45 * tree.scale)
    && !NPCS.some(npc => Math.hypot(x - npc.x, z - npc.z) < (npc.kind === 'sign' ? .35 : .4));
}
export function movePosition(position, dx, dz) {
  let { x, z } = position;
  if (canWalk(x + dx, z)) x += dx;
  if (canWalk(x, z + dz)) z += dz;
  return { x, z };
}
export function nearestInteraction(position) {
  return NPCS.map(npc => ({ ...npc, distance: Math.hypot(position.x - npc.x, position.z - npc.z) }))
    .filter(npc => npc.distance < 1.85).sort((a, b) => a.distance - b.distance)[0] || null;
}
export function locationAt(position) {
  return position.z < 17 ? { title: 'Bosque de Aurora', subtitle: 'ROTA 01 · POKÉMON SELVAGENS' } : { title: 'Vila Primavera', subtitle: 'UM LUGAR PARA COMEÇAR' };
}
export function restoreWorld(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    const position = data.position;
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z) || !canWalk(position.x, position.z)) return null;
    return { version: 1, position: { x: position.x, z: position.z }, badge: data.badge === true, steps: Number.isSafeInteger(data.steps) && data.steps >= 0 ? data.steps : 0 };
  } catch { return null; }
}
