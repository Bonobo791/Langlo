import {
  openFixtureClient,
  type FixtureTarget
} from '../../src/lib/server/db/connection.ts';

export async function seedStudy(target: FixtureTarget) {
  const { client, close } = await openFixtureClient(target);
  try {
    await client.batch(
      [
        "INSERT OR IGNORE INTO users (id) VALUES ('learner-a'), ('learner-b')",
        "INSERT OR IGNORE INTO enrollments (id, owner_id, language, starting_level, explanation_language) VALUES ('enrollment-a', 'learner-a', 'fr', 'A1', 'en'), ('enrollment-b', 'learner-b', 'fr', 'A1', 'en')",
        "INSERT OR IGNORE INTO skills (id, language, level) VALUES ('fr-articles', 'fr', 'A1')",
        "INSERT OR IGNORE INTO content_versions (id, skill_id, language, version, status) VALUES ('content-v1', 'fr-articles', 'fr', 1, 'pilot-ready'), ('content-v2', 'fr-articles', 'fr', 2, 'draft')",
        "INSERT OR IGNORE INTO questions (id, content_version_id, skill_id, language, format) VALUES ('question-1', 'content-v1', 'fr-articles', 'fr', 'typed-blank'), ('question-2', 'content-v2', 'fr-articles', 'fr', 'typed-blank')",
        "INSERT OR IGNORE INTO study_sessions (id, owner_id, enrollment_id, language, mode) VALUES ('study-a', 'learner-a', 'enrollment-a', 'fr', 'practice'), ('study-b', 'learner-b', 'enrollment-b', 'fr', 'assessment')",
        "INSERT OR IGNORE INTO attempts (id, owner_id, study_session_id, question_id, content_version_id, skill_id, language, submission_key, evidence_kind, answer) VALUES ('attempt-a', 'learner-a', 'study-a', 'question-1', 'content-v1', 'fr-articles', 'fr', 'submit-a', 'independent', 'un')",
        "INSERT OR IGNORE INTO evaluations (id, owner_id, attempt_id, evaluator_version, rubric_version, outcome) VALUES ('evaluation-a', 'learner-a', 'attempt-a', 'prepared-v1', 'rubric-v1', 'incorrect')"
      ],
      'write'
    );
  } finally {
    close();
  }
}
