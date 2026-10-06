import { DatabaseSync } from 'node:sqlite';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createSourceId } from '../src/lib/server/db/source-id.ts';

// Dependency-free SQL checks; libSQL migration/transaction integration needs Vitest.
const root = fileURLToPath(new URL('../', import.meta.url));
const journal = JSON.parse(
  readFileSync(join(root, 'drizzle/meta/_journal.json'), 'utf8')
);
const identity = {
  ownerId: 'learner-a',
  language: 'fr',
  skillId: 'fr-articles',
  canonicalMistake: 'article-gender'
};
const whitespace =
  '\u0009\u000a\u000b\u000c\u000d\u0020\u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff';

/** Seed an owned native SQLite file at a selected migration prefix; close removes only this test's temporary tree. */
function fixture(count = journal.entries.length) {
  const directory = mkdtempSync(join(tmpdir(), 'langlo-native-review-'));
  const db = new DatabaseSync(join(directory, 'test.sqlite'));
  try {
    db.exec('PRAGMA foreign_keys=ON');
    for (const entry of journal.entries.slice(0, count)) {
      db.exec(readFileSync(join(root, 'drizzle', `${entry.tag}.sql`), 'utf8'));
    }
    for (const sql of [
      "INSERT INTO users(id) VALUES ('learner-a'), ('isolated')",
      "INSERT INTO skills(id,language,level) VALUES('fr-articles','fr','A1'), ('isolated-skill','fr','A1')",
      "INSERT INTO enrollments(id,owner_id,language,starting_level,explanation_language) VALUES('enrollment-a','learner-a','fr','A1','en')",
      "INSERT INTO content_versions(id,skill_id,language,version) VALUES('version-a','fr-articles','fr',1)",
      "INSERT INTO questions(id,content_version_id,skill_id,language,format) VALUES('question-a','version-a','fr-articles','fr','typed-blank')",
      "INSERT INTO study_sessions(id,owner_id,enrollment_id,language,mode) VALUES('session-a','learner-a','enrollment-a','fr','practice')",
      "INSERT INTO attempts(id,owner_id,study_session_id,question_id,content_version_id,skill_id,language,submission_key,evidence_kind,answer) VALUES('attempt-a','learner-a','session-a','question-a','version-a','fr-articles','fr','submission-a','independent','un')",
      "INSERT INTO evaluations(id,owner_id,attempt_id,evaluator_version,rubric_version,outcome) VALUES('evaluation-a','learner-a','attempt-a','eval-v1','rubric-v1','incorrect')"
    ]) {
      db.exec(sql);
    }
  } catch (error) {
    db.close();
    rmSync(directory, { recursive: true });
    throw error;
  }
  return {
    db,
    close() {
      db.close();
      rmSync(directory, { recursive: true });
    }
  };
}

for (const field of Object.keys(identity)) {
  test(`NUL helper boundary ${field}`, () => {
    for (const value of ['\0x', 'x\0']) {
      assert.throws(
        () => createSourceId({ ...identity, [field]: value }),
        /identity/i
      );
    }
  });
}

test('supported pairs and forbidden insert/update/replace', () => {
  const { db, close } = fixture();
  try {
    const pairs = [
      ['fr', 'A1'],
      ['de', 'A1'],
      ['de', 'A2'],
      ['en', 'A1'],
      ['en', 'A2']
    ];
    for (const [index, [language, level]] of pairs.entries()) {
      db.prepare('INSERT INTO users(id) VALUES (?)').run(`owner-${index}`);
      db.prepare(
        "INSERT INTO enrollments(id,owner_id,language,starting_level,explanation_language) VALUES (?, ?, ?, ?, 'en')"
      ).run(`e-${index}`, `owner-${index}`, language, level);
    }
    for (const sql of [
      "INSERT INTO enrollments(id,owner_id,language,starting_level,explanation_language) VALUES('invalid','isolated','fr','A2','en')",
      "UPDATE enrollments SET starting_level='A2' WHERE id='enrollment-a'",
      "REPLACE INTO enrollments(id,owner_id,language,starting_level,explanation_language) VALUES('enrollment-a','learner-a','fr','A2','en')"
    ]) {
      assert.throws(() => db.exec(sql), /supported track/i);
    }
    assert.equal(
      db
        .prepare('SELECT starting_level FROM enrollments WHERE id=?')
        .get('enrollment-a')?.starting_level,
      'A1'
    );
  } finally {
    close();
  }
});

test('identity text insert/update/replace rejects trim-only and NUL; preserves nonblank text', () => {
  const { db, close } = fixture();
  try {
    for (const value of [...whitespace, whitespace, '\0x', 'x\0']) {
      for (const sql of [
        'INSERT INTO users(id) VALUES (?)',
        "INSERT INTO skills(id,language,level) VALUES(?,'fr','A1')",
        "INSERT INTO card_drafts(id,owner_id,language,skill_id,canonical_mistake,source_id,format,fields_json) VALUES ('card','learner-a','fr','fr-articles',?,'langlo:v1:'||printf('%064d',0),'cloze','{}')",
        "UPDATE users SET id=? WHERE id='isolated'",
        "UPDATE skills SET id=? WHERE id='isolated-skill'",
        'REPLACE INTO users(id) VALUES (?)',
        "REPLACE INTO skills(id,language,level) VALUES(?,'fr','A1')",
        "REPLACE INTO card_drafts(id,owner_id,language,skill_id,canonical_mistake,source_id,format,fields_json) VALUES ('card','learner-a','fr','fr-articles',?,'langlo:v1:'||printf('%064d',0),'cloze','{}')"
      ]) {
        assert.throws(() => db.prepare(sql).run(value), /identity/i);
      }
    }
    const canonicalMistake = `${whitespace}nonblank${whitespace}`;
    db.prepare(
      "INSERT INTO card_drafts(id,owner_id,language,skill_id,canonical_mistake,source_id,format,fields_json) VALUES ('card','learner-a','fr','fr-articles',?,?,'cloze','{}')"
    ).run(canonicalMistake, createSourceId({ ...identity, canonicalMistake }));
    for (const value of ['\t\u00a0', 'x\0']) {
      assert.throws(
        () =>
          db
            .prepare(
              "UPDATE card_drafts SET canonical_mistake=? WHERE id='card'"
            )
            .run(value),
        /identity/i
      );
    }
    assert.equal(
      db.prepare('SELECT canonical_mistake FROM card_drafts').get()
        ?.canonical_mistake,
      canonicalMistake
    );
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
    db.exec("DELETE FROM users WHERE id='learner-a'");
    for (const table of ['card_drafts', 'attempts', 'evaluations']) {
      assert.equal(
        db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n,
        0
      );
    }
    assert.equal(
      db.prepare("SELECT count(*) AS n FROM users WHERE id='isolated'").get()
        ?.n,
      1
    );
  } finally {
    close();
  }
});

test('upgrade rejects invalid historical rows and retains valid history', () => {
  const reviewPath = join(root, 'drizzle/0003_review_invariants.sql');
  const review = existsSync(reviewPath) ? readFileSync(reviewPath, 'utf8') : '';
  const invalidHistory = [
    "UPDATE enrollments SET starting_level='A2'",
    'INSERT INTO users(id) VALUES(char(9))',
    "INSERT INTO skills(id,language,level) VALUES(char(160),'fr','A1')",
    "INSERT INTO card_drafts(id,owner_id,language,skill_id,canonical_mistake,source_id,format,fields_json) VALUES('bad','learner-a','fr','fr-articles',char(9),'langlo:v1:'||printf('%064d',0),'cloze','{}')",
    "INSERT INTO card_drafts(id,owner_id,language,skill_id,canonical_mistake,source_id,format,fields_json) VALUES('bad','learner-a','fr','fr-articles','x'||char(0),'langlo:v1:'||printf('%064d',0),'cloze','{}')"
  ];
  for (const invalid of invalidHistory) {
    const { db, close } = fixture(3);
    try {
      db.exec(invalid);
      const before = db.prepare('SELECT * FROM enrollments').all();
      const attempts = db.prepare('SELECT * FROM attempts').all();
      const evaluations = db.prepare('SELECT * FROM evaluations').all();
      db.exec('BEGIN');
      assert.throws(() => db.exec(review), /CHECK|CONSTRAINT/i);
      db.exec('ROLLBACK');
      assert.deepEqual(db.prepare('SELECT * FROM enrollments').all(), before);
      assert.deepEqual(db.prepare('SELECT * FROM attempts').all(), attempts);
      assert.deepEqual(
        db.prepare('SELECT * FROM evaluations').all(),
        evaluations
      );
      assert.equal(
        db
          .prepare(
            "SELECT count(*) AS n FROM sqlite_master WHERE name='enrollments_supported_track_insert'"
          )
          .get()?.n,
        0
      );
    } finally {
      close();
    }
  }
  const { db, close } = fixture(3);
  try {
    const before = db.prepare('SELECT * FROM enrollments').all();
    const attempts = db.prepare('SELECT * FROM attempts').all();
    const evaluations = db.prepare('SELECT * FROM evaluations').all();
    db.exec(review);
    assert.deepEqual(db.prepare('SELECT * FROM enrollments').all(), before);
    assert.deepEqual(db.prepare('SELECT * FROM attempts').all(), attempts);
    assert.deepEqual(
      db.prepare('SELECT * FROM evaluations').all(),
      evaluations
    );
  } finally {
    close();
  }
});
