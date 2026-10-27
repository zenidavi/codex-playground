import test from 'node:test';
import assert from 'node:assert/strict';
import { terrainAt, canWalk, movePosition, START_POSITION, nearestInteraction, locationAt, restoreWorld, seededRandom, NPCS } from '../js/world-model.js';

test('mapa distingue trilha, grama alta, lago, ponte e edifícios', () => {
  assert.equal(terrainAt(15.5, 22.5), 'path');
  assert.equal(terrainAt(8, 10), 'tall-grass');
  assert.equal(terrainAt(26, 12), 'water');
  assert.equal(terrainAt(26, 16), 'bridge');
  assert.equal(terrainAt(11, 19), 'building');
  assert.equal(terrainAt(-1, 12), 'edge');
});
test('colisão impede atravessar lago, casas, pessoas e bordas', () => {
  assert.equal(canWalk(26, 12), false); assert.equal(canWalk(11, 19), false);
  assert.equal(canWalk(11, 22.3), false); assert.equal(canWalk(0, 22), false);
  assert.equal(canWalk(10, 24.6), false, 'cercas também bloqueiam a passagem');
  assert.equal(canWalk(26, 16), true); assert.equal(canWalk(START_POSITION.x, START_POSITION.z), true);
  const position = { x: 23.1, z: 14 };
  assert.equal(movePosition(position, .5, 0).x, position.x);
  assert.equal(position.x, 23.1, 'posição original não é alterada');
});
test('todos os NPCs e os gramados são alcançáveis a partir da vila', () => {
  const queue = [{ x: 15.5, z: 23.5 }], visited = new Set(['15.5,23.5']);
  const reached = new Set(); let grass = false, bridge = false;
  for (let i = 0; i < queue.length; i++) {
    const position = queue[i];
    const npc = nearestInteraction(position); if (npc) reached.add(npc.id);
    grass ||= terrainAt(position.x, position.z) === 'tall-grass';
    bridge ||= terrainAt(position.x, position.z) === 'bridge';
    for (const [dx, dz] of [[.5, 0], [-.5, 0], [0, .5], [0, -.5]]) {
      const x = position.x + dx, z = position.z + dz, key = `${x},${z}`;
      if (!visited.has(key) && canWalk(x, z)) { visited.add(key); queue.push({ x, z }); }
    }
  }
  assert.deepEqual([...reached].sort(), NPCS.map(npc => npc.id).sort());
  assert.equal(grass, true); assert.equal(bridge, true);
});
test('interações exigem proximidade; a região muda ao chegar ao bosque', () => {
  assert.equal(nearestInteraction(START_POSITION), null);
  assert.equal(nearestInteraction({ x: 20.3, z: 23.5 }).id, 'nurse');
  assert.equal(locationAt(START_POSITION).title, 'Vila Primavera');
  assert.equal(locationAt({ x: 15.5, z: 12 }).title, 'Bosque de Aurora');
});
test('posição, missão e passos são restaurados apenas em locais válidos', () => {
  const data = { version: 1, position: START_POSITION, badge: true, steps: 42 };
  assert.deepEqual(restoreWorld(JSON.stringify(data)), data);
  for (const position of [{ x: 26, z: 12 }, { x: 11, z: 19 }, { x: 999, z: 23 }, { x: '15', z: 23 }, null]) {
    assert.equal(restoreWorld(JSON.stringify({ ...data, position })), null);
  }
  assert.equal(restoreWorld('{bad'), null);
  const a = seededRandom(10), b = seededRandom(10);
  assert.deepEqual(Array.from({ length: 8 }, a), Array.from({ length: 8 }, b));
});
