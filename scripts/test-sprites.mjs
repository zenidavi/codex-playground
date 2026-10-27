import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createGame, startEncounter } from '../js/engine.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const results = fileURLToPath(new URL('../test-results/', import.meta.url));
await mkdir(results, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
let browser, page, count = 0;
const errors = [];
const check = async (name, fn) => { await fn(); console.log(`✓ ${++count}. ${name}`); };
const ready = page => page.locator('#game-viewport[data-ready="true"]').waitFor({ timeout: 60000 });
const monitor = page => {
  page.setDefaultTimeout(60000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
};
const settled = page => page.waitForFunction(() => document.getElementById('sprite-feedback').textContent.startsWith('Prévia pronta.'));
const canvasAlpha = page => page.evaluate(() => document.getElementById('sprite-preview').getContext('2d').getImageData(0, 0, 1, 1).data[3]);
const gameState = page => page.evaluate(() => localStorage.getItem('poketrilha.save.v1'));

try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('O servidor não iniciou.')), 10000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Servidor encerrou: ${code}`)); });
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
  });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport: { width: 1100, height: 950 }, reducedMotion: 'reduce' });
  page = await context.newPage(); monitor(page);
  await page.goto(url); await ready(page);
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < 256; y += 8) for (let x = 0; x < 256; x += 8) { ctx.fillStyle = ((x + y) / 8) % 2 ? '#ccc' : '#eee'; ctx.fillRect(x, y, 8, 8); }
    for (let row = 0; row < 4; row++) for (let column = 0; column < 4; column++) {
      ctx.fillStyle = '#202020'; ctx.fillRect(column * 64 + 16, row * 64 + 12, 32, 44);
      ctx.fillStyle = `rgb(180,${70 + row * 35},${40 + column * 30})`; ctx.fillRect(column * 64 + 18, row * 64 + 14, 28, 40);
      ctx.fillStyle = '#fff'; ctx.fillRect(column * 64 + 24, row * 64 + 20, 3, 3);
    }
    return canvas.toDataURL().split(',')[1];
  });
  const file = { name: 'charmander-test.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };

  await check('editor abre no título e rejeita arquivos inválidos sem aplicar nada', async () => {
    await page.locator('#sprite-button').click();
    assert.equal(await page.locator('#sprite-apply').isDisabled(), true);
    await page.locator('#sprite-file').setInputFiles({ name: 'invalido.txt', mimeType: 'text/plain', buffer: Buffer.from('not a PNG') });
    await page.waitForFunction(() => document.getElementById('sprite-feedback').classList.contains('error'));
    assert.equal(await page.locator('#sprite-apply').isDisabled(), true);
    await page.locator('#sprite-file').setInputFiles({ name: 'grande.png', mimeType: 'image/png', buffer: Buffer.alloc(8 * 1024 * 1024 + 1) });
    await page.waitForFunction(() => document.getElementById('sprite-feedback').textContent.includes('8 MB'));
    assert.equal(await page.locator('#graphics-error').isVisible(), false);
  });
  await check('PNG de 16 quadros mostra as quatro direções e oculta o quadriculado', async () => {
    const choosing = page.waitForEvent('filechooser');
    await page.locator('.sprite-file-label').click();
    await (await choosing).setFiles(file); await settled(page);
    await page.waitForFunction(() => document.getElementById('sprite-preview').getContext('2d').getImageData(0, 0, 1, 1).data[3] === 0);
    for (const [row, direction] of ['down', 'left', 'right', 'up'].entries()) {
      await page.locator(`[data-preview-direction="${direction}"]`).click();
      await page.waitForFunction(expected => document.getElementById('sprite-preview').getContext('2d').getImageData(128, 128, 1, 1).data[1] === expected, 70 + row * 35);
    }
    await page.locator('#sprite-hide-background').uncheck(); await settled(page);
    await page.waitForFunction(() => document.getElementById('sprite-preview').getContext('2d').getImageData(0, 0, 1, 1).data[3] === 255);
    assert.equal(await canvasAlpha(page), 255);
    await page.locator('#sprite-hide-background').check(); await settled(page);
    await page.waitForFunction(() => document.getElementById('sprite-preview').getContext('2d').getImageData(0, 0, 1, 1).data[3] === 0);
    await page.screenshot({ path: `${results}/sprite-studio-desktop.png`, fullPage: true });
  });
  await check('aplicar salva o arquivo original localmente e atualiza a seleção do Charmander', async () => {
    await page.locator('#sprite-apply').click();
    await page.waitForFunction(() => document.getElementById('sprite-feedback').textContent.startsWith('Aplicado'));
    const record = await page.evaluate(async () => { const { readSprite } = await import('./js/sprite-storage.js'); const record = await readSprite(); return { size: record.blob.size, name: record.filename, hide: record.hideBackground, version: record.version }; });
    assert.equal(record.size, file.buffer.length); assert.equal(record.name, file.name); assert.equal(record.hide, true); assert.equal(record.version, 1);
    assert.equal(await gameState(page), null, 'não cria nem substitui uma aventura');
    await page.locator('#sprite-dialog [data-close]').click();
    await page.locator('#new-game-button').click(); await page.locator('[data-starter="charmander"]').click(); await page.locator('#start-button').click();
    while (await page.locator('#dialogue-box').isVisible()) await page.locator('#dialogue-next').click();
    const pixel = await page.evaluate(async () => { const image = document.getElementById('companion-image'); await image.decode(); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64; const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0, 64, 64); return [...ctx.getImageData(32, 32, 1, 1).data]; });
    assert.deepEqual(pixel, [180, 70, 40, 255]);
    await page.keyboard.down('w');
    try { await page.waitForFunction(() => JSON.parse(localStorage.getItem('poketrilha.world.v1')).steps > 0); }
    finally { await page.keyboard.up('w'); }
    assert.equal(JSON.parse(await gameState(page)).player.species, 'charmander');
  });
  await check('recarregar restaura a arte e o combate continua funcionando com ela', async () => {
    const state = startEncounter(createGame('charmander'), () => .1);
    await page.addInitScript(state => {
      if (sessionStorage.getItem('sprite-test-battle')) return;
      sessionStorage.setItem('sprite-test-battle', 'true'); localStorage.setItem('poketrilha.save.v1', JSON.stringify(state));
    }, state);
    await page.reload(); await ready(page); await page.locator('#continue-button').click();
    await page.locator('#sprite-button').click();
    await page.waitForFunction(() => document.getElementById('sprite-file-info').textContent.includes('imagem salva'));
    const before = await gameState(page);
    await page.locator('#sprite-apply').click(); await page.waitForFunction(() => document.getElementById('sprite-feedback').textContent.startsWith('Aplicado'));
    assert.equal(await gameState(page), before);
    await page.locator('#sprite-dialog [data-close]').click();
    await page.locator('[data-move="tackle"]').click();
    await page.waitForFunction(() => !document.getElementById('turn-label').textContent.includes('EM ANDAMENTO'));
    assert.equal(JSON.parse(await gameState(page)).turn, 1);
  });
  await check('voltar ao original apaga a personalização e preserva o progresso', async () => {
    const before = await gameState(page);
    await page.locator('#sprite-button').click(); await page.locator('#sprite-remove').click();
    await page.waitForFunction(() => document.getElementById('sprite-feedback').textContent.includes('foi restaurado'));
    assert.equal(await gameState(page), before);
    assert.equal(await page.locator('#sprite-remove').isDisabled(), true);
    const removed = await page.evaluate(async () => (await import('./js/sprite-storage.js')).readSprite());
    assert.equal(removed, undefined);
  });
  await check('celular carrega a imagem e mantém os controles dentro da janela', async () => {
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const mobile = await mobileContext.newPage(); monitor(mobile);
    await mobile.goto(url); await ready(mobile); await mobile.locator('#sprite-button').tap();
    await mobile.locator('#sprite-file').setInputFiles(file); await settled(mobile);
    for (const width of [320, 375]) {
      await mobile.setViewportSize({ width, height: 812 });
      assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.ok(await mobile.evaluate(() => { const dialog = document.getElementById('sprite-dialog'); return dialog.scrollWidth <= dialog.clientWidth; }));
    }
    await mobile.screenshot({ path: `${results}/sprite-studio-mobile.png`, fullPage: true });
    await mobile.locator('#sprite-apply').tap();
    await mobile.waitForFunction(() => document.getElementById('sprite-feedback').textContent.startsWith('Aplicado'));
    await mobileContext.close();
  });
  await check('sem IndexedDB, a arte funciona na sessão com aviso de persistência', async () => {
    const privateContext = await browser.newContext({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
    await privateContext.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('Bloqueado', 'SecurityError'); } }));
    const privatePage = await privateContext.newPage(); monitor(privatePage);
    await privatePage.goto(url); await ready(privatePage); await privatePage.locator('#sprite-button').click();
    await privatePage.locator('#sprite-file').setInputFiles(file); await settled(privatePage); await privatePage.locator('#sprite-apply').click();
    await privatePage.waitForFunction(() => document.getElementById('sprite-feedback').textContent.includes('nesta sessão'));
    assert.equal(await privatePage.locator('#sprite-remove').isDisabled(), false);
    await privateContext.close();
  });
  assert.deepEqual(errors, []);
  console.log(`\n${count} cenários de sprites passaram, sem erros JavaScript.`);
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  try { await browser?.close(); } finally { server.kill('SIGTERM'); }
}
