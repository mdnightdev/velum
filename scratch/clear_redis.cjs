const { createClient } = require('redis');
async function clear() {
  const client = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
  await client.connect();
  await client.del('bank:accounts');
  console.log('Cleared bank:accounts');
  process.exit(0);
}
clear();
