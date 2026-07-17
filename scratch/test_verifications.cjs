const fetch = require('node-fetch');

async function test() {
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passcode: 'VELUM-SYS-OP-901' })
  });
  const loginData = await loginRes.json();
  const token = loginData.sessionId;
  
  const res = await fetch('http://127.0.0.1:3000/api/admin/verifications', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
