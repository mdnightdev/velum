export default {
  schema: './server/v2/db/schema/index.ts',
  out: './server/v2/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL
  }
};
