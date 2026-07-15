const fs = require('fs');
let code = fs.readFileSync('server/controllers/marketplace.ts', 'utf8');

// Add imports
code = code.replace(
  "import { walletRepository } from '../db/walletRepository.js';",
  "import { walletRepository } from '../db/walletRepository.js';\nimport { processCreateEscrow, processReleaseEscrow, processRevertEscrow, processResolveDispute } from '../services/marketplaceService.js';"
);

// Replace createEscrow
code = code.replace(
  /export const createEscrow = async \(req: Request, res: Response\) => \{[\s\S]*?res\.json\(enrichEscrow\(newEscrow\)\);\n  \} catch \(err: any\) \{\n    console\.error\('Error initiating escrow hold:', err\);\n    res\.status\(500\)\.json\(\{ error: 'Failed to open escrow hold\.' \}\);\n  \}\n\};/,
  `export const createEscrow = async (req: Request, res: Response) => {
  try {
    const { listingId, couponCode, skuVariantId } = req.body;
    const user = (req as any).user;
    if (!listingId) {
      return res.status(400).json({ error: 'Listing identity is required.' });
    }
    loadDb();
    
    const result = await processCreateEscrow(listingId, user.user_id, user.username, couponCode, skuVariantId);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    saveDb();
    res.json(enrichEscrow(result.escrow!));
  } catch (err: any) {
    console.error('Error initiating escrow hold:', err);
    res.status(500).json({ error: 'Failed to open escrow hold.' });
  }
};`
);

// Replace releaseEscrow
code = code.replace(
  /export const releaseEscrow = async \(req: Request, res: Response\) => \{[\s\S]*?res\.json\(enrichEscrow\(finalEscrow\)\);\n  \} catch \(err: any\) \{\n    console\.error\('Error releasing escrow capital:', err\);\n    res\.status\(500\)\.json\(\{ error: 'Failed to release capital hold\.' \}\);\n  \}\n\};/,
  `export const releaseEscrow = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const user = (req as any).user;
    loadDb();
    
    const result = await processReleaseEscrow(transactionId, user.user_id, false);
    if (!result.success) {
      // For some of these, we were returning 404 or 403. We can just use 400 for generic error or parse it.
      if (result.error?.includes('not located')) return res.status(404).json({ error: result.error });
      if (result.error?.includes('Forbidden')) return res.status(403).json({ error: result.error });
      return res.status(400).json({ error: result.error });
    }
    
    saveDb();
    res.json(enrichEscrow(result.escrow!));
  } catch (err: any) {
    console.error('Error releasing escrow capital:', err);
    res.status(500).json({ error: 'Failed to release capital hold.' });
  }
};`
);

// Replace revertEscrow
code = code.replace(
  /export const revertEscrow = async \(req: Request, res: Response\) => \{[\s\S]*?res\.json\(enrichEscrow\(finalEsc\)\);\n  \} catch \(err\) \{\n    res\.status\(500\)\.json\(\{ error: 'Escrow reversion state exception\.' \}\);\n  \}\n\};/,
  `export const revertEscrow = async (req: Request, res: Response) => {
  try {
    const { transactionId } = req.params;
    const user = (req as any).user;
    loadDb();
    
    const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';
    const result = await processRevertEscrow(transactionId, user.user_id, isAdmin);
    
    if (!result.success) {
      if (result.error?.includes('not found')) return res.status(404).json({ error: result.error });
      if (result.error?.includes('Unauthorized')) return res.status(403).json({ error: result.error });
      return res.status(400).json({ error: result.error });
    }
    
    saveDb();
    res.json(enrichEscrow(result.escrow!));
  } catch (err) {
    res.status(500).json({ error: 'Escrow reversion state exception.' });
  }
};`
);

// Replace resolveSupportChatDispute
code = code.replace(
  /export const resolveSupportChatDispute = async \(req: Request, res: Response\) => \{[\s\S]*?res\.json\(\{ success: true, chat, escrow: marketRepository\.findEscrowById\(escrow\.transaction_id\) \}\);\n  \} catch \(err\) \{\n    console\.error\('Error in resolveSupportChatDispute:', err\);\n    res\.status\(500\)\.json\(\{ error: 'Failed to resolve dispute\.' \}\);\n  \}\n\};/,
  `export const resolveSupportChatDispute = async (req: Request, res: Response) => {
  try {
    const { chatId } = req.params;
    const { resolution, penalty_applied_to } = req.body;
    const user = (req as any).user;
    
    const isAdmin = user.role === 'CLI_ADMIN' || user.role === 'LOGIN_ADMIN' || user.role === 'SUPPORT_ADMIN';
    if (!isAdmin) {
      return res.status(403).json({ error: 'Restricted: Only Velum administrators can resolve active disputes.' });
    }
    
    loadDb();
    const result = await processResolveDispute(chatId, resolution, penalty_applied_to, user.user_id, user.username);
    
    if (!result.success) {
      if (result.error?.includes('not found')) return res.status(404).json({ error: result.error });
      return res.status(400).json({ error: result.error });
    }
    
    // processResolveDispute already called saveDb() but we can call it again or not
    res.json({ success: true, chat: result.chat, escrow: result.escrow });
  } catch (err) {
    console.error('Error in resolveSupportChatDispute:', err);
    res.status(500).json({ error: 'Failed to resolve dispute.' });
  }
};`
);

fs.writeFileSync('server/controllers/marketplace.ts', code);
console.log("Updated marketplace.ts");
