CREATE TABLE `message_campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`image_key` text,
	`image_name` text,
	`image_mime` text,
	`created_at` text NOT NULL,
	`created_by` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_contacts` (
	`campaign_id` text NOT NULL,
	`phone` text NOT NULL,
	`details_json` text NOT NULL,
	`confirmed_at` text,
	`confirmed_by` text,
	`version` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`campaign_id`, `phone`),
	FOREIGN KEY (`campaign_id`) REFERENCES `message_campaigns`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `owner_identity` (
	`key` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`bound_at` text NOT NULL
);
