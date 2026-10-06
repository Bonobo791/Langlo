import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  openFixtureDatabase,
  type FixtureTarget
} from '../src/lib/server/db/connection';
import { migrateFixtureDatabase } from '../src/lib/server/db/migrate';
import { createSourceId } from '../src/lib/server/db/source-id';
import {
  createDisposableFixture,
  disposeDisposableFixture
} from './fixtures/database';
import { seedStudy } from './fixtures/study';

let target: FixtureTarget;
const identity = {
  ownerId: 'learner-a',
  language: 'fr',
  skillId: 'fr-articles',
  canonicalMistake: 'indefinite-article-gender'
};
beforeEach(async () => {
  target = await createDisposableFixture();
  await migrateFixtureDatabase(target);
  await seedStudy(target);
});
afterEach(async () => {
  await disposeDisposableFixture(target);
});

/** Build an approved synthetic card insert with deliberate owner/source overrides for real constraint tests. */
function insertCard(
  id: string,
  ownerId = identity.ownerId,
  sourceId = createSourceId({ ...identity, ownerId })
) {
  return {
    sql: 'INSERT INTO card_drafts (id, owner_id, language, skill_id, canonical_mistake, source_id, format, state, fields_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
    args: [
      id,
      ownerId,
      'fr',
      identity.skillId,
      identity.canonicalMistake,
      sourceId,
      'cloze',
      'approved',
      '{"text":"un livre"}'
    ]
  };
}

describe('persistent delivery identity', () => {
  it.each([
    "retry_count='nonnumeric'",
    'retry_count=1.5',
    "state='claimed', claim_token='token', claimed_at=1.5, claim_expires_at=3"
  ])(
    'rejects non-integral delivery counters or timestamps: %s',
    async (update) => {
      const { client, close } = await openFixtureDatabase(target);
      try {
        await client.execute(insertCard('card-a'));
        await client.execute({
          sql: "INSERT INTO deliveries (id, owner_id, card_draft_id, language, source_id, confirmed_profile, confirmed_deck) VALUES ('delivery-a', 'learner-a', 'card-a', 'fr', ?, 'Synthetic profile', 'Langlo::French')",
          args: [createSourceId(identity)]
        });
        await expect(
          client.execute(
            `UPDATE deliveries SET ${update} WHERE id='delivery-a'`
          )
        ).rejects.toThrow(/integer/i);
      } finally {
        close();
      }
    }
  );
  it('rejects retargeting a delivery to a rejected card and preserves its SourceID', async () => {
    const { client, close } = await openFixtureDatabase(target);
    const original = createSourceId(identity);
    const different = createSourceId({
      ...identity,
      canonicalMistake: 'other-mistake'
    });
    try {
      await client.execute(insertCard('card-a'));
      await client.execute({
        sql: "INSERT INTO card_drafts (id, owner_id, language, skill_id, canonical_mistake, source_id, format, state, fields_json) VALUES ('card-rejected', 'learner-a', 'fr', 'fr-articles', 'other-mistake', ?, 'cloze', 'rejected', '{}')",
        args: [different]
      });
      await client.execute({
        sql: "INSERT INTO deliveries (id, owner_id, card_draft_id, language, source_id, confirmed_profile, confirmed_deck) VALUES ('delivery-a', 'learner-a', 'card-a', 'fr', ?, 'Synthetic profile', 'Langlo::French')",
        args: [original]
      });
      await expect(
        client.execute({
          sql: "UPDATE deliveries SET card_draft_id='card-rejected', source_id=? WHERE id='delivery-a'",
          args: [different]
        })
      ).rejects.toThrow(/immutable/i);
      expect(
        (
          await client.execute(
            "SELECT card_draft_id, source_id FROM deliveries WHERE id='delivery-a'"
          )
        ).rows
      ).toEqual([{ card_draft_id: 'card-a', source_id: original }]);
      await client.execute(
        "UPDATE card_drafts SET state='rejected' WHERE id='card-a'"
      );
      await expect(
        client.execute(
          "UPDATE deliveries SET state='claimed', claim_token='token', claimed_at=1, claim_expires_at=2 WHERE id='delivery-a'"
        )
      ).rejects.toThrow(/approved/i);
    } finally {
      close();
    }
  });
  it('is deterministic, bounded, unambiguous and separates owners/languages/skills/mistakes', () => {
    const original = createSourceId(identity);
    expect(original).toMatch(/^langlo:v1:[a-f0-9]{64}$/);
    expect(createSourceId({ ...identity })).toBe(original);
    for (const field of [
      'ownerId',
      'language',
      'skillId',
      'canonicalMistake'
    ] as const) {
      expect(
        createSourceId({ ...identity, [field]: `${identity[field]}different` })
      ).not.toBe(original);
    }
    expect(
      createSourceId({
        ownerId: 'a:b',
        language: 'fr',
        skillId: 'c',
        canonicalMistake: 'd'
      })
    ).not.toBe(
      createSourceId({
        ownerId: 'a',
        language: 'fr',
        skillId: 'b:c',
        canonicalMistake: 'd'
      })
    );
  });

  it('rejects empty or unbounded canonical identity fields', () => {
    expect(() => createSourceId({ ...identity, ownerId: '' })).toThrow(
      /identity/i
    );
    expect(() =>
      createSourceId({ ...identity, canonicalMistake: ' '.repeat(3) })
    ).toThrow(/identity/i);
    expect(() =>
      createSourceId({ ...identity, canonicalMistake: 'x'.repeat(4097) })
    ).toThrow(/identity/i);
  });

  it('concurrent duplicate inserts through independent local clients create one card identity', async () => {
    const connections = await Promise.all(
      Array.from({ length: 4 }, () => openFixtureDatabase(target))
    );
    try {
      const results = await Promise.all(
        connections.map(({ client }, index) =>
          client.execute(insertCard(`duplicate-${index}`))
        )
      );
      expect(
        results.reduce((count, result) => count + result.rowsAffected, 0)
      ).toBe(1);
      const rows = (
        await connections[0].client.execute(
          'SELECT owner_id, source_id FROM card_drafts'
        )
      ).rows;
      expect(rows).toEqual([
        { owner_id: identity.ownerId, source_id: createSourceId(identity) }
      ]);
      await connections[0].client.execute(
        insertCard('other-owner', 'learner-b')
      );
      expect(
        (
          await connections[0].client.execute(
            'SELECT count(*) AS count FROM card_drafts'
          )
        ).rows[0].count
      ).toBe(2);
    } finally {
      connections.forEach(({ close }) => close());
    }
  });

  it.each(['draft', 'rejected'])(
    'refuses delivery before learner approval for a %s card',
    async (state) => {
      const { client, close } = await openFixtureDatabase(target);
      try {
        await client.execute(insertCard('card-a'));
        await client.execute({
          sql: "UPDATE card_drafts SET state=? WHERE id='card-a'",
          args: [state]
        });
        await expect(
          client.execute({
            sql: "INSERT INTO deliveries (id, owner_id, card_draft_id, language, source_id, confirmed_profile, confirmed_deck) VALUES ('delivery-a', 'learner-a', 'card-a', 'fr', ?, 'Synthetic profile', 'Langlo::French')",
            args: [createSourceId(identity)]
          })
        ).rejects.toThrow(/approved/i);
        expect((await client.execute('SELECT * FROM deliveries')).rows).toEqual(
          []
        );
      } finally {
        close();
      }
    }
  );

  it('rejects incomplete claim leases and preserves the immutable canonical card identity', async () => {
    const { client, close } = await openFixtureDatabase(target);
    const sourceId = createSourceId(identity);
    try {
      await client.execute(insertCard('card-a'));
      await client.execute({
        sql: "INSERT INTO deliveries (id, owner_id, card_draft_id, language, source_id, confirmed_profile, confirmed_deck) VALUES ('delivery-a', 'learner-a', 'card-a', 'fr', ?, 'Synthetic profile', 'Langlo::French')",
        args: [sourceId]
      });
      await expect(
        client.execute(
          "UPDATE deliveries SET state='claimed', claim_token='claim', claimed_at=100 WHERE id='delivery-a'"
        )
      ).rejects.toThrow(/CHECK/i);
      await expect(
        client.execute(
          "UPDATE card_drafts SET canonical_mistake='changed-identity' WHERE id='card-a'"
        )
      ).rejects.toThrow(/immutable/i);
    } finally {
      close();
    }
  });

  it('retains SourceID across format edits and retries and rejects cross-owner delivery relations', async () => {
    const { client, close } = await openFixtureDatabase(target);
    const sourceId = createSourceId(identity);
    try {
      await client.execute(insertCard('card-a'));
      await client.execute(
        'UPDATE card_drafts SET format=\'question-answer\', fields_json=\'{"front":"article?","back":"un"}\' WHERE id=\'card-a\''
      );
      await expect(
        client.execute({
          sql: "INSERT INTO deliveries (id, owner_id, card_draft_id, language, source_id, confirmed_profile, confirmed_deck) VALUES ('forged', 'learner-b', 'card-a', 'fr', ?, 'Wrong profile', 'Wrong deck')",
          args: [sourceId]
        })
      ).rejects.toThrow(/FOREIGN KEY/i);
      await client.execute({
        sql: "INSERT INTO deliveries (id, owner_id, card_draft_id, language, source_id, confirmed_profile, confirmed_deck) VALUES ('delivery-a', 'learner-a', 'card-a', 'fr', ?, 'Synthetic profile', 'Langlo::French')",
        args: [sourceId]
      });
      await expect(
        client.execute({
          sql: "INSERT INTO deliveries (id, owner_id, card_draft_id, language, source_id, confirmed_profile, confirmed_deck) VALUES ('retry', 'learner-a', 'card-a', 'fr', ?, 'Synthetic profile', 'Langlo::French')",
          args: [sourceId]
        })
      ).rejects.toThrow(/UNIQUE/i);
      await client.execute(
        "UPDATE deliveries SET state='claimed', claim_token='synthetic-claim', claimed_at=100, claim_expires_at=200 WHERE id='delivery-a'"
      );
      await client.execute(
        "UPDATE deliveries SET state='pending', claim_token=NULL, claimed_at=NULL, claim_expires_at=NULL, retry_count=retry_count+1 WHERE id='delivery-a'"
      );
      expect(
        (await client.execute('SELECT source_id, retry_count FROM deliveries'))
          .rows
      ).toEqual([{ source_id: sourceId, retry_count: 1 }]);
      expect(
        (await client.execute('SELECT source_id FROM card_drafts')).rows[0]
          .source_id
      ).toBe(sourceId);
      await expect(
        client.execute(
          "UPDATE deliveries SET state='delivered' WHERE id='delivery-a'"
        )
      ).rejects.toThrow(/CHECK/i);
    } finally {
      close();
    }
  });
});
