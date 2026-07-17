const fs = require('fs');
let code = fs.readFileSync('server/controllers/payments.ts', 'utf8');

const regex = /export const addPaymentMethod = async \(req: Request, res: Response\) => \{[\s\S]*?res\.status\(500\)\.json\(\{ error: 'Failed to record payment method\.' \}\);\n  \}\n\};/;

const replacement = `export const addPaymentMethod = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { methodType, institution, methodCategory, initialBalanceCents } = req.body;

    if (!methodType || !institution || !methodCategory) {
      return res.status(400).json({ error: 'Missing payment method details.' });
    }

    if (methodType !== 'CARD' && methodType !== 'BANK_ACCOUNT') {
      return res.status(400).json({ error: 'Invalid financial account class.' });
    }

    loadDb();
    db.external_financial_accounts = db.external_financial_accounts || [];
    db.payment_methods = db.payment_methods || [];

    const accountKind = methodCategory === 'BANK' ? 'BANK_ACCOUNT' : (methodCategory === 'DEBIT' ? 'DEBIT_CARD' : 'CREDIT_CARD');

    // Check limits (max 1 of each category)
    const existingAccounts = db.external_financial_accounts.filter(a => Number(a.user_id) === Number(user.user_id) && a.is_active);
    const existingOfKind = existingAccounts.find(a => a.account_kind === accountKind);
    if (existingOfKind) {
      return res.status(400).json({ error: \`You already have a \${methodCategory.toLowerCase()} linked. Maximum 1 allowed per user.\` });
    }

    // Generate realistic number
    let formattedMaskedNumber = '';
    if (methodCategory === 'BANK') {
      const accNum = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
      formattedMaskedNumber = \`**** \${accNum.slice(-4)}\`;
    } else if (methodCategory === 'DEBIT') {
      let bin = '4242';
      if (institution === 'Mastercard') bin = '5100';
      else if (institution === 'UnionPay') bin = '6200';
      const lastFour = Math.floor(Math.random() * 9000 + 1000).toString();
      formattedMaskedNumber = \`\${bin} **** **** \${lastFour}\`;
    } else {
      const lastFour = Math.floor(Math.random() * 9000 + 1000).toString();
      formattedMaskedNumber = \`4829 **** **** \${lastFour}\`;
    }

    const accountToken = \`tok_\${generateUlid()}\`;
    let startingBalance = initialBalanceCents ? Number(initialBalanceCents) : Math.floor(Math.random() * (10000 - 5000 + 1) + 5000) * 100;

    if (institution.includes("Velum")) {
      let maxBalance = 0;
      existingAccounts.forEach(a => {
        if (a.available_cents > maxBalance) maxBalance = a.available_cents;
      });
      const maxBalanceUSD = maxBalance / 100;
      let creditLimit = 500;
      if (institution.includes("Titanium")) creditLimit = 50000;
      else if (institution.includes("Black")) creditLimit = 15000;
      else if (institution.includes("Platinum")) creditLimit = 5000;
      startingBalance = creditLimit * 100;
    }

    const extAccount: ExternalFinancialAccount = {
      account_token: accountToken,
      user_id: Number(user.user_id),
      account_kind: accountKind,
      institution: institution,
      masked_number: formattedMaskedNumber,
      available_cents: startingBalance,
      expires_at_sim: methodType === 'CARD' ? (institution.includes("Velum") ? Date.now() + 31536000000 * 5 : Date.now() + 31536000000 * 3) : null,
      is_active: true,
      created_at: Date.now()
    };
    db.external_financial_accounts.push(extAccount);

    const methodId = \`pm_\${generateUlid()}\`;
    db.payment_methods.forEach(pm => {
      if (Number(pm.user_id) === Number(user.user_id)) {
        pm.is_default = false;
      }
    });

    const newMethod: PaymentMethod = {
      payment_method_id: methodId,
      user_id: user.user_id,
      method_type: methodType,
      external_account_token: accountToken,
      display_label: \`\${institution} \${formattedMaskedNumber}\`,
      is_default: true,
      status: 'ACTIVE',
      added_at: Date.now()
    };
    db.payment_methods.push(newMethod);

    saveDb(true);
    res.json({
      ...newMethod,
      method_id: newMethod.payment_method_id,
      institution: institution,
      masked_number: formattedMaskedNumber,
      external_balance_cents: startingBalance
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record payment method.' });
  }
};`;

code = code.replace(regex, replacement);
fs.writeFileSync('server/controllers/payments.ts', code);
