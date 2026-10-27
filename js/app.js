import { SPECIES, STARTERS, WILD, TYPES, MAX_LEVEL, movesFor } from './data.js';
import { createGame, startEncounter, takeTurn, rest, restoreGame, xpRequired } from './engine.js';
import { WorldRenderer } from './world-renderer.js';
import { START_POSITION, nearestInteraction, terrainAt, locationAt, restoreWorld } from './world-model.js';
import { spriteURL, trainerArt } from './pixel-art.js';
import { AudioGuide } from './audio.js';
import { mountSpriteStudio } from './sprite-studio.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'poketrilha.save.v1'; // Preserve the original game's saves.
const WORLD_KEY = 'poketrilha.world.v1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pause = ms => new Promise(resolve => setTimeout(resolve, reducedMotion ? 30 : ms));
const audio = new AudioGuide();
const nameOf = pokemon => SPECIES[pokemon.species].name;
const typeBadge = type => `<span class="type-badge ${type}">${TYPES[type].name}</span>`;
const freshWorld = () => ({ version: 1, position: { ...START_POSITION }, badge: false, steps: 0 });
let game = null, world, selected = null, active = false, busy = false, mode = 'world';
let worldData = freshWorld();
let dialogue = null, interaction = null, walkedDistance = 0, encounterCooldown = 4;
let lastFrameUpdate = 0, currentLocation = '', toastTimer, regionTimer, storageWarning = false;
let openStarterAfterReset = false;
let spriteStudio = null;
const customPortraits = new Map();
const portrait = species => customPortraits.get(species) || spriteURL(species);

function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4200);
}
function storageUnavailable() {
  $('save-status').textContent = 'Progresso apenas nesta sessão';
  if (!storageWarning) toast('O navegador bloqueou o salvamento. Você ainda pode jogar nesta sessão.');
  storageWarning = true;
}
function save() {
  if (!game) return;
  if (world && active) worldData.position = { ...world.position };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(game));
    localStorage.setItem(WORLD_KEY, JSON.stringify(worldData));
    $('save-status').textContent = '● Progresso salvo neste navegador';
  } catch { storageUnavailable(); }
}
function log(message) {
  const item = document.createElement('li'); item.textContent = message;
  $('battle-log').prepend(item);
  while ($('battle-log').children.length > 30) $('battle-log').lastElementChild.remove();
}
function canMove() {
  return active && mode === 'world' && !busy && !dialogue && !document.querySelector('dialog[open]') && $('graphics-error').hidden;
}
function openModal(id) {
  world?.clearInput();
  if (id === 'bag-dialog') renderBag();
  if (id === 'map-dialog') world?.drawMap($('full-map'));
  $(id).showModal();
  if (id === 'sprite-dialog') spriteStudio?.open();
}
function setHp(target, hp, maxHp) {
  const track = $(`${target}-hp`);
  track.firstElementChild.style.width = `${Math.max(0, hp) / maxHp * 100}%`;
  track.classList.toggle('low', hp / maxHp <= .25);
  track.classList.toggle('medium', hp / maxHp > .25 && hp / maxHp <= .5);
  track.setAttribute('aria-valuenow', hp); track.setAttribute('aria-valuemax', maxHp);
  $(`${target}-hp-label`).textContent = `${hp} / ${maxHp}`;
}
function setXp(id) {
  const player = game.player;
  const max = player.level === MAX_LEVEL ? 1 : xpRequired(player.level);
  const value = player.level === MAX_LEVEL ? 1 : player.xp;
  $(id).firstElementChild.style.width = `${value / max * 100}%`;
  $(id).setAttribute('aria-valuenow', value); $(id).setAttribute('aria-valuemax', max);
}
function renderWorldHud() {
  if (!game) return;
  const player = game.player;
  $('companion-image').src = portrait(player.species); $('companion-image').alt = nameOf(player);
  $('companion-name').textContent = nameOf(player); $('companion-level').textContent = `Nv. ${player.level}`;
  setHp('world', player.hp, player.maxHp); setXp('world-xp');
  $('world-xp-label').textContent = player.level === MAX_LEVEL ? 'NÍVEL MÁX.' : `${player.xp}/${xpRequired(player.level)} XP`;
  const ready = game.wins >= 3 && game.caught.length >= 1;
  $('quest-title').textContent = worldData.badge ? 'Insígnia do Bosque' : 'O chamado do bosque';
  $('quest-description').textContent = worldData.badge ? 'Uma amizade, muitas histórias. Continue explorando!' : ready ? 'Você conseguiu! Volte à professora Lia na vila.' : 'Vença 3 encontros e capture seu primeiro Pokémon.';
  $('quest-wins').textContent = `${game.wins >= 3 ? '✓' : '○'} ${Math.min(game.wins, 3)}/3 vitórias`;
  $('quest-catch').textContent = `${game.caught.length ? '✓' : '○'} ${Math.min(game.caught.length, 1)}/1 captura`;
  document.querySelector('.quest-panel').classList.toggle('complete', ready || worldData.badge);
}
function renderBag() {
  if (!game) return;
  $('bag-potions').textContent = game.potions; $('bag-balls').textContent = game.balls;
  $('bag-badge').textContent = worldData.badge ? '✦' : '—';
  $('badge-description').textContent = worldData.badge ? 'Uma lembrança da sua primeira grande jornada' : 'Conclua a missão da professora Lia';
  const ids = [game.player.species, ...WILD];
  $('collection-count').textContent = `${game.caught.length + 1} / ${ids.length} registrados`;
  $('collection-list').innerHTML = ids.map(id => {
    const known = id === game.player.species || game.caught.includes(id);
    return `<div class="collection-card ${known ? '' : 'unknown'}"><img src="${portrait(id)}" alt="${known ? SPECIES[id].name : 'Pokémon ainda não capturado'}"><strong>${known ? SPECIES[id].name : '???'}</strong><span>${id === game.player.species ? 'SEU PARCEIRO' : known ? 'CAPTURADO' : 'NÃO REGISTRADO'}</span></div>`;
  }).join('');
}
function renderBattle() {
  const { player, enemy } = game;
  const inBattle = game.phase === 'battle';
  $('player-name').textContent = nameOf(player); $('player-level').textContent = `Nv. ${player.level}`;
  document.querySelector('.enemy-card').hidden = !inBattle;
  if (enemy) {
    $('enemy-name').textContent = nameOf(enemy); $('enemy-level').textContent = `Nv. ${enemy.level}`;
    const type = SPECIES[enemy.species].type;
    $('enemy-type').className = `type-badge ${type}`; $('enemy-type').textContent = TYPES[type].name;
    setHp('enemy', enemy.hp, enemy.maxHp);
  }
  setHp('player', player.hp, player.maxHp); setXp('battle-xp');
  $('turn-label').textContent = inBattle ? `TURNO ${game.turn + 1} · ${busy ? 'EM ANDAMENTO' : 'SUA VEZ'}` : 'MAIS UM CAPÍTULO DA JORNADA';
  $('action-title').textContent = inBattle ? `O que ${nameOf(player)} vai fazer?` : ({ victory: 'Uma pequena grande vitória!', captured: 'Uma nova amizade!', escaped: 'De volta à trilha.', defeat: 'Até os heróis descansam.' }[game.phase]);
  $('move-list').innerHTML = inBattle ? movesFor(player).map(move => `<button class="move-button" data-move="${move.id}" ${busy ? 'disabled' : ''}><div class="move-top"><strong>${move.name}</strong>${typeBadge(move.type)}</div><div class="move-power">PODER ${move.power}<span>→</span></div></button>`).join('') : '';
  $('battle-tools').hidden = !inBattle;
  $('potion-count').textContent = `×${game.potions}`; $('ball-count').textContent = `×${game.balls}`;
  $('potion-button').disabled = busy || !game.potions || player.hp === player.maxHp;
  $('capture-button').disabled = busy || !game.balls;
  $('flee-button').disabled = busy;
  $('return-button').hidden = inBattle;
  $('return-button').innerHTML = `${game.phase === 'defeat' ? 'Voltar ao Centro Pokémon' : 'Voltar à trilha'} <span>→</span>`;
}
function showDialogue(npc, lines, onComplete) {
  world.clearInput();
  dialogue = { npc, lines, index: 0, onComplete };
  $('dialogue-name').textContent = npc.name;
  $('dialogue-image').src = trainerArt(npc.kind === 'sign' ? 'scout' : npc.kind).toDataURL();
  $('dialogue-image').alt = npc.kind === 'sign' ? '' : npc.name;
  $('dialogue-box').hidden = false;
  updateDialogue();
}
function updateDialogue() {
  $('dialogue-text').textContent = dialogue.lines[dialogue.index];
  $('dialogue-action').textContent = dialogue.index < dialogue.lines.length - 1 ? 'Continuar' : 'Vamos lá';
  $('dialogue-next').focus({ preventScroll: true });
}
function advanceDialogue() {
  if (!dialogue) return;
  audio.play('confirm');
  if (++dialogue.index < dialogue.lines.length) updateDialogue();
  else {
    const complete = dialogue.onComplete;
    dialogue = null; $('dialogue-box').hidden = true;
    world.clearInput(); complete?.(); $('world-canvas').focus({ preventScroll: true });
  }
}
function interact() {
  if (dialogue) { advanceDialogue(); return; }
  if (!canMove()) return;
  const npc = nearestInteraction(world.position);
  if (!npc) { toast('Aproxime-se de uma pessoa ou da placa para interagir.'); return; }
  if (npc.id === 'nurse') {
    showDialogue(npc, [`Olá! ${nameOf(game.player)} parece ter vivido grandes aventuras. Vamos cuidar de vocês?`, 'Prontinho! HP recuperado, 3 poções e 5 Poké Bolas na mochila. Volte sempre que precisar.'], () => {
      game = rest(game); renderWorldHud(); save(); audio.play('heal'); log('Clara recuperou seu parceiro e repôs a mochila.'); toast('HP completo · 3 poções · 5 Poké Bolas');
    });
  } else if (npc.id === 'professor') {
    if (worldData.badge) showDialogue(npc, ['A Insígnia do Bosque é uma lembrança do que vocês conquistaram juntos. Ainda há quatro espécies selvagens para conhecer. Continue sua história!']);
    else if (game.wins >= 3 && game.caught.length >= 1) showDialogue(npc, ['Três vitórias e uma nova amizade… Vocês já não são os mesmos que saíram daqui!', 'Receba a Insígnia do Bosque! Não é sobre chegar primeiro: é sobre as histórias que colecionamos pelo caminho.'], () => {
      worldData.badge = true; save(); renderWorldHud(); audio.play('victory'); toast('✦ Você recebeu a Insígnia do Bosque!'); log('Missão concluída: Insígnia do Bosque recebida!');
    });
    else showDialogue(npc, [`O Bosque de Aurora fica ao norte, seguindo a trilha. Seu desafio é vencer 3 encontros e capturar pelo menos um Pokémon. Você já tem ${Math.min(game.wins, 3)} vitórias e ${game.caught.length} espécies capturadas.`, 'Para capturar, enfraqueça o Pokémon sem deixá-lo com zero HP. Se precisar de cuidados ou itens, procure a Clara em frente ao telhado vermelho.']);
  } else if (npc.id === 'scout') showDialogue(npc, ['Ei, viajante! Na grama alta, cada passo pode virar um encontro. Fique na trilha se quiser atravessar o bosque com tranquilidade.', 'Água vence fogo, fogo vence planta e planta vence água. E uma dica: fugir sempre funciona por aqui. Às vezes, a melhor jogada é tentar de novo depois.']);
  else showDialogue(npc, ['ROTA 01 — BOSQUE DE AURORA. Ao norte: gramados e Pokémon selvagens. Ao sul: Vila Primavera e Centro Pokémon.', 'Lago dos Reflexos a leste. Atravesse pela ponte; a margem é funda demais para caminhar.']);
}
function activateGame() {
  active = true; world.enabled = true; busy = false;
  $('title-screen').hidden = true; world.setPosition(worldData.position); world.setPartner(game.player.species);
  renderWorldHud();
  if (game.phase === 'battle') {
    mode = 'battle'; world.showBattle(game); $('battle-hud').hidden = false; $('world-hud').hidden = true;
    renderBattle(); $('battle-message').textContent = 'Seu encontro foi restaurado. A aventura continua.';
  } else {
    if (game.phase === 'defeat') { game = rest(game); world.setPosition({ x: 20.3, z: 23.5 }); }
    mode = 'world'; world.showWorld(); $('world-hud').hidden = false; $('battle-hud').hidden = true;
    renderWorldHud();
  }
  save(); $('world-canvas').focus({ preventScroll: true });
}
function begin() {
  if (!selected || busy) return;
  game = createGame(selected); worldData = freshWorld(); encounterCooldown = 4; walkedDistance = 0;
  $('battle-log').replaceChildren(); $('starter-dialog').close();
  activateGame(); audio.play('confirm');
  log(`Você e ${nameOf(game.player)} começaram sua jornada em Vila Primavera.`);
  showDialogue({ name: 'Prof.ª Lia', kind: 'professor' }, [`Ah, ${nameOf(game.player)} escolheu você também! Sou Lia, a pesquisadora desta vila. Seu parceiro vai caminhar sempre ao seu lado.`, 'Siga a trilha ao norte e encontre Pokémon na grama alta. Vença 3 encontros, capture um novo amigo e volte para receber a Insígnia do Bosque.', 'Use WASD ou as setas para caminhar e E para conversar. No celular, use o direcional e o botão A. A Clara, ao lado do Centro Pokémon de telhado vermelho, cuida de vocês gratuitamente.']);
}
async function encounter() {
  if (!canMove() || game.player.hp <= 0) return;
  busy = true; world.clearInput(); interaction = null; $('interact-button').hidden = true;
  $('encounter-transition').classList.add('active'); audio.play('confirm');
  await pause(330);
  game = startEncounter(game); mode = 'battle'; world.showBattle(game);
  $('world-hud').hidden = true; $('battle-hud').hidden = false;
  busy = false; renderBattle(); save();
  $('battle-message').textContent = `Um ${nameOf(game.enemy)} selvagem apareceu!`;
  log(`Um ${nameOf(game.enemy)} selvagem de nível ${game.enemy.level} apareceu.`);
  await pause(370); $('encounter-transition').classList.remove('active');
  $('move-list').firstElementChild?.focus({ preventScroll: true });
}
async function perform(action) {
  if (busy || !active || mode !== 'battle' || document.querySelector('dialog[open]')) return;
  const result = takeTurn(game, action);
  if (!result.acted) { $('battle-message').textContent = result.events[0].text; return; }
  busy = true; renderBattle();
  const previous = game; game = result.state; save();
  let visiblePlayerHp = previous.player.hp, visibleEnemyHp = previous.enemy.hp;
  try {
    for (const event of result.events) {
      $('battle-message').textContent = event.text; log(event.text); audio.play(event.kind);
      world.animateEvent(event, event.type);
      if (event.kind === 'attack' || event.kind === 'heal') {
        const target = event.kind === 'heal' ? 'player' : event.target;
        await pause(210);
        const number = $(`${target}-damage`);
        number.textContent = event.kind === 'heal' ? `+${event.amount}` : `−${event.damage}`;
        number.className = `damage-number pop${event.kind === 'heal' ? ' heal' : ''}`;
        if (event.kind === 'heal') visiblePlayerHp += event.amount;
        else if (target === 'enemy') visibleEnemyHp -= event.damage;
        else visiblePlayerHp -= event.damage;
        setHp('player', visiblePlayerHp, previous.player.maxHp); setHp('enemy', visibleEnemyHp, previous.enemy.maxHp);
        await pause(560); number.className = 'damage-number';
      } else if (event.kind === 'capture' || event.kind === 'throw') await pause(1150);
      else if (event.kind === 'level') toast(`✦ ${nameOf(game.player)} chegou ao nível ${game.player.level}!`);
    }
  } finally {
    busy = false; renderBattle(); renderWorldHud(); world.setBattleResult(game.phase);
    if (game.phase !== 'battle') {
      $('return-button').focus({ preventScroll: true });
      if (game.phase === 'defeat') $('battle-message').textContent = 'A Clara vai cuidar do seu parceiro. Sua jornada continua depois de uma pausa.';
    } else {
      const focus = action === 'potion' ? $('potion-button') : action === 'capture' ? $('capture-button') : $('move-list').querySelector(`[data-move="${action}"]`);
      (focus && !focus.disabled ? focus : $('move-list').firstElementChild)?.focus({ preventScroll: true });
    }
  }
}
function returnToWorld() {
  if (busy || game.phase === 'battle') return;
  if (game.phase === 'defeat') {
    game = rest(game); world.setPosition({ x: 20.3, z: 23.5 }); toast('Clara cuidou de vocês. HP e mochila recuperados!');
  }
  mode = 'world'; world.showWorld(); $('battle-hud').hidden = true; $('world-hud').hidden = false;
  encounterCooldown = 5; walkedDistance = 0; renderWorldHud(); save();
  $('world-canvas').focus({ preventScroll: true });
}
function onMove(position, distance) {
  walkedDistance += distance;
  if (walkedDistance < .85) return;
  walkedDistance -= .85; worldData.steps++; worldData.position = { ...position }; save();
  if (encounterCooldown > 0) { encounterCooldown--; return; }
  if (terrainAt(position.x, position.z) === 'tall-grass' && Math.random() < .23) void encounter();
}
function updateFrame(position) {
  if (!$('game-viewport').dataset.ready) { $('game-viewport').dataset.ready = 'true'; $('loading-screen').hidden = true; }
  if (!active || mode !== 'world' || performance.now() - lastFrameUpdate < 160) return;
  lastFrameUpdate = performance.now();
  const location = locationAt(position);
  if (location.title !== currentLocation) {
    const previous = currentLocation; currentLocation = location.title;
    $('location-title').textContent = location.title; $('location-subtitle').textContent = location.subtitle;
    $('world-description').textContent = `${location.title}. ${location.subtitle}.`;
    if (previous) {
      clearTimeout(regionTimer); $('region-toast').textContent = location.title; $('region-toast').hidden = false;
      regionTimer = setTimeout(() => { $('region-toast').hidden = true; }, 2200);
    }
  }
  world.drawMap($('minimap'), position);
  interaction = canMove() ? nearestInteraction(position) : null;
  $('interact-button').hidden = !interaction;
  if (interaction) $('interact-label').textContent = interaction.id === 'sign' ? 'Ler placa da rota' : `Conversar com ${interaction.name}`;
}

// Selection is DOM based, so the pixel art stays sharp and keyboard accessible.
$('starter-list').innerHTML = STARTERS.map(id => {
  const species = SPECIES[id];
  return `<button class="starter-card" data-starter="${id}" aria-pressed="false" aria-label="Escolher ${species.name}, tipo ${TYPES[species.type].name}"><span class="starter-number">#${species.number}</span><span class="starter-selected" aria-hidden="true">✓</span><div class="starter-art"><img src="${spriteURL(id)}" alt="${species.name}" width="128" height="128"></div><div class="starter-name"><strong>${species.name}</strong>${typeBadge(species.type)}</div><span class="starter-description">${species.description}</span><span class="starter-stats">${[['HP', species.hp], ['ATQ', species.attack], ['DEF', species.defense]].map(([label, stat]) => `<span>${label}<i><b style="width:${stat}%"></b></i></span>`).join('')}</span></button>`;
}).join('');
$('starter-list').addEventListener('click', event => {
  const button = event.target.closest('[data-starter]'); if (!button) return;
  selected = button.dataset.starter;
  for (const card of $('starter-list').children) card.setAttribute('aria-pressed', String(card === button));
  $('choice-description').textContent = `${SPECIES[selected].name} está pronto para ir com você.`;
  $('start-button').disabled = false; audio.play('confirm');
});
$('new-game-button').addEventListener('click', () => {
  if (game) { openStarterAfterReset = true; openModal('reset-dialog'); }
  else openModal('starter-dialog');
});
$('continue-button').addEventListener('click', () => { if (game && world) { activateGame(); log('Sua aventura foi restaurada. Bem-vindos de volta!'); } });
$('start-button').addEventListener('click', begin);
$('dialogue-next').addEventListener('click', advanceDialogue);
$('interact-button').addEventListener('click', interact);
$('touch-action').addEventListener('click', interact);
$('move-list').addEventListener('click', event => { const button = event.target.closest('[data-move]'); if (button) void perform(button.dataset.move); });
$('potion-button').addEventListener('click', () => void perform('potion'));
$('capture-button').addEventListener('click', () => void perform('capture'));
$('flee-button').addEventListener('click', () => void perform('flee'));
$('return-button').addEventListener('click', returnToWorld);
$('help-button').addEventListener('click', () => openModal('help-dialog'));
$('sprite-button').addEventListener('click', () => openModal('sprite-dialog'));
$('bag-button').addEventListener('click', () => openModal('bag-dialog'));
$('map-button').addEventListener('click', () => openModal('map-dialog'));
$('journal-button').addEventListener('click', () => openModal('journal-dialog'));
$('reload-button').addEventListener('click', () => location.reload());
$('sound-button').addEventListener('click', async () => {
  $('sound-button').disabled = true;
  try {
    const enabled = await audio.toggle(); $('sound-button').setAttribute('aria-pressed', String(enabled));
    $('sound-button').setAttribute('aria-label', enabled ? 'Desativar som' : 'Ativar som');
    $('sound-button').querySelector('span').textContent = enabled ? 'Som ligado' : 'Som desligado';
    $('sound-button').querySelector('path').setAttribute('d', enabled ? 'm11 5-6 5H2v4h3l6 5V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14' : 'm11 5-6 5H2v4h3l6 5V5Zm5 4 6 6m0-6-6 6');
  } catch { toast('O áudio não está disponível neste navegador.'); }
  finally { $('sound-button').disabled = false; }
});
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('close', () => { world?.clearInput(); if (active && !dialogue) $('world-canvas').focus({ preventScroll: true }); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
  });
}
$('reset-button').addEventListener('click', () => { if (!busy) { openStarterAfterReset = false; $('bag-dialog').close(); openModal('reset-dialog'); } });
$('confirm-reset').addEventListener('click', () => {
  if (busy) return;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  game = null; selected = null; active = false; mode = 'world'; worldData = freshWorld(); dialogue = null;
  world.enabled = false; world.clearInput(); world.showWorld(); world.setPosition(START_POSITION); world.setPartner('bulbasaur');
  encounterCooldown = 4; walkedDistance = 0; currentLocation = '';
  try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(WORLD_KEY); } catch { storageUnavailable(); }
  $('dialogue-box').hidden = true; $('battle-hud').hidden = true; $('world-hud').hidden = true; $('title-screen').hidden = false;
  $('continue-button').hidden = true; $('battle-log').replaceChildren(); $('region-toast').hidden = true;
  $('save-status').textContent = 'Seu próximo capítulo começa aqui.';
  for (const card of $('starter-list').children) card.setAttribute('aria-pressed', 'false');
  $('choice-description').textContent = 'Escolha seu primeiro companheiro.'; $('start-button').disabled = true;
  if (openStarterAfterReset) openModal('starter-dialog');
  else $('new-game-button').focus({ preventScroll: true });
});

const directions = { KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down', KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right' };
document.addEventListener('keydown', event => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (!world || document.querySelector('dialog[open]')) return;
  if (dialogue && (event.code === 'Enter' || event.code === 'KeyE' || event.code === 'Space')) { event.preventDefault(); if (!event.repeat) advanceDialogue(); return; }
  if (!active || mode !== 'world' || busy) return;
  if (directions[event.code]) { event.preventDefault(); world.setInput(directions[event.code], true); }
  else if (['KeyE', 'Enter'].includes(event.code) && !event.repeat && event.target.tagName !== 'BUTTON') { event.preventDefault(); interact(); }
  else if (event.code === 'KeyB' && !event.repeat) openModal('bag-dialog');
  else if (event.code === 'KeyM' && !event.repeat) openModal('map-dialog');
});
document.addEventListener('keyup', event => { if (directions[event.code]) world?.setInput(directions[event.code], false); });
for (const button of document.querySelectorAll('[data-direction]')) {
  const release = () => { world?.setInput(button.dataset.direction, false); button.classList.remove('pressed'); };
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); if (canMove()) { world.setInput(button.dataset.direction, true); button.classList.add('pressed'); } });
  button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release); button.addEventListener('lostpointercapture', release);
}
window.addEventListener('blur', () => world?.clearInput());
document.addEventListener('visibilitychange', () => { world?.clearInput(); if (document.hidden) save(); });
window.addEventListener('pagehide', save);

try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    game = restoreGame(raw);
    if (!game) toast('Seu progresso não pôde ser lido. Você pode começar uma nova jornada.');
    else worldData = restoreWorld(localStorage.getItem(WORLD_KEY)) || freshWorld();
  }
} catch { storageUnavailable(); }
try {
  world = new WorldRenderer($('world-canvas'), {
    canMove, onMove, onFrame: updateFrame,
    onAssetError: toast,
    onError: message => { $('graphics-error-text').textContent = message; $('graphics-error').hidden = false; },
  });
  $('title-screen').hidden = false; $('continue-button').hidden = !game;
  if (game) { world.setPartner(game.player.species); $('save-status').textContent = '● Uma história espera por você'; }
  spriteStudio = mountSpriteStudio({
    world, getPartner: () => game?.player.species, onMessage: toast,
    onChanged: (species, sheet) => {
      if (sheet) customPortraits.set(species, sheet.frame('down').toDataURL());
      else customPortraits.delete(species);
      document.querySelector(`[data-starter="${species}"] img`).src = portrait(species);
      if (game) { renderWorldHud(); if ($('bag-dialog').open) renderBag(); }
    },
  });
} catch (error) {
  console.error('Não foi possível iniciar o cenário:', error);
  $('loading-screen').hidden = true; $('graphics-error').hidden = false;
  $('graphics-error-text').textContent = 'Este jogo usa WebGL 2. Ative a aceleração gráfica do navegador ou tente uma versão atual do Chrome, Edge ou Firefox. Seu progresso salvo será preservado.';
}
