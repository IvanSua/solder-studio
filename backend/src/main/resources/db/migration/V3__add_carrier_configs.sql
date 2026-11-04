-- Carrier configuration for hybrid shipping system.
-- One row per supported carrier. Seeded with the three Argentine carriers.
-- mode: MANUAL (use DB rates table) | AUTO (call carrier API in real time)
-- Credentials are optional — when null, mode falls back to MANUAL automatically.

CREATE TABLE carrier_configs (
    id              BIGSERIAL PRIMARY KEY,
    carrier_code    VARCHAR(50)  NOT NULL UNIQUE,   -- OCA, ANDREANI, CORREO_ARGENTINO
    carrier_name    VARCHAR(100) NOT NULL,
    mode            VARCHAR(10)  NOT NULL DEFAULT 'MANUAL' CHECK (mode IN ('MANUAL','AUTO')),
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    api_username    VARCHAR(255),
    api_password    VARCHAR(255),
    api_client_number VARCHAR(100),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO carrier_configs (carrier_code, carrier_name, mode, enabled) VALUES
    ('OCA',                 'OCA e-Pak',          'MANUAL', TRUE),
    ('ANDREANI',            'Andreani',            'MANUAL', TRUE),
    ('CORREO_ARGENTINO',    'Correo Argentino',    'MANUAL', TRUE);
