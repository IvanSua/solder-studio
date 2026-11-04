-- ── Fix URLs de imágenes de productos (encoding corrompido) ─────────────────
-- Las imágenes usan placehold.co con el nombre del producto en la URL.
-- Al insertarse sin encoding UTF-8, los caracteres especiales quedaron como '?'.
-- Este script los restaura a los valores correctos.
--
-- Ejecutar con psql o pgAdmin UNA SOLA VEZ.

SET client_encoding = 'UTF8';

BEGIN;

-- Remera Clásica
UPDATE product_images
SET image_url = 'https://placehold.co/600x600/ffffff/333333?text=Remera+Clásica',
    alt_text  = 'Remera Clásica frente'
WHERE product_id = (SELECT id FROM products WHERE slug = 'remera-clasica')
  AND (image_url LIKE '%Cl%sica%' OR image_url LIKE '%Cl??sica%' OR image_url LIKE '%Cl%3Fsica%');

-- Si el slug está OK pero el URL no matcheó el WHERE, forzar:
UPDATE product_images
SET image_url = 'https://placehold.co/600x600/ffffff/333333?text=Remera+Clásica',
    alt_text  = 'Remera Clásica frente'
WHERE product_id = (SELECT id FROM products WHERE slug = 'remera-clasica')
  AND image_url NOT LIKE '%Clásica%';

-- Taza Cerámica
UPDATE product_images
SET image_url = 'https://placehold.co/600x600/ffffff/333333?text=Taza+Cerámica',
    alt_text  = 'Taza Cerámica 350ml'
WHERE product_id = (SELECT id FROM products WHERE slug = 'taza-ceramica-350')
  AND image_url NOT LIKE '%Cerámica%';

-- Verificar
SELECT p.slug, pi.image_url, pi.alt_text
FROM product_images pi
JOIN products p ON p.id = pi.product_id
ORDER BY p.slug;

COMMIT;
