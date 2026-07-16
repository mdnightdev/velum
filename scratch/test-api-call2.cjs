const http = require('http');
const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/bank/accounts',
  method: 'GET'
}, (res) => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    console.log("STATUS:", res.statusCode);
    console.log("BODY:", body);
  });
});
req.on('error', console.error);
req.end();
