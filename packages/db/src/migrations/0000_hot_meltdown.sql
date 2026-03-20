CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text,
	`model_id` text,
	`system_prompt` text,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_conversations_updated` ON `conversations` (`updated_at`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`audio_path` text,
	`tokens_in` integer,
	`tokens_out` integer,
	`latency_ms` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_messages_conversation` ON `messages` (`conversation_id`);--> statement-breakpoint
CREATE INDEX `idx_messages_created` ON `messages` (`created_at`);--> statement-breakpoint
CREATE TABLE `download_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	`progress_pct` real DEFAULT 0 NOT NULL,
	`downloaded_bytes` integer DEFAULT 0 NOT NULL,
	`total_bytes` integer,
	`speed_bps` integer,
	`status` text DEFAULT 'queued' NOT NULL,
	`error` text,
	`started_at` integer,
	`completed_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_download_queue_model` ON `download_queue` (`model_id`);--> statement-breakpoint
CREATE INDEX `idx_download_queue_status` ON `download_queue` (`status`);--> statement-breakpoint
CREATE TABLE `model_tags` (
	`model_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`model_id`, `tag_id`),
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`display_name` text NOT NULL,
	`description` text,
	`type` text NOT NULL,
	`format` text,
	`variant` text,
	`repo` text,
	`file_name` text,
	`local_path` text,
	`size_bytes` integer,
	`status` text DEFAULT 'available' NOT NULL,
	`min_ram_gb` real,
	`recommended_vram_gb` real,
	`downloaded_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `models_name_unique` ON `models` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_models_name` ON `models` (`name`);--> statement-breakpoint
CREATE INDEX `idx_models_type` ON `models` (`type`);--> statement-breakpoint
CREATE INDEX `idx_models_status` ON `models` (`status`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`label` text NOT NULL,
	`permissions` text DEFAULT '*' NOT NULL,
	`rate_limit` integer,
	`last_used_at` integer,
	`expires_at` integer,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_prefix_unique` ON `api_keys` (`key_prefix`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_api_keys_hash` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_api_keys_prefix` ON `api_keys` (`key_prefix`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `usage_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`model_id` text,
	`type` text NOT NULL,
	`tokens_in` integer,
	`tokens_out` integer,
	`latency_ms` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`model_id`) REFERENCES `models`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_metrics_model` ON `usage_metrics` (`model_id`);--> statement-breakpoint
CREATE INDEX `idx_metrics_created` ON `usage_metrics` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_metrics_type` ON `usage_metrics` (`type`);--> statement-breakpoint
CREATE TABLE `voice_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`stt_model` text,
	`tts_model` text,
	`tts_voice` text,
	`language` text DEFAULT 'en' NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_voice_profiles_default` ON `voice_profiles` (`is_default`);