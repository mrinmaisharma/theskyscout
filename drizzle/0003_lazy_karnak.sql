CREATE TABLE `voucher_usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`voucher_code` text NOT NULL,
	`event_type` text NOT NULL,
	`visitor_id` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`accept_language` text,
	`referrer` text,
	`country` text,
	`region` text,
	`city` text,
	`event_metadata` text,
	`created_at` text NOT NULL
);
