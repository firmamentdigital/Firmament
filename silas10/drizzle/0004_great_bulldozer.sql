CREATE TABLE `admin_members` (
	`email` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`active` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL,
	`activated_at` text,
	`revoked_at` text,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `admin_members_user_id_unique` ON `admin_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `event_brands` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`label` text NOT NULL,
	`asset_key` text,
	`asset_path` text,
	`mime` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text NOT NULL
);
