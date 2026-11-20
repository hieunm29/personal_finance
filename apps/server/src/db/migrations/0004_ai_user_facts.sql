CREATE TABLE `ai_user_facts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
