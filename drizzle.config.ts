import 'dotenv/config';

const getCleanUrl = () => {
  const raw = (process.env.DATABASE_URL || process.env.CLOUD_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/velum').trim().replace(/\s+/g, '');
  let clean = raw.replace(/(&|\?)channel_binding=[^&]+/g, '').replace('-pooler', '');
  if (!clean.includes('uselibpqcompat=true')) {
    clean += (clean.includes('?') ? '&' : '?') + 'uselibpqcompat=true';
  }
  return clean;
};

export default {
  schema: './server/v2/db/schema/index.ts',
  out: './server/v2/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: getCleanUrl(),
    ssl: { rejectUnauthorized: false }
  }
};



