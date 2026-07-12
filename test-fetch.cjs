const http = require('http');

const fetchUrl = (url) => {
  return new Promise((resolve) => {
    http.get(url, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
  });
};

(async () => {
  const main = await fetchUrl('http://localhost:3000/src/main.tsx');
  console.log("main.tsx status:", main.statusCode);
  
  // Extract imports
  const imports = main.body.match(/import (.*?) from ['"](.*?)['"]/g);
  if(imports) {
    for (const imp of imports) {
      const match = imp.match(/from ['"](.*?)['"]/);
      if (match) {
        const url = 'http://localhost:3000' + match[1];
        const res = await fetchUrl(url);
        console.log("Fetched", url, res.statusCode);
        if (res.statusCode !== 200 && res.statusCode !== 304) {
          console.error("FAILED TO FETCH:", url);
        }
      }
    }
  }
})();
