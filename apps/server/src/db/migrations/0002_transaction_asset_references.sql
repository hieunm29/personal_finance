-- Expand transaction and recurring-template account references on a fresh MVP
-- schema. The legacy-aware runner must substitute existing asset_id and
-- recurring_template_id source columns when those columns already exist; the
-- NULL literals below are intentional for the original baseline tables.
PRAGMA foreign_keys = OFF;

CREATE TABLE `transactions_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`category_id` text NOT NULL,
	`wallet_id` text,
	`asset_id` text,
	`recurring_template_id` text,
	`to_wallet_id` text,
	`date` text NOT NULL,
	`note` text,
	`is_recurring` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE no action
);

INSERT INTO `transactions_new` (
	`id`, `user_id`, `type`, `amount`, `category_id`, `wallet_id`, `asset_id`, `recurring_template_id`,
	`to_wallet_id`, `date`, `note`, `is_recurring`, `created_at`, `updated_at`
)
SELECT
	`id`, `user_id`, `type`, `amount`, `category_id`, `wallet_id`, NULL, NULL,
	`to_wallet_id`, `date`, `note`, `is_recurring`, `created_at`, `updated_at`
FROM `transactions`;

DROP TABLE `transactions`;
ALTER TABLE `transactions_new` RENAME TO `transactions`;

CREATE TABLE `recurring_templates_new` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`category_id` text NOT NULL,
	`wallet_id` text,
	`asset_id` text,
	`note` text,
	`interval` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`last_generated_date` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE no action
);

INSERT INTO `recurring_templates_new` (
	`id`, `user_id`, `type`, `amount`, `category_id`, `wallet_id`, `asset_id`, `note`,
	`interval`, `start_date`, `end_date`, `last_generated_date`, `is_active`, `created_at`
)
SELECT
	`id`, `user_id`, `type`, `amount`, `category_id`, `wallet_id`, NULL, `note`,
	`interval`, `start_date`, `end_date`, `last_generated_date`, `is_active`, `created_at`
FROM `recurring_templates`;

DROP TABLE `recurring_templates`;
ALTER TABLE `recurring_templates_new` RENAME TO `recurring_templates`;

PRAGMA foreign_keys = ON;
