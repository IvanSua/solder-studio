-- Wishlist & Recently Viewed
CREATE TABLE IF NOT EXISTS wishlist_items (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS recently_viewed (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    viewed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, product_id)
);

-- Reviews & Q&A
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
CREATE INDEX IF NOT EXISTS idx_questions_product ON product_questions(product_id);

-- Suggestions
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
CREATE INDEX IF NOT EXISTS idx_suggestions_votes ON suggestions(vote_count DESC);

CREATE TABLE IF NOT EXISTS suggestion_votes (
    id            BIGSERIAL PRIMARY KEY,
    suggestion_id BIGINT NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    user_id       BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (suggestion_id, user_id)
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       VARCHAR(40) NOT NULL,
    title      VARCHAR(150) NOT NULL,
    message    VARCHAR(500) NOT NULL,
    link       VARCHAR(300),
    read       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read    ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- Shipping
CREATE TABLE IF NOT EXISTS shipping_rates (
    id                     BIGSERIAL PRIMARY KEY,
    province               VARCHAR(100) NOT NULL,
    postal_code_prefix     VARCHAR(10),
    carrier_name           VARCHAR(100) NOT NULL,
    delivery_days_min      INT NOT NULL,
    delivery_days_max      INT NOT NULL,
    price_amount           BIGINT NOT NULL,
    free_shipping_threshold BIGINT,
    active                 BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_province ON shipping_rates(province);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_active   ON shipping_rates(active);

-- Blog
CREATE TABLE IF NOT EXISTS blog_posts (
    id           BIGSERIAL PRIMARY KEY,
    title        VARCHAR(255) NOT NULL,
    slug         VARCHAR(255) NOT NULL UNIQUE,
    excerpt      TEXT,
    content      TEXT,
    author       VARCHAR(255) NOT NULL,
    category     VARCHAR(255) NOT NULL,
    image_url    VARCHAR(500),
    published    BOOLEAN NOT NULL DEFAULT FALSE,
    featured     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug      ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(published, published_at DESC);

-- Newsletter
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id            BIGSERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    name          VARCHAR(255),
    source        VARCHAR(20) NOT NULL DEFAULT 'REGISTRATION',
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_subscribers(active, subscribed_at DESC);

-- Events
CREATE TABLE IF NOT EXISTS events (
    id          BIGSERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    subtitle    VARCHAR(300),
    type        VARCHAR(20) NOT NULL DEFAULT 'CONCERT',
    category    VARCHAR(40),
    event_date  DATE NOT NULL,
    event_time  TIME,
    venue       VARCHAR(200),
    city        VARCHAR(100) DEFAULT 'Buenos Aires',
    description TEXT,
    image_url   VARCHAR(500),
    ticket_url  VARCHAR(500),
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_events_date   ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_type   ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_active ON events(active);
