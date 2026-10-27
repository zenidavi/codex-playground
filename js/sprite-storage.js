import { STARTERS } from './data.js';

// Keep the original Charmander key and DB version so existing images survive.
// Images stay in this browser; they are never uploaded to GitHub or a server.
function speciesKey(species) {
  if (!STARTERS.includes(species)) throw new Error('Escolha um dos três Pokémon iniciais.');
  return species;
}
async function access(mode, operation) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('poketrilha-art', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('sheets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return new Promise((resolve, reject) => {
    let result;
    try {
      const transaction = db.transaction('sheets', mode);
      const request = operation(transaction.objectStore('sheets'));
      request.onsuccess = () => { result = request.result; };
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onerror = transaction.onabort = () => { db.close(); reject(transaction.error || new Error('Armazenamento indisponível')); };
    } catch (error) { db.close(); reject(error); }
  });
}
export const readSprite = (species = 'charmander') => {
  const key = speciesKey(species);
  return access('readonly', store => store.get(key));
};
export const writeSprite = (record, species = 'charmander') => {
  const key = speciesKey(species);
  return access('readwrite', store => store.put(record, key));
};
export const deleteSprite = (species = 'charmander') => {
  const key = speciesKey(species);
  return access('readwrite', store => store.delete(key));
};
