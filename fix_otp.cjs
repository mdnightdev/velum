const fs = require('fs');

let cryptoSvc = fs.readFileSync('server/services/cryptoService.ts', 'utf8');
const otpStart = cryptoSvc.indexOf('export function getStepOTP');
if (otpStart !== -1) {
  cryptoSvc = cryptoSvc.substring(0, otpStart);
  fs.writeFileSync('server/services/cryptoService.ts', cryptoSvc);
  console.log("OTP removed from cryptoService.");
}

let authCtrl = fs.readFileSync('server/controllers/auth.ts', 'utf8');
authCtrl = authCtrl.replace(`checkStepOTP,\n  getStepOTP\n} from '../services/cryptoService.js';`, `} from '../services/cryptoService.js';\nimport { checkStepOTP, getStepOTP } from '../services/otpService.js';`);
fs.writeFileSync('server/controllers/auth.ts', authCtrl);
console.log("Updated auth.ts");

// update auth.test.ts
let authTest = fs.readFileSync('server/tests/auth.test.ts', 'utf8');
authTest = authTest.replace(`checkStepOTP } from '../services/cryptoService.js';`, `checkStepOTP } from '../services/otpService.js';`);
fs.writeFileSync('server/tests/auth.test.ts', authTest);
console.log("Updated auth.test.ts");
