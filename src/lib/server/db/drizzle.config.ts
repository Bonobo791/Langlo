import { defineConfig } from 'drizzle-kit';

// Generation only: no URL, auth token or ambient production environment.
export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite'
});
