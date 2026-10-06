-- Additive review guards; keep these triggers when generating future table rebuilds.
-- Fail closed over existing rows. Never silently delete, repair or rehash historical identity.
-- char(...) matches ECMAScript String.trim whitespace, including Unicode separators and BOM.
-- NUL is forbidden because SQLite length() stops at NUL while JS hashing does not.
CREATE TEMP TABLE langlo_review_upgrade_gate (
  invalid_rows integer NOT NULL CHECK(invalid_rows = 0)
);
--> statement-breakpoint
INSERT INTO langlo_review_upgrade_gate (invalid_rows)
SELECT count(*) FROM enrollments WHERE NOT ((language = 'fr' AND starting_level = 'A1') OR (language IN ('de', 'en') AND starting_level IN ('A1', 'A2')));
--> statement-breakpoint
INSERT INTO langlo_review_upgrade_gate (invalid_rows)
SELECT count(*) FROM users
WHERE instr(id, char(0)) > 0 OR length(trim(id, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0;
--> statement-breakpoint
INSERT INTO langlo_review_upgrade_gate (invalid_rows)
SELECT count(*) FROM skills
WHERE instr(id, char(0)) > 0 OR length(trim(id, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0;
--> statement-breakpoint
INSERT INTO langlo_review_upgrade_gate (invalid_rows)
SELECT count(*) FROM card_drafts
WHERE instr(canonical_mistake, char(0)) > 0 OR length(trim(canonical_mistake, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0;
--> statement-breakpoint
DROP TABLE langlo_review_upgrade_gate;
--> statement-breakpoint
CREATE TRIGGER enrollments_supported_track_insert
BEFORE INSERT ON enrollments
WHEN NOT ((NEW.language = 'fr' AND NEW.starting_level = 'A1') OR (NEW.language IN ('de', 'en') AND NEW.starting_level IN ('A1', 'A2')))
BEGIN
  SELECT RAISE(ABORT, 'Enrollment must use a supported track');
END;
--> statement-breakpoint
CREATE TRIGGER enrollments_supported_track_update
BEFORE UPDATE OF language, starting_level ON enrollments
WHEN NOT ((NEW.language = 'fr' AND NEW.starting_level = 'A1') OR (NEW.language IN ('de', 'en') AND NEW.starting_level IN ('A1', 'A2')))
BEGIN
  SELECT RAISE(ABORT, 'Enrollment must use a supported track');
END;
--> statement-breakpoint
CREATE TRIGGER users_review_identity_insert
BEFORE INSERT ON users
WHEN instr(NEW.id, char(0)) > 0
  OR length(trim(NEW.id, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0
BEGIN
  SELECT RAISE(ABORT, 'SourceID identity text must be nonblank and NUL-free');
END;
--> statement-breakpoint
CREATE TRIGGER users_review_identity_update
BEFORE UPDATE OF id ON users
WHEN instr(NEW.id, char(0)) > 0
  OR length(trim(NEW.id, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0
BEGIN
  SELECT RAISE(ABORT, 'SourceID identity text must be nonblank and NUL-free');
END;
--> statement-breakpoint
CREATE TRIGGER skills_review_identity_insert
BEFORE INSERT ON skills
WHEN instr(NEW.id, char(0)) > 0
  OR length(trim(NEW.id, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0
BEGIN
  SELECT RAISE(ABORT, 'SourceID identity text must be nonblank and NUL-free');
END;
--> statement-breakpoint
CREATE TRIGGER skills_review_identity_update
BEFORE UPDATE OF id ON skills
WHEN instr(NEW.id, char(0)) > 0
  OR length(trim(NEW.id, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0
BEGIN
  SELECT RAISE(ABORT, 'SourceID identity text must be nonblank and NUL-free');
END;
--> statement-breakpoint
CREATE TRIGGER card_drafts_review_identity_insert
BEFORE INSERT ON card_drafts
WHEN instr(NEW.canonical_mistake, char(0)) > 0
  OR length(trim(NEW.canonical_mistake, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0
BEGIN
  SELECT RAISE(ABORT, 'SourceID identity text must be nonblank and NUL-free');
END;
--> statement-breakpoint
CREATE TRIGGER card_drafts_review_identity_update
BEFORE UPDATE OF canonical_mistake ON card_drafts
WHEN instr(NEW.canonical_mistake, char(0)) > 0
  OR length(trim(NEW.canonical_mistake, char(9, 10, 11, 12, 13, 32, 160, 5760, 8192, 8193, 8194, 8195, 8196, 8197, 8198, 8199, 8200, 8201, 8202, 8232, 8233, 8239, 8287, 12288, 65279))) = 0
BEGIN
  SELECT RAISE(ABORT, 'SourceID identity text must be nonblank and NUL-free');
END;
