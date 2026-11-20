ALTER TABLE `transactions` ADD `to_asset_id` text REFERENCES assets(id);--> statement-breakpoint
-- Chuyển ví (wallets, không có số dư) thành tài sản tiền mặt / ngân hàng có số dư thật.
-- Ví tiền mặt dùng lại tài sản tiền mặt có sẵn của user (nếu có) để không tạo trùng.
CREATE TABLE `_wallet_asset_map` (`wallet_id` text PRIMARY KEY NOT NULL, `asset_id` text NOT NULL);
--> statement-breakpoint
INSERT INTO `_wallet_asset_map` (`wallet_id`, `asset_id`)
SELECT w.`id`, (SELECT a.`id` FROM `assets` a WHERE a.`user_id` = w.`user_id` AND a.`type` = 'cash' ORDER BY a.`created_at`, a.`rowid` LIMIT 1)
FROM `wallets` w
WHERE w.`type` = 'cash' AND EXISTS (SELECT 1 FROM `assets` a WHERE a.`user_id` = w.`user_id` AND a.`type` = 'cash');
--> statement-breakpoint
INSERT INTO `_wallet_asset_map` (`wallet_id`, `asset_id`)
SELECT w.`id`,
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))
FROM `wallets` w
WHERE w.`id` NOT IN (SELECT `wallet_id` FROM `_wallet_asset_map`);
--> statement-breakpoint
INSERT INTO `assets` (`id`, `user_id`, `type`, `name`, `current_value`, `created_at`, `updated_at`)
SELECT m.`asset_id`, w.`user_id`, CASE WHEN w.`type` = 'cash' THEN 'cash' ELSE 'bank' END, w.`name`, w.`initial_balance`, w.`created_at`, datetime('now')
FROM `_wallet_asset_map` m JOIN `wallets` w ON w.`id` = m.`wallet_id`
WHERE m.`asset_id` NOT IN (SELECT `id` FROM `assets`);
--> statement-breakpoint
-- Giữ asset_id sẵn có (dữ liệu cũ có thể có cả wallet_id lẫn asset_id; asset là tài khoản thật).
UPDATE `transactions` SET `asset_id` = coalesce(`asset_id`, (SELECT m.`asset_id` FROM `_wallet_asset_map` m WHERE m.`wallet_id` = `transactions`.`wallet_id`)), `wallet_id` = NULL
WHERE `wallet_id` IN (SELECT `wallet_id` FROM `_wallet_asset_map`);
--> statement-breakpoint
UPDATE `transactions` SET `to_asset_id` = coalesce(`to_asset_id`, (SELECT m.`asset_id` FROM `_wallet_asset_map` m WHERE m.`wallet_id` = `transactions`.`to_wallet_id`)), `to_wallet_id` = NULL
WHERE `to_wallet_id` IN (SELECT `wallet_id` FROM `_wallet_asset_map`);
--> statement-breakpoint
UPDATE `recurring_templates` SET `asset_id` = coalesce(`asset_id`, (SELECT m.`asset_id` FROM `_wallet_asset_map` m WHERE m.`wallet_id` = `recurring_templates`.`wallet_id`)), `wallet_id` = NULL
WHERE `wallet_id` IN (SELECT `wallet_id` FROM `_wallet_asset_map`);
--> statement-breakpoint
DELETE FROM `wallets` WHERE `id` IN (SELECT `wallet_id` FROM `_wallet_asset_map`);
--> statement-breakpoint
DROP TABLE `_wallet_asset_map`;
