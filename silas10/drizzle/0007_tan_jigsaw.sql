CREATE TABLE `master_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`credential_fingerprint` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `master_sessions_expiry_idx` ON `master_sessions` (`expires_at`);