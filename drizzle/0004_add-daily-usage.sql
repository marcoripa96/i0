CREATE TABLE `daily_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`search_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_usage_user_date_idx` ON `daily_usage` (`user_id`,`date`);--> statement-breakpoint
ALTER TABLE `user` ADD `search_limit` integer DEFAULT 100 NOT NULL;