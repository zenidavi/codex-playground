import { SPECIES, STARTERS, TYPES, MAX_LEVEL, movesFor } from './data.js';
import { createGame, startEncounter, takeTurn, rest, restoreGame, xpRequired } from './engine.js';

const $ = id => document.getElementById(id);
const SAVE_KEY = 'poketrilha.save.v1';
let game = null;
let selected = null;
let busy = false;
let toastTimer;
let storageWarning = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pause = ms => new Promise(resolve => setTimeout(resolve, reducedMotion ? 20 : ms));
const nameOf = pokemon => SPECIES[pokemon.species].name;
const badge = type => `<span class="type-badge ${type}">${TYPES[type].icon} ${TYPES[type].name}</span>`;

function toast(text) {
  clearTimeout(toastTimer);
  $('toast').textContent = text;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}
function storageUnavailable() {
  if (!storageWarning) toast('O navegador bloqueou o salvamento. Sua aventura continua nesta sessão.');
  storageWarning = true;
}
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(game)); }
  catch { storageUnavailable(); }
}
function addLog(text) {
  const entry = document.createElement('li');
  entry.textContent = text;
  $('battle-log').prepend(entry);
  while ($('battle-log').children.length > 12) $('battle-log').lastElementChild.remove();
}
function renderStarters() {
  $('starter-list').innerHTML = STARTERS.map(id => {
    const item = SPECIES[id];
    return `<button class="starter-card ${item.type}" data-starter="${id}" aria-pressed="false" aria-label="Escolher ${item.name}, tipo ${TYPES[item.type].name}"><div class="starter-art"><span class="starter-number">#${item.number}</span><span class="selection-circle" aria-hidden="true">✓</span><img src="assets/${id}.svg" alt="${item.name}" width="190" height="180"></div><div class="starter-info"><div class="starter-title"><h3>${item.name}</h3>${badge(item.type)}</div><p class="starter-description">${item.description}</p><div class="starter-stats">${[['HP', item.hp], ['ATQ', item.attack], ['DEF', item.defense]].map(([label, value]) => `<div class="stat"><span>${label}</span><div class="stat-track" aria-label="${label}: ${value}"><i style="width:${value}%"></i></div></div>`).join('')}</div></div></button>`;
  }).join('');
  $('starter-list').addEventListener('click', event => {
    const card = event.target.closest('[data-starter]');
    if (!card) return;
    selected = card.dataset.starter;
    for (const button of $('starter-list').children) button.setAttribute('aria-pressed', String(button === card));
    $('choice-title').textContent = `${SPECIES[selected].name} está pronto para ir com você!`;
    $('choice-description').textContent = `${SPECIES[selected].personality}. A amizade começa no primeiro passo.`;
    $('start-button').disabled = false;
    $('start-button').innerHTML = 'Começar aventura <span>→</span>';
  });
}
function setHp(target, hp, maxHp) {
  const track = $(`${target}-hp`);
  track.firstElementChild.style.width = `${Math.max(0, hp) / maxHp * 100}%`;
  track.classList.toggle('low', hp / maxHp <= .25);
  track.classList.toggle('medium', hp / maxHp > .25 && hp / maxHp <= .5);
  track.setAttribute('aria-valuenow', hp);
  track.setAttribute('aria-valuemax', maxHp);
  $(`${target}-hp-label`).textContent = `${hp} / ${maxHp}`;
}
function setBadge(id, type) {
  $(id).className = `type-badge ${type}`;
  $(id).textContent = `${TYPES[type].icon} ${TYPES[type].name}`;
}
function render() {
  if (!game) return;
  const { player, enemy, phase } = game;
  const inBattle = phase === 'battle';
  const info = SPECIES[player.species];
  $('selection-screen').hidden = true;
  $('adventure-screen').hidden = false;
  $('player-sprite').src = `assets/${player.species}.svg`;
  $('player-sprite').alt = info.name;
  $('player-sprite').classList.toggle('fainted', phase === 'defeat');
  $('player-name').textContent = info.name;
  $('player-level').textContent = `Nv. ${player.level}`;
  setHp('player', player.hp, player.maxHp);
  $('enemy-hud').hidden = !enemy || !inBattle;
  $('enemy-sprite').hidden = !enemy;
  if (enemy) {
    $('enemy-name').textContent = nameOf(enemy);
    $('enemy-level').textContent = `Nv. ${enemy.level}`;
    $('enemy-sprite').src = `assets/${enemy.species}.svg`;
    $('enemy-sprite').alt = `${nameOf(enemy)} selvagem`;
    $('enemy-sprite').classList.toggle('fainted', phase === 'victory');
    setBadge('enemy-type', SPECIES[enemy.species].type);
    setHp('enemy', enemy.hp, enemy.maxHp);
  }
  $('companion-image').src = `assets/${player.species}.svg`;
  $('companion-image').alt = info.name;
  $('companion-name').textContent = info.name;
  $('companion-level').textContent = `Nv. ${player.level}`;
  setBadge('companion-type', info.type);
  $('xp-label').textContent = player.level === MAX_LEVEL ? 'NÍVEL MÁXIMO' : `${player.xp} / ${xpRequired(player.level)} XP`;
  $('xp-track').firstElementChild.style.width = `${player.level === MAX_LEVEL ? 100 : player.xp / xpRequired(player.level) * 100}%`;
  $('xp-track').setAttribute('aria-valuenow', player.level === MAX_LEVEL ? 1 : player.xp);
  $('xp-track').setAttribute('aria-valuemax', player.level === MAX_LEVEL ? 1 : xpRequired(player.level));
  $('wins-count').textContent = game.wins;
  $('encounters-count').textContent = game.encounters;
  $('level-gain').textContent = player.level - 5;
  $('potion-count').textContent = `×${game.potions}`;
  $('battle-scene').classList.toggle('is-idle', !enemy);
  $('scene-status').textContent = inBattle ? 'ENCONTRO SELVAGEM' : phase === 'victory' ? 'MAIS UMA HISTÓRIA' : 'EXPLORANDO';
  $('turn-label').textContent = inBattle ? `TURNO ${game.turn + 1} · ${busy ? 'EM ANDAMENTO' : 'SUA VEZ'}` : phase === 'defeat' ? 'UMA PAUSA FAZ PARTE' : 'A JORNADA CONTINUA';
  $('action-title').textContent = inBattle ? `O que ${info.name} vai fazer?` : phase === 'defeat' ? 'Vamos recuperar as energias?' : phase === 'victory' ? 'Prontos para o próximo encontro?' : 'O que vamos descobrir hoje?';
  const focusedMove = document.activeElement?.dataset.move;
  $('move-list').innerHTML = inBattle ? movesFor(player).map(move => `<button class="move-button ${move.type}" data-move="${move.id}" ${busy ? 'disabled' : ''}><div class="move-top"><strong>${move.name}</strong>${badge(move.type)}</div><div class="move-meta"><span>${move.description}</span><span>PODER ${move.power} →</span></div></button>`).join('') : '';
  if (focusedMove && !busy) document.querySelector(`[data-move="${focusedMove}"]`)?.focus({ preventScroll: true });
  $('potion-button').hidden = !inBattle;
  $('potion-button').disabled = busy || !game.potions || player.hp === player.maxHp;
  $('flee-button').hidden = !inBattle;
  $('flee-button').disabled = busy;
  $('explore-button').hidden = inBattle || phase === 'defeat';
  $('explore-button').disabled = busy;
  $('rest-button').hidden = inBattle;
  $('rest-button').disabled = busy;
  $('reset-button').disabled = busy;
  $('battle-result').hidden = inBattle;
  if (!inBattle) {
    const results = {
      ready: ['✧', 'A trilha é sua.', 'Explore o gramado e conheça seu próximo adversário.'],
      victory: ['✦', 'Uma pequena grande vitória!', 'Experiência, amizade e um novo passo na jornada.'],
      defeat: ['♡', 'Até os heróis descansam.', 'Descanse para recuperar todo o HP e suas poções.'],
      escaped: ['→', 'De volta à trilha.', 'Respire fundo. A próxima aventura está logo ali.'],
    };
    const [icon, title, description] = results[phase];
    $('result-icon').textContent = icon;
    $('result-title').textContent = title;
    $('result-description').textContent = description;
  }
}
function explore() {
  if (busy || !game || game.phase === 'battle') return;
  const next = startEncounter(game);
  if (next === game) return;
  game = next;
  $('action-feedback').textContent = '';
  $('enemy-sprite').classList.remove('fainted');
  addLog(`Um ${nameOf(game.enemy)} selvagem de nível ${game.enemy.level} apareceu!`);
  save();
  render();
  $('enemy-sprite').classList.add('enter');
  setTimeout(() => $('enemy-sprite').classList.remove('enter'), 500);
  $('move-list').querySelector('button')?.focus({ preventScroll: true });
}
async function perform(action) {
  if (busy || !game) return;
  const result = takeTurn(game, action);
  if (!result.acted) {
    $('action-feedback').textContent = result.events[0].text;
    return;
  }
  busy = true;
  $('action-feedback').textContent = 'Cada movimento conta…';
  render();
  // Commit the complete turn before animation so closing the tab never loses it.
  const previous = game;
  game = result.state;
  save();
  let visiblePlayerHp = previous.player.hp;
  let visibleEnemyHp = previous.enemy?.hp;
  try {
    for (const event of result.events) {
      if (event.kind === 'attack') {
        const attacker = $(event.target === 'enemy' ? 'player-sprite' : 'enemy-sprite');
        const defender = $(`${event.target}-sprite`);
        attacker.classList.add('attacking');
        await pause(200);
        defender.classList.add('hit');
        const number = $(`${event.target}-damage`);
        number.textContent = `−${event.damage}`;
        number.className = 'damage-number pop';
        if (event.target === 'enemy') { visibleEnemyHp -= event.damage; setHp('enemy', visibleEnemyHp, previous.enemy.maxHp); }
        else { visiblePlayerHp -= event.damage; setHp('player', visiblePlayerHp, previous.player.maxHp); }
        addLog(event.text);
        $('action-feedback').textContent = event.text;
        await pause(520);
        attacker.classList.remove('attacking');
        defender.classList.remove('hit');
        number.className = 'damage-number';
      } else if (event.kind === 'heal') {
        visiblePlayerHp += event.amount;
        setHp('player', visiblePlayerHp, previous.player.maxHp);
        const number = $('player-damage');
        number.textContent = `+${event.amount}`;
        number.className = 'damage-number pop heal';
        $('player-sprite').classList.add('healing');
        addLog(event.text);
        await pause(600);
        $('player-sprite').classList.remove('healing');
        number.className = 'damage-number';
      } else {
        addLog(event.text);
        if (event.kind === 'level') toast(`✦ Nível ${game.player.level}! Vocês estão crescendo juntos.`);
      }
    }
  } finally {
    busy = false;
    $('action-feedback').textContent = game.phase === 'battle' ? 'Sua vez. Escolha o próximo movimento.' : '';
    render();
    if (game.phase !== 'battle') (game.phase === 'defeat' ? $('rest-button') : $('explore-button')).focus({ preventScroll: true });
    else {
      const nextFocus = action === 'potion' && !$('potion-button').disabled ? $('potion-button') : $('move-list').querySelector(`[data-move="${action}"]`) || $('move-list').firstElementChild;
      nextFocus?.focus({ preventScroll: true });
    }
  }
}
function begin() {
  if (!selected || busy) return;
  game = createGame(selected);
  $('battle-log').replaceChildren();
  addLog(`Você e ${nameOf(game.player)} deram o primeiro passo. Bem-vindos à Rota 01!`);
  save();
  render();
  $('adventure-title').setAttribute('tabindex', '-1');
  $('adventure-title').focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
}

renderStarters();
$('start-button').addEventListener('click', begin);
$('explore-button').addEventListener('click', explore);
$('move-list').addEventListener('click', event => {
  const button = event.target.closest('[data-move]');
  if (button) void perform(button.dataset.move);
});
$('potion-button').addEventListener('click', () => void perform('potion'));
$('flee-button').addEventListener('click', () => void perform('flee'));
$('rest-button').addEventListener('click', () => {
  if (busy || !game || game.phase === 'battle') return;
  game = rest(game);
  addLog(`${nameOf(game.player)} descansou: HP completo e 3 poções na mochila.`);
  $('action-feedback').textContent = '';
  save(); render();
  toast('Energias renovadas. Vamos seguir a trilha!');
});
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
for (const button of document.querySelectorAll('[data-close]')) button.addEventListener('click', () => button.closest('dialog').close());
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const box = dialog.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});
$('reset-button').addEventListener('click', () => { if (!busy) $('reset-dialog').showModal(); });
$('confirm-reset').addEventListener('click', () => {
  if (busy) return;
  game = null; selected = null;
  try { localStorage.removeItem(SAVE_KEY); } catch { storageUnavailable(); }
  $('reset-dialog').close();
  $('adventure-screen').hidden = true;
  $('selection-screen').hidden = false;
  $('battle-log').replaceChildren();
  $('action-feedback').textContent = '';
  for (const button of $('starter-list').children) button.setAttribute('aria-pressed', 'false');
  $('start-button').disabled = true;
  $('start-button').innerHTML = 'Escolha seu parceiro <span>→</span>';
  $('choice-title').textContent = 'Sua história está prestes a começar';
  $('choice-description').textContent = 'Um parceiro, muitas possibilidades.';
  $('starter-list').firstElementChild.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: reducedMotion ? 'instant' : 'smooth' });
});
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    game = restoreGame(raw);
    if (game) { addLog('De volta à trilha! Sua aventura foi restaurada.'); render(); }
    else toast('O progresso salvo não pôde ser lido. Escolha um parceiro para recomeçar.');
  }
} catch { storageUnavailable(); }
