import { SPECIES, STARTERS, WILD, MAX_LEVEL, movesFor } from './data.js';

export const xpRequired = level => level >= MAX_LEVEL ? 0 : 15 * level + 15;
export function createPokemon(species, level = 5) {
  if (!SPECIES[species] || !Number.isInteger(level) || level < 1 || level > MAX_LEVEL) throw new Error('Pokémon inválido');
  const base = SPECIES[species];
  const maxHp = Math.floor(base.hp * 2 * level / 100) + level + 22;
  return { species, level, maxHp, hp: maxHp, attack: Math.floor(base.attack * 2 * level / 100) + 8, defense: Math.floor(base.defense * 2 * level / 100) + 8, xp: 0 };
}
export function createGame(starter) {
  if (!STARTERS.includes(starter)) throw new Error('Escolha um inicial válido');
  return { version: 1, player: createPokemon(starter), enemy: null, phase: 'ready', wins: 0, encounters: 0, potions: 3, balls: 5, caught: [], turn: 0 };
}
const effectiveness = {
  fire: { grass: 2, bug: 2, fire: .5, water: .5 },
  water: { fire: 2, water: .5, grass: .5 },
  grass: { water: 2, fire: .5, grass: .5, bug: .5 },
  electric: { water: 2, electric: .5, grass: .5 },
  bug: { grass: 2, fire: .5 },
};
export const typeMultiplier = (attackType, defenseType) => effectiveness[attackType]?.[defenseType] ?? 1;
export function calculateDamage(attacker, defender, move, rng = Math.random) {
  const multiplier = typeMultiplier(move.type, SPECIES[defender.species].type);
  const critical = rng() < .1;
  const stab = SPECIES[attacker.species].type === move.type ? 1.2 : 1;
  const variance = .9 + rng() * .1;
  const base = ((2 * attacker.level / 5 + 2) * move.power * attacker.attack / defender.defense / 25) + 2;
  return { damage: Math.max(1, Math.floor(base * multiplier * stab * (critical ? 1.5 : 1) * variance)), multiplier, critical };
}
export function startEncounter(current, rng = Math.random) {
  if (!['ready', 'victory', 'escaped', 'captured'].includes(current.phase) || current.player.hp <= 0) return current;
  const state = structuredClone(current);
  const species = WILD[Math.min(WILD.length - 1, Math.floor(rng() * WILD.length))];
  const level = Math.max(3, Math.min(MAX_LEVEL, state.player.level + Math.floor(rng() * 3) - 1));
  state.enemy = createPokemon(species, level);
  state.phase = 'battle';
  state.turn = 0;
  state.encounters++;
  return state;
}
export function awardExperience(player, amount) {
  if (player.level === MAX_LEVEL) return 0;
  player.xp += amount;
  let levels = 0;
  while (player.level < MAX_LEVEL && player.xp >= xpRequired(player.level)) {
    player.xp -= xpRequired(player.level);
    const next = createPokemon(player.species, player.level + 1);
    const hpGain = next.maxHp - player.maxHp;
    Object.assign(player, { level: next.level, maxHp: next.maxHp, attack: next.attack, defense: next.defense, hp: Math.min(next.maxHp, player.hp + hpGain) });
    levels++;
  }
  if (player.level === MAX_LEVEL) player.xp = 0;
  return levels;
}
export function takeTurn(current, action, rng = Math.random) {
  const state = structuredClone(current);
  const events = [];
  const invalid = text => ({ state, events: [{ kind: 'info', text }], acted: false });
  if (state.phase !== 'battle') return invalid('Explore o gramado para encontrar um Pokémon.');
  if (action === 'flee') {
    state.phase = 'escaped';
    state.enemy = null;
    return { state, events: [{ kind: 'escape', text: 'Vocês voltaram à trilha em segurança.' }], acted: true };
  }
  if (action === 'capture') {
    if (!state.balls) return invalid('As Poké Bolas acabaram. A enfermeira Clara pode repor sua mochila.');
    state.balls--;
    state.turn++;
    const chance = .25 + (1 - state.enemy.hp / state.enemy.maxHp) * .65;
    if (rng() < chance) {
      state.phase = 'captured';
      if (!state.caught.includes(state.enemy.species)) state.caught.push(state.enemy.species);
      const xp = state.player.level === MAX_LEVEL ? 0 : state.enemy.level * 5 + 10;
      const levels = awardExperience(state.player, xp);
      events.push({ kind: 'capture', text: `${SPECIES[state.enemy.species].name} foi capturado! ${xp ? `+${xp} XP.` : 'Nível máximo alcançado.'}`, xp, levels });
      if (levels) events.push({ kind: 'level', text: `${SPECIES[state.player.species].name} chegou ao nível ${state.player.level}!` });
      return { state, events, acted: true };
    }
    events.push({ kind: 'throw', text: `${SPECIES[state.enemy.species].name} escapou da Poké Bola! Enfraqueça-o para aumentar a chance de captura.` });
  } else if (action === 'potion') {
    if (!state.potions) return invalid('Suas poções acabaram. Descanse depois da batalha para repor.');
    if (state.player.hp === state.player.maxHp) return invalid('Seu parceiro já está com o HP cheio. Escolha um golpe.');
    const healed = Math.min(24, state.player.maxHp - state.player.hp);
    state.player.hp += healed;
    state.potions--;
    events.push({ kind: 'heal', target: 'player', amount: healed, text: `A poção recuperou ${healed} HP!` });
  } else {
    const move = movesFor(state.player).find(item => item.id === action);
    if (!move) return invalid('Escolha um golpe disponível.');
    const hit = calculateDamage(state.player, state.enemy, move, rng);
    const damage = Math.min(hit.damage, state.enemy.hp);
    state.enemy.hp -= damage;
    events.push({ kind: 'attack', target: 'enemy', type: move.type, ...hit, damage, text: `${SPECIES[state.player.species].name} usou ${move.name}: −${damage} HP!${hit.multiplier > 1 ? ' Super eficaz!' : hit.multiplier < 1 ? ' Pouco eficaz…' : ''}${hit.critical ? ' Crítico!' : ''}` });
  }
  if (action !== 'capture') state.turn++;
  if (state.enemy.hp === 0) {
    state.phase = 'victory';
    state.wins++;
    const potionGained = state.potions < 5;
    state.potions = Math.min(5, state.potions + 1);
    const xp = state.enemy.level * 9 + 15;
    const atCap = state.player.level === MAX_LEVEL;
    const levels = awardExperience(state.player, xp);
    events.push({ kind: 'victory', xp: atCap ? 0 : xp, levels, text: `Vitória! ${atCap ? 'Nível máximo alcançado.' : `+${xp} XP.`} ${potionGained ? '+1 poção.' : 'Mochila cheia: 5 poções.'}` });
    if (levels) events.push({ kind: 'level', text: `${SPECIES[state.player.species].name} chegou ao nível ${state.player.level}! Atributos e HP aumentaram.` });
  } else {
    const moves = movesFor(state.enemy);
    const move = moves[Math.min(moves.length - 1, Math.floor(rng() * moves.length))];
    const hit = calculateDamage(state.enemy, state.player, move, rng);
    const damage = Math.min(hit.damage, state.player.hp);
    state.player.hp -= damage;
    events.push({ kind: 'attack', target: 'player', type: move.type, ...hit, damage, text: `${SPECIES[state.enemy.species].name} usou ${move.name}: −${damage} HP!${hit.multiplier > 1 ? ' Super eficaz!' : hit.multiplier < 1 ? ' Pouco eficaz…' : ''}${hit.critical ? ' Crítico!' : ''}` });
    if (state.player.hp === 0) {
      state.phase = 'defeat';
      events.push({ kind: 'defeat', text: 'Seu parceiro precisa descansar. Recupere as energias e tente outra vez!' });
    }
  }
  return { state, events, acted: true };
}
export function rest(current) {
  if (current.phase === 'battle') return current;
  const state = structuredClone(current);
  state.player.hp = state.player.maxHp;
  state.potions = 3;
  state.balls = 5;
  state.enemy = null;
  state.phase = 'ready';
  return state;
}

// Rebuild derived attributes; saved data never supplies names, moves or markup.
export function restoreGame(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== 1 || !STARTERS.includes(data.player?.species)) return null;
    if (!['ready', 'battle', 'victory', 'defeat', 'escaped', 'captured'].includes(data.phase)) return null;
    for (const key of ['wins', 'encounters', 'potions', 'turn']) if (!Number.isSafeInteger(data[key]) || data[key] < 0) return null;
    if (data.potions > 5 || data.wins > data.encounters) return null;
    const balls = data.balls === undefined ? 5 : data.balls;
    const caught = data.caught === undefined ? [] : data.caught;
    if (!Number.isSafeInteger(balls) || balls < 0 || balls > 5 || !Array.isArray(caught) || caught.length > WILD.length || caught.some(id => !WILD.includes(id)) || new Set(caught).size !== caught.length) return null;
    const rebuild = value => {
      const pokemon = createPokemon(value.species, value.level);
      if (!Number.isInteger(value.hp) || value.hp < 0 || value.hp > pokemon.maxHp) throw new Error('HP inválido');
      if (!Number.isInteger(value.xp) || value.xp < 0 || (pokemon.level < MAX_LEVEL ? value.xp >= xpRequired(pokemon.level) : value.xp !== 0)) throw new Error('XP inválido');
      return { ...pokemon, hp: value.hp, xp: value.xp };
    };
    const player = rebuild(data.player);
    const enemy = data.enemy ? rebuild(data.enemy) : null;
    if (player.level < 5 || (enemy && enemy.level < 3)) return null;
    if (enemy && !WILD.includes(enemy.species)) return null;
    if (['battle', 'victory', 'defeat', 'captured'].includes(data.phase) && !enemy) return null;
    if (data.phase === 'battle' && (!player.hp || !enemy.hp)) return null;
    if (data.phase === 'victory' && (enemy.hp !== 0 || !player.hp)) return null;
    if (data.phase === 'captured' && (!enemy.hp || !player.hp || !caught.includes(enemy.species))) return null;
    if (data.phase === 'defeat' ? player.hp !== 0 || !enemy.hp : player.hp === 0) return null;
    if (['ready', 'escaped'].includes(data.phase) && enemy) return null;
    return { version: 1, player, enemy, phase: data.phase, wins: data.wins, encounters: data.encounters, potions: data.potions, balls, caught, turn: data.turn };
  } catch { return null; }
}
