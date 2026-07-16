const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/verify',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const parsed = JSON.parse(data);
    const token = parsed.token;
    console.log("Token:", token ? "Got it" : "none");
    if (token) {
        const req2 = http.request({
            hostname: 'localhost', port: 3000, path: '/api/admin/cli/exec', method: 'POST',
            headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
        }, (res2) => {
            let data2 = '';
            res2.on('data', chunk => data2 += chunk);
            res2.on('end', () => console.log('CLI out:', data2));
        });
        req2.write(JSON.stringify({ adminId: 1, command: 'fund 1000000 "System seed"' }));
        req2.end();
    }
  });
});

req.write(JSON.stringify({ passcode: "14002" })); 
req.end();
