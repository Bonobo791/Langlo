CREATE TABLE `attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`study_session_id` text NOT NULL,
	`question_id` text NOT NULL,
	`content_version_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`language` text NOT NULL,
	`submission_key` text NOT NULL,
	`evidence_kind` text NOT NULL,
	`answer` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`study_session_id`,`owner_id`,`language`) REFERENCES `study_sessions`(`id`,`owner_id`,`language`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`question_id`,`content_version_id`,`skill_id`,`language`) REFERENCES `questions`(`id`,`content_version_id`,`skill_id`,`language`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "attempts_submission_nonempty" CHECK(length(trim("attempts"."submission_key")) BETWEEN 1 AND 256),
	CONSTRAINT "attempts_evidence_kind" CHECK("attempts"."evidence_kind" IN ('independent', 'assisted'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_owner_submission_unique` ON `attempts` (`owner_id`,`submission_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_identity_owner` ON `attempts` (`id`,`owner_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `attempts_identity_owner_skill_language` ON `attempts` (`id`,`owner_id`,`skill_id`,`language`);--> statement-breakpoint
CREATE TABLE `content_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`skill_id` text NOT NULL,
	`language` text NOT NULL,
	`version` integer NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`skill_id`,`language`) REFERENCES `skills`(`id`,`language`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "content_versions_positive" CHECK("content_versions"."version" > 0),
	CONSTRAINT "content_versions_status" CHECK("content_versions"."status" IN ('draft', 'reference-checked', 'schema-validated', 'pilot-ready', 'quarantined'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_versions_skill_version` ON `content_versions` (`skill_id`,`version`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_versions_identity_skill_language` ON `content_versions` (`id`,`skill_id`,`language`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`language` text NOT NULL,
	`starting_level` text NOT NULL,
	`explanation_language` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "enrollments_language" CHECK("enrollments"."language" IN ('fr', 'de', 'en')),
	CONSTRAINT "enrollments_level" CHECK("enrollments"."starting_level" IN ('A1', 'A2')),
	CONSTRAINT "enrollments_explanation" CHECK("enrollments"."explanation_language" IN ('en', 'pt'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_owner_language_unique` ON `enrollments` (`owner_id`,`language`);--> statement-breakpoint
CREATE UNIQUE INDEX `enrollments_identity_owner_language` ON `enrollments` (`id`,`owner_id`,`language`);--> statement-breakpoint
CREATE TABLE `evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`evaluator_version` text NOT NULL,
	`rubric_version` text NOT NULL,
	`outcome` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attempt_id`,`owner_id`) REFERENCES `attempts`(`id`,`owner_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "evaluations_evaluator_nonempty" CHECK(length(trim("evaluations"."evaluator_version")) > 0),
	CONSTRAINT "evaluations_rubric_nonempty" CHECK(length(trim("evaluations"."rubric_version")) > 0),
	CONSTRAINT "evaluations_outcome" CHECK("evaluations"."outcome" IN ('correct', 'incorrect', 'uncertain'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `evaluations_attempt_version_unique` ON `evaluations` (`attempt_id`,`evaluator_version`,`rubric_version`);--> statement-breakpoint
CREATE UNIQUE INDEX `evaluations_identity_owner_attempt` ON `evaluations` (`id`,`owner_id`,`attempt_id`);--> statement-breakpoint
CREATE TABLE `prerequisites` (
	`skill_id` text NOT NULL,
	`prerequisite_id` text NOT NULL,
	`language` text NOT NULL,
	PRIMARY KEY(`skill_id`, `prerequisite_id`),
	FOREIGN KEY (`skill_id`,`language`) REFERENCES `skills`(`id`,`language`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`prerequisite_id`,`language`) REFERENCES `skills`(`id`,`language`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "prerequisites_not_self" CHECK("prerequisites"."skill_id" <> "prerequisites"."prerequisite_id")
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` text PRIMARY KEY NOT NULL,
	`content_version_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`language` text NOT NULL,
	`format` text NOT NULL,
	FOREIGN KEY (`content_version_id`,`skill_id`,`language`) REFERENCES `content_versions`(`id`,`skill_id`,`language`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "questions_format" CHECK("questions"."format" IN ('multiple-choice', 'typed-blank', 'translation', 'correction'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `questions_identity_version_skill_language` ON `questions` (`id`,`content_version_id`,`skill_id`,`language`);--> statement-breakpoint
CREATE TABLE `skill_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`attempt_id` text NOT NULL,
	`evaluation_id` text NOT NULL,
	`skill_id` text NOT NULL,
	`language` text NOT NULL,
	`scoring_version` text NOT NULL,
	`contribution` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`attempt_id`,`owner_id`,`skill_id`,`language`) REFERENCES `attempts`(`id`,`owner_id`,`skill_id`,`language`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`evaluation_id`,`owner_id`,`attempt_id`) REFERENCES `evaluations`(`id`,`owner_id`,`attempt_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "skill_evidence_scoring_nonempty" CHECK(length(trim("skill_evidence"."scoring_version")) > 0),
	CONSTRAINT "skill_evidence_contribution" CHECK("skill_evidence"."contribution" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skill_evidence_attempt_scoring_unique` ON `skill_evidence` (`owner_id`,`attempt_id`,`scoring_version`);--> statement-breakpoint
CREATE TABLE `skills` (
	`id` text PRIMARY KEY NOT NULL,
	`language` text NOT NULL,
	`level` text NOT NULL,
	CONSTRAINT "skills_language" CHECK("skills"."language" IN ('fr', 'de', 'en')),
	CONSTRAINT "skills_level" CHECK("skills"."level" IN ('A1', 'A2'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `skills_identity_language` ON `skills` (`id`,`language`);--> statement-breakpoint
CREATE TABLE `study_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`enrollment_id` text NOT NULL,
	`language` text NOT NULL,
	`mode` text NOT NULL,
	`state` text DEFAULT 'active' NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`enrollment_id`,`owner_id`,`language`) REFERENCES `enrollments`(`id`,`owner_id`,`language`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "study_sessions_mode" CHECK("study_sessions"."mode" IN ('practice', 'assessment', 'mixed-review')),
	CONSTRAINT "study_sessions_state" CHECK("study_sessions"."state" IN ('active', 'paused', 'completed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_sessions_identity_owner_language` ON `study_sessions` (`id`,`owner_id`,`language`);--> statement-breakpoint
CREATE INDEX `study_sessions_owner_state` ON `study_sessions` (`owner_id`,`state`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	CONSTRAINT "users_id_nonempty" CHECK(length(trim("users"."id")) > 0)
);
