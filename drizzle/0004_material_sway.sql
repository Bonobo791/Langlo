CREATE TABLE `native_flashcard_decks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "native_flashcard_decks_name_nonempty" CHECK(length(trim("native_flashcard_decks"."name")) BETWEEN 1 AND 160)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `native_flashcard_decks_id_owner_unique` ON `native_flashcard_decks` (`id`,`owner_id`);--> statement-breakpoint
CREATE INDEX `native_flashcard_decks_owner` ON `native_flashcard_decks` (`owner_id`);--> statement-breakpoint
CREATE TABLE `native_flashcard_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`deck_id` text NOT NULL,
	`kind` text NOT NULL,
	`content_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`deck_id`,`owner_id`) REFERENCES `native_flashcard_decks`(`id`,`owner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "native_flashcard_notes_kind" CHECK("native_flashcard_notes"."kind" IN ('basic', 'cloze')),
	CONSTRAINT "native_flashcard_notes_status" CHECK("native_flashcard_notes"."status" IN ('draft', 'approved', 'rejected')),
	CONSTRAINT "native_flashcard_notes_content_json" CHECK(json_valid("native_flashcard_notes"."content_json")),
	CONSTRAINT "native_flashcard_notes_content_shape" CHECK(("native_flashcard_notes"."kind" = 'basic' AND json_type("native_flashcard_notes"."content_json") = 'object' AND json_type("native_flashcard_notes"."content_json", '$.front') = 'text' AND json_type("native_flashcard_notes"."content_json", '$.back') = 'text' AND length(trim(json_extract("native_flashcard_notes"."content_json", '$.front'), char(9) || char(10) || char(11) || char(12) || char(13) || char(32) || char(160) || char(5760) || char(8192) || char(8193) || char(8194) || char(8195) || char(8196) || char(8197) || char(8198) || char(8199) || char(8200) || char(8201) || char(8202) || char(8232) || char(8233) || char(8239) || char(8287) || char(12288) || char(65279))) BETWEEN 1 AND 4096 AND length(trim(json_extract("native_flashcard_notes"."content_json", '$.back'), char(9) || char(10) || char(11) || char(12) || char(13) || char(32) || char(160) || char(5760) || char(8192) || char(8193) || char(8194) || char(8195) || char(8196) || char(8197) || char(8198) || char(8199) || char(8200) || char(8201) || char(8202) || char(8232) || char(8233) || char(8239) || char(8287) || char(12288) || char(65279))) BETWEEN 1 AND 4096 AND json_remove("native_flashcard_notes"."content_json", '$.front', '$.back') = '{}') OR ("native_flashcard_notes"."kind" = 'cloze' AND json_type("native_flashcard_notes"."content_json") = 'object' AND json_type("native_flashcard_notes"."content_json", '$.text') = 'text' AND length(trim(json_extract("native_flashcard_notes"."content_json", '$.text'), char(9) || char(10) || char(11) || char(12) || char(13) || char(32) || char(160) || char(5760) || char(8192) || char(8193) || char(8194) || char(8195) || char(8196) || char(8197) || char(8198) || char(8199) || char(8200) || char(8201) || char(8202) || char(8232) || char(8233) || char(8239) || char(8287) || char(12288) || char(65279))) BETWEEN 1 AND 4096 AND json_remove("native_flashcard_notes"."content_json", '$.text') = '{}'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `native_flashcard_notes_id_owner_unique` ON `native_flashcard_notes` (`id`,`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `native_flashcard_notes_source_owner_unique` ON `native_flashcard_notes` (`owner_id`,`source_id`);--> statement-breakpoint
CREATE INDEX `native_flashcard_notes_owner_deck` ON `native_flashcard_notes` (`owner_id`,`deck_id`);--> statement-breakpoint
CREATE TABLE `native_flashcard_review_events` (
	`id` text NOT NULL,
	`owner_id` text NOT NULL,
	`card_id` text NOT NULL,
	`expected_revision` integer NOT NULL,
	`rating` text NOT NULL,
	`reviewed_at` integer NOT NULL,
	`scheduler_version` text NOT NULL,
	`parameters_json` text NOT NULL,
	`result_json` text NOT NULL,
	PRIMARY KEY(`owner_id`, `id`),
	FOREIGN KEY (`card_id`,`owner_id`) REFERENCES `native_flashcards`(`id`,`owner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "native_flashcard_review_events_revision" CHECK("native_flashcard_review_events"."expected_revision" >= 0),
	CONSTRAINT "native_flashcard_review_events_id_nonempty" CHECK(length(trim("native_flashcard_review_events"."id", char(9) || char(10) || char(11) || char(12) || char(13) || char(32) || char(160) || char(5760) || char(8192) || char(8193) || char(8194) || char(8195) || char(8196) || char(8197) || char(8198) || char(8199) || char(8200) || char(8201) || char(8202) || char(8232) || char(8233) || char(8239) || char(8287) || char(12288) || char(65279))) BETWEEN 1 AND 256 AND length("native_flashcard_review_events"."id") <= 256),
	CONSTRAINT "native_flashcard_review_events_rating" CHECK("native_flashcard_review_events"."rating" IN ('again', 'hard', 'good', 'easy')),
	CONSTRAINT "native_flashcard_review_events_parameters_json" CHECK(json_valid("native_flashcard_review_events"."parameters_json")),
	CONSTRAINT "native_flashcard_review_events_result_json" CHECK(json_valid("native_flashcard_review_events"."result_json"))
) WITHOUT ROWID;
--> statement-breakpoint
CREATE INDEX `native_flashcard_review_events_card_time` ON `native_flashcard_review_events` (`owner_id`,`card_id`,`reviewed_at`);--> statement-breakpoint
CREATE TRIGGER `native_flashcard_review_events_no_update` BEFORE UPDATE ON `native_flashcard_review_events` BEGIN SELECT RAISE(ABORT, 'native flashcard review history is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `native_flashcard_review_events_no_delete` BEFORE DELETE ON `native_flashcard_review_events` WHEN EXISTS (SELECT 1 FROM `native_flashcards` WHERE `id` = OLD.`card_id` AND `owner_id` = OLD.`owner_id`) BEGIN SELECT RAISE(ABORT, 'native flashcard review history is append-only'); END;--> statement-breakpoint
CREATE TRIGGER `native_flashcard_review_events_no_replace` BEFORE INSERT ON `native_flashcard_review_events` WHEN EXISTS (SELECT 1 FROM `native_flashcard_review_events` WHERE `owner_id` = NEW.`owner_id` AND `id` = NEW.`id`) BEGIN SELECT RAISE(ABORT, 'native flashcard review history is append-only'); END;--> statement-breakpoint
CREATE TABLE `native_flashcards` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`note_id` text NOT NULL,
	`ordinal` integer DEFAULT 0 NOT NULL,
	`state_json` text NOT NULL,
	`due_at` integer NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`suspended` integer DEFAULT false NOT NULL,
	`scheduler_version` text NOT NULL,
	`parameters_json` text NOT NULL,
	FOREIGN KEY (`note_id`,`owner_id`) REFERENCES `native_flashcard_notes`(`id`,`owner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "native_flashcards_ordinal" CHECK("native_flashcards"."ordinal" >= 0),
	CONSTRAINT "native_flashcards_revision" CHECK("native_flashcards"."revision" >= 0),
	CONSTRAINT "native_flashcards_state_json" CHECK(json_valid("native_flashcards"."state_json")),
	CONSTRAINT "native_flashcards_parameters_json" CHECK(json_valid("native_flashcards"."parameters_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `native_flashcards_id_owner_unique` ON `native_flashcards` (`id`,`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `native_flashcards_note_ordinal_unique` ON `native_flashcards` (`owner_id`,`note_id`,`ordinal`);--> statement-breakpoint
CREATE INDEX `native_flashcards_owner_due` ON `native_flashcards` (`owner_id`,`suspended`,`due_at`);
