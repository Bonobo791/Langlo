import {
  createEmptyCard,
  fsrs,
  checkParameters,
  generatorParameters,
  Rating,
  type Card,
  type Grade,
  type FSRSParameters
} from 'ts-fsrs';
import type { Client } from '@libsql/client';

export interface LearnerSession {
  userId: string;
}

type BasicContent = { front: string; back: string };
type ClozeContent = { text: string };
type Content = BasicContent | ClozeContent;
type CreateNoteInput = {
  id: string;
  sourceId: string;
  deckId: string;
} & (
  | { kind: 'basic'; content: BasicContent }
  | { kind: 'cloze'; content: ClozeContent }
);
type RatingName = 'again' | 'hard' | 'good' | 'easy';

const schedulerVersion = 'ts-fsrs@5.4.2';
const parameters = generatorParameters();
const maxCardTextLength = 4096;
const ratings: Record<RatingName, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy
};

async function beginWrite(client: Client) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await client.transaction('write');
    } catch (error) {
      if ((error as { code?: string }).code !== 'SQLITE_BUSY' || attempt === 7)
        throw error;
      await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1)));
    }
  }
}

export class FlashcardError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateContent(kind: unknown, content: unknown): void {
  if (!isRecord(content)) throw new FlashcardError('INVALID_CONTENT');

  if (kind === 'basic') {
    if (
      Object.keys(content).length !== 2 ||
      typeof content.front !== 'string' ||
      typeof content.back !== 'string' ||
      !content.front.trim() ||
      !content.back.trim() ||
      content.front.length > maxCardTextLength ||
      content.back.length > maxCardTextLength
    )
      throw new FlashcardError('INVALID_CONTENT');
  } else if (kind === 'cloze') {
    if (
      Object.keys(content).length !== 1 ||
      typeof content.text !== 'string' ||
      !content.text.trim()
    )
      throw new FlashcardError('INVALID_CONTENT');
    if (content.text.length > maxCardTextLength)
      throw new FlashcardError('INVALID_CONTENT');
    const matches = content.text.match(/\{\{c1::[^{}]+\}\}/g) ?? [];
    if (
      !matches.length ||
      /\{\{c\d+::/.test(content.text.replace(/\{\{c1::[^{}]+\}\}/g, ''))
    ) {
      throw new FlashcardError('INVALID_CLOZE');
    }
  } else {
    throw new FlashcardError('INVALID_CONTENT');
  }
}

function readCardScheduler(
  version: unknown,
  serializedParameters: string
): { scheduler: ReturnType<typeof fsrs>; parameters: FSRSParameters } {
  if (version !== schedulerVersion)
    throw new FlashcardError('UNSUPPORTED_SCHEDULER_VERSION');

  let parsed: unknown;
  try {
    parsed = JSON.parse(serializedParameters);
  } catch {
    throw new FlashcardError('INVALID_SCHEDULER_STATE');
  }
  if (!isRecord(parsed)) throw new FlashcardError('INVALID_SCHEDULER_STATE');

  const {
    request_retention,
    maximum_interval,
    w,
    enable_fuzz,
    enable_short_term,
    learning_steps,
    relearning_steps
  } = parsed;
  if (
    typeof request_retention !== 'number' ||
    !Number.isFinite(request_retention) ||
    request_retention <= 0 ||
    request_retention > 1 ||
    typeof maximum_interval !== 'number' ||
    !Number.isFinite(maximum_interval) ||
    maximum_interval <= 0 ||
    !Array.isArray(w) ||
    ![17, 19, 21].includes(w.length) ||
    w.some(
      (weight) => typeof weight !== 'number' || !Number.isFinite(weight)
    ) ||
    typeof enable_fuzz !== 'boolean' ||
    typeof enable_short_term !== 'boolean' ||
    !Array.isArray(learning_steps) ||
    !learning_steps.every(
      (step) => typeof step === 'string' && /^\d+(?:m|h|d)$/.test(step)
    ) ||
    !Array.isArray(relearning_steps) ||
    !relearning_steps.every(
      (step) => typeof step === 'string' && /^\d+(?:m|h|d)$/.test(step)
    )
  ) {
    throw new FlashcardError('INVALID_SCHEDULER_STATE');
  }

  try {
    const stored = parsed as unknown as FSRSParameters;
    checkParameters(stored.w);
    const normalized = generatorParameters(stored);
    return { scheduler: fsrs(normalized), parameters: normalized };
  } catch {
    throw new FlashcardError('INVALID_SCHEDULER_STATE');
  }
}

function decodeCard(serialized: string): Card {
  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new FlashcardError('INVALID_CARD_STATE');
  }
  if (!isRecord(parsed) || typeof parsed.due !== 'string')
    throw new FlashcardError('INVALID_CARD_STATE');
  const card = parsed as unknown as Card & {
    due: string;
    last_review?: string;
  };
  const due = new Date(card.due);
  const lastReview = card.last_review ? new Date(card.last_review) : undefined;
  if (
    Number.isNaN(due.getTime()) ||
    (card.last_review !== undefined &&
      (typeof card.last_review !== 'string' ||
        Number.isNaN(lastReview?.getTime())))
  ) {
    throw new FlashcardError('INVALID_CARD_STATE');
  }
  return {
    ...card,
    due,
    last_review: lastReview
  };
}

function encodeCard(card: Card): string {
  return JSON.stringify(card);
}

function newCard(now = new Date()): Card {
  return createEmptyCard(now);
}

export async function createDeck(
  client: Client,
  session: LearnerSession,
  input: { id: string; name: string }
) {
  if (!input.name.trim() || input.name.length > 160)
    throw new FlashcardError('INVALID_DECK');
  await client.execute({
    sql: 'INSERT INTO native_flashcard_decks (id, owner_id, name) VALUES (?, ?, ?)',
    args: [input.id, session.userId, input.name]
  });
}

export async function createNote(
  client: Client,
  session: LearnerSession,
  input: CreateNoteInput
) {
  validateContent(input.kind, input.content);
  const cardId = `card:${input.id}`;
  const card = newCard();
  const now = card.due.getTime();
  const tx = await beginWrite(client);
  try {
    await tx.execute({
      sql: "INSERT INTO native_flashcard_notes (id, source_id, owner_id, deck_id, kind, content_json, status) VALUES (?, ?, ?, ?, ?, ?, 'draft')",
      args: [
        input.id,
        input.sourceId,
        session.userId,
        input.deckId,
        input.kind,
        JSON.stringify(input.content)
      ]
    });
    await tx.execute({
      sql: 'INSERT INTO native_flashcards (id, owner_id, note_id, state_json, due_at, scheduler_version, parameters_json) VALUES (?, ?, ?, ?, ?, ?, ?)',
      args: [
        cardId,
        session.userId,
        input.id,
        encodeCard(card),
        now,
        schedulerVersion,
        JSON.stringify(parameters)
      ]
    });
    await tx.commit();
    return { id: input.id, cardId, status: 'draft' as const };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

export async function approveNote(
  client: Client,
  session: LearnerSession,
  noteId: string
) {
  const result = await client.execute({
    sql: "UPDATE native_flashcard_notes SET status = 'approved' WHERE id = ? AND owner_id = ? AND status = 'draft'",
    args: [noteId, session.userId]
  });
  if (result.rowsAffected !== 1) throw new FlashcardError('NOT_FOUND');
}

export async function getNote(
  client: Client,
  session: LearnerSession,
  noteId: string
) {
  const result = await client.execute({
    sql: 'SELECT n.id, n.source_id, n.owner_id, n.deck_id, n.kind, n.content_json, n.status, c.id AS card_id, c.state_json, c.due_at, c.revision, c.suspended, c.scheduler_version, c.parameters_json FROM native_flashcard_notes n JOIN native_flashcards c ON c.note_id = n.id AND c.owner_id = n.owner_id WHERE n.id = ? AND n.owner_id = ?',
    args: [noteId, session.userId]
  });
  const row = result.rows[0];
  if (!row) throw new FlashcardError('NOT_FOUND');
  return {
    id: String(row.id),
    sourceId: String(row.source_id),
    ownerId: String(row.owner_id),
    deckId: String(row.deck_id),
    kind: String(row.kind),
    content: JSON.parse(String(row.content_json)) as Content,
    status: String(row.status),
    card: {
      id: String(row.card_id),
      state: decodeCard(String(row.state_json)),
      dueAt: Number(row.due_at),
      revision: Number(row.revision),
      suspended: Boolean(row.suspended),
      schedulerVersion: String(row.scheduler_version),
      parameters: JSON.parse(String(row.parameters_json)) as typeof parameters
    }
  };
}

export async function submitReview(
  client: Client,
  session: LearnerSession,
  input: {
    cardId: string;
    submissionId: string;
    expectedRevision: number;
    rating: RatingName;
  }
) {
  if (
    typeof input.submissionId !== 'string' ||
    input.submissionId.trim().length < 1 ||
    input.submissionId.length > 256
  ) {
    throw new FlashcardError('INVALID_SUBMISSION_ID');
  }
  const tx = await beginWrite(client);
  try {
    const previous = await tx.execute({
      sql: 'SELECT card_id, expected_revision, rating, reviewed_at, result_json FROM native_flashcard_review_events WHERE owner_id = ? AND id = ?',
      args: [session.userId, input.submissionId]
    });
    if (previous.rows[0]) {
      const row = previous.rows[0];
      if (
        row.card_id !== input.cardId ||
        Number(row.expected_revision) !== input.expectedRevision ||
        row.rating !== input.rating
      )
        throw new FlashcardError('IDEMPOTENCY_CONFLICT');
      await tx.commit();
      return {
        ...(JSON.parse(String(row.result_json)) as {
          revision: number;
          dueAt: number;
        }),
        duplicate: true
      };
    }

    const found = await tx.execute({
      sql: 'SELECT c.state_json, c.revision, c.scheduler_version, c.parameters_json, n.status FROM native_flashcards c JOIN native_flashcard_notes n ON n.id = c.note_id AND n.owner_id = c.owner_id WHERE c.id = ? AND c.owner_id = ?',
      args: [input.cardId, session.userId]
    });
    const cardRow = found.rows[0];
    if (!cardRow) throw new FlashcardError('NOT_FOUND');
    if (cardRow.status !== 'approved') throw new FlashcardError('NOT_APPROVED');
    if (Number(cardRow.revision) !== input.expectedRevision)
      throw new FlashcardError('STALE_REVIEW');

    const cardScheduler = readCardScheduler(
      cardRow.scheduler_version,
      String(cardRow.parameters_json)
    );

    const reviewedAt = new Date();
    const updated = cardScheduler.scheduler.next(
      decodeCard(String(cardRow.state_json)),
      reviewedAt,
      ratings[input.rating]
    ).card;
    const revision = input.expectedRevision + 1;
    const result = { revision, dueAt: updated.due.getTime() };
    const changed = await tx.execute({
      sql: 'UPDATE native_flashcards SET state_json = ?, due_at = ?, revision = ? WHERE id = ? AND owner_id = ? AND revision = ?',
      args: [
        encodeCard(updated),
        result.dueAt,
        revision,
        input.cardId,
        session.userId,
        input.expectedRevision
      ]
    });
    if (changed.rowsAffected !== 1) throw new FlashcardError('STALE_REVIEW');
    await tx.execute({
      sql: 'INSERT INTO native_flashcard_review_events (id, owner_id, card_id, expected_revision, rating, reviewed_at, scheduler_version, parameters_json, result_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        input.submissionId,
        session.userId,
        input.cardId,
        input.expectedRevision,
        input.rating,
        reviewedAt.getTime(),
        String(cardRow.scheduler_version),
        JSON.stringify(cardScheduler.parameters),
        JSON.stringify(result)
      ]
    });
    await tx.commit();
    return { ...result, duplicate: false };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}
