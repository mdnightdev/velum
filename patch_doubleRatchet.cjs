const fs = require('fs');

let content = fs.readFileSync('src/services/doubleRatchetService.ts', 'utf8');

// 1. Add imports
content = content.replace(
  "import { saveSkippedMessageKey, consumeSkippedMessageKey } from './skippedKeysStore';",
  "import { saveSkippedMessageKey, consumeSkippedMessageKey } from './skippedKeysStore';\nimport { saveLocalKeysToDb, loadLocalKeysFromDb, saveConversationStateToDb, loadConversationStateFromDb } from './cryptoDbStore';"
);

// 2. Modify initializeLocalKeys
const oldInit = `  async initializeLocalKeys(): Promise<void> {
    try {
      const subtle = window.crypto.subtle;

      // Generate long-term identity key
      this.localIdentityKeyPair = await subtle.generateKey(`;

const newInit = `  async initializeLocalKeys(): Promise<void> {
    try {
      const existingKeys = await loadLocalKeysFromDb();
      if (existingKeys) {
        this.localIdentityKeyPair = existingKeys.identityKeyPair;
        this.localSignedPrekeyPair = existingKeys.signedPrekeyPair;
        this.localOneTimePrekeys = existingKeys.oneTimePrekeys;
        console.log('[DoubleRatchet] Loaded local keys from IndexedDB.');
        
        // Ensure they are re-uploaded or the backend knows we exist?
        // Let's just return to avoid overwriting keys.
        // wait, we should upload bundle just in case backend restarted.
        await this.uploadPrekeyBundle();
        return;
      }
      const subtle = window.crypto.subtle;

      // Generate long-term identity key
      this.localIdentityKeyPair = await subtle.generateKey(`;

content = content.replace(oldInit, newInit);

// 3. Save local keys after generation
const oldUpload = `      // Upload bundle to server
      await this.uploadPrekeyBundle();
    } catch (err) {`;

const newUpload = `      // Save to IndexedDB
      await saveLocalKeysToDb(this.localIdentityKeyPair, this.localSignedPrekeyPair, this.localOneTimePrekeys);

      // Upload bundle to server
      await this.uploadPrekeyBundle();
    } catch (err) {`;
content = content.replace(oldUpload, newUpload);

// 4. Update state writes to save to DB
content = content.replace(
  /this\.conversationStates\.set\(peerUserId, state\);/g,
  "this.conversationStates.set(peerUserId, state);\n      saveConversationStateToDb(peerUserId, state).catch(e => console.error(e));"
);

// 5. Update state reads to check DB if not in map
const oldGet = `    // Get or initialize conversation state
    let state = this.conversationStates.get(peerUserId);
    if (!state) {
      // Perform X3DH handshake`;

const newGet = `    // Get or initialize conversation state
    let state = this.conversationStates.get(peerUserId);
    if (!state) {
      state = await loadConversationStateFromDb(peerUserId);
      if (state) {
        this.conversationStates.set(peerUserId, state);
      }
    }
    if (!state) {
      // Perform X3DH handshake`;
content = content.replace(oldGet, newGet);

const oldGetDec = `    // Get or initialize conversation state
    let state = this.conversationStates.get(peerUserId);
    if (!state) {
      // For incoming messages, we need to perform X3DH as receiver`;
const newGetDec = `    // Get or initialize conversation state
    let state = this.conversationStates.get(peerUserId);
    if (!state) {
      state = await loadConversationStateFromDb(peerUserId);
      if (state) {
        this.conversationStates.set(peerUserId, state);
      }
    }
    if (!state) {
      // For incoming messages, we need to perform X3DH as receiver`;

content = content.replace(oldGetDec, newGetDec);


fs.writeFileSync('src/services/doubleRatchetService.ts', content);
