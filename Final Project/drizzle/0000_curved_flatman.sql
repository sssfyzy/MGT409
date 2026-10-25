CREATE TABLE `hs_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`payload` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `hs_events_owner` ON `hs_events` (`owner`);--> statement-breakpoint
CREATE TABLE `hs_members` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`person_id` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `hs_member_contact` ON `hs_members` (`event_id`,`email`);--> statement-breakpoint
CREATE INDEX `hs_member_user` ON `hs_members` (`user_id`);--> statement-breakpoint
CREATE INDEX `hs_member_email` ON `hs_members` (`email`);--> statement-breakpoint
CREATE TABLE `hs_operations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`kind` text NOT NULL,
	`state` text NOT NULL,
	`detail` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hs_records` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires` integer
);
