CREATE TABLE `child_guardians` (
	`child_id` text NOT NULL,
	`guardian_id` text NOT NULL,
	PRIMARY KEY(`child_id`, `guardian_id`),
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `children` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`full_name` text NOT NULL,
	`birth_date` text NOT NULL,
	`created_at` text NOT NULL,
	`checked_in_at` text,
	`checked_in_by` text,
	`version` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `families` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`primary_guardian_id` text NOT NULL,
	`phone` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`primary_guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `families_code_unique` ON `families` (`code`);--> statement-breakpoint
CREATE TABLE `family_guardians` (
	`family_id` text NOT NULL,
	`guardian_id` text NOT NULL,
	`will_attend` integer DEFAULT 1 NOT NULL,
	PRIMARY KEY(`family_id`, `guardian_id`),
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guardian_id`) REFERENCES `guardians`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `guardians` (
	`id` text PRIMARY KEY NOT NULL,
	`full_name` text NOT NULL,
	`birth_date` text NOT NULL,
	`created_at` text NOT NULL,
	`checked_in_at` text,
	`checked_in_by` text,
	`version` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`question` text DEFAULT '' NOT NULL,
	`response_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `families`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TRIGGER family_guardian_limit
BEFORE INSERT ON family_guardians
WHEN NOT EXISTS (
  SELECT 1 FROM family_guardians
  WHERE family_id = NEW.family_id AND guardian_id = NEW.guardian_id
) AND (SELECT COUNT(*) FROM family_guardians WHERE family_id = NEW.family_id) >= 2
BEGIN
  SELECT RAISE(ABORT, 'family_guardian_limit');
END;
--> statement-breakpoint
CREATE TRIGGER child_guardian_family
BEFORE INSERT ON child_guardians
WHEN NOT EXISTS (
  SELECT 1 FROM children
  JOIN family_guardians ON family_guardians.family_id = children.family_id
  WHERE children.id = NEW.child_id AND family_guardians.guardian_id = NEW.guardian_id
)
BEGIN
  SELECT RAISE(ABORT, 'child_guardian_family');
END;
