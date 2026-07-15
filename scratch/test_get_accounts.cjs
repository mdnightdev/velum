const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('Login res:', data);
    const parsed = JSON.parse(data);
    const token = parsed.token;
    
    if (token) {
        const req2 = http.request({
            hostname: 'localhost', port: 3000, path: '/api/bank/accounts', method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token }
        }, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => console.log('Accounts:', data2));
        });
        req2.end();
    }
  });
});

// Assuming '14002' is the CLI admin code, or '4005' for support? The instructions say standard passcode. Let's try "77777777" or check auth routes for default passcodes.
req.write(JSON.stringify({ passcode: "14002" })); 
req.end();
