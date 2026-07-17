const fs = require('fs');
let code = fs.readFileSync('server/controllers/payments.ts', 'utf8');

const oldGen = `let formattedMaskedNumber = '';
    if (methodCategory === 'BANK') {
      const accNum = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
      formattedMaskedNumber = \\\`\\*\\*\\*\\* \\\${accNum.slice(-4)}\\\`;
    } else if (methodCategory === 'DEBIT') {
      let bin = '4242';
      if (institution === 'Mastercard') bin = '5100';
      else if (institution === 'UnionPay') bin = '6200';
      const lastFour = Math.floor(Math.random() * 9000 + 1000).toString();
      formattedMaskedNumber = \\\`\\\${bin} \\*\\*\\*\\* \\*\\*\\*\\* \\\${lastFour}\\\`;
    } else {
      const lastFour = Math.floor(Math.random() * 9000 + 1000).toString();
      formattedMaskedNumber = \\\`4829 \\*\\*\\*\\* \\*\\*\\*\\* \\\${lastFour}\\\`;
    }`;

const newGen = `let formattedMaskedNumber = '';
    if (methodCategory === 'BANK') {
      const accNum = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
      formattedMaskedNumber = \`**** \${accNum.slice(-4)}\`;
    } else if (methodCategory === 'DEBIT') {
      let bin = '4242';
      if (institution === 'Mastercard') bin = '5100';
      else if (institution === 'UnionPay') bin = '6200';
      else if (institution === 'Discover') bin = '6011';
      else if (institution === 'JCB') bin = '3528';
      else if (institution === 'Maestro') bin = '5018';
      const lastFour = Math.floor(Math.random() * 9000 + 1000).toString();
      formattedMaskedNumber = \`\${bin} **** **** \${lastFour}\`;
    } else {
      let bin = '4829'; // Velum
      if (institution === 'American Express') bin = '3782';
      else if (institution === 'Capital One') bin = '4417';
      else if (institution === 'Chase Sapphire') bin = '4147';
      const lastFour = Math.floor(Math.random() * 9000 + 1000).toString();
      if (institution === 'American Express') {
         formattedMaskedNumber = \`\${bin} ****** *\${lastFour.slice(-3)}\`;
      } else {
         formattedMaskedNumber = \`\${bin} **** **** \${lastFour}\`;
      }
    }`;

// Doing it with regex instead since literal replacement might fail on backticks
const regex = /let formattedMaskedNumber = '';[\s\S]*?formattedMaskedNumber = `4829 \*\*\*\* \*\*\*\* \$\{lastFour\}`;[\s\n]*\}/;
code = code.replace(regex, newGen);
fs.writeFileSync('server/controllers/payments.ts', code);
