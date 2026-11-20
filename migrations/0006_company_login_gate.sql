-- Migration 0006: Add access_password column to companies table and seed company passwords
ALTER TABLE companies ADD COLUMN access_password TEXT NOT NULL DEFAULT '1234';

-- Update distinct access passwords for existing companies
UPDATE companies SET access_password = '3E2026' WHERE name = 'Three Eagles Ltd';
UPDATE companies SET access_password = 'AV2026' WHERE name = 'Avondale Construction Limited';
UPDATE companies SET access_password = 'PME2026' WHERE name = 'PME';
UPDATE companies SET access_password = '3602026' WHERE name = '360';
UPDATE companies SET access_password = 'RUD2026' WHERE name = 'Ruddy';
UPDATE companies SET access_password = 'AQU2026' WHERE name = 'Aquascape';

-- Upsert default companies if not already present
INSERT OR IGNORE INTO companies (name, access_password, is_default, display_order, active) VALUES
  ('Three Eagles Ltd', '3E2026', 1, 1, 1),
  ('Avondale Construction Limited', 'AV2026', 0, 2, 1),
  ('PME', 'PME2026', 0, 3, 1),
  ('360', '3602026', 0, 4, 1),
  ('Ruddy', 'RUD2026', 0, 5, 1),
  ('Aquascape', 'AQU2026', 0, 6, 1);
