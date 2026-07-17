async function test() {
  const loginRes = await fetch('http://127.0.0.1:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'CLI', password: 'VELUM-SYS-OP-901', duress: false })
  });
  const loginData = await loginRes.json();
  const token = loginData.sessionId;
  
  if (!token) {
     console.log('Login failed', loginData);
     return;
  }

  const res = await fetch('http://127.0.0.1:3000/api/payments/methods', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ methodType: 'CARD', institution: 'Visa', methodCategory: 'DEBIT' })
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.json());

  const res2 = await fetch('http://127.0.0.1:3000/api/payments/methods', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ methodType: 'CARD', institution: 'Velum Black', methodCategory: 'CREDIT' })
  });
  console.log('Status2:', res2.status);
  console.log('Body2:', await res2.json());

}
test();
