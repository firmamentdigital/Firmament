CREATE TABLE `owner_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`credential` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
