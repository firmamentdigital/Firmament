CREATE TABLE `guest_login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL,
	`window_started` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `guest_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`member_email` text NOT NULL,
	`phase` text NOT NULL,
	`credential_version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`member_email`) REFERENCES `admin_members`(`email`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `admin_members` ADD `password_hash` text;--> statement-breakpoint
ALTER TABLE `admin_members` ADD `password_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `admin_members` ADD `password_changed_at` text;--> statement-breakpoint
ALTER TABLE `admin_members` ADD `invite_hash` text;--> statement-breakpoint
ALTER TABLE `admin_members` ADD `invite_expires_at` integer;