CREATE TABLE `voucher_otp_challenges` (
	`id` text PRIMARY KEY NOT NULL,
	`voucher_code` text NOT NULL,
	`email` text NOT NULL,
	`purpose` text NOT NULL,
	`otp_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vouchers` (
	`code` text PRIMARY KEY NOT NULL,
	`origin_city` text NOT NULL,
	`origin_airport` text NOT NULL,
	`origin_code` text NOT NULL,
	`destination_city` text NOT NULL,
	`destination_airport` text NOT NULL,
	`destination_code` text NOT NULL,
	`default_travel_date` text NOT NULL,
	`earliest_travel_date` text NOT NULL,
	`latest_travel_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text NOT NULL,
	`redeemed_at` text
);
--> statement-breakpoint
ALTER TABLE `voucher_redemptions` ADD `passport_ciphertext` text;--> statement-breakpoint
ALTER TABLE `voucher_redemptions` ADD `passport_iv` text;--> statement-breakpoint
ALTER TABLE `voucher_redemptions` ADD `verified_at` text;