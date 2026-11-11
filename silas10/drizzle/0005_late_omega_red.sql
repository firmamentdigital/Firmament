ALTER TABLE `families` ADD `status` text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `families` ADD `cancelled_at` text;--> statement-breakpoint
ALTER TABLE `families` ADD `cancelled_by` text;