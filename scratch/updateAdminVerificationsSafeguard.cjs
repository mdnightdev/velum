const fs = require('fs');
let code = fs.readFileSync('src/components/AdminVerificationView.tsx', 'utf8');

const replacement = `
  const loadVerificationQueue = async () => {
    try {
      setLoading(true);
      const sId = sessionStorage.getItem('velum-sessionId');
      const res = await fetch('/api/admin/verifications', {
        headers: { 'Authorization': \`Bearer \${sId}\` }
      });
      if (res.ok) {
        try {
          const data = await res.json();
          setListings(Array.isArray(data) ? data : []);
        } catch (e) {
          setListings([]);
        }
      }
      
      const dRes = await fetch('/api/marketplace/support-chats', {
        headers: { 'Authorization': \`Bearer \${sId}\` }
      });
      if (dRes.ok) {
        try {
          const dData = await dRes.json();
          setDisputes(Array.isArray(dData) ? dData : []);
        } catch (e) {
          setDisputes([]);
        }
      }
    } catch (e) {
      console.error('Failed to load verification queue', e.message, e.stack);
    } finally {
      setLoading(false);
    }
  };
`;

code = code.replace(/const loadVerificationQueue = async \(\) => \{[\s\S]*?finally \{\n      setLoading\(false\);\n    \}\n  \};/, replacement.trim());
fs.writeFileSync('src/components/AdminVerificationView.tsx', code);
