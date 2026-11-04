-- ============================================================
-- V1 — Baseline schema
-- Tienda de Ropa / Solder Studio — PostgreSQL 16
-- ============================================================

-- ── Users & Auth ─────────────────────────────────────────────

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    cuit VARCHAR(13),
    role VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verification_token VARCHAR(64),
    email_verification_expires_at TIMESTAMPTZ,
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(64),
    points INT NOT NULL DEFAULT 0,
    level VARCHAR(20) NOT NULL DEFAULT 'BRONZE',
    referral_code VARCHAR(20),
    referred_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX users_referral_code_key ON users(referral_code) WHERE referral_code IS NOT NULL;
CREATE INDEX idx_users_email ON users(email);

CREATE TABLE password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_password_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_user  ON password_reset_tokens(user_id);

CREATE TABLE addresses (
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

CREATE TABLE saved_sizes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_name VARCHAR(100) NOT NULL,
    size VARCHAR(20) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, category_name)
);

-- ── Catalog ───────────────────────────────────────────────────

CREATE TABLE categories (
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
CREATE INDEX idx_categories_slug ON categories(slug);

CREATE TABLE products (
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
CREATE INDEX idx_products_category ON products(category_id) WHERE active = TRUE;
CREATE INDEX idx_products_slug     ON products(slug);

CREATE TABLE product_variants (
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
CREATE INDEX idx_product_variants_product ON product_variants(product_id) WHERE active = TRUE;

CREATE TABLE product_images (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id),
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    sort_order INT NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE print_areas (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL UNIQUE REFERENCES products(id),
    canvas_width INT NOT NULL,
    canvas_height INT NOT NULL,
    printable_x INT NOT NULL,
    printable_y INT NOT NULL,
    printable_width INT NOT NULL,
    printable_height INT NOT NULL
);

CREATE TABLE size_guides (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    sizes JSONB NOT NULL,
    measurements JSONB NOT NULL,
    instructions TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_size_guides_category ON size_guides(category_id) WHERE active = TRUE;

-- ── Custom Designs ────────────────────────────────────────────

CREATE TABLE custom_designs (
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
CREATE INDEX idx_custom_designs_user ON custom_designs(user_id);

CREATE TABLE design_assets (
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

-- ── Cart ─────────────────────────────────────────────────────

CREATE TABLE carts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_abandoned_email_at TIMESTAMPTZ
);

CREATE TABLE cart_items (
    id BIGSERIAL PRIMARY KEY,
    cart_id BIGINT NOT NULL REFERENCES carts(id),
    product_variant_id BIGINT NOT NULL REFERENCES product_variants(id),
    quantity INT NOT NULL,
    custom_design_id BIGINT REFERENCES custom_designs(id)
);

-- ── Orders ───────────────────────────────────────────────────

CREATE TABLE orders (
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
CREATE INDEX idx_orders_user        ON orders(user_id);
CREATE INDEX idx_orders_status_date ON orders(status, created_at);
CREATE INDEX idx_orders_payment_ext ON orders(payment_external_id);

CREATE TABLE order_items (
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

CREATE TABLE stock_reservations (
    id BIGSERIAL PRIMARY KEY,
    variant_id BIGINT NOT NULL REFERENCES product_variants(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    order_id BIGINT REFERENCES orders(id),
    quantity INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_stock_reservations_status ON stock_reservations(status, expires_at);
CREATE INDEX idx_stock_reservations_order  ON stock_reservations(order_id);

CREATE TABLE return_requests (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    reason VARCHAR(30) NOT NULL,
    description TEXT,
    resolution VARCHAR(20) NOT NULL DEFAULT 'REFUND',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    admin_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_returns_order  ON return_requests(order_id);
CREATE INDEX idx_returns_user   ON return_requests(user_id);
CREATE INDEX idx_returns_status ON return_requests(status);

-- ── Payments ─────────────────────────────────────────────────

CREATE TABLE payment_webhook_events (
    id BIGSERIAL PRIMARY KEY,
    payment_external_id VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL,
    order_id BIGINT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    payload_hash VARCHAR(64),
    retry_count INT NOT NULL DEFAULT 0,
    last_error VARCHAR(500),
    next_retry_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX idx_payment_external_id ON payment_webhook_events(payment_external_id);

-- ── Promotions & Gift Cards ───────────────────────────────────

CREATE TABLE promotions (
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
CREATE INDEX idx_promotions_active ON promotions(active, starts_at, ends_at);

CREATE TABLE gift_cards (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(255) NOT NULL UNIQUE,
    initial_amount NUMERIC(10, 2) NOT NULL,
    remaining_amount NUMERIC(10, 2) NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'ARS',
    purchased_by_user_id BIGINT REFERENCES users(id),
    redeemed_by_user_id BIGINT REFERENCES users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    redeemed_at TIMESTAMPTZ
);
CREATE INDEX idx_gift_cards_code ON gift_cards(code);

-- ── Loyalty ───────────────────────────────────────────────────

CREATE TABLE point_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    reason VARCHAR(60) NOT NULL,
    reference_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_point_tx_user ON point_transactions(user_id);

-- ── Wishlist & Recently Viewed ────────────────────────────────

CREATE TABLE wishlist_items (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

CREATE TABLE recently_viewed (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

-- ── Reviews & Q&A ────────────────────────────────────────────

CREATE TABLE product_reviews (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title VARCHAR(150),
    body TEXT,
    verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, user_id)
);
CREATE INDEX idx_reviews_product ON product_reviews(product_id);

CREATE TABLE product_questions (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT,
    answered_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_questions_product ON product_questions(product_id);

-- ── Suggestions ───────────────────────────────────────────────

CREATE TABLE suggestions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    vote_count INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'open',
    answer TEXT,
    answered_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    answered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_suggestions_votes ON suggestions(vote_count DESC);

CREATE TABLE suggestion_votes (
    id BIGSERIAL PRIMARY KEY,
    suggestion_id BIGINT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (suggestion_id, user_id)
);

-- ── Notifications ─────────────────────────────────────────────

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(150) NOT NULL,
    message VARCHAR(500) NOT NULL,
    link VARCHAR(300),
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_read    ON notifications(user_id, read);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- ── Shipping ─────────────────────────────────────────────────

CREATE TABLE shipping_rates (
    id BIGSERIAL PRIMARY KEY,
    province VARCHAR(100) NOT NULL,
    postal_code_prefix VARCHAR(10),
    carrier_name VARCHAR(100) NOT NULL,
    delivery_days_min INT NOT NULL,
    delivery_days_max INT NOT NULL,
    price_amount BIGINT NOT NULL,
    free_shipping_threshold BIGINT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_shipping_rates_province ON shipping_rates(province);
CREATE INDEX idx_shipping_rates_active   ON shipping_rates(active);

-- ── Blog ─────────────────────────────────────────────────────

CREATE TABLE blog_posts (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT,
    author VARCHAR(255) NOT NULL,
    category VARCHAR(255) NOT NULL,
    image_url VARCHAR(500),
    published BOOLEAN NOT NULL DEFAULT FALSE,
    featured BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);
CREATE INDEX idx_blog_posts_slug      ON blog_posts(slug);
CREATE INDEX idx_blog_posts_published ON blog_posts(published, published_at DESC);

-- ── Newsletter ────────────────────────────────────────────────

CREATE TABLE newsletter_subscribers (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    source VARCHAR(20) NOT NULL DEFAULT 'REGISTRATION',
    active BOOLEAN NOT NULL DEFAULT TRUE,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_newsletter_active ON newsletter_subscribers(active, subscribed_at DESC);

-- ── Events ───────────────────────────────────────────────────

CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    subtitle VARCHAR(300),
    type VARCHAR(20) NOT NULL DEFAULT 'CONCERT',
    category VARCHAR(40),
    event_date DATE NOT NULL,
    event_time TIME,
    venue VARCHAR(200),
    city VARCHAR(100) DEFAULT 'Buenos Aires',
    description TEXT,
    image_url VARCHAR(500),
    ticket_url VARCHAR(500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_events_date   ON events(event_date);
CREATE INDEX idx_events_type   ON events(type);
CREATE INDEX idx_events_active ON events(active);
