-- V2 — Índice compuesto para historial de órdenes por usuario
-- Optimiza la query más frecuente del panel de usuario:
--   findByUserIdOrderByCreatedAtDesc
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
