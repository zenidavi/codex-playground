import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createGame, startEncounter } from '../js/engine.js';
import { START_POSITION } from '../js/world-model.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const results = fileURLToPath(new URL('../test-results/', import.meta.url));
await mkdir(results, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT: '0', HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
const saveKey = 'poketrilha.save.v1', worldKey = 'poketrilha.world.v1';
let browser, count = 0, fixtureIndex = 0;
const errors = [];
const check = async (name, fn) => { await fn(); console.log(`✓ ${++count}. ${name}`); };
const getState = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
const getWorld = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), worldKey);
const ready = page => page.locator('#game-viewport[data-ready="true"]').waitFor({ timeout: 60000 });
const settle = page => page.waitForFunction(() => !document.getElementById('turn-label').textContent.includes('EM ANDAMENTO'));
const turn = async (page, selector) => { await page.locator(selector).click(); await settle(page); };
const dismissDialogue = async page => {
  while (await page.locator('#dialogue-box').isVisible()) await page.locator('#dialogue-next').click();
};
const monitor = page => {
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });
};
async function restoreFixture(page, game, position = START_POSITION, badge = false) {
  // Apply after navigation: pagehide legitimately saves the current game first.
  await page.addInitScript(({ saveKey, worldKey, game, position, badge, token }) => {
    if (sessionStorage.getItem(token)) return;
    sessionStorage.setItem(token, 'applied');
    localStorage.setItem(saveKey, JSON.stringify(game));
    localStorage.setItem(worldKey, JSON.stringify({ version: 1, position, badge, steps: 0 }));
  }, { saveKey, worldKey, game, position, badge, token: `poketrilha.test.fixture.${++fixtureIndex}` });
  await page.reload(); await ready(page); await page.locator('#continue-button').click();
}

try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('O servidor não iniciou.')), 10000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Servidor encerrado: ${code}`)); });
    server.stdout.on('data', data => { const match = String(data).match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
    server.stderr.on('data', data => process.stderr.write(data));
  });
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined), args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader'], headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => { Math.random = () => .1; });
  const page = await context.newPage(); page.setDefaultTimeout(60000); monitor(page);
  await page.goto(url); await ready(page);

  await check('cenário WebGL 2 renderiza, recursos são locais e arquivos privados não são servidos', async () => {
    assert.match(await page.title(), /Ecos do Bosque/);
    assert.equal(await page.locator('#graphics-error').isVisible(), false);
    assert.match(await page.evaluate(() => { const gl = document.getElementById('world-canvas').getContext('webgl2'); return gl.getParameter(gl.VERSION); }), /WebGL 2/);
    assert.equal((await fetch(`${url}/.git/config`)).status, 404);
    await page.screenshot({ path: `${results}/hd-title.png`, fullPage: true });
  });
  await check('três iniciais, seleção por teclado e introdução jogável', async () => {
    await page.locator('#new-game-button').click();
    assert.equal(await page.locator('#start-button').isDisabled(), true);
    for (const id of ['bulbasaur', 'squirtle', 'charmander']) {
      await page.locator(`[data-starter="${id}"]`).focus(); await page.keyboard.press('Enter');
      assert.equal(await page.locator(`[data-starter="${id}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[aria-pressed="true"]').count(), 1);
    }
    await page.screenshot({ path: `${results}/hd-starters.png`, fullPage: true });
    await page.locator('#start-button').click();
    assert.equal((await getState(page)).player.species, 'charmander');
    assert.equal(await page.locator('#dialogue-box').isVisible(), true);
    await dismissDialogue(page);
    assert.equal(await page.locator('#world-hud').isVisible(), true);
    await page.screenshot({ path: `${results}/hd-world.png`, fullPage: true });
  });
  await check('movimento real por teclado e conversa por proximidade', async () => {
    const before = await getWorld(page);
    await page.keyboard.down('a');
    try { await page.waitForFunction(key => JSON.parse(localStorage.getItem(key)).position.x < 12.4, worldKey); }
    finally { await page.keyboard.up('a'); }
    assert.ok((await getWorld(page)).position.x < before.position.x - 2);
    await page.locator('#interact-button').waitFor(); await page.keyboard.press('e');
    assert.match(await page.locator('#dialogue-name').innerText(), /Lia/);
    await dismissDialogue(page);
    await page.reload(); await ready(page); await page.locator('#continue-button').click();
    assert.ok((await getWorld(page)).position.x < 12.4);
  });
  await check('mapa, mochila e ajuda pausam o movimento e fecham com Escape', async () => {
    for (const [key, id] of [['m', 'map-dialog'], ['b', 'bag-dialog']]) {
      await page.keyboard.press(key); assert.equal(await page.locator(`#${id}`).isVisible(), true);
      const before = await getWorld(page);
      await page.keyboard.down('w'); await page.waitForTimeout(250); await page.keyboard.up('w');
      assert.deepEqual((await getWorld(page)).position, before.position);
      await page.keyboard.press('Escape'); assert.equal(await page.locator(`#${id}`).isVisible(), false);
    }
    await page.locator('#help-button').click(); assert.equal(await page.locator('#help-dialog').isVisible(), true);
    await page.keyboard.press('Escape');
  });
  await check('andar na grama alta dispara um encontro, sem botão de batalha', async () => {
    await restoreFixture(page, createGame('charmander'), { x: 15.5, z: 10.5 });
    await page.keyboard.down('a');
    try { await page.locator('#battle-hud').waitFor(); }
    finally { await page.keyboard.up('a'); }
    assert.equal((await getState(page)).phase, 'battle');
    assert.equal((await getState(page)).encounters, 1);
    assert.equal((await getState(page)).enemy.species, 'caterpie');
    assert.equal(await page.locator('#potion-button').isDisabled(), true);
    await page.screenshot({ path: `${results}/hd-battle.png`, fullPage: true });
  });
  await check('cliques repetidos executam apenas um turno e barras refletem o HP', async () => {
    await page.evaluate(() => { const button = document.querySelector('[data-move="tackle"]'); button.click(); button.click(); button.click(); });
    await settle(page);
    const after = await getState(page); assert.equal(after.turn, 1);
    assert.ok(after.player.hp < after.player.maxHp); assert.ok(after.enemy.hp < after.enemy.maxHp);
    assert.equal(Number(await page.locator('#player-hp').getAttribute('aria-valuenow')), after.player.hp);
    assert.equal(Number(await page.locator('#enemy-hp').getAttribute('aria-valuenow')), after.enemy.hp);
    await page.locator('#journal-button').click(); assert.match(await page.locator('#battle-log').innerText(), /usou Investida/);
    await page.keyboard.press('Escape');
  });
  await check('poção, falha de captura e restauração de um turno completo', async () => {
    let before = await getState(page); await turn(page, '#potion-button');
    assert.equal((await getState(page)).potions, before.potions - 1);
    await page.evaluate(() => { Math.random = () => .99; });
    before = await getState(page); await turn(page, '#capture-button');
    const after = await getState(page);
    assert.equal(after.phase, 'battle'); assert.equal(after.balls, before.balls - 1); assert.ok(after.player.hp < before.player.hp);
    await page.reload(); await ready(page); await page.locator('#continue-button').click();
    assert.deepEqual(await getState(page), after);
    assert.equal(await page.locator('#battle-hud').isVisible(), true);
  });
  await check('captura registra a coleção, concede XP e retorna ao mapa', async () => {
    await turn(page, '#capture-button');
    const after = await getState(page); assert.equal(after.phase, 'captured'); assert.deepEqual(after.caught, ['caterpie']);
    assert.ok(after.player.xp > 0); assert.match(await page.locator('#action-title').innerText(), /amizade/);
    await page.locator('#return-button').click(); await page.locator('#bag-button').click();
    assert.equal(await page.locator('.collection-card:not(.unknown)').count(), 2);
    assert.match(await page.locator('#collection-list').innerText(), /Caterpie/);
    await page.keyboard.press('Escape');
  });
  await check('vitórias elevam o nível; missão entrega e salva a Insígnia do Bosque', async () => {
    let state = await getState(page);
    for (let i = 0; i < 3; i++) {
      state.phase = 'ready'; state.enemy = null;
      state = startEncounter(state, () => .1); state.enemy.hp = 1;
      await restoreFixture(page, state);
      await turn(page, '[data-move="tackle"]'); state = await getState(page);
      assert.equal(state.phase, 'victory');
    }
    assert.equal(state.wins, 3); assert.ok(state.player.level > 5);
    await restoreFixture(page, state, { x: 11, z: 23.5 });
    await page.locator('#interact-button').waitFor(); await page.keyboard.press('e'); await dismissDialogue(page);
    assert.equal((await getWorld(page)).badge, true);
    await page.locator('#bag-button').click(); assert.equal(await page.locator('#bag-badge').innerText(), '✦');
    await page.keyboard.press('Escape');
  });
  await check('Centro Pokémon recupera HP e repõe itens; derrota também permite continuar', async () => {
    let state = createGame('squirtle'); state.player.hp = 2; state.potions = 0; state.balls = 0;
    await restoreFixture(page, state, { x: 20.3, z: 23.5 });
    await page.locator('#interact-button').waitFor(); await page.locator('#interact-button').click(); await dismissDialogue(page);
    state = await getState(page); assert.equal(state.player.hp, state.player.maxHp); assert.equal(state.potions, 3); assert.equal(state.balls, 5);
    state = startEncounter(state, () => .6); state.player.hp = 1;
    await restoreFixture(page, state); await turn(page, '[data-move="tackle"]');
    assert.equal((await getState(page)).phase, 'defeat');
    await page.locator('#return-button').click();
    state = await getState(page); assert.equal(state.phase, 'ready'); assert.equal(state.player.hp, state.player.maxHp);
    assert.equal(await page.locator('#world-hud').isVisible(), true);
  });
  await check('fuga preserva HP e XP; recomeço pode ser cancelado e exige confirmação', async () => {
    const before = startEncounter(createGame('bulbasaur'), () => .5);
    await restoreFixture(page, before); await turn(page, '#flee-button');
    const after = await getState(page); assert.equal(after.phase, 'escaped'); assert.equal(after.player.hp, before.player.hp); assert.equal(after.player.xp, before.player.xp);
    await page.locator('#return-button').click(); await page.locator('#bag-button').click(); await page.locator('#reset-button').click();
    await page.locator('#reset-dialog [data-close]').click(); assert.notEqual(await getState(page), null);
    await page.locator('#bag-button').click(); await page.locator('#reset-button').click(); await page.locator('#confirm-reset').click();
    assert.equal(await getState(page), null); assert.equal(await page.locator('#title-screen').isVisible(), true);
  });
  await check('GitHub Pages: módulos, estilos e assets funcionam em uma subpasta', async () => {
    await page.route('**/codex-playground/**', async route => {
      const requestUrl = new URL(route.request().url());
      requestUrl.pathname = requestUrl.pathname.replace('/codex-playground', '') || '/';
      const response = await route.fetch({ url: requestUrl.toString() }); await route.fulfill({ response });
    });
    await page.goto(`${url}/codex-playground/`); await ready(page);
    assert.equal(await page.locator('#graphics-error').isVisible(), false); assert.equal(await page.locator('#title-screen').isVisible(), true);
    await page.unrouteAll();
  });
  await check('celular: renderização, seleção, controles por toque e layout sem transbordar', async () => {
    const mobileContext = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const mobile = await mobileContext.newPage(); mobile.setDefaultTimeout(60000); monitor(mobile);
    await mobile.goto(url); await ready(mobile);
    await mobile.screenshot({ path: `${results}/hd-mobile-title.png`, fullPage: true });
    await mobile.locator('#new-game-button').tap(); await mobile.locator('[data-starter="squirtle"]').tap();
    await mobile.locator('#start-button').tap(); await dismissDialogue(mobile);
    const button = await mobile.locator('[data-direction="up"]').boundingBox();
    const touch = await mobileContext.newCDPSession(mobile);
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: button.x + button.width / 2, y: button.y + button.height / 2 }] });
    try { await mobile.waitForFunction(key => JSON.parse(localStorage.getItem(key)).position.z < 22.5, worldKey); }
    finally { await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    await mobile.screenshot({ path: `${results}/hd-mobile-world.png`, fullPage: true });
    for (const width of [320, 375, 768]) {
      await mobile.setViewportSize({ width, height: 812 });
      assert.ok(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `largura ${width}`);
    }
    const fixture = startEncounter(createGame('squirtle'), () => .2);
    await restoreFixture(mobile, fixture); await turn(mobile, '[data-move="tackle"]');
    assert.equal((await getState(mobile)).turn, 1);
    await mobile.setViewportSize({ width: 375, height: 812 });
    await mobile.screenshot({ path: `${results}/hd-mobile-battle.png`, fullPage: true });
    await mobileContext.close();
  });
  await check('animações normais terminam e liberam o próximo turno', async () => {
    const animatedContext = await browser.newContext({ reducedMotion: 'no-preference', viewport: { width: 1100, height: 900 } });
    const animated = await animatedContext.newPage(); animated.setDefaultTimeout(60000); monitor(animated);
    await animated.goto(url); await ready(animated);
    await restoreFixture(animated, startEncounter(createGame('charmander'), () => .5));
    await animated.locator('[data-move="tackle"]').click(); assert.match(await animated.locator('#turn-label').innerText(), /EM ANDAMENTO/);
    await settle(animated); assert.equal((await getState(animated)).turn, 1);
    assert.equal(await animated.locator('[data-move="tackle"]').isDisabled(), false);
    await animatedContext.close();
  });
  await check('save corrompido e armazenamento bloqueado têm recuperação', async () => {
    await page.goto(url); await ready(page);
    await page.addInitScript(key => localStorage.setItem(key, '{invalid'), saveKey); await page.reload(); await ready(page);
    assert.equal(await page.locator('#continue-button').isVisible(), false);
    const privateContext = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1000, height: 800 } });
    await privateContext.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Bloqueado', 'SecurityError'); } }); });
    const privatePage = await privateContext.newPage(); privatePage.setDefaultTimeout(60000); monitor(privatePage);
    await privatePage.goto(url); await ready(privatePage);
    assert.match(await privatePage.locator('#save-status').innerText(), /sessão/);
    await privatePage.locator('#new-game-button').click(); await privatePage.locator('[data-starter="bulbasaur"]').click(); await privatePage.locator('#start-button').click();
    await dismissDialogue(privatePage); await privatePage.locator('#bag-button').click(); assert.equal(await privatePage.locator('#bag-balls').innerText(), '5');
    await privateContext.close();
  });
  assert.deepEqual(errors, []);
  console.log(`\n${count} cenários de navegador passaram, sem erros JavaScript ou recursos ausentes. Capturas em test-results/.`);
} catch (error) {
  console.error(error); process.exitCode = 1;
} finally {
  try { await browser?.close(); } finally { server.kill('SIGTERM'); }
}
