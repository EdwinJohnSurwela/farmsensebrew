-- ══════════════════════════════════════════════════════════════════
-- FarmSense Brew — Admin Seed Data
-- File: database/seeds/002_seed_admin_user.sql
--
-- Run after the main seed file so the schema already exists:
--   mysql -h YOUR_RDS_ENDPOINT -u admin -p farmsense_db < database/seeds/002_seed_admin_user.sql
-- ══════════════════════════════════════════════════════════════════

USE farmsense_db;

-- Admin dashboard login account
-- Username: admin
-- Password: FarmSenseAdmin@2025
INSERT IGNORE INTO users (username, password_hash, role, full_name, email) VALUES
  ('admin',
   '$2b$10$bbeWHGQs6X.zZ0wy6Uh1cuqu7C3klwNX9KZMMi2y1EDFQvbfY.wjW',
   'admin',
   'System Administrator',
   'admin@farmsensebrew.local');

-- Verify seed
SELECT username, role, full_name, email
FROM users
WHERE username = 'admin';
