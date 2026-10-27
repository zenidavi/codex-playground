import test from 'node:test';
import assert from 'node:assert/strict';
import { SPECIES, STARTERS, WILD, movesFor, MAX_LEVEL } from '../js/data.js';
import { createPokemon, createGame, startEncounter, takeTurn, rest, calculateDamage, typeMultiplier, awardExperience, xpRequired, restoreGame } from '../js/engine.js';

const fixed = () => .6;
const encounter = starter => startEncounter(createGame(starter), fixed);

test('os três iniciais começam no nível 5, com HP completo e atributos próprios', () => {
  for (const id of STARTERS) {
    const game = createGame(id);
    assert.equal(game.player.level, 5);
    assert.equal(game.player.hp, game.player.maxHp);
    assert.equal(game.phase, 'ready');
    assert.equal(game.potions, 3);
    assert.equal(movesFor(game.player).length, 2);
  }
  assert.ok(createPokemon('squirtle').defense > createPokemon('charmander').defense);
  assert.throws(() => createGame('pikachu'));
  assert.throws(() => createPokemon('missing'));
});
test('encontros usam espécies selvagens e níveis próximos, com limites', () => {
  for (const random of [0, .25, .5, .75, .99999]) {
    const game = startEncounter(createGame('bulbasaur'), () => random);
    assert.ok(WILD.includes(game.enemy.species));
    assert.ok(game.enemy.level >= 4 && game.enemy.level <= 6);
    assert.equal(game.encounters, 1);
    assert.equal(startEncounter(game), game);
  }
  const game = createGame('squirtle'); game.player = createPokemon('squirtle', MAX_LEVEL);
  assert.equal(startEncounter(game, () => .999).enemy.level, MAX_LEVEL);
});
test('vantagens e resistências de tipo alteram o dano', () => {
  assert.equal(typeMultiplier('water', 'fire'), 2);
  assert.equal(typeMultiplier('fire', 'grass'), 2);
  assert.equal(typeMultiplier('grass', 'water'), 2);
  assert.equal(typeMultiplier('grass', 'fire'), .5);
  assert.equal(typeMultiplier('normal', 'grass'), 1);
  const attacker = createPokemon('charmander');
  const defender = createPokemon('oddish');
  const effective = calculateDamage(attacker, defender, movesFor(attacker)[1], fixed);
  const neutral = calculateDamage(attacker, defender, { type: 'normal', power: 40 }, fixed);
  assert.ok(effective.damage >= neutral.damage * 2);
  assert.equal(effective.multiplier, 2);
});
test('críticos causam mais dano e RNG pode ser controlado nos testes', () => {
  const player = createPokemon('bulbasaur'); const enemy = createPokemon('pidgey'); const move = movesFor(player)[0];
  const critical = calculateDamage(player, enemy, move, () => 0);
  const normal = calculateDamage(player, enemy, move, () => .5);
  assert.equal(critical.critical, true);
  assert.ok(critical.damage > normal.damage);
});
test('um turno resolve o golpe do jogador antes da resposta e não altera o estado original', () => {
  const original = encounter('charmander'); const snapshot = structuredClone(original);
  const { state, events, acted } = takeTurn(original, 'tackle', fixed);
  assert.equal(acted, true);
  assert.equal(state.turn, 1);
  assert.deepEqual(events.map(event => event.target), ['enemy', 'player']);
  assert.ok(state.player.hp < original.player.hp);
  assert.ok(state.enemy.hp < original.enemy.hp);
  assert.deepEqual(original, snapshot);
});
test('nocaute encerra a batalha sem contra-ataque e entrega XP e poção apenas uma vez', () => {
  const original = encounter('charmander'); original.enemy.hp = 1;
  const { state, events } = takeTurn(original, 'element', fixed);
  assert.equal(state.phase, 'victory'); assert.equal(state.enemy.hp, 0);
  assert.equal(state.player.hp, original.player.hp);
  assert.equal(state.wins, 1); assert.ok(state.player.xp > 0); assert.equal(state.potions, 4);
  assert.equal(events.filter(event => event.kind === 'attack').length, 1);
  const repeated = takeTurn(state, 'element', fixed);
  assert.equal(repeated.acted, false); assert.equal(repeated.state.wins, 1);
});
test('experiência permite múltiplos níveis, melhora atributos e preserva dano sofrido', () => {
  const player = createPokemon('bulbasaur'); player.hp -= 10;
  const before = structuredClone(player);
  const gained = awardExperience(player, xpRequired(5) + xpRequired(6) + 7);
  assert.equal(gained, 2); assert.equal(player.level, 7); assert.equal(player.xp, 7);
  assert.ok(player.maxHp > before.maxHp); assert.ok(player.attack > before.attack);
  assert.equal(player.maxHp - player.hp, 10);
});
test('nível máximo limita XP e não causa loops de progressão', () => {
  const player = createPokemon('squirtle', 19);
  assert.equal(awardExperience(player, 999999), 1);
  assert.equal(player.level, MAX_LEVEL); assert.equal(player.xp, 0);
  assert.equal(awardExperience(player, 9999), 0); assert.equal(xpRequired(MAX_LEVEL), 0);
});
test('poção cura até 24 HP, consome item e turno e permite resposta do adversário', () => {
  const original = encounter('squirtle'); original.player.hp = 1;
  const { state, events } = takeTurn(original, 'potion', fixed);
  assert.equal(events[0].kind, 'heal'); assert.equal(events[0].amount, 24);
  assert.equal(state.potions, 2); assert.equal(state.turn, 1);
  assert.ok(state.player.hp > 1 && state.player.hp < 25);
  const almostFull = encounter('bulbasaur'); almostFull.player.hp--;
  assert.equal(takeTurn(almostFull, 'potion', fixed).events[0].amount, 1);
});
test('ações inválidas não gastam item ou turno', () => {
  for (const action of ['potion', 'unknown']) {
    const full = encounter('bulbasaur');
    const result = takeTurn(full, action, fixed);
    assert.equal(result.acted, false); assert.deepEqual(result.state, full);
  }
  const empty = encounter('bulbasaur'); empty.player.hp--; empty.potions = 0;
  assert.equal(takeTurn(empty, 'potion').acted, false);
  assert.equal(takeTurn(createGame('squirtle'), 'tackle').acted, false);
});
test('fugir preserva HP e não concede experiência nem contra-ataque', () => {
  const original = encounter('bulbasaur');
  const { state, events } = takeTurn(original, 'flee', fixed);
  assert.equal(state.phase, 'escaped'); assert.equal(state.enemy, null);
  assert.equal(state.player.hp, original.player.hp); assert.equal(state.player.xp, 0);
  assert.equal(state.wins, 0); assert.equal(events.length, 1);
  assert.equal(startEncounter(state, fixed).encounters, 2);
});
test('derrota impede novos golpes; descanso recupera HP, poções e permite continuar', () => {
  const original = encounter('squirtle'); original.player.hp = 1; original.potions = 0;
  const defeated = takeTurn(original, 'tackle', fixed).state;
  assert.equal(defeated.phase, 'defeat'); assert.equal(defeated.player.hp, 0);
  assert.equal(takeTurn(defeated, 'tackle').acted, false);
  assert.equal(startEncounter(defeated), defeated);
  const recovered = rest(defeated);
  assert.equal(recovered.phase, 'ready'); assert.equal(recovered.player.hp, recovered.player.maxHp);
  assert.equal(recovered.potions, 3); assert.equal(recovered.encounters, 1);
  assert.equal(startEncounter(recovered, fixed).phase, 'battle');
  assert.equal(rest(original), original, 'não pode descansar em combate');
});
test('salvamento restaura batalhas e atributos canônicos', () => {
  const state = takeTurn(encounter('charmander'), 'tackle', fixed).state;
  assert.deepEqual(restoreGame(JSON.stringify(state)), state);
  state.player.attack = 9999;
  const saved = restoreGame(JSON.stringify(state));
  assert.equal(saved.player.attack, createPokemon('charmander').attack);
  const win = encounter('bulbasaur'); win.enemy.hp = 1;
  const victory = takeTurn(win, 'element', fixed).state;
  assert.deepEqual(restoreGame(JSON.stringify(victory)), victory);
});
test('salvamentos corrompidos ou inconsistentes são rejeitados', () => {
  for (const raw of ['', '{}', 'null', '{invalid', '{"version":2}']) assert.equal(restoreGame(raw), null);
  const invalid = [
    state => { state.player.species = '<script>'; }, state => { state.player.hp = -1; },
    state => { state.player.level = 999; }, state => { state.player.level = 1; }, state => { state.player.xp = 99999; },
    state => { state.potions = 99; }, state => { state.phase = 'battle'; },
    state => { state.phase = 'victory'; }, state => { state.player.hp = 0; },
    state => { state.encounters = -1; }, state => { state.wins = 5; },
  ];
  for (const mutate of invalid) { const state = createGame('bulbasaur'); mutate(state); assert.equal(restoreGame(JSON.stringify(state)), null); }
});
test('cada inicial pode completar um encontro com ações válidas', () => {
  for (const starter of STARTERS) {
    for (let index = 0; index < WILD.length; index++) {
      let state = startEncounter(createGame(starter), () => (index + .1) / WILD.length);
      let turns = 0;
      while (state.phase === 'battle' && turns++ < 40) {
        const action = state.player.hp < state.player.maxHp / 2 && state.potions ? 'potion' : 'element';
        state = takeTurn(state, action, fixed).state;
        assert.ok(state.player.hp >= 0 && state.enemy.hp >= 0);
      }
      assert.ok(['victory', 'defeat'].includes(state.phase), `${SPECIES[starter].name} vs ${state.enemy.species}`);
    }
  }
});

test('captura de um Pokémon enfraquecido consome bola, entrega XP e encerra sem contra-ataque', () => {
  const original = encounter('bulbasaur'); original.enemy.hp = 1;
  const { state, events } = takeTurn(original, 'capture', fixed);
  assert.equal(state.phase, 'captured'); assert.equal(state.balls, 4); assert.equal(state.turn, 1);
  assert.equal(state.player.hp, original.player.hp); assert.ok(state.player.xp > 0);
  assert.deepEqual(state.caught, ['oddish']); assert.equal(state.wins, 0);
  assert.equal(events[0].kind, 'capture');
  assert.deepEqual(restoreGame(JSON.stringify(state)), state);
  assert.equal(startEncounter(state, fixed).phase, 'battle');
});
test('captura que falha permite resposta; sem bolas não consome turno', () => {
  const original = encounter('squirtle');
  const { state, events } = takeTurn(original, 'capture', () => .99);
  assert.equal(state.phase, 'battle'); assert.equal(state.balls, 4); assert.equal(state.turn, 1);
  assert.equal(events[0].kind, 'throw'); assert.equal(events[1].target, 'player');
  assert.equal(state.enemy.hp, original.enemy.hp); assert.ok(state.player.hp < original.player.hp);
  original.balls = 0;
  const invalid = takeTurn(original, 'capture', fixed);
  assert.equal(invalid.acted, false); assert.deepEqual(invalid.state, original);
});
test('coleção é única, itens são repostos e saves anteriores migram sem perder progresso', () => {
  const original = encounter('charmander'); original.enemy.hp = 1; original.caught = ['oddish'];
  const captured = takeTurn(original, 'capture', fixed).state;
  assert.deepEqual(captured.caught, ['oddish']);
  const recovered = rest(captured); assert.equal(recovered.balls, 5); assert.deepEqual(recovered.caught, ['oddish']);
  const legacy = createGame('bulbasaur'); delete legacy.balls; delete legacy.caught;
  const restored = restoreGame(JSON.stringify(legacy)); assert.equal(restored.balls, 5); assert.deepEqual(restored.caught, []);
  for (const value of [['oddish', 'oddish'], ['unknown'], null]) {
    const bad = createGame('bulbasaur'); bad.caught = value;
    assert.equal(restoreGame(JSON.stringify(bad)), null);
  }
  const bad = createGame('squirtle'); bad.balls = -1; assert.equal(restoreGame(JSON.stringify(bad)), null);
});
