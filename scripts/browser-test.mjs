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
let browser;
let count = 0;
const errors = [];
const storageKey = 'poketrilha.save.v1';
const check = async (name, fn) => { await fn(); count++; console.log(`✓ ${name}`); };
const getState = page => page.evaluate(key => JSON.parse(localStorage.getItem(key)), storageKey);
const settle = page => page.waitForFunction(() => !document.getElementById('reset-button').disabled);
const turn = async (page, selector) => { await page.locator(selector).click(); await settle(page); };
const phase = async page => (await getState(page)).phase;
const fight = async page => {
  let turns = 0;
  while (await phase(page) === 'battle' && turns++ < 20) {
    const state = await getState(page);
    await turn(page, state.player.hp < state.player.maxHp / 2 && state.potions ? '#potion-button' : '[data-move="element"]');
  }
  assert.equal(await phase(page), 'victory');
};

try {
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('O servidor não iniciou em 10 segundos.')), 10000);
    const fail = error => { clearTimeout(timer); reject(error); };
    let output = '';
    server.once('error', fail);
    server.once('exit', code => fail(new Error(`O servidor encerrou: ${code}.`)));
    server.stderr.on('data', data => { output += data; });
    server.stdout.on('data', data => {
      output += data;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  const executablePath = process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => { Math.random = () => .6; });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()}: ${response.url()}`); });
  await page.goto(url);

  await check('a página e todos os SVGs carregam sem erros', async () => {
    await page.locator('[data-starter="bulbasaur"]').waitFor();
    assert.equal(await page.title(), 'Pokétrilha — Sua próxima aventura');
    assert.equal(await page.locator('#start-button').isDisabled(), true);
    await page.waitForFunction(() => [...document.images].filter(image => image.getClientRects().length).every(image => image.complete && image.naturalWidth > 0));
    assert.equal((await fetch(`${url}/.git/config`)).status, 404);
    assert.equal((await fetch(`${url}/js/engine.js`)).headers.get('content-type'), 'text/javascript; charset=utf-8');
  });
  await check('seleção dos três iniciais, estado visual e ajuda por teclado', async () => {
    for (const id of ['squirtle', 'charmander', 'bulbasaur']) {
      await page.locator(`[data-starter="${id}"]`).click();
      assert.equal(await page.locator(`[data-starter="${id}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[aria-pressed="true"]').count(), 1);
    }
    await page.screenshot({ path: `${results}/selection-desktop.png`, fullPage: true });
    await page.locator('#help-button').click();
    assert.equal(await page.locator('#help-dialog').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#help-dialog').isVisible(), false);
    await page.locator('[data-starter="bulbasaur"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('#start-button').click();
    assert.equal((await getState(page)).player.species, 'bulbasaur');
  });
  await check('recomeço pede confirmação, pode ser cancelado e retorna à seleção', async () => {
    await page.locator('#reset-button').click();
    await page.locator('#reset-dialog [data-close]').click();
    assert.equal(await page.locator('#adventure-screen').isVisible(), true);
    await page.locator('#reset-button').click();
    await page.locator('#confirm-reset').click();
    assert.equal(await page.locator('#selection-screen').isVisible(), true);
    assert.equal(await getState(page), null);
    await page.locator('[data-starter="charmander"]').click();
    await page.locator('#start-button').click();
    assert.equal(await page.locator('#potion-button').isVisible(), false);
    await page.locator('#explore-button').click();
    assert.equal(await phase(page), 'battle');
    assert.equal((await getState(page)).enemy.species, 'oddish');
    assert.equal(await page.locator('#potion-button').isDisabled(), true);
  });
  await check('cliques rápidos executam apenas um turno, com HP e diário atualizados', async () => {
    const before = await getState(page);
    await page.evaluate(() => {
      const button = document.querySelector('[data-move="tackle"]');
      button.click(); button.click(); button.click();
    });
    await settle(page);
    const after = await getState(page);
    assert.equal(after.turn, 1);
    assert.ok(after.player.hp < before.player.hp);
    assert.ok(after.enemy.hp < before.enemy.hp);
    assert.match(await page.locator('#battle-log').innerText(), /usou Investida/);
    assert.equal(Number(await page.locator('#player-hp').getAttribute('aria-valuenow')), after.player.hp);
    assert.equal(Number(await page.locator('#enemy-hp').getAttribute('aria-valuenow')), after.enemy.hp);
    await page.screenshot({ path: `${results}/battle-desktop.png`, fullPage: true });
  });
  await check('poção consome item e turno; recarregar restaura a batalha exata', async () => {
    const before = await getState(page);
    await turn(page, '#potion-button');
    const after = await getState(page);
    assert.equal(after.potions, before.potions - 1);
    assert.equal(after.turn, before.turn + 1);
    assert.match(await page.locator('#battle-log').innerText(), /A poção recuperou/);
    await page.reload();
    await page.locator('#adventure-screen').waitFor();
    assert.deepEqual(await getState(page), after);
    assert.equal(await page.locator('#enemy-name').innerText(), 'Oddish');
  });
  await check('vitórias concedem experiência e níveis; descanso permite seguir', async () => {
    await fight(page);
    assert.equal((await getState(page)).wins, 1);
    assert.match(await page.locator('#result-title').innerText(), /vitória/);
    assert.ok((await getState(page)).player.xp > 0);
    await page.locator('#rest-button').click();
    assert.equal((await getState(page)).player.hp, (await getState(page)).player.maxHp);
    await page.locator('#explore-button').click();
    await fight(page);
    assert.equal((await getState(page)).player.level, 6);
    assert.equal(await page.locator('#companion-level').innerText(), 'Nv. 6');
    assert.equal(await page.locator('#level-gain').innerText(), '1');
  });
  await check('fuga encerra o encontro sem dano ou experiência', async () => {
    await page.locator('#explore-button').click();
    const before = await getState(page);
    await turn(page, '#flee-button');
    const after = await getState(page);
    assert.equal(after.phase, 'escaped');
    assert.equal(after.player.hp, before.player.hp);
    assert.equal(after.player.xp, before.player.xp);
    assert.equal(await page.locator('#enemy-sprite').isVisible(), false);
  });
  await check('derrota e descanso não deixam o jogo bloqueado', async () => {
    const fixture = startEncounter(createGame('squirtle'), () => .6);
    fixture.player.hp = 1;
    await page.evaluate(({ key, state }) => localStorage.setItem(key, JSON.stringify(state)), { key: storageKey, state: fixture });
    await page.reload();
    await turn(page, '[data-move="tackle"]');
    assert.equal(await phase(page), 'defeat');
    assert.equal(await page.locator('#explore-button').isVisible(), false);
    assert.equal((await getState(page)).player.hp, 0);
    await page.locator('#rest-button').click();
    assert.equal(await phase(page), 'ready');
    assert.equal((await getState(page)).player.hp, (await getState(page)).player.maxHp);
    assert.equal((await getState(page)).potions, 3);
    await page.locator('#explore-button').click();
    assert.equal(await phase(page), 'battle');
  });
  await check('save inválido é tratado; nenhum erro JavaScript ou recurso ausente', async () => {
    await page.evaluate(key => localStorage.setItem(key, '{broken'), storageKey);
    await page.reload();
    assert.equal(await page.locator('#selection-screen').isVisible(), true);
    assert.match(await page.locator('#toast').innerText(), /não pôde ser lido/);
    assert.deepEqual(errors, []);
  });
  await check('layout de celular e ações por toque, sem rolagem horizontal', async () => {
    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const mobilePage = await mobile.newPage();
    mobilePage.on('pageerror', error => errors.push(error.message));
    await mobilePage.goto(url);
    await mobilePage.locator('[data-starter="squirtle"]').tap();
    await mobilePage.screenshot({ path: `${results}/selection-mobile.png`, fullPage: true });
    for (const width of [320, 375, 768]) {
      await mobilePage.setViewportSize({ width, height: 812 });
      assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `seleção em ${width}px`);
    }
    await mobilePage.setViewportSize({ width: 375, height: 812 });
    await mobilePage.locator('#start-button').tap();
    await mobilePage.locator('#explore-button').tap();
    assert.equal((await getState(mobilePage)).player.species, 'squirtle');
    assert.equal(await phase(mobilePage), 'battle');
    await mobilePage.screenshot({ path: `${results}/battle-mobile.png`, fullPage: true });
    for (const width of [320, 375, 768]) {
      await mobilePage.setViewportSize({ width, height: 812 });
      assert.ok(await mobilePage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `batalha em ${width}px`);
    }
    await turn(mobilePage, '[data-move="tackle"]');
    assert.equal((await getState(mobilePage)).turn, 1);
    await mobile.close();
  });
  await check('animações normais terminam e liberam o próximo turno', async () => {
    const animated = await browser.newContext({ reducedMotion: 'no-preference' });
    const animatedPage = await animated.newPage();
    animatedPage.on('pageerror', error => errors.push(error.message));
    await animatedPage.goto(url);
    await animatedPage.locator('[data-starter="bulbasaur"]').click();
    await animatedPage.locator('#start-button').click();
    await animatedPage.locator('#explore-button').click();
    await animatedPage.locator('[data-move="tackle"]').click();
    assert.equal(await animatedPage.locator('#reset-button').isDisabled(), true);
    await settle(animatedPage);
    assert.equal((await getState(animatedPage)).turn, 1);
    assert.equal(await animatedPage.locator('.attacking, .hit').count(), 0);
    await animated.close();
  });
  await check('armazenamento bloqueado avisa e permite continuar jogando', async () => {
    const privateContext = await browser.newContext({ reducedMotion: 'reduce' });
    await privateContext.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Armazenamento bloqueado', 'SecurityError'); } });
    });
    const privatePage = await privateContext.newPage();
    privatePage.on('pageerror', error => errors.push(error.message));
    await privatePage.goto(url);
    assert.match(await privatePage.locator('#toast').innerText(), /bloqueou o salvamento/);
    await privatePage.locator('[data-starter="squirtle"]').click();
    await privatePage.locator('#start-button').click();
    await privatePage.locator('#explore-button').click();
    await turn(privatePage, '[data-move="tackle"]');
    assert.match(await privatePage.locator('#turn-label').innerText(), /TURNO 2/);
    await privateContext.close();
  });
  assert.deepEqual(errors, []);
  console.log(`\n${count} cenários de navegador passaram. Capturas em test-results/.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  try { await browser?.close(); } finally { server.kill('SIGTERM'); }
}
