CREATE TABLE `collections` (
	`prefix` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`total` integer NOT NULL,
	`author` text,
	`license` text,
	`category` text,
	`palette` integer,
	`height` integer,
	`version` text,
	`samples` text
);
--> statement-breakpoint
CREATE TABLE `icons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`prefix` text NOT NULL,
	`name` text NOT NULL,
	`full_name` text NOT NULL,
	`body` text NOT NULL,
	`width` integer,
	`height` integer,
	`category` text,
	`tags` text,
	`embedding` F32_BLOB(256)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `icons_full_name_idx` ON `icons` (`full_name`);--> statement-breakpoint
CREATE INDEX `icons_prefix_idx` ON `icons` (`prefix`);--> statement-breakpoint
CREATE INDEX `icons_category_idx` ON `icons` (`category`);