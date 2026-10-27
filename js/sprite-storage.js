// Images stay in this browser; they are never uploaded to GitHub or a server.
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
export const readSprite = () => access('readonly', store => store.get('charmander'));
export const writeSprite = record => access('readwrite', store => store.put(record, 'charmander'));
export const deleteSprite = () => access('readwrite', store => store.delete('charmander'));
