import { afterEach, describe, expect, it } from 'vitest';
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
        db.client.execute(
          'DELETE FROM native_flashcard_review_events WHERE owner_id = ? AND id = ?',
          [learner.userId, review.submissionId]
        )
      ).rejects.toThrow(/append-only/i);

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
});
