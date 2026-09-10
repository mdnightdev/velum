import { defineRailway, github, preserve, project, service } from "railway/iac";

export const partial = "velum";

export default defineRailway(() => {
  const velum = service("velum", {
    source: github("mdnightdev/velum", { branch: "main" }),
    build: {
      builder: "NIXPACKS",
      buildCommand: "npm run build",
    },
    start: "NODE_ENV=production node dist/server.cjs",
    healthcheck: "/v2/health",
    healthcheckTimeout: 120,
    deploy: {
      restartPolicyMaxRetries: 5,
    },
    env: {
      REDIS_URL: preserve(),
      DATABASE_URL: preserve(),
      NODE_ENV: preserve(),
      LOUNGE_ENCRYPTION_KEY: preserve(),
      DB_ENCRYPTION_KEY: preserve(),
      DB_ENCRYPTION_SALT: preserve(),
      JWT_SECRET: preserve(),
      HMAC_SECRET: preserve(),
      R2_ACCOUNT_ID: preserve(),
      R2_ACCESS_KEY_ID: preserve(),
      R2_SECRET_ACCESS_KEY: preserve(),
      R2_BUCKET_NAME: preserve(),
      R2_PUBLIC_URL: preserve(),
      VAPID_PUBLIC_KEY: preserve(),
      VAPID_PRIVATE_KEY: preserve(),
      VAPID_SUBJECT: preserve(),
      MIDNIGHT_PASSWORD: preserve(),
      MIDNIGHT_SAFE_WORD: preserve(),
      MIDNIGHT_PANIC_PHRASE: preserve(),
      MIDNIGHT_RECOVERY_KEY: preserve(),
      LEXIE_PASSWORD: preserve(),
      LEXIE_SAFE_WORD: preserve(),
      LEXIE_PANIC_PHRASE: preserve(),
      LEXIE_RECOVERY_KEY: preserve(),
      VITE_API_URL: preserve(),
      VITE_WS_URL: preserve(),
      APP_URL: preserve(),
      WEBAUTHN_ORIGIN: preserve(),
      WEBAUTHN_RP_ID: preserve(),
      ALLOWED_ORIGINS: preserve(),
      FIREBASE_SERVICE_ACCOUNT_JSON: preserve(),
    },
  });
  return project("velum", {
    resources: [velum],
  });
});
