export const MAX_LEVEL = 20;
export const TYPES = {
  grass: { name: 'Planta', icon: '❧' }, fire: { name: 'Fogo', icon: '♨' },
  water: { name: 'Água', icon: '◈' }, electric: { name: 'Elétrico', icon: 'ϟ' },
  normal: { name: 'Normal', icon: '◎' }, bug: { name: 'Inseto', icon: '❋' },
};
export const SPECIES = {
  bulbasaur: { name: 'Bulbasaur', number: '001', type: 'grass', hp: 45, attack: 49, defense: 49, description: 'Um pequeno broto de grandes possibilidades.', personality: 'Leal & tranquilo', move: 'Chicote de Vinha', starter: true },
  charmander: { name: 'Charmander', number: '004', type: 'fire', hp: 39, attack: 52, defense: 43, description: 'Uma chama de coragem para iluminar a jornada.', personality: 'Corajoso & curioso', move: 'Brasa', starter: true },
  squirtle: { name: 'Squirtle', number: '007', type: 'water', hp: 44, attack: 48, defense: 65, description: 'Pronto para mergulhar em qualquer aventura.', personality: 'Gentil & determinado', move: 'Jato de Água', starter: true },
  pikachu: { name: 'Pikachu', number: '025', type: 'electric', hp: 35, attack: 55, defense: 40, move: 'Choque do Trovão' },
  caterpie: { name: 'Caterpie', number: '010', type: 'bug', hp: 45, attack: 30, defense: 35, move: 'Picada' },
  pidgey: { name: 'Pidgey', number: '016', type: 'normal', hp: 40, attack: 45, defense: 40, move: 'Investida' },
  oddish: { name: 'Oddish', number: '043', type: 'grass', hp: 45, attack: 50, defense: 55, move: 'Absorver' },
};
export const STARTERS = Object.keys(SPECIES).filter(id => SPECIES[id].starter);
export const WILD = ['caterpie', 'pidgey', 'oddish', 'pikachu'];
export function movesFor(pokemon) {
  const species = SPECIES[pokemon.species];
  return [
    { id: 'tackle', name: 'Investida', type: 'normal', power: 36, description: 'Um ataque direto e confiável.' },
    { id: 'element', name: species.move, type: species.type, power: 40, description: 'O poder natural do seu parceiro.' },
  ];
}
