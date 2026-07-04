-- ══════════════════════════════════════════════════════════════════
-- FarmSense Brew — Seed Data
-- File: database/seeds/001_seed_nodes_and_users.sql
--
-- Run after migration (set host/user to match your MySQL instance, e.g. XAMPP local):
--   mysql -h 127.0.0.1 -u root -p farmsense_db < 001_seed_nodes_and_users.sql
-- ══════════════════════════════════════════════════════════════════

USE farmsense_db;

-- ─── SEED: SENSOR NODES (X formation, 50 sqm plot) ───────────────────────────
INSERT IGNORE INTO sensor_nodes (node_id, position, description) VALUES
  ('NODE_01', 'NW_CORNER', 'Northwest corner — shaded side near tree canopy'),
  ('NODE_02', 'NE_CORNER', 'Northeast corner — partial sun exposure'),
  ('NODE_03', 'SW_CORNER', 'Southwest corner — near farm path'),
  ('NODE_04', 'SE_CORNER', 'Southeast corner — most sun-exposed'),
  ('NODE_05', 'CENTER',    'Center of 50 sqm plot — reference point');

-- ─── SEED: USERS ──────────────────────────────────────────────────────────────
-- IMPORTANT: These are PLACEHOLDER bcrypt hashes.
-- Generate real hashes using: python3 -c "import bcrypt; print(bcrypt.hashpw(b'yourpassword', bcrypt.gensalt()).decode())"
-- Or in Node.js: bcrypt.hash('yourpassword', 10)
-- DEFAULT PASSWORDS BELOW — CHANGE BEFORE DEPLOYMENT
--   agronomist_user password: FarmSense@2025
--   farmowner_user  password: Javier@2025
--   fieldstaff_user password: Staff@2025

INSERT IGNORE INTO users (username, password_hash, role, full_name, email) VALUES
  ('agronomist_user',
   '$2b$10$Oqe2YBxxt1qR34lS447Zy.2nBT4RDePYL/50TUQr98AocELqStUBu',
   'agronomist',
   'Farm Agronomist',
   'agronomist@javierfarm.ph'),

  ('farmowner_user',
   '$2b$10$Ar6NkiieRj1qlctvrufbmeQ7vYLh/MJ9FqsWq9MQXl.tRYI./2aou',
   'farm_owner',
   'Farm Owner - Javier',
   'owner@javierfarm.ph'),

  ('fieldstaff_user',
   '$2b$10$EfnA83QcB2lSFb6idTQf2eXWMuv1LPP0rubFFr7NMqLHGSS57RcbO',
   'field_staff',
   'Field Staff',
   'staff@javierfarm.ph');

-- ─── VERIFY SEEDS ─────────────────────────────────────────────────────────────
SELECT 'Sensor Nodes:' AS '';
SELECT node_id, position, description FROM sensor_nodes;

SELECT 'Users:' AS '';
SELECT username, role, full_name, LEFT(password_hash, 20) AS hash_preview FROM users;
