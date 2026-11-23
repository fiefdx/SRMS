-- SRMS database schema (MySQL 8+ / MariaDB 10.5+, InnoDB, utf8mb4)
--
-- Design notes
--  * orders/order_items: a line stores the dish name and unit price at the time of purchase, so a
--    later price change on the menu never rewrites order history.
--  * reservations: one table holds normal tables and special events (type + occasion + requirements +
--    menu_selection). A separate events table would duplicate every column, so /api/events is a
--    filtered view of this table instead.
--  * Double booking is prevented in a transaction (SELECT ... FOR UPDATE), not by a unique index,
--    because a cancelled booking must not block the table for that slot.

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('customer', 'admin') NOT NULL DEFAULT 'customer',
  phone         VARCHAR(30),
  address       VARCHAR(255),
  dietary_tags  JSON,
  favourites    JSON,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_items (
  id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name         VARCHAR(120) NOT NULL,
  category     ENUM('starter', 'main', 'dessert', 'beverage') NOT NULL,
  description  VARCHAR(500),
  ingredients  JSON,
  allergens    JSON,
  dietary_tags JSON,
  price        DECIMAL(8, 2) NOT NULL,
  available    BOOLEAN NOT NULL DEFAULT TRUE,
  today_special BOOLEAN NOT NULL DEFAULT FALSE,
  popularity   INT NOT NULL DEFAULT 0,
  emoji        VARCHAR(16),
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_menu_name (name),
  KEY idx_menu_category (category),
  KEY idx_menu_available (available),
  CONSTRAINT chk_menu_price CHECK (price > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(40) NOT NULL,
  seats INT NOT NULL,
  area  ENUM('main', 'window', 'group') NOT NULL DEFAULT 'main',
  UNIQUE KEY uq_table_label (label),
  CONSTRAINT chk_table_seats CHECK (seats > 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS orders (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference         VARCHAR(20) NOT NULL,
  user_id           INT UNSIGNED NOT NULL,
  status            ENUM('pending', 'preparing', 'ready', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
  fulfilment        ENUM('delivery', 'pickup') NOT NULL DEFAULT 'delivery',
  fulfilment_details JSON,
  notes             VARCHAR(500),
  subtotal          DECIMAL(10, 2) NOT NULL DEFAULT 0,
  delivery_fee      DECIMAL(8, 2) NOT NULL DEFAULT 0,
  tax               DECIMAL(8, 2) NOT NULL DEFAULT 0,
  total             DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_reference (reference),
  KEY idx_orders_user_status (user_id, status),
  KEY idx_orders_created (created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT chk_orders_total CHECK (total >= 0)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_items (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  menu_item_id INT UNSIGNED,
  name        VARCHAR(120) NOT NULL,
  unit_price  DECIMAL(8, 2) NOT NULL,
  quantity    INT NOT NULL,
  line_total  DECIMAL(10, 2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
  KEY idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_menu FOREIGN KEY (menu_item_id) REFERENCES menu_items (id) ON DELETE SET NULL,
  CONSTRAINT chk_order_items_quantity CHECK (quantity >= 1)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reservations (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference      VARCHAR(20) NOT NULL,
  user_id        INT UNSIGNED NOT NULL,
  type           ENUM('standard', 'birthday', 'corporate', 'group') NOT NULL DEFAULT 'standard',
  table_id       INT UNSIGNED,
  reservation_date DATE NOT NULL,
  start_time     TIME NOT NULL,
  end_time       TIME NOT NULL,
  party_size     INT NOT NULL,
  occasion       VARCHAR(120),
  requirements   VARCHAR(500),
  menu_selection JSON,
  status         ENUM('pending', 'approved', 'cancelled', 'completed') NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_reservations_reference (reference),
  KEY idx_reservations_slot (reservation_date, start_time),
  KEY idx_reservations_user (user_id),
  KEY idx_reservations_type (type),
  CONSTRAINT fk_reservations_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_reservations_table FOREIGN KEY (table_id) REFERENCES restaurant_tables (id) ON DELETE SET NULL,
  CONSTRAINT chk_reservation_party CHECK (party_size >= 1 AND party_size <= 40),
  CONSTRAINT chk_reservation_time CHECK (end_time > start_time)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS feedback (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED,
  user_id    INT UNSIGNED,
  rating     INT,
  comment    VARCHAR(500) NOT NULL,
  sentiment  ENUM('positive', 'neutral', 'negative'),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_feedback_order (order_id),
  CONSTRAINT fk_feedback_order FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL,
  CONSTRAINT chk_feedback_rating CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5))
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
