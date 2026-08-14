const fs = require('fs');
const file = 'src/components/Auth/hooks/useAuthForm.ts';
let code = fs.readFileSync(file, 'utf8');

const restoreAccountOrig = `    try {
      const saltRes = await fetch(\`/v2/auth/recovery-salt?username=\${encodeURIComponent(recoveryUsername.trim())}\`);
      if (!saltRes.ok) {
        setAuthError('Authentication failed: Missing credentials.');
        return;
      }
      const { salt } = await saltRes.json();
      if (!salt) {
        setAuthError('Authentication failed: Invalid credentials.');
        return;
      }

      const hashedRecoveryKey = await computeClientHash(recoveryCodeInput.trim(), salt);

      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      const newSalt = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');

      const hashedPassword = await computeClientHash(recoveryNewPassword.trim(), newSalt);
      const hashedSafeWord = await computeClientHash(recoverySafeWord.trim(), newSalt);

      const res = await fetch('/v2/auth/restore-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          safeWord: hashedSafeWord,
          recoveryKey: hashedRecoveryKey,
          newPassword: hashedPassword,
          salt: newSalt,
        }),
      });`;

const restoreAccountNew = `    try {
      const res = await fetch('/v2/auth/restore-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: recoveryUsername.trim(),
          safeWord: recoverySafeWord.trim(),
          recoveryKey: recoveryCodeInput.trim(),
          newPassword: recoveryNewPassword.trim(),
        }),
      });`;

const redeemCodeOrig = `    try {
      const saltRes = await fetch(\`/v2/auth/recovery-salt?username=\${encodeURIComponent(redeemUsername.trim())}\`);
      if (!saltRes.ok) {
        setAuthError('Authentication failed: Invalid parameters.');
        return;
      }
      const { salt } = await saltRes.json();
      if (!salt) {
        setAuthError('Authentication failed: Invalid credentials.');
        return;
      }

      const hashedPassword = await computeClientHash(redeemNewPassword.trim(), salt);

      const res = await fetch('/v2/auth/redeem-restore-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: redeemUsername.trim(),
          restoreCode: redeemCode.trim(),
          newPassword: hashedPassword
        })
      });`;

const redeemCodeNew = `    try {
      const res = await fetch('/v2/auth/redeem-restore-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: redeemUsername.trim(),
          restoreCode: redeemCode.trim(),
          newPassword: redeemNewPassword.trim()
        })
      });`;

code = code.replace(restoreAccountOrig, restoreAccountNew);
code = code.replace(redeemCodeOrig, redeemCodeNew);

fs.writeFileSync(file, code, 'utf8');
console.log('Patched correctly');
