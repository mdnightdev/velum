const fs = require('fs');
let testCode = fs.readFileSync('server/tests/auth.test.ts', 'utf8');

testCode = testCode.replace(
  "    validateCredentials: vi.fn(async (user, password) => {\n      return { isValid: password === 'a'.repeat(64) };\n    }),",
  `    validateCredentials: vi.fn(async (user, password) => {\n      return { isValid: password === 'a'.repeat(64) };\n    }),
    performUserLogin: vi.fn(async (params) => {
      if (params.passwordHex === 'a'.repeat(64)) {
        return {
          status: 'SUCCESS',
          user: { user_id: 1, username: 'existinguser' },
          profile: {},
          sessionId: 'mock-session-123',
          deviceId: 'dev_123',
          signedToken: 'mock-session-token-999'
        };
      }
      return { status: 'INVALID_CREDENTIALS' };
    }),`
);

fs.writeFileSync('server/tests/auth.test.ts', testCode);
console.log("Fixed test");
