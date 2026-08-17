const fs = require('fs');
const file = 'src/hooks/useWebSocket.ts';
let code = fs.readFileSync(file, 'utf8');

const importStatement = `import { getLocalMessages, saveLocalMessages, rotateAndReEncryptLocalMessages } from '../utils/indexedDb';\nimport { LocalVaultEncryption } from '../services/localVaultEncryption';\n`;

code = code.replace(`import { getLocalMessages, saveLocalMessages } from '../utils/indexedDb';\n`, importStatement);

const rotationHook = `
  // Background Periodic Key Rotation for Message History Forward Secrecy
  useEffect(() => {
    if (!isAuthenticated) return;
    
    let isMounted = true;
    const runRotationCheck = async () => {
      try {
        const needsRotation = await LocalVaultEncryption.checkAndRotatePeriodically();
        if (needsRotation && isMounted) {
          console.log('[useWebSocket] Triggering periodic message history key rotation...');
          await rotateAndReEncryptLocalMessages();
        }
      } catch (err) {
        console.error('[useWebSocket] Rotation check failed:', err);
      }
    };

    runRotationCheck();
  }, [isAuthenticated]);
`;

const marker = `  const [wsConnected, setWsConnected] = useState(false);\n`;
code = code.replace(marker, marker + rotationHook);

fs.writeFileSync(file, code);
