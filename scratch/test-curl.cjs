const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/bank/accounts',
  method: 'GET',
  headers: {
    // Wait, the API requires a session token in a cookie.
    // Let's bypass it by checking the code.
  }
};
