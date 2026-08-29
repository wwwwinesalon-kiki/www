CREATE TABLE `admin_users` (
	`id` text PRIMARY KEY NOT NULL,
	`access_email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_admin_email` ON `admin_users` (`access_email`);--> statement-breakpoint
CREATE TABLE `analytics_daily` (
	`day` text NOT NULL,
	`metric` text NOT NULL,
	`dimension` text NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_analytics_daily_unique` ON `analytics_daily` (`day`,`metric`,`dimension`);--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` text PRIMARY KEY NOT NULL,
	`event_type` text NOT NULL,
	`session_id` text NOT NULL,
	`path` text NOT NULL,
	`entity_id` text,
	`occurred_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_analytics_type_date` ON `analytics_events` (`event_type`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`before` text,
	`after` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_entity` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_created` ON `audit_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `content_media` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text,
	`r2_key` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`alt` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_placements` (
	`id` text PRIMARY KEY NOT NULL,
	`content_id` text NOT NULL,
	`surface` text NOT NULL,
	`position` integer NOT NULL,
	`featured` integer NOT NULL,
	`pinned` integer NOT NULL,
	`is_new` integer NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`content_id`) REFERENCES `contents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_placements_surface_position` ON `content_placements` (`surface`,`position`);--> statement-breakpoint
CREATE TABLE `contents` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`summary` text,
	`body` text NOT NULL,
	`tags` text,
	`cover_image` text,
	`audio` text,
	`publish_status` text NOT NULL,
	`public_visible` integer NOT NULL,
	`member_visible` integer NOT NULL,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_contents_slug` ON `contents` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_contents_listing` ON `contents` (`type`,`publish_status`);--> statement-breakpoint
CREATE TABLE `event_applications` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`member_id` text,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`line_name` text,
	`member_type` text NOT NULL,
	`applied_at` text NOT NULL,
	`application_status` text NOT NULL,
	`payment_status` text NOT NULL,
	`cancelled_at` text,
	`notes` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	`deleted_at` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_app_event_status` ON `event_applications` (`event_id`,`application_status`);--> statement-breakpoint
CREATE TABLE `event_payments` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`amount` integer NOT NULL,
	`status` text NOT NULL,
	`paid_at` text,
	`refunded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	`deleted_at` text,
	FOREIGN KEY (`application_id`) REFERENCES `event_applications`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_payments_status` ON `event_payments` (`status`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`event_type` text NOT NULL,
	`description` text,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`venue` text NOT NULL,
	`capacity` integer NOT NULL,
	`price` integer NOT NULL,
	`member_only` integer NOT NULL,
	`registration_enabled` integer NOT NULL,
	`waitlist_enabled` integer NOT NULL,
	`publish_status` text NOT NULL,
	`public_visible` integer NOT NULL,
	`member_visible` integer NOT NULL,
	`cover_image` text,
	`items_to_bring` text,
	`precautions` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_events_slug` ON `events` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_events_start` ON `events` (`start_at`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`line_name` text,
	`email` text,
	`status` text NOT NULL,
	`joined_at` text,
	`source` text,
	`last_contact_at` text,
	`interest_categories` text,
	`notes` text,
	`kaihipay_customer_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	`deleted_at` text
);
--> statement-breakpoint
CREATE INDEX `idx_members_status` ON `members` (`status`);--> statement-breakpoint
CREATE INDEX `idx_members_email` ON `members` (`email`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`read_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notifications_unread` ON `notifications` (`read_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text NOT NULL
);
