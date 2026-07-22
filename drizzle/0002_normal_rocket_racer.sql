CREATE TABLE `voucher_travel_dates` (
	`voucher_code` text NOT NULL,
	`travel_date` text NOT NULL,
	PRIMARY KEY(`voucher_code`, `travel_date`)
);
