import { registerHooks } from 'node:module';

// Regression harness: SQL-only fixture seed must never initialize the ORM/schema graph.
registerHooks({
  load(url, context, nextLoad) {
    if (
      url.includes('/node_modules/drizzle-orm/') ||
      url.endsWith('/src/lib/server/db/schema.ts')
    ) {
      throw new Error(
        'SQL-only fixture command unexpectedly loaded ORM or full schema'
      );
    }
    return nextLoad(url, context);
  }
});
