import { createInterface } from 'node:readline';
import { openFixtureClient } from '../../src/lib/server/db/connection.ts';
import { createSourceId } from '../../src/lib/server/db/source-id.ts';

const [fixtureRoot, databaseUrl, proposedId, ownerId, canonicalMistake] =
  process.argv.slice(2);
const { client, close } = await openFixtureClient({
  fixtureRoot,
  databaseUrl
});
const lines = createInterface({ input: process.stdin });
try {
  console.log(JSON.stringify({ event: 'ready', pid: process.pid }));
  for await (const line of lines) {
    if (line !== 'release') throw new Error('Invalid fixture barrier');
    const sourceId = createSourceId({
      ownerId,
      language: 'fr',
      skillId: 'fr-articles',
      canonicalMistake
    });
    const result = await client.execute({
      sql: 'INSERT INTO card_drafts (id, owner_id, language, skill_id, canonical_mistake, source_id, format, state, fields_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
      args: [
        proposedId,
        ownerId,
        'fr',
        'fr-articles',
        canonicalMistake,
        sourceId,
        'cloze',
        'approved',
        '{}'
      ]
    });
    console.log(
      JSON.stringify({
        event: 'completed',
        pid: process.pid,
        rowsAffected: result.rowsAffected,
        sourceId
      })
    );
    break;
  }
} finally {
  lines.close();
  process.stdin.destroy();
  close();
}
