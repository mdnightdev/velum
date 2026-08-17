const fs = require('fs');
let code = fs.readFileSync('src/services/doubleRatchetService.ts', 'utf8');

const clearCode = `
  public clearMemoryState(): void {
    this.conversationStates.clear();
    this.localIdentityKeyPair = null;
    this.localSignedPrekeyPair = null;
    this.localOneTimePrekeys = [];
  }
`;

if (!code.includes('clearMemoryState')) {
  // Add it before getMacKey or anywhere
  code = code.replace(
    /private async getMacKey/g,
    clearCode + '\n  private async getMacKey'
  );
  fs.writeFileSync('src/services/doubleRatchetService.ts', code);
}
