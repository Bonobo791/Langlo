CREATE TABLE `card_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`language` text NOT NULL,
	`skill_id` text NOT NULL,
	`canonical_mistake` text NOT NULL,
	`source_id` text NOT NULL,
	`format` text NOT NULL,
	`state` text DEFAULT 'draft' NOT NULL,
	`fields_json` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`,`language`) REFERENCES `skills`(`id`,`language`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "card_drafts_mistake_nonempty" CHECK(length(trim("card_drafts"."canonical_mistake")) BETWEEN 1 AND 4096),
	CONSTRAINT "card_drafts_source_format" CHECK(length("card_drafts"."source_id") = 74 AND "card_drafts"."source_id" GLOB 'langlo:v1:*' AND substr("card_drafts"."source_id", 11) NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "card_drafts_format" CHECK("card_drafts"."format" IN ('cloze', 'question-answer')),
	CONSTRAINT "card_drafts_state" CHECK("card_drafts"."state" IN ('draft', 'approved', 'rejected')),
	CONSTRAINT "card_drafts_fields_json" CHECK(json_valid("card_drafts"."fields_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_drafts_canonical_identity_unique` ON `card_drafts` (`owner_id`,`language`,`skill_id`,`canonical_mistake`);--> statement-breakpoint
CREATE UNIQUE INDEX `card_drafts_source_unique` ON `card_drafts` (`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `card_drafts_identity_owner_source_language` ON `card_drafts` (`id`,`owner_id`,`source_id`,`language`);--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`card_draft_id` text NOT NULL,
	`language` text NOT NULL,
	`source_id` text NOT NULL,
	`confirmed_profile` text NOT NULL,
	`confirmed_deck` text NOT NULL,
	`state` text DEFAULT 'pending' NOT NULL,
	`claim_token` text,
	`claimed_at` integer,
	`claim_expires_at` integer,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`note_id` text,
	`delivered_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_draft_id`,`owner_id`,`source_id`,`language`) REFERENCES `card_drafts`(`id`,`owner_id`,`source_id`,`language`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "deliveries_profile_nonempty" CHECK(length(trim("deliveries"."confirmed_profile")) > 0),
	CONSTRAINT "deliveries_deck_nonempty" CHECK(length(trim("deliveries"."confirmed_deck")) > 0),
	CONSTRAINT "deliveries_state" CHECK("deliveries"."state" IN ('pending', 'claimed', 'delivered', 'failed')),
	CONSTRAINT "deliveries_retry_count" CHECK("deliveries"."retry_count" >= 0),
	CONSTRAINT "deliveries_claim_shape" CHECK(("deliveries"."state" = 'claimed' AND "deliveries"."claim_token" IS NOT NULL AND length("deliveries"."claim_token") > 0 AND "deliveries"."claimed_at" IS NOT NULL AND "deliveries"."claim_expires_at" IS NOT NULL AND "deliveries"."claim_expires_at" > "deliveries"."claimed_at") OR ("deliveries"."state" <> 'claimed' AND "deliveries"."claim_token" IS NULL AND "deliveries"."claimed_at" IS NULL AND "deliveries"."claim_expires_at" IS NULL)),
	CONSTRAINT "deliveries_acknowledgement" CHECK(("deliveries"."state" = 'delivered' AND "deliveries"."note_id" IS NOT NULL AND length(trim("deliveries"."note_id")) > 0 AND "deliveries"."delivered_at" IS NOT NULL) OR ("deliveries"."state" <> 'delivered' AND "deliveries"."note_id" IS NULL AND "deliveries"."delivered_at" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deliveries_source_unique` ON `deliveries` (`source_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `deliveries_card_unique` ON `deliveries` (`card_draft_id`);--> statement-breakpoint
CREATE INDEX `deliveries_owner_state` ON `deliveries` (`owner_id`,`state`);
--> statement-breakpoint
-- Hand-authored triggers: Drizzle snapshots do not model these invariants.
CREATE TRIGGER card_drafts_identity_immutable
BEFORE UPDATE OF owner_id, language, skill_id, canonical_mistake, source_id ON card_drafts
WHEN NEW.owner_id IS NOT OLD.owner_id
  OR NEW.language IS NOT OLD.language
  OR NEW.skill_id IS NOT OLD.skill_id
  OR NEW.canonical_mistake IS NOT OLD.canonical_mistake
  OR NEW.source_id IS NOT OLD.source_id
BEGIN
  SELECT RAISE(ABORT, 'Card canonical identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER deliveries_require_approved_card
BEFORE INSERT ON deliveries
WHEN (SELECT state FROM card_drafts WHERE id = NEW.card_draft_id AND owner_id = NEW.owner_id) <> 'approved'
BEGIN
  SELECT RAISE(ABORT, 'Delivery requires an approved card');
END;
