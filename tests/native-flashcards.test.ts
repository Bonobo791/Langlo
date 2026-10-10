import { afterEach, describe, expect, it } from 'vitest';
import { createEmptyCard, fsrs, generatorParameters, Rating } from 'ts-fsrs';
import { migrateFixtureDatabase } from '../src/lib/server/db/migrate';
import { openFixtureDatabase } from '../src/lib/server/db/connection';
import {
  approveNote,
  createDeck,
  createNote,
  getNote,
  submitReview,
  type LearnerSession
} from '../src/lib/server/flashcards';
import {
  createDisposableFixture,
  disposeDisposableFixture
} from './fixtures/database';
import type { FixtureTarget } from '../src/lib/server/db/fixture-target';
import { seedStudy } from './fixtures/study';

const fixtures: FixtureTarget[] = [];
afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(disposeDisposableFixture));
});

async function fixture() {
  const target = await createDisposableFixture();
  fixtures.push(target);
  await migrateFixtureDatabase(target);
  await seedStudy(target);
  return target;
}

// These contexts stand in for a verified identity in tests only. Production auth is not implemented.
const testSession = (userId: string): LearnerSession => ({ userId });

describe('native flashcard persistence feasibility', () => {
  it('persists an approved Basic note across fresh test sessions and scopes it to its owner', async () => {
    const target = await fixture();
    const ownerA = testSession('learner-a');
    const ownerB = testSession('learner-b');
    const first = await openFixtureDatabase(target);
    try {
      await createDeck(first.client, ownerA, {
        id: 'deck-10000000-0000-4000-8000-000000000001',
        name: 'French'
      });
      await createNote(first.client, ownerA, {
        id: 'note-10000000-0000-4000-8000-000000000001',
        sourceId: 'source-10000000-0000-4000-8000-000000000001',
        deckId: 'deck-10000000-0000-4000-8000-000000000001',
        kind: 'basic',
        content: { front: 'Bonjour', back: 'Hello' }
      });
      await approveNote(
        first.client,
        ownerA,
        'note-10000000-0000-4000-8000-000000000001'
      );
    } finally {
      first.close();
    }

    const second = await openFixtureDatabase(target);
    const ownerAReloaded = testSession(ownerA.userId);
    try {
      await expect(
        getNote(
          second.client,
          ownerAReloaded,
          'note-10000000-0000-4000-8000-000000000001'
        )
      ).resolves.toMatchObject({
        id: 'note-10000000-0000-4000-8000-000000000001',
        status: 'approved',
        content: { front: 'Bonjour', back: 'Hello' }
      });
      const firstReview = await submitReview(second.client, ownerAReloaded, {
        cardId: 'card:note-10000000-0000-4000-8000-000000000001',
        submissionId: 'review-10000000-0000-4000-8000-000000000008',
        expectedRevision: 0,
        rating: 'good'
      });
      expect(firstReview.revision).toBe(1);
      await expect(
        getNote(
          second.client,
          ownerAReloaded,
          'note-10000000-0000-4000-8000-000000000001'
        )
      ).resolves.toMatchObject({ card: { revision: 1 } });
      await expect(
        getNote(
          second.client,
          ownerB,
          'note-10000000-0000-4000-8000-000000000001'
        )
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    } finally {
      second.close();
    }
  });

  it('counts supplementary-plane card text as Unicode code points at the storage limit', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    const supplementaryCharacter = '𐐷';
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000010',
        name: 'French'
      });
      await expect(
        createNote(db.client, learner, {
          id: 'note-10000000-0000-4000-8000-000000000010',
          sourceId: 'source-10000000-0000-4000-8000-000000000010',
          deckId: 'deck-10000000-0000-4000-8000-000000000010',
          kind: 'basic',
          content: {
            front: supplementaryCharacter.repeat(4096),
            back: 'valid'
          }
        })
      ).resolves.toMatchObject({ status: 'draft' });
      await expect(
        createNote(db.client, learner, {
          id: 'note-10000000-0000-4000-8000-000000000011',
          sourceId: 'source-10000000-0000-4000-8000-000000000011',
          deckId: 'deck-10000000-0000-4000-8000-000000000010',
          kind: 'basic',
          content: {
            front: supplementaryCharacter.repeat(4097),
            back: 'valid'
          }
        })
      ).rejects.toMatchObject({ code: 'INVALID_CONTENT' });

      await expect(
        createNote(db.client, learner, {
          id: 'note-10000000-0000-4000-8000-000000000012',
          sourceId: 'source-10000000-0000-4000-8000-000000000012',
          deckId: 'deck-10000000-0000-4000-8000-000000000010',
          kind: 'cloze',
          content: {
            text: `{{c1::${supplementaryCharacter.repeat(4088)}}}`
          }
        })
      ).resolves.toMatchObject({ status: 'draft' });
      await expect(
        createNote(db.client, learner, {
          id: 'note-10000000-0000-4000-8000-000000000013',
          sourceId: 'source-10000000-0000-4000-8000-000000000013',
          deckId: 'deck-10000000-0000-4000-8000-000000000010',
          kind: 'cloze',
          content: {
            text: `{{c1::${supplementaryCharacter.repeat(4089)}}}`
          }
        })
      ).rejects.toMatchObject({ code: 'INVALID_CONTENT' });
    } finally {
      db.close();
    }
  });

  it('requires approval and persists a real FSRS review exactly once, rejecting a stale revision', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000002',
        name: 'French'
      });
      const note = await createNote(db.client, learner, {
        id: 'note-10000000-0000-4000-8000-000000000002',
        sourceId: 'source-10000000-0000-4000-8000-000000000002',
        deckId: 'deck-10000000-0000-4000-8000-000000000002',
        kind: 'basic',
        content: { front: 'Merci', back: 'Thank you' }
      });
      await expect(
        submitReview(db.client, learner, {
          cardId: note.cardId,
          submissionId: 'review-10000000-0000-4000-8000-000000000001',
          expectedRevision: 0,
          rating: 'good'
        })
      ).rejects.toMatchObject({ code: 'NOT_APPROVED' });

      await approveNote(db.client, learner, note.id);
      const submittedAt = Date.now();
      const review = {
        cardId: note.cardId,
        submissionId: 'review-10000000-0000-4000-8000-000000000001',
        expectedRevision: 0,
        rating: 'good' as const
      };
      const first = await submitReview(db.client, learner, review);
      const retry = await submitReview(db.client, learner, review);
      expect(retry).toMatchObject({
        duplicate: true,
        revision: first.revision
      });
      await expect(
        submitReview(db.client, learner, { ...review, rating: 'easy' })
      ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' });
      expect(
        (
          await db.client.execute(
            'SELECT count(*) AS count FROM native_flashcard_review_events WHERE owner_id = ? AND reviewed_at BETWEEN ? AND ?',
            [learner.userId, submittedAt, Date.now()]
          )
        ).rows[0].count
      ).toBe(1);
      expect(
        (
          await db.client.execute(
            'SELECT count(*) AS count FROM native_flashcard_review_events WHERE owner_id = ?',
            [learner.userId]
          )
        ).rows[0].count
      ).toBe(1);
      await expect(
        submitReview(db.client, learner, {
          ...review,
          submissionId: 'review-10000000-0000-4000-8000-000000000002',
          expectedRevision: 0,
          rating: 'again'
        })
      ).rejects.toMatchObject({ code: 'STALE_REVIEW' });
      await expect(
        db.client.execute({
          sql: 'UPDATE native_flashcard_review_events SET rating = ? WHERE owner_id = ? AND id = ?',
          args: ['again', learner.userId, review.submissionId]
        })
      ).rejects.toThrow(/cannot be updated/i);
      await expect(
        db.client.execute(
          'DELETE FROM native_flashcard_review_events WHERE owner_id = ? AND id = ?',
          [learner.userId, review.submissionId]
        )
      ).rejects.toThrow(/cannot be deleted/i);
      await db.client.execute('PRAGMA recursive_triggers = OFF');
      await expect(
        db.client.execute({
          sql: 'INSERT OR REPLACE INTO native_flashcard_review_events (id, owner_id, card_id, expected_revision, rating, reviewed_at, scheduler_version, parameters_json, result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [
            review.submissionId,
            learner.userId,
            note.cardId,
            0,
            'easy',
            submittedAt + 1,
            'ts-fsrs@5.4.2',
            '{}',
            '{}'
          ]
        })
      ).rejects.toThrow(/cannot be replaced/i);
      await expect(
        db.client.execute({
          sql: 'INSERT OR REPLACE INTO native_flashcard_review_events (rowid, id, owner_id, card_id, expected_revision, rating, reviewed_at, scheduler_version, parameters_json, result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [
            1,
            'review-10000000-0000-4000-8000-000000000099',
            learner.userId,
            note.cardId,
            0,
            'easy',
            submittedAt + 2,
            'ts-fsrs@5.4.2',
            '{}',
            '{}'
          ]
        })
      ).rejects.toThrow(/rowid|column/i);
      expect(
        (
          await db.client.execute(
            'SELECT rating FROM native_flashcard_review_events WHERE owner_id = ? AND id = ?',
            [learner.userId, review.submissionId]
          )
        ).rows[0].rating
      ).toBe('good');

      const persisted = await getNote(db.client, learner, note.id);
      expect(persisted.card).toMatchObject({
        revision: 1,
        schedulerVersion: 'ts-fsrs@5.4.2'
      });
      expect(persisted.card.dueAt).toBeGreaterThan(submittedAt);
    } finally {
      db.close();
    }
  });

  it('rejects another learner review attempts without changing the owner’s card or grammar evidence', async () => {
    const target = await fixture();
    const ownerA = testSession('learner-a');
    const ownerB = testSession('learner-b');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, ownerA, {
        id: 'deck-10000000-0000-4000-8000-000000000003',
        name: 'French'
      });
      const note = await createNote(db.client, ownerA, {
        id: 'note-10000000-0000-4000-8000-000000000003',
        sourceId: 'source-10000000-0000-4000-8000-000000000003',
        deckId: 'deck-10000000-0000-4000-8000-000000000003',
        kind: 'basic',
        content: { front: 'Au revoir', back: 'Goodbye' }
      });
      await approveNote(db.client, ownerA, note.id);
      const evidenceBefore = (
        await db.client.execute(
          'SELECT * FROM skill_evidence WHERE owner_id = ? ORDER BY id',
          [ownerA.userId]
        )
      ).rows;
      await expect(getNote(db.client, ownerB, note.id)).rejects.toMatchObject({
        code: 'NOT_FOUND'
      });
      await expect(
        submitReview(db.client, ownerB, {
          cardId: note.cardId,
          submissionId: 'review-10000000-0000-4000-8000-000000000003',
          expectedRevision: 0,
          rating: 'easy'
        })
      ).rejects.toMatchObject({ code: 'NOT_FOUND' });
      expect(
        (
          await db.client.execute(
            'SELECT * FROM skill_evidence WHERE owner_id = ? ORDER BY id',
            [ownerA.userId]
          )
        ).rows
      ).toEqual(evidenceBefore);
      expect((await getNote(db.client, ownerA, note.id)).card.revision).toBe(0);
    } finally {
      db.close();
    }
  });

  it('accepts only one of two concurrent reviews submitted against the same revision', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000006',
        name: 'French'
      });
      const note = await createNote(db.client, learner, {
        id: 'note-10000000-0000-4000-8000-000000000006',
        sourceId: 'source-10000000-0000-4000-8000-000000000006',
        deckId: 'deck-10000000-0000-4000-8000-000000000006',
        kind: 'basic',
        content: { front: 'Oui', back: 'Yes' }
      });
      await approveNote(db.client, learner, note.id);
      const common = {
        cardId: note.cardId,
        expectedRevision: 0
      };
      const results = await Promise.allSettled([
        submitReview(db.client, learner, {
          ...common,
          submissionId: 'review-10000000-0000-4000-8000-000000000006',
          rating: 'good'
        }),
        submitReview(db.client, learner, {
          ...common,
          submissionId: 'review-10000000-0000-4000-8000-000000000007',
          rating: 'hard'
        })
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled')
      ).toHaveLength(1);
      expect(
        results.filter((result) => result.status === 'rejected')
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === 'rejected')
      ).toMatchObject({
        reason: { code: 'STALE_REVIEW' }
      });
      expect((await getNote(db.client, learner, note.id)).card.revision).toBe(
        1
      );
      expect(
        (
          await db.client.execute(
            'SELECT count(*) AS count FROM native_flashcard_review_events WHERE owner_id = ?',
            [learner.userId]
          )
        ).rows[0].count
      ).toBe(1);
    } finally {
      db.close();
    }
  });

  it('stores one restricted Cloze card per note and rejects unsupported Cloze syntax', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000004',
        name: 'French'
      });
      const note = await createNote(db.client, learner, {
        id: 'note-10000000-0000-4000-8000-000000000004',
        sourceId: 'source-10000000-0000-4000-8000-000000000004',
        deckId: 'deck-10000000-0000-4000-8000-000000000004',
        kind: 'cloze',
        content: { text: '{{c1::je}} {{c1::suis}} prêt.' }
      });
      await approveNote(db.client, learner, note.id);
      expect(note.cardId).toBeTruthy();
      await expect(
        createNote(db.client, learner, {
          id: 'note-10000000-0000-4000-8000-000000000005',
          sourceId: 'source-10000000-0000-4000-8000-000000000005',
          deckId: 'deck-10000000-0000-4000-8000-000000000004',
          kind: 'cloze',
          content: { text: '{{c1::je}} {{c2::suis}} prêt.' }
        })
      ).rejects.toMatchObject({ code: 'INVALID_CLOZE' });
      const reloaded = await openFixtureDatabase(target);
      const learnerReloaded = testSession(learner.userId);
      try {
        await submitReview(reloaded.client, learnerReloaded, {
          cardId: note.cardId,
          submissionId: 'review-10000000-0000-4000-8000-000000000009',
          expectedRevision: 0,
          rating: 'again'
        });
        await expect(
          getNote(reloaded.client, learnerReloaded, note.id)
        ).resolves.toMatchObject({
          status: 'approved',
          card: { revision: 1, schedulerVersion: 'ts-fsrs@5.4.2' }
        });
      } finally {
        reloaded.close();
      }
    } finally {
      db.close();
    }
  });

  it('erases reviewed cards and their history when the owner is deleted', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000007',
        name: 'French'
      });
      const note = await createNote(db.client, learner, {
        id: 'note-10000000-0000-4000-8000-000000000007',
        sourceId: 'source-10000000-0000-4000-8000-000000000007',
        deckId: 'deck-10000000-0000-4000-8000-000000000007',
        kind: 'basic',
        content: { front: 'Bonjour', back: 'Hello' }
      });
      await approveNote(db.client, learner, note.id);
      await submitReview(db.client, learner, {
        cardId: note.cardId,
        submissionId: 'review-10000000-0000-4000-8000-000000000010',
        expectedRevision: 0,
        rating: 'good'
      });

      await expect(
        db.client.execute('DELETE FROM users WHERE id = ?', [learner.userId])
      ).resolves.toBeDefined();
      for (const table of [
        'native_flashcard_decks',
        'native_flashcard_notes',
        'native_flashcards',
        'native_flashcard_review_events'
      ]) {
        expect(
          (
            await db.client.execute(
              `SELECT count(*) AS count FROM ${table} WHERE owner_id = ?`,
              [learner.userId]
            )
          ).rows[0].count
        ).toBe(0);
      }
    } finally {
      db.close();
    }
  });

  it('uses each card’s persisted FSRS parameters when scheduling and recording reviews', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000008',
        name: 'French'
      });
      const note = await createNote(db.client, learner, {
        id: 'note-10000000-0000-4000-8000-000000000008',
        sourceId: 'source-10000000-0000-4000-8000-000000000008',
        deckId: 'deck-10000000-0000-4000-8000-000000000008',
        kind: 'basic',
        content: { front: 'Bonjour', back: 'Hello' }
      });
      const cardParameters = generatorParameters({
        learning_steps: ['1d'],
        relearning_steps: ['1d']
      });
      await db.client.execute(
        'UPDATE native_flashcards SET parameters_json = ? WHERE id = ? AND owner_id = ?',
        [JSON.stringify(cardParameters), note.cardId, learner.userId]
      );
      await approveNote(db.client, learner, note.id);
      const submissionId = 'review-10000000-0000-4000-8000-000000000011';
      const result = await submitReview(db.client, learner, {
        cardId: note.cardId,
        submissionId,
        expectedRevision: 0,
        rating: 'good'
      });
      const event = (
        await db.client.execute(
          'SELECT reviewed_at, parameters_json FROM native_flashcard_review_events WHERE owner_id = ? AND id = ?',
          [learner.userId, submissionId]
        )
      ).rows[0];
      expect(JSON.parse(String(event.parameters_json))).toEqual(cardParameters);
      const reviewedAt = new Date(Number(event.reviewed_at));
      const expectedDue = fsrs(cardParameters)
        .next(createEmptyCard(reviewedAt), reviewedAt, Rating.Good)
        .card.due.getTime();
      const defaultDue = fsrs()
        .next(createEmptyCard(reviewedAt), reviewedAt, Rating.Good)
        .card.due.getTime();
      expect(result.dueAt).toBe(expectedDue);
      expect(result.dueAt).not.toBe(defaultDue);
    } finally {
      db.close();
    }
  });

  it('rejects cards written by an unsupported scheduler version without changing them', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000009',
        name: 'French'
      });
      const note = await createNote(db.client, learner, {
        id: 'note-10000000-0000-4000-8000-000000000009',
        sourceId: 'source-10000000-0000-4000-8000-000000000009',
        deckId: 'deck-10000000-0000-4000-8000-000000000009',
        kind: 'basic',
        content: { front: 'Bonjour', back: 'Hello' }
      });
      await approveNote(db.client, learner, note.id);
      await db.client.execute(
        'UPDATE native_flashcards SET scheduler_version = ? WHERE id = ? AND owner_id = ?',
        ['ts-fsrs@unsupported', note.cardId, learner.userId]
      );

      await expect(
        submitReview(db.client, learner, {
          cardId: note.cardId,
          submissionId: 'review-10000000-0000-4000-8000-000000000012',
          expectedRevision: 0,
          rating: 'good'
        })
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_SCHEDULER_VERSION' });
      await db.client.execute(
        'UPDATE native_flashcards SET scheduler_version = ?, parameters_json = ? WHERE id = ? AND owner_id = ?',
        ['ts-fsrs@5.4.2', '{}', note.cardId, learner.userId]
      );
      await expect(
        submitReview(db.client, learner, {
          cardId: note.cardId,
          submissionId: 'review-10000000-0000-4000-8000-000000000013',
          expectedRevision: 0,
          rating: 'good'
        })
      ).rejects.toMatchObject({ code: 'INVALID_SCHEDULER_STATE' });
      await expect(getNote(db.client, learner, note.id)).resolves.toMatchObject(
        {
          card: { revision: 0, schedulerVersion: 'ts-fsrs@5.4.2' }
        }
      );
      expect(
        (
          await db.client.execute(
            'SELECT count(*) AS count FROM native_flashcard_review_events WHERE card_id = ?',
            [note.cardId]
          )
        ).rows[0].count
      ).toBe(0);
    } finally {
      db.close();
    }
  });

  it('validates Basic and Cloze discriminants and bounds stored text sizes', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000010',
        name: 'French'
      });
      await expect(
        createNote(db.client, learner, {
          id: 'note-10000000-0000-4000-8000-000000000010',
          sourceId: 'source-10000000-0000-4000-8000-000000000010',
          deckId: 'deck-10000000-0000-4000-8000-000000000010',
          kind: 'basic',
          content: { text: '{{c1::bonjour}}' }
        } as unknown as Parameters<typeof createNote>[2])
      ).rejects.toMatchObject({ code: 'INVALID_CONTENT' });
      await expect(
        createNote(db.client, learner, {
          id: 'note-10000000-0000-4000-8000-000000000011',
          sourceId: 'source-10000000-0000-4000-8000-000000000011',
          deckId: 'deck-10000000-0000-4000-8000-000000000010',
          kind: 'cloze',
          content: { front: 'Bonjour', back: 'Hello' }
        } as unknown as Parameters<typeof createNote>[2])
      ).rejects.toMatchObject({ code: 'INVALID_CONTENT' });
      await expect(
        createNote(db.client, learner, {
          id: 'note-10000000-0000-4000-8000-000000000013',
          sourceId: 'source-10000000-0000-4000-8000-000000000013',
          deckId: 'deck-10000000-0000-4000-8000-000000000010',
          kind: 'cloze',
          content: { text: `{{c1::${'x'.repeat(4090)}}}` }
        })
      ).rejects.toMatchObject({ code: 'INVALID_CONTENT' });

      await expect(
        db.client.execute({
          sql: 'INSERT INTO native_flashcard_notes (id, source_id, owner_id, deck_id, kind, content_json) VALUES (?, ?, ?, ?, ?, ?)',
          args: [
            'note-10000000-0000-4000-8000-000000000015',
            'source-10000000-0000-4000-8000-000000000015',
            learner.userId,
            'deck-10000000-0000-4000-8000-000000000010',
            'basic',
            JSON.stringify({ front: 'Hello', back: 'Bonjour', extra: 'x' })
          ]
        })
      ).rejects.toThrow(/CHECK|CONSTRAINT/i);
      await expect(
        db.client.execute({
          sql: 'INSERT INTO native_flashcard_notes (id, source_id, owner_id, deck_id, kind, content_json) VALUES (?, ?, ?, ?, ?, ?)',
          args: [
            'note-10000000-0000-4000-8000-000000000019',
            'source-10000000-0000-4000-8000-000000000019',
            learner.userId,
            'deck-10000000-0000-4000-8000-000000000010',
            'basic',
            JSON.stringify({ front: '\t\n\u00a0\ufeff', back: 'Hello' })
          ]
        })
      ).rejects.toThrow(/CHECK|CONSTRAINT/i);
      await expect(
        db.client.execute({
          sql: 'INSERT INTO native_flashcard_notes (id, source_id, owner_id, deck_id, kind, content_json) VALUES (?, ?, ?, ?, ?, ?)',
          args: [
            'note-10000000-0000-4000-8000-000000000016',
            'source-10000000-0000-4000-8000-000000000016',
            learner.userId,
            'deck-10000000-0000-4000-8000-000000000010',
            'basic',
            JSON.stringify({ front: 'x'.repeat(4097), back: 'Hello' })
          ]
        })
      ).rejects.toThrow(/CHECK|CONSTRAINT/i);
    } finally {
      db.close();
    }
  });

  it('rejects oversized Basic text before attempting persistence', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000013',
        name: 'French'
      });
      await expect(
        createNote(db.client, learner, {
          id: 'note-10000000-0000-4000-8000-000000000018',
          sourceId: 'source-10000000-0000-4000-8000-000000000018',
          deckId: 'deck-10000000-0000-4000-8000-000000000013',
          kind: 'basic',
          content: { front: 'x'.repeat(4097), back: 'y' }
        })
      ).rejects.toMatchObject({ code: 'INVALID_CONTENT' });
    } finally {
      db.close();
    }
  });

  it('rejects empty review submission identifiers before scheduling', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000011',
        name: 'French'
      });
      const note = await createNote(db.client, learner, {
        id: 'note-10000000-0000-4000-8000-000000000014',
        sourceId: 'source-10000000-0000-4000-8000-000000000014',
        deckId: 'deck-10000000-0000-4000-8000-000000000011',
        kind: 'basic',
        content: { front: 'Bonjour', back: 'Hello' }
      });
      await approveNote(db.client, learner, note.id);
      await expect(
        submitReview(db.client, learner, {
          cardId: note.cardId,
          submissionId: '   ',
          expectedRevision: 0,
          rating: 'good'
        })
      ).rejects.toMatchObject({ code: 'INVALID_SUBMISSION_ID' });
      await expect(
        db.client.execute({
          sql: 'INSERT INTO native_flashcard_review_events (id, owner_id, card_id, expected_revision, rating, reviewed_at, scheduler_version, parameters_json, result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          args: [
            '\t\n\u00a0\ufeff',
            learner.userId,
            note.cardId,
            0,
            'good',
            Date.now(),
            'ts-fsrs@5.4.2',
            '{}',
            '{}'
          ]
        })
      ).rejects.toThrow(/CHECK|CONSTRAINT/i);
      expect((await getNote(db.client, learner, note.id)).card.revision).toBe(
        0
      );
    } finally {
      db.close();
    }
  });

  it('reports malformed persisted card JSON as a stable flashcard error', async () => {
    const target = await fixture();
    const learner = testSession('learner-a');
    const db = await openFixtureDatabase(target);
    try {
      await createDeck(db.client, learner, {
        id: 'deck-10000000-0000-4000-8000-000000000012',
        name: 'French'
      });
      const note = await createNote(db.client, learner, {
        id: 'note-10000000-0000-4000-8000-000000000017',
        sourceId: 'source-10000000-0000-4000-8000-000000000017',
        deckId: 'deck-10000000-0000-4000-8000-000000000012',
        kind: 'basic',
        content: { front: 'Bonjour', back: 'Hello' }
      });
      await db.client.execute('PRAGMA ignore_check_constraints = ON');
      await db.client.execute(
        "UPDATE native_flashcards SET state_json = 'not-json' WHERE id = ? AND owner_id = ?",
        [note.cardId, learner.userId]
      );
      await db.client.execute('PRAGMA ignore_check_constraints = OFF');

      await expect(getNote(db.client, learner, note.id)).rejects.toMatchObject({
        code: 'INVALID_CARD_STATE'
      });
    } finally {
      db.close();
    }
  });
});
