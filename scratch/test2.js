async function test() {
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'CLI', password: 'VELUM-SYS-OP-901', duress: false })
  });
  const loginData = await loginRes.json();
  console.log('Login:', loginData);
  const token = loginData.sessionId;
  
  if (!token) return;
  const res = await fetch('http://127.0.0.1:3000/api/admin/verifications', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  console.log('Verifications status:', res.status);
  const text = await res.text();
  console.log(text.substring(0, 100));
}
test();
