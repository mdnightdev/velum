const fs = require('fs');
let code = fs.readFileSync('src/utils/indexedDb.ts', 'utf8');

const purgeCode = `
export function purgeLocalMessages(): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const db = await openDatabase();
      const tx = db.transaction([STORE_MESSAGES, STORE_MEDIA], 'readwrite');
      const storeMsgs = tx.objectStore(STORE_MESSAGES);
      const storeMedia = tx.objectStore(STORE_MEDIA);
      storeMsgs.clear();
      storeMedia.clear();
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    } catch (e) {
      reject(e);
    }
  });
}
`;

if (!code.includes('purgeLocalMessages')) {
  code += '\n' + purgeCode;
  fs.writeFileSync('src/utils/indexedDb.ts', code);
}
