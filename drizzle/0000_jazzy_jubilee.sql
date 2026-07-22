CREATE TABLE `voucher_redemptions` (
	`id` text PRIMARY KEY NOT NULL,
	`reference` text NOT NULL,
	`voucher_code` text NOT NULL,
	`origin_code` text NOT NULL,
	`destination_code` text NOT NULL,
	`travel_date` text NOT NULL,
	`full_name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`address` text NOT NULL,
	`latitude` real,
	`longitude` real,
	`location_accuracy` real,
	`location_captured_at` text,
	`location_consent` integer NOT NULL,
	`privacy_consent` integer NOT NULL,
	`email_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `voucher_redemptions_reference_unique` ON `voucher_redemptions` (`reference`);--> statement-breakpoint
CREATE UNIQUE INDEX `voucher_redemptions_voucher_code_unique` ON `voucher_redemptions` (`voucher_code`);