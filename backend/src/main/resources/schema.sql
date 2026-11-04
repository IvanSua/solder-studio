-- Tienda de Ropa - Database Schema
-- PostgreSQL 16

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),          -- nullable for OAuth2 users
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    cuit VARCHAR(13),
    role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    -- Email verification
    email_verified               BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token     VARCHAR(64),
    email_verification_expires_at TIMESTAMPTZ,
    -- Two-factor authentication
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret  VARCHAR(64),
    -- Loyalty / referrals
    points       INT NOT NULL DEFAULT 0,
    level        VARCHAR(20) NOT NULL DEFAULT 'BRONZE',
    referral_code VARCHAR(20),
    referred_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_referral_code_key ON users(referral_code) WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS addresses (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    street VARCHAR(255) NOT NULL,
    apartment VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    province VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    notes TEXT,
    default_address BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    description TEXT,
    image_url VARCHAR(500),
    parent_id BIGINT REFERENCES categories(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    description TEXT,
    category_id BIGINT REFERENCES categories(id),
    customizable BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    color VARCHAR(100) NOT NULL,
    size VARCHAR(20) NOT NULL,
    price_amount BIGINT NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'ARS',
    stock_total INT NOT NULL DEFAULT 0,
    stock_reserved INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    sku VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, color, size)
);

CREATE TABLE IF NOT EXISTS product_images (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    sort_order INT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE

);

CREATE TABLE IF NOT EXISTS print_areas (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL UNIQUE REFERENCES products(id),
    canvas_width INT NOT NULL,
    canvas_height INT NOT NULL,
    printable_x INT NOT NULL,
    printable_y INT NOT NULL,
    printable_width INT NOT NULL,
    printable_height INT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_designs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    product_variant_id BIGINT NOT NULL REFERENCES product_variants(id),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    scene_json JSONB,
    preview_url VARCHAR(500),
    production_render_url VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS design_assets (
    id BIGSERIAL PRIMARY KEY,
    custom_design_id BIGINT NOT NULL REFERENCES custom_designs(id),
    original_file_url VARCHAR(500) NOT NULL,
    normalized_file_url VARCHAR(500) NOT NULL,
    width_px INT NOT NULL,
    height_px INT NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_abandoned_email_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS cart_items (
    id BIGSERIAL PRIMARY KEY,
    cart_id BIGINT NOT NULL REFERENCES carts(id),
    product_variant_id BIGINT NOT NULL REFERENCES product_variants(id),
    quantity INT NOT NULL,
    custom_design_id BIGINT REFERENCES custom_designs(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    shipping_address_id BIGINT REFERENCES addresses(id),
    subtotal_amount BIGINT NOT NULL,
    discount_amount BIGINT NOT NULL DEFAULT 0,
    tax_amount BIGINT NOT NULL DEFAULT 0,
    shipping_amount BIGINT NOT NULL DEFAULT 0,
    total_amount BIGINT NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'ARS',
    payment_provider VARCHAR(50),
    payment_external_id VARCHAR(255),
    payment_method VARCHAR(30),
    installments INT NOT NULL DEFAULT 1,
    tracking_number VARCHAR(100),
    tracking_url VARCHAR(500),
    estimated_delivery_at TIMESTAMPTZ,
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    product_variant_id BIGINT NOT NULL REFERENCES product_variants(id),
    quantity INT NOT NULL,
    unit_price_amount BIGINT NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'ARS',
    custom_design_id BIGINT REFERENCES custom_designs(id),
    product_name VARCHAR(255) NOT NULL,
    variant_color VARCHAR(100) NOT NULL,
    variant_size VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_reservations (
    id BIGSERIAL PRIMARY KEY,
    variant_id BIGINT NOT NULL REFERENCES product_variants(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    order_id BIGINT REFERENCES orders(id),
    quantity INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotions (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE,
    description TEXT,
    scope VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,
    value BIGINT NOT NULL,
    priority INT NOT NULL DEFAULT 0,
    stackable BOOLEAN NOT NULL DEFAULT FALSE,
    exclusive_group VARCHAR(100),
    target_product_id BIGINT,
    target_category_id BIGINT,
    minimum_purchase_amount BIGINT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_payment_ext ON orders(payment_external_id);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_status ON stock_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_stock_reservations_order ON stock_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS idx_custom_designs_user ON custom_designs(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);

CREATE TABLE IF NOT EXISTS wishlist_items (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS recently_viewed (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

-- ── Reviews y feedback ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS product_reviews (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id    BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title       VARCHAR(150),
    body        TEXT,
    verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, user_id)
);

CREATE TABLE IF NOT EXISTS product_questions (
    id          BIGSERIAL PRIMARY KEY,
    product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question    TEXT NOT NULL,
    answer      TEXT,
    answered_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    answered_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suggestions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(200) NOT NULL,
    description TEXT,
    vote_count  INT NOT NULL DEFAULT 0,
    status      VARCHAR(30) NOT NULL DEFAULT 'open',
    answer      TEXT,
    answered_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    answered_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suggestion_votes (
    id            BIGSERIAL PRIMARY KEY,
    suggestion_id BIGINT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (suggestion_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_product   ON product_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_questions_product ON product_questions(product_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_votes ON suggestions(vote_count DESC);

-- ── Fidelización ─────────────────────────────────────────────────────────────
-- Run manually (ddl-auto: validate):
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS points INT NOT NULL DEFAULT 0;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS level VARCHAR(20) NOT NULL DEFAULT 'BRONZE';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20) UNIQUE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS point_transactions (
    id           BIGSERIAL PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount       INT NOT NULL,
    reason       VARCHAR(60) NOT NULL,
    reference_id BIGINT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS saved_sizes (
    id            BIGSERIAL PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_name VARCHAR(100) NOT NULL,
    size          VARCHAR(20) NOT NULL,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, category_name)
);

CREATE INDEX IF NOT EXISTS idx_point_tx_user ON point_transactions(user_id);

-- ── Notificaciones in-app ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type        VARCHAR(40) NOT NULL,
    title       VARCHAR(150) NOT NULL,
    message     VARCHAR(500) NOT NULL,
    link        VARCHAR(300),
    read        BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read    ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- ── Newsletter subscribers ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    name          VARCHAR(255),
    source        VARCHAR(20) NOT NULL DEFAULT 'REGISTRATION',
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(active, subscribed_at DESC);

-- ── Devoluciones ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS return_requests (
    id           BIGSERIAL PRIMARY KEY,
    order_id     BIGINT NOT NULL REFERENCES orders(id),
    user_id      BIGINT NOT NULL REFERENCES users(id),
    reason       VARCHAR(30) NOT NULL,
    description  TEXT,
    resolution   VARCHAR(20) NOT NULL DEFAULT 'REFUND',
    status       VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    admin_notes  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order  ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_user   ON return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON return_requests(status);

-- ── Eventos ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    subtitle    VARCHAR(300),
    type        VARCHAR(20)  NOT NULL DEFAULT 'CONCERT',
    category    VARCHAR(40),
    event_date  DATE         NOT NULL,
    event_time  TIME,
    venue       VARCHAR(200),
    city        VARCHAR(100) DEFAULT 'Buenos Aires',
    description TEXT,
    image_url   VARCHAR(500),
    ticket_url  VARCHAR(500),
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_date   ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_type   ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(active);

-- ── Guía de Talles ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS size_guides (
    id          BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name        VARCHAR(200) NOT NULL,
    sizes       JSONB NOT NULL,
    measurements JSONB NOT NULL,
    instructions TEXT,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_size_guides_category ON size_guides(category_id) WHERE active = TRUE;

-- ── Admin y operaciones ────────────────────────────────────────────────────────
-- Run manually (ddl-auto: validate):
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- ── Comunicación y marketing ───────────────────────────────────────────────────
-- Run manually (ddl-auto: validate):
-- Column last_abandoned_email_at is defined inline in the carts table above.

-- ── Pagos y finanzas ────────────────────────────────────────────────────────────
-- Run manually (ddl-auto: validate):
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS cuit VARCHAR(13);
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
-- ALTER TABLE orders ADD COLUMN IF NOT EXISTS installments INT NOT NULL DEFAULT 1;

-- ── Seguridad: verificación de email, 2FA y OAuth ───────────────────────────────
-- Run manually (ddl-auto: validate):
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(64);
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires_at TIMESTAMPTZ;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(64);
-- -- Google OAuth users have no local password; allow nullable password_hash:
-- ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
