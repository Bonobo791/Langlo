-- Hand-authored invariants are not represented by Drizzle snapshots.
-- Fail closed if the supported previous schema already contains invalid numeric rows.
CREATE TEMP TABLE langlo_numeric_upgrade_gate (
  invalid_rows integer NOT NULL CHECK(invalid_rows = 0)
);
--> statement-breakpoint
INSERT INTO langlo_numeric_upgrade_gate (invalid_rows)
SELECT count(*) FROM content_versions
WHERE typeof(version) <> 'integer' OR version < 1 OR version > 9007199254740991;
--> statement-breakpoint
INSERT INTO langlo_numeric_upgrade_gate (invalid_rows)
SELECT count(*) FROM deliveries
WHERE typeof(retry_count) <> 'integer' OR retry_count < 0
   OR (claimed_at IS NOT NULL AND typeof(claimed_at) <> 'integer')
   OR (claim_expires_at IS NOT NULL AND typeof(claim_expires_at) <> 'integer')
   OR (delivered_at IS NOT NULL AND typeof(delivered_at) <> 'integer');
--> statement-breakpoint
DROP TABLE langlo_numeric_upgrade_gate;
--> statement-breakpoint
CREATE TRIGGER content_versions_integer_insert
BEFORE INSERT ON content_versions
WHEN typeof(NEW.version) <> 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'Content version must be a positive safe integer');
END;
--> statement-breakpoint
CREATE TRIGGER content_versions_integer_update
BEFORE UPDATE OF version ON content_versions
WHEN typeof(NEW.version) <> 'integer' OR NEW.version < 1 OR NEW.version > 9007199254740991
BEGIN
  SELECT RAISE(ABORT, 'Content version must be a positive safe integer');
END;
--> statement-breakpoint
CREATE TRIGGER deliveries_identity_immutable
BEFORE UPDATE OF id, owner_id, card_draft_id, language, source_id ON deliveries
WHEN NEW.id IS NOT OLD.id
  OR NEW.owner_id IS NOT OLD.owner_id
  OR NEW.card_draft_id IS NOT OLD.card_draft_id
  OR NEW.language IS NOT OLD.language
  OR NEW.source_id IS NOT OLD.source_id
BEGIN
  SELECT RAISE(ABORT, 'Delivery identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER deliveries_approved_work_update
BEFORE UPDATE OF state ON deliveries
WHEN NEW.state IN ('claimed', 'delivered')
  AND (SELECT state FROM card_drafts WHERE id = NEW.card_draft_id AND owner_id = NEW.owner_id) <> 'approved'
BEGIN
  SELECT RAISE(ABORT, 'Delivery work requires an approved card');
END;
--> statement-breakpoint
CREATE TRIGGER deliveries_integer_insert
BEFORE INSERT ON deliveries
WHEN typeof(NEW.retry_count) <> 'integer' OR NEW.retry_count < 0
  OR (NEW.claimed_at IS NOT NULL AND typeof(NEW.claimed_at) <> 'integer')
  OR (NEW.claim_expires_at IS NOT NULL AND typeof(NEW.claim_expires_at) <> 'integer')
  OR (NEW.delivered_at IS NOT NULL AND typeof(NEW.delivered_at) <> 'integer')
BEGIN
  SELECT RAISE(ABORT, 'Delivery counters and timestamps must be integers');
END;
--> statement-breakpoint
CREATE TRIGGER deliveries_integer_update
BEFORE UPDATE OF retry_count, claimed_at, claim_expires_at, delivered_at ON deliveries
WHEN typeof(NEW.retry_count) <> 'integer' OR NEW.retry_count < 0
  OR (NEW.claimed_at IS NOT NULL AND typeof(NEW.claimed_at) <> 'integer')
  OR (NEW.claim_expires_at IS NOT NULL AND typeof(NEW.claim_expires_at) <> 'integer')
  OR (NEW.delivered_at IS NOT NULL AND typeof(NEW.delivered_at) <> 'integer')
BEGIN
  SELECT RAISE(ABORT, 'Delivery counters and timestamps must be integers');
END;
