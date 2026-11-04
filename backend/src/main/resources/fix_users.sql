-- Fix corrupted user first/last names caused by PostgreSQL client_encoding mismatch.
-- Run this once in pgAdmin after restarting the backend with the UTF8 encoding fix.
SET client_encoding = 'UTF8';

BEGIN;

-- Fix any user whose last_name contains replacement characters (stored as ??)
-- Update known corrupted names from seed data
UPDATE users
SET last_name = 'Pérez'
WHERE email = 'juan@example.com'
  AND last_name NOT LIKE '%é%';

-- Generic cleanup: replace common corrupted patterns for accented chars
-- (Only updates rows that still have the double-? corruption pattern)
UPDATE users
SET first_name = regexp_replace(first_name, '\?\?', '', 'g'),
    last_name  = regexp_replace(last_name,  '\?\?', '', 'g')
WHERE first_name LIKE '%??%'
   OR last_name  LIKE '%??%';

COMMIT;

-- Verify
SELECT id, email, first_name, last_name, role FROM users ORDER BY id;
