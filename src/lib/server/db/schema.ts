import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';

const createdAt = () =>
  integer('created_at')
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

// Identity only. T010 selects and adds maintained auth-library tables and fields.
export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    createdAt: createdAt()
  },
  (table) => [check('users_id_nonempty', sql`length(trim(${table.id})) > 0`)]
);

export const enrollments = sqliteTable(
  'enrollments',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    language: text('language', { enum: ['fr', 'de', 'en'] }).notNull(),
    startingLevel: text('starting_level', { enum: ['A1', 'A2'] }).notNull(),
    explanationLanguage: text('explanation_language', {
      enum: ['en', 'pt']
    }).notNull(),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex('enrollments_owner_language_unique').on(
      table.ownerId,
      table.language
    ),
    uniqueIndex('enrollments_identity_owner_language').on(
      table.id,
      table.ownerId,
      table.language
    ),
    check('enrollments_language', sql`${table.language} IN ('fr', 'de', 'en')`),
    check('enrollments_level', sql`${table.startingLevel} IN ('A1', 'A2')`),
    check(
      'enrollments_explanation',
      sql`${table.explanationLanguage} IN ('en', 'pt')`
    )
  ]
);

export const skills = sqliteTable(
  'skills',
  {
    id: text('id').primaryKey(),
    language: text('language', { enum: ['fr', 'de', 'en'] }).notNull(),
    level: text('level', { enum: ['A1', 'A2'] }).notNull()
  },
  (table) => [
    uniqueIndex('skills_identity_language').on(table.id, table.language),
    check('skills_language', sql`${table.language} IN ('fr', 'de', 'en')`),
    check('skills_level', sql`${table.level} IN ('A1', 'A2')`)
  ]
);

export const prerequisites = sqliteTable(
  'prerequisites',
  {
    skillId: text('skill_id').notNull(),
    prerequisiteId: text('prerequisite_id').notNull(),
    language: text('language').notNull()
  },
  (table) => [
    primaryKey({ columns: [table.skillId, table.prerequisiteId] }),
    foreignKey({
      columns: [table.skillId, table.language],
      foreignColumns: [skills.id, skills.language]
    }),
    foreignKey({
      columns: [table.prerequisiteId, table.language],
      foreignColumns: [skills.id, skills.language]
    }),
    check(
      'prerequisites_not_self',
      sql`${table.skillId} <> ${table.prerequisiteId}`
    )
  ]
);

export const contentVersions = sqliteTable(
  'content_versions',
  {
    id: text('id').primaryKey(),
    skillId: text('skill_id').notNull(),
    language: text('language').notNull(),
    version: integer('version').notNull(),
    status: text('status', {
      enum: [
        'draft',
        'reference-checked',
        'schema-validated',
        'pilot-ready',
        'quarantined'
      ]
    })
      .notNull()
      .default('draft'),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex('content_versions_skill_version').on(
      table.skillId,
      table.version
    ),
    uniqueIndex('content_versions_identity_skill_language').on(
      table.id,
      table.skillId,
      table.language
    ),
    foreignKey({
      columns: [table.skillId, table.language],
      foreignColumns: [skills.id, skills.language]
    }),
    // Migration 0002 additionally enforces SQLite integer storage type and safe range.
    // Keep hand-authored triggers when generating future table rebuilds.
    check('content_versions_positive', sql`${table.version} > 0`),
    check(
      'content_versions_status',
      sql`${table.status} IN ('draft', 'reference-checked', 'schema-validated', 'pilot-ready', 'quarantined')`
    )
  ]
);

export const questions = sqliteTable(
  'questions',
  {
    id: text('id').primaryKey(),
    contentVersionId: text('content_version_id').notNull(),
    skillId: text('skill_id').notNull(),
    language: text('language').notNull(),
    format: text('format', {
      enum: ['multiple-choice', 'typed-blank', 'translation', 'correction']
    }).notNull()
  },
  (table) => [
    uniqueIndex('questions_identity_version_skill_language').on(
      table.id,
      table.contentVersionId,
      table.skillId,
      table.language
    ),
    foreignKey({
      columns: [table.contentVersionId, table.skillId, table.language],
      foreignColumns: [
        contentVersions.id,
        contentVersions.skillId,
        contentVersions.language
      ]
    }),
    check(
      'questions_format',
      sql`${table.format} IN ('multiple-choice', 'typed-blank', 'translation', 'correction')`
    )
  ]
);

export const studySessions = sqliteTable(
  'study_sessions',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    enrollmentId: text('enrollment_id').notNull(),
    language: text('language').notNull(),
    mode: text('mode', {
      enum: ['practice', 'assessment', 'mixed-review']
    }).notNull(),
    state: text('state', { enum: ['active', 'paused', 'completed'] })
      .notNull()
      .default('active'),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex('study_sessions_identity_owner_language').on(
      table.id,
      table.ownerId,
      table.language
    ),
    foreignKey({
      columns: [table.enrollmentId, table.ownerId, table.language],
      foreignColumns: [
        enrollments.id,
        enrollments.ownerId,
        enrollments.language
      ]
    }).onDelete('cascade'),
    index('study_sessions_owner_state').on(table.ownerId, table.state),
    check(
      'study_sessions_mode',
      sql`${table.mode} IN ('practice', 'assessment', 'mixed-review')`
    ),
    check(
      'study_sessions_state',
      sql`${table.state} IN ('active', 'paused', 'completed')`
    )
  ]
);

export const attempts = sqliteTable(
  'attempts',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studySessionId: text('study_session_id').notNull(),
    questionId: text('question_id').notNull(),
    contentVersionId: text('content_version_id').notNull(),
    skillId: text('skill_id').notNull(),
    language: text('language').notNull(),
    submissionKey: text('submission_key').notNull(),
    evidenceKind: text('evidence_kind', {
      enum: ['independent', 'assisted']
    }).notNull(),
    answer: text('answer').notNull(),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex('attempts_owner_submission_unique').on(
      table.ownerId,
      table.submissionKey
    ),
    uniqueIndex('attempts_identity_owner').on(table.id, table.ownerId),
    uniqueIndex('attempts_identity_owner_skill_language').on(
      table.id,
      table.ownerId,
      table.skillId,
      table.language
    ),
    foreignKey({
      columns: [table.studySessionId, table.ownerId, table.language],
      foreignColumns: [
        studySessions.id,
        studySessions.ownerId,
        studySessions.language
      ]
    }).onDelete('cascade'),
    foreignKey({
      columns: [
        table.questionId,
        table.contentVersionId,
        table.skillId,
        table.language
      ],
      foreignColumns: [
        questions.id,
        questions.contentVersionId,
        questions.skillId,
        questions.language
      ]
    }),
    check(
      'attempts_submission_nonempty',
      sql`length(trim(${table.submissionKey})) BETWEEN 1 AND 256`
    ),
    check(
      'attempts_evidence_kind',
      sql`${table.evidenceKind} IN ('independent', 'assisted')`
    )
  ]
);

export const evaluations = sqliteTable(
  'evaluations',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    attemptId: text('attempt_id').notNull(),
    evaluatorVersion: text('evaluator_version').notNull(),
    rubricVersion: text('rubric_version').notNull(),
    outcome: text('outcome', {
      enum: ['correct', 'incorrect', 'uncertain']
    }).notNull(),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex('evaluations_attempt_version_unique').on(
      table.attemptId,
      table.evaluatorVersion,
      table.rubricVersion
    ),
    uniqueIndex('evaluations_identity_owner_attempt').on(
      table.id,
      table.ownerId,
      table.attemptId
    ),
    foreignKey({
      columns: [table.attemptId, table.ownerId],
      foreignColumns: [attempts.id, attempts.ownerId]
    }).onDelete('cascade'),
    check(
      'evaluations_evaluator_nonempty',
      sql`length(trim(${table.evaluatorVersion})) > 0`
    ),
    check(
      'evaluations_rubric_nonempty',
      sql`length(trim(${table.rubricVersion})) > 0`
    ),
    check(
      'evaluations_outcome',
      sql`${table.outcome} IN ('correct', 'incorrect', 'uncertain')`
    )
  ]
);

export const skillEvidence = sqliteTable(
  'skill_evidence',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    attemptId: text('attempt_id').notNull(),
    evaluationId: text('evaluation_id').notNull(),
    skillId: text('skill_id').notNull(),
    language: text('language').notNull(),
    scoringVersion: text('scoring_version').notNull(),
    contribution: integer('contribution').notNull(),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex('skill_evidence_attempt_scoring_unique').on(
      table.ownerId,
      table.attemptId,
      table.scoringVersion
    ),
    foreignKey({
      columns: [table.attemptId, table.ownerId, table.skillId, table.language],
      foreignColumns: [
        attempts.id,
        attempts.ownerId,
        attempts.skillId,
        attempts.language
      ]
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.evaluationId, table.ownerId, table.attemptId],
      foreignColumns: [
        evaluations.id,
        evaluations.ownerId,
        evaluations.attemptId
      ]
    }).onDelete('cascade'),
    check(
      'skill_evidence_scoring_nonempty',
      sql`length(trim(${table.scoringVersion})) > 0`
    ),
    check('skill_evidence_contribution', sql`${table.contribution} IN (0, 1)`)
  ]
);

export const cardDrafts = sqliteTable(
  'card_drafts',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    language: text('language').notNull(),
    skillId: text('skill_id').notNull(),
    canonicalMistake: text('canonical_mistake').notNull(),
    sourceId: text('source_id').notNull(),
    format: text('format', { enum: ['cloze', 'question-answer'] }).notNull(),
    state: text('state', { enum: ['draft', 'approved', 'rejected'] })
      .notNull()
      .default('draft'),
    fieldsJson: text('fields_json').notNull(),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex('card_drafts_canonical_identity_unique').on(
      table.ownerId,
      table.language,
      table.skillId,
      table.canonicalMistake
    ),
    uniqueIndex('card_drafts_source_unique').on(table.sourceId),
    uniqueIndex('card_drafts_identity_owner_source_language').on(
      table.id,
      table.ownerId,
      table.sourceId,
      table.language
    ),
    foreignKey({
      columns: [table.skillId, table.language],
      foreignColumns: [skills.id, skills.language]
    }),
    check(
      'card_drafts_mistake_nonempty',
      sql`length(trim(${table.canonicalMistake})) BETWEEN 1 AND 4096`
    ),
    check(
      'card_drafts_source_format',
      sql`length(${table.sourceId}) = 74 AND ${table.sourceId} GLOB 'langlo:v1:*' AND substr(${table.sourceId}, 11) NOT GLOB '*[^0-9a-f]*'`
    ),
    check(
      'card_drafts_format',
      sql`${table.format} IN ('cloze', 'question-answer')`
    ),
    check(
      'card_drafts_state',
      sql`${table.state} IN ('draft', 'approved', 'rejected')`
    ),
    check('card_drafts_fields_json', sql`json_valid(${table.fieldsJson})`)
  ]
);

export const deliveries = sqliteTable(
  'deliveries',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    cardDraftId: text('card_draft_id').notNull(),
    language: text('language').notNull(),
    sourceId: text('source_id').notNull(),
    confirmedProfile: text('confirmed_profile').notNull(),
    confirmedDeck: text('confirmed_deck').notNull(),
    state: text('state', {
      enum: ['pending', 'claimed', 'delivered', 'failed']
    })
      .notNull()
      .default('pending'),
    claimToken: text('claim_token'),
    claimedAt: integer('claimed_at'),
    claimExpiresAt: integer('claim_expires_at'),
    retryCount: integer('retry_count').notNull().default(0),
    noteId: text('note_id'),
    deliveredAt: integer('delivered_at'),
    createdAt: createdAt()
  },
  (table) => [
    uniqueIndex('deliveries_source_unique').on(table.sourceId),
    uniqueIndex('deliveries_card_unique').on(table.cardDraftId),
    foreignKey({
      columns: [
        table.cardDraftId,
        table.ownerId,
        table.sourceId,
        table.language
      ],
      foreignColumns: [
        cardDrafts.id,
        cardDrafts.ownerId,
        cardDrafts.sourceId,
        cardDrafts.language
      ]
    }).onDelete('cascade'),
    index('deliveries_owner_state').on(table.ownerId, table.state),
    check(
      'deliveries_profile_nonempty',
      sql`length(trim(${table.confirmedProfile})) > 0`
    ),
    check(
      'deliveries_deck_nonempty',
      sql`length(trim(${table.confirmedDeck})) > 0`
    ),
    check(
      'deliveries_state',
      sql`${table.state} IN ('pending', 'claimed', 'delivered', 'failed')`
    ),
    check('deliveries_retry_count', sql`${table.retryCount} >= 0`),
    check(
      'deliveries_claim_shape',
      sql`(${table.state} = 'claimed' AND ${table.claimToken} IS NOT NULL AND length(${table.claimToken}) > 0 AND ${table.claimedAt} IS NOT NULL AND ${table.claimExpiresAt} IS NOT NULL AND ${table.claimExpiresAt} > ${table.claimedAt}) OR (${table.state} <> 'claimed' AND ${table.claimToken} IS NULL AND ${table.claimedAt} IS NULL AND ${table.claimExpiresAt} IS NULL)`
    ),
    check(
      'deliveries_acknowledgement',
      sql`(${table.state} = 'delivered' AND ${table.noteId} IS NOT NULL AND length(trim(${table.noteId})) > 0 AND ${table.deliveredAt} IS NOT NULL) OR (${table.state} <> 'delivered' AND ${table.noteId} IS NULL AND ${table.deliveredAt} IS NULL)`
    )
  ]
);
