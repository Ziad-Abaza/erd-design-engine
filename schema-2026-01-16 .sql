-- Generated SQL Schema
-- Generated on: 2026-01-16T16:41:49.885Z
-- Tables: 43
-- ERD SchemaFlow SQL Generator

-- Create tables

CREATE TABLE IF NOT EXISTS `advertisements` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(191),
  `brief` TEXT,
  `content` LONGTEXT,
  `redirect_to` VARCHAR(191),
  `target_screen` VARCHAR(191),
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `cache` (
  `key` VARCHAR(191) NOT NULL,
  `value` MEDIUMTEXT NOT NULL,
  `expiration` INT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `cache_locks` (
  `key` VARCHAR(191) NOT NULL,
  `owner` VARCHAR(191) NOT NULL,
  `expiration` INT NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `carts` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT,
  `session_id` VARCHAR(191),
  `subtotal` DECIMAL(10,2) NOT NULL,
  `discount` DECIMAL(10,2) NOT NULL,
  `tax` DECIMAL(10,2) NOT NULL,
  `shipping` DECIMAL(10,2) NOT NULL,
  `total` DECIMAL(10,2) NOT NULL,
  `coupons` LONGTEXT,
  `shipping_method` VARCHAR(191),
  `shipping_address` VARCHAR(191),
  `billing_address` VARCHAR(191),
  `completed_at` TIMESTAMP,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  `deleted_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `cart_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `cart_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `vendor_id` BIGINT NOT NULL,
  `quantity` INT NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `discount` DECIMAL(10,2) NOT NULL,
  `tax` DECIMAL(10,2) NOT NULL,
  `total` DECIMAL(10,2),
  `options` LONGTEXT,
  `note` TEXT,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  `deleted_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `categories` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `category_name` VARCHAR(191) NOT NULL UNIQUE,
  `description` TEXT,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `category_product` (
  `category_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`category_id`, `product_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `failed_jobs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `uuid` VARCHAR(191) NOT NULL UNIQUE,
  `connection` TEXT NOT NULL,
  `queue` TEXT NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `exception` LONGTEXT NOT NULL,
  `failed_at` TIMESTAMP NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `faqs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `question` VARCHAR(191) NOT NULL,
  `answer` TEXT NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `favorites` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `follows` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `vendor_id` BIGINT NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `jobs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `queue` VARCHAR(191) NOT NULL,
  `payload` LONGTEXT NOT NULL,
  `attempts` TINYINT NOT NULL,
  `reserved_at` INT,
  `available_at` INT NOT NULL,
  `created_at` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `job_batches` (
  `id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `total_jobs` INT NOT NULL,
  `pending_jobs` INT NOT NULL,
  `failed_jobs` INT NOT NULL,
  `failed_job_ids` LONGTEXT NOT NULL,
  `options` MEDIUMTEXT,
  `cancelled_at` INT,
  `created_at` INT NOT NULL,
  `finished_at` INT,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `media` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `model_type` VARCHAR(191) NOT NULL,
  `model_id` BIGINT NOT NULL,
  `uuid` CHAR(36) UNIQUE,
  `collection_name` VARCHAR(191) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `file_name` VARCHAR(191) NOT NULL,
  `mime_type` VARCHAR(191),
  `disk` VARCHAR(191) NOT NULL,
  `conversions_disk` VARCHAR(191),
  `size` BIGINT NOT NULL,
  `manipulations` LONGTEXT NOT NULL,
  `custom_properties` LONGTEXT NOT NULL,
  `generated_conversions` LONGTEXT NOT NULL,
  `responsive_images` LONGTEXT NOT NULL,
  `order_column` INT,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `migrations` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `migration` VARCHAR(191) NOT NULL,
  `batch` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` CHAR(36) NOT NULL,
  `type` VARCHAR(191) NOT NULL,
  `notifiable_type` VARCHAR(191) NOT NULL,
  `notifiable_id` BIGINT NOT NULL,
  `data` TEXT NOT NULL,
  `read_at` TIMESTAMP,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `orders` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_number` VARCHAR(191) NOT NULL UNIQUE,
  `user_id` BIGINT,
  `cart_id` BIGINT,
  `status_id` BIGINT NOT NULL,
  `payment_method_id` BIGINT,
  `payment_status_id` BIGINT,
  `billing_name` VARCHAR(191) NOT NULL,
  `billing_email` VARCHAR(191) NOT NULL,
  `billing_phone` VARCHAR(191) NOT NULL,
  `billing_address` VARCHAR(191) NOT NULL,
  `billing_city` VARCHAR(191) NOT NULL,
  `billing_state` VARCHAR(191),
  `billing_country` VARCHAR(191) NOT NULL,
  `billing_postcode` VARCHAR(191) NOT NULL,
  `shipping_name` VARCHAR(191) NOT NULL,
  `shipping_email` VARCHAR(191) NOT NULL,
  `shipping_phone` VARCHAR(191) NOT NULL,
  `shipping_address` VARCHAR(191) NOT NULL,
  `shipping_city` VARCHAR(191) NOT NULL,
  `shipping_state` VARCHAR(191),
  `shipping_country` VARCHAR(191) NOT NULL,
  `shipping_postcode` VARCHAR(191) NOT NULL,
  `subtotal` DECIMAL(10,2) NOT NULL,
  `shipping_cost` DECIMAL(10,2) NOT NULL,
  `tax_amount` DECIMAL(10,2) NOT NULL,
  `discount_amount` DECIMAL(10,2) NOT NULL,
  `total` DECIMAL(10,2) NOT NULL,
  `transaction_id` VARCHAR(191),
  `payment_details` TEXT,
  `paid_at` TIMESTAMP,
  `shipping_method` VARCHAR(191),
  `tracking_number` VARCHAR(191),
  `notes` TEXT,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  `deleted_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_downloads` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `order_item_id` BIGINT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `file` VARCHAR(191) NOT NULL,
  `filename` VARCHAR(191) NOT NULL,
  `download_limit` INT NOT NULL,
  `download_count` INT NOT NULL,
  `expires_at` TIMESTAMP,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_histories` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `status_id` BIGINT NOT NULL,
  `comment` TEXT,
  `notify_customer` TINYINT NOT NULL,
  `created_by` BIGINT,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `vendor_id` BIGINT NOT NULL,
  `product_name` VARCHAR(191) NOT NULL,
  `product_sku` VARCHAR(191),
  `price` DECIMAL(10,2) NOT NULL,
  `quantity` INT NOT NULL,
  `options` LONGTEXT,
  `tax_amount` DECIMAL(10,2) NOT NULL,
  `discount_amount` DECIMAL(10,2) NOT NULL,
  `total` DECIMAL(10,2) NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_notes` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `order_id` BIGINT NOT NULL,
  `note` TEXT NOT NULL,
  `created_by` BIGINT NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_statuses` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `color` VARCHAR(191) NOT NULL,
  `is_default` BOOLEAN NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `password_reset_tokens` (
  `email` VARCHAR(191) NOT NULL,
  `token` VARCHAR(191) NOT NULL,
  `created_at` TIMESTAMP,
  PRIMARY KEY (`email`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `payment_methods` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `code` VARCHAR(191) NOT NULL UNIQUE,
  `description` TEXT,
  `is_active` BOOLEAN NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `payment_statuses` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `color` VARCHAR(191) NOT NULL,
  `is_default` BOOLEAN NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `personal_access_tokens` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `tokenable_type` VARCHAR(191) NOT NULL,
  `tokenable_id` BIGINT NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `token` VARCHAR(64) NOT NULL UNIQUE,
  `abilities` TEXT,
  `last_used_at` TIMESTAMP,
  `expires_at` TIMESTAMP,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `products` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `vendor_id` BIGINT NOT NULL,
  `product_name` VARCHAR(191) NOT NULL UNIQUE,
  `description` TEXT,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_details` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT NOT NULL,
  `size` VARCHAR(191),
  `color` VARCHAR(191),
  `price` DECIMAL(8,2) NOT NULL,
  `discount` DECIMAL(8,2),
  `stock` INT NOT NULL,
  `material` VARCHAR(191),
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `promotions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `promotion_amount` DECIMAL(8,2),
  `promotion_priority` INT NOT NULL,
  `duration` INT NOT NULL,
  `status` ENUM NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `regions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL UNIQUE,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `region_vendor` (
  `region_id` BIGINT NOT NULL,
  `vendor_id` BIGINT NOT NULL,
  `delivery_cost` DOUBLE,
  `discount` INT,
  `description` TEXT,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`region_id`, `vendor_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `reviews` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `product_id` BIGINT NOT NULL,
  `rating` TINYINT NOT NULL,
  `comment` TEXT,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` BIGINT,
  `ip_address` VARCHAR(45),
  `user_agent` TEXT,
  `payload` LONGTEXT NOT NULL,
  `last_activity` INT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `static_pages` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `title` VARCHAR(191) NOT NULL,
  `slug` VARCHAR(191) NOT NULL UNIQUE,
  `content` TEXT NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `subject` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `status` VARCHAR(191) NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191),
  `email` VARCHAR(191) NOT NULL UNIQUE,
  `password` VARCHAR(191) NOT NULL,
  `email_verified_at` TIMESTAMP NOT NULL,
  `address` VARCHAR(191),
  `phone` VARCHAR(191) UNIQUE,
  `gender` ENUM,
  `token` VARCHAR(191),
  `token_expiration` TIMESTAMP,
  `is_active` BOOLEAN NOT NULL,
  `role` ENUM,
  `remember_token` VARCHAR(100),
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  `verification_token` VARCHAR(191),
  `is_verified` BOOLEAN NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_vendor` (
  `user_id` BIGINT NOT NULL,
  `vendor_id` BIGINT NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`user_id`, `vendor_id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `vendors` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `brand_name` VARCHAR(191) NOT NULL UNIQUE,
  `image` VARCHAR(191),
  `description` TEXT,
  `phone` VARCHAR(191) NOT NULL,
  `status` ENUM NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  `deleted_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `vendor_promotion` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `vendor_id` BIGINT NOT NULL,
  `promotion_id` BIGINT NOT NULL,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `status` ENUM NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wallets` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `balance` DECIMAL(15,2) NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  `is_active` BOOLEAN NOT NULL,
  `last_activity_at` TIMESTAMP,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  `deleted_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `wallet_id` BIGINT NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `description` VARCHAR(191) NOT NULL,
  `meta` LONGTEXT,
  `balance_after` DECIMAL(15,2) NOT NULL,
  `reference_id` BIGINT,
  `reference_type` VARCHAR(191),
  `referenceable_type` VARCHAR(191) NOT NULL,
  `referenceable_id` BIGINT NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  `deleted_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wishlists` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL UNIQUE,
  `name` VARCHAR(191) NOT NULL UNIQUE,
  `is_default` BOOLEAN NOT NULL,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  `deleted_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wishlist_items` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `wishlist_id` BIGINT NOT NULL UNIQUE,
  `product_id` BIGINT NOT NULL UNIQUE,
  `note` TEXT,
  `created_at` TIMESTAMP,
  `updated_at` TIMESTAMP,
  `deleted_at` TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB;

-- Foreign key constraints

ALTER TABLE `carts`
  ADD CONSTRAINT `fk_carts_user_id_to_users_id`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `cart_items`
  ADD CONSTRAINT `fk_cart_items_cart_id_to_carts_id`
  FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `cart_items`
  ADD CONSTRAINT `fk_cart_items_product_id_to_products_id`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `cart_items`
  ADD CONSTRAINT `fk_cart_items_vendor_id_to_users_id`
  FOREIGN KEY (`vendor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `category_product`
  ADD CONSTRAINT `fk_category_product_category_id_to_categories_id`
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `category_product`
  ADD CONSTRAINT `fk_category_product_product_id_to_products_id`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `favorites`
  ADD CONSTRAINT `fk_favorites_product_id_to_products_id`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `favorites`
  ADD CONSTRAINT `fk_favorites_user_id_to_users_id`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `follows`
  ADD CONSTRAINT `fk_follows_user_id_to_users_id`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `follows`
  ADD CONSTRAINT `fk_follows_vendor_id_to_vendors_id`
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_cart_id_to_carts_id`
  FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_payment_method_id_to_payment_methods_id`
  FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_payment_status_id_to_payment_statuses_id`
  FOREIGN KEY (`payment_status_id`) REFERENCES `payment_statuses`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_status_id_to_order_statuses_id`
  FOREIGN KEY (`status_id`) REFERENCES `order_statuses`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `orders`
  ADD CONSTRAINT `fk_orders_user_id_to_users_id`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_downloads`
  ADD CONSTRAINT `fk_order_downloads_order_id_to_orders_id`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_downloads`
  ADD CONSTRAINT `fk_order_downloads_order_item_id_to_order_items_id`
  FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_histories`
  ADD CONSTRAINT `fk_order_histories_created_by_to_users_id`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_histories`
  ADD CONSTRAINT `fk_order_histories_order_id_to_orders_id`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_histories`
  ADD CONSTRAINT `fk_order_histories_status_id_to_order_statuses_id`
  FOREIGN KEY (`status_id`) REFERENCES `order_statuses`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_order_items_order_id_to_orders_id`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_order_items_product_id_to_products_id`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_items`
  ADD CONSTRAINT `fk_order_items_vendor_id_to_users_id`
  FOREIGN KEY (`vendor_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_notes`
  ADD CONSTRAINT `fk_order_notes_created_by_to_users_id`
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `order_notes`
  ADD CONSTRAINT `fk_order_notes_order_id_to_orders_id`
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `products`
  ADD CONSTRAINT `fk_products_vendor_id_to_vendors_id`
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `product_details`
  ADD CONSTRAINT `fk_product_details_product_id_to_products_id`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `region_vendor`
  ADD CONSTRAINT `fk_region_vendor_region_id_to_regions_id`
  FOREIGN KEY (`region_id`) REFERENCES `regions`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `region_vendor`
  ADD CONSTRAINT `fk_region_vendor_vendor_id_to_vendors_id`
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `reviews`
  ADD CONSTRAINT `fk_reviews_product_id_to_products_id`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `reviews`
  ADD CONSTRAINT `fk_reviews_user_id_to_users_id`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `support_tickets`
  ADD CONSTRAINT `fk_support_tickets_user_id_to_users_id`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `user_vendor`
  ADD CONSTRAINT `fk_user_vendor_user_id_to_users_id`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `user_vendor`
  ADD CONSTRAINT `fk_user_vendor_vendor_id_to_vendors_id`
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `vendor_promotion`
  ADD CONSTRAINT `fk_vendor_promotion_promotion_id_to_promotions_id`
  FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `vendor_promotion`
  ADD CONSTRAINT `fk_vendor_promotion_vendor_id_to_vendors_id`
  FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `wallets`
  ADD CONSTRAINT `fk_wallets_user_id_to_users_id`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `wallet_transactions`
  ADD CONSTRAINT `fk_wallet_transactions_wallet_id_to_wallets_id`
  FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `wishlists`
  ADD CONSTRAINT `fk_wishlists_user_id_to_users_id`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `wishlist_items`
  ADD CONSTRAINT `fk_wishlist_items_product_id_to_products_id`
  FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE `wishlist_items`
  ADD CONSTRAINT `fk_wishlist_items_wishlist_id_to_wishlists_id`
  FOREIGN KEY (`wishlist_id`) REFERENCES `wishlists`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

