import { defineEnvVars } from '@sveltejs/kit/env';

// All variables are dynamic and private. Validation happens at the request boundary.
export const variables = defineEnvVars({
  APP_ENV: { schema: (value) => value },
  APP_ORIGIN: { schema: (value) => value },
  DATA_ENABLED: { schema: (value) => value },
  DATABASE_URL: { schema: (value) => value },
  TURSO_AUTH_TOKEN: { schema: (value) => value },
  APP_BUILD_SHA: { schema: (value) => value }
});
