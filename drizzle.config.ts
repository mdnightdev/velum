import 'dotenv/config';

const defaultDbUrl = 'postgresql://neondb_owner:npg_7d1BLlsUWFRz@ep-silent-paper-azmc0w9y-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const getCleanUrl = () => {
  const raw = (process.env.DATABASE_URL || process.env.CLOUD_DATABASE_URL || defaultDbUrl).trim().replace(/\s+/g, '');
  return raw.replace(/(&|\?)channel_binding=[^&]+/g, '');
};

export default {
  schema: './server/v2/db/schema/index.ts',
  out: './server/v2/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: getCleanUrl()
  }
};


