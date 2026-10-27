import test from 'node:test';
import assert from 'node:assert/strict';
import { SHEET_DIRECTIONS, frameRect, walkingFrame, movementDirection, backgroundMask } from '../js/sprite-sheet.js';

test('folha 1024 × 1024 separa exatamente os 16 quadros sem sobreposição', () => {
  const positions = new Set();
  for (const [row, direction] of SHEET_DIRECTIONS.entries()) {
    for (let column = 0; column < 4; column++) {
      const frame = frameRect(1024, 1024, direction, column);
      assert.deepEqual(frame, { x: column * 256, y: row * 256, width: 256, height: 256 });
      positions.add(`${frame.x}:${frame.y}`);
    }
  }
  assert.equal(positions.size, 16);
});
test('folhas inválidas e quadros fora da grade são rejeitados', () => {
  for (const size of [[0, 0], [1024, 768], [1023, 1023], [8192, 8192]]) assert.throws(() => frameRect(...size, 'down'));
  assert.throws(() => frameRect(1024, 1024, 'diagonal'));
  assert.throws(() => frameRect(1024, 1024, 'left', 4));
  assert.throws(() => frameRect(1024, 1024, 'left', -1));
});
test('caminhada usa quatro quadros, fecha o ciclo e respeita movimento reduzido', () => {
  assert.deepEqual([0, .125, .25, .375, .5].map(time => walkingFrame(time, true)), [0, 1, 2, 3, 0]);
  assert.equal(walkingFrame(.375, false), 0);
  assert.equal(walkingFrame(.375, true, true), 0);
});
test('o parceiro muda de direção pelo próprio deslocamento e conserva a última ao parar', () => {
  assert.equal(movementDirection(1, 0), 'right');
  assert.equal(movementDirection(-1, 0), 'left');
  assert.equal(movementDirection(0, -1), 'up');
  assert.equal(movementDirection(0, 1), 'down');
  assert.equal(movementDirection(0, 0, 'left'), 'left');
});

test('ocultar fundo preserva contornos, cores e reflexos claros fechados dentro do sprite', () => {
  const size = 9;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  const set = (x, y, rgba) => pixels.set(rgba, (y * size + x) * 4);
  for (let i = 2; i <= 6; i++) {
    set(i, 2, [30, 30, 30, 255]); set(i, 6, [30, 30, 30, 255]);
    set(2, i, [30, 30, 30, 255]); set(6, i, [30, 30, 30, 255]);
  }
  set(0, 4, [240, 160, 40, 255]);
  set(1, 1, [190, 195, 197, 255]);
  const before = new Uint8ClampedArray(pixels);
  const mask = backgroundMask(pixels, size, size);
  assert.equal(mask[0], 1); assert.equal(mask[1 * size + 1], 1);
  assert.equal(mask[2 * size + 2], 0); assert.equal(mask[4 * size + 4], 0);
  assert.equal(mask[4 * size], 0);
  assert.deepEqual(pixels, before, 'o arquivo original não é alterado');
});
test('máscara atravessa regiões já transparentes e valida o tamanho dos pixels', () => {
  const pixels = new Uint8ClampedArray(4 * 4 * 4);
  assert.equal(backgroundMask(pixels, 4, 4).reduce((sum, item) => sum + item, 0), 16);
  assert.throws(() => backgroundMask(pixels, 5, 5));
});
