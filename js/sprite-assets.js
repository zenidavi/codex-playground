// Original PNGs uploaded by the user. Hide the baked background only at runtime.
// Four columns; rows ordered down / left / right / up.
export const POKEMON_SHEETS = Object.freeze({
  bulbasaur: Object.freeze({ url: new URL('../assets/sprites/bulbasaur-walk.png', import.meta.url).href, hideBackground: true }),
  charmander: Object.freeze({ url: new URL('../assets/sprites/charmander-walk.png', import.meta.url).href, hideBackground: true }),
  squirtle: Object.freeze({ url: new URL('../assets/sprites/squirtle-walk.png', import.meta.url).href, hideBackground: true }),
});
