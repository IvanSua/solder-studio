-- ── Fix encoding de productos seed (versión 2) ───────────────────────────────
-- Ejecutar con psql o pgAdmin.
-- Maneja el caso donde ya existen variantes correctamente codificadas
-- junto con duplicados corruptos (??nica, etc).

SET client_encoding = 'UTF8';

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 1: Eliminar variantes corruptas DONDE YA EXISTE una versión correcta
-- Identifica los registros con '?' en el talle y los borra si hay una versión
-- buena del mismo (product_id, color) ya en la tabla.
-- ─────────────────────────────────────────────────────────────────────────────
DELETE FROM product_variants AS pv_bad
WHERE pv_bad.size LIKE '%?%'
  AND EXISTS (
      SELECT 1 FROM product_variants pv_good

      .
      WHERE pv_good.product_id = pv_bad.product_id
        AND pv_good.color     = pv_bad.color
        AND pv_good.size NOT LIKE '%?%'
        AND pv_good.id != pv_bad.id
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 2: Corregir cualquier variante corrupta restante (sin duplicado)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE product_variants SET size = 'Única'
WHERE size LIKE '%?%' AND size ILIKE '%nica';

-- Capturar otros patrones posibles de tamaños corruptos
UPDATE product_variants SET size = 'Única'
WHERE size IN ('??nica', '?nica', 'Nica', 'Unica') AND size != 'Única';

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 3: Corregir nombres de productos
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE products SET
  name        = 'Remera Clásica',
  description = 'Remera 100% algodón, disponible en múltiples colores y talles. Lavado a máquina.'
WHERE slug = 'remera-clasica';

UPDATE products SET
  name        = 'Taza Cerámica 350ml',
  description = 'Taza de cerámica blanca, apta para lavavajillas. Impresión de alta resolución.'
WHERE slug = 'taza-ceramica-350';

UPDATE products SET
  name        = 'Buzo Canguro',
  description = 'Buzo canguro con capucha y bolsillo frontal. Interior afelpado, ideal para el frío.'
WHERE slug = 'buzo-canguro';

UPDATE products SET
  name        = 'Totebag Canvas',
  description = 'Bolsa de tela resistente, ideal para el día a día. Asa larga y compartimento principal amplio.'
WHERE slug = 'totebag-canvas';

UPDATE products SET
  name        = 'Remera Oversize',
  description = 'Remera de corte oversize, 100% algodón. Perfecta para un look casual y cómodo.'
WHERE slug = 'remera-oversize';

-- ─────────────────────────────────────────────────────────────────────────────
-- PASO 4: Corregir nombres de categorías con caracteres especiales
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE categories SET name = 'Remeras'  WHERE slug = 'remeras'  AND name != 'Remeras';
UPDATE categories SET name = 'Buzos'    WHERE slug = 'buzos'    AND name != 'Buzos';
UPDATE categories SET name = 'Bolsos'   WHERE slug = 'bolsos'   AND name != 'Bolsos';
UPDATE categories SET name = 'Tazas'    WHERE slug = 'tazas'    AND name != 'Tazas';

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN: mostrar resultado
-- ─────────────────────────────────────────────────────────────────────────────
SELECT id, name, slug FROM products ORDER BY id;
SELECT DISTINCT size FROM product_variants ORDER BY size;
SELECT count(*) AS nombres_corruptos_restantes FROM products WHERE name LIKE '%?%';
