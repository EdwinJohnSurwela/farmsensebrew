-- ══════════════════════════════════════════════════════════════════
-- FarmSense Brew — Mockup Sensor Data for IT322 Demo
-- File: database/seeds/002_seed_mockup_sensor_data.sql
--
-- Generates realistic 24h sensor data for all 5 nodes
-- Run after 001_seed_nodes_and_users.sql
-- ══════════════════════════════════════════════════════════════════

USE farmsense_db;

-- ─── MOCKUP: SENSOR READINGS (last 24 hours, every 30 min per node) ──────────
-- Simulates realistic microclimate patterns for Liberica coffee

INSERT INTO sensor_readings (node_id, position, temperature, humidity, soil_pct, soil_raw, clr_risk, confidence_pct, recorded_at) VALUES
-- NODE_01 (NW_CORNER) — Shaded, moderate risk
('NODE_01','NW_CORNER', 22.1, 82, 45, 2100, 'MODERATE', 72.5, NOW() - INTERVAL 24 HOUR),
('NODE_01','NW_CORNER', 21.8, 84, 44, 2080, 'MODERATE', 74.1, NOW() - INTERVAL 23 HOUR),
('NODE_01','NW_CORNER', 21.5, 88, 43, 2050, 'HIGH',     81.3, NOW() - INTERVAL 22 HOUR),
('NODE_01','NW_CORNER', 21.3, 89, 42, 2030, 'HIGH',     83.7, NOW() - INTERVAL 21 HOUR),
('NODE_01','NW_CORNER', 21.6, 86, 41, 2010, 'HIGH',     79.2, NOW() - INTERVAL 20 HOUR),
('NODE_01','NW_CORNER', 22.4, 82, 40, 1990, 'MODERATE', 68.4, NOW() - INTERVAL 19 HOUR),
('NODE_01','NW_CORNER', 23.8, 75, 38, 1920, 'MODERATE', 55.6, NOW() - INTERVAL 18 HOUR),
('NODE_01','NW_CORNER', 25.2, 68, 36, 1860, 'LOW',      42.3, NOW() - INTERVAL 17 HOUR),
('NODE_01','NW_CORNER', 26.5, 65, 34, 1810, 'LOW',      38.1, NOW() - INTERVAL 16 HOUR),
('NODE_01','NW_CORNER', 27.2, 62, 32, 1770, 'LOW',      35.5, NOW() - INTERVAL 15 HOUR),
('NODE_01','NW_CORNER', 26.8, 64, 31, 1750, 'LOW',      36.8, NOW() - INTERVAL 14 HOUR),
('NODE_01','NW_CORNER', 26.1, 67, 30, 1730, 'LOW',      40.2, NOW() - INTERVAL 13 HOUR),
('NODE_01','NW_CORNER', 25.5, 70, 32, 1760, 'MODERATE', 48.9, NOW() - INTERVAL 12 HOUR),
('NODE_01','NW_CORNER', 24.8, 73, 34, 1800, 'MODERATE', 52.4, NOW() - INTERVAL 11 HOUR),
('NODE_01','NW_CORNER', 24.2, 76, 36, 1840, 'MODERATE', 58.7, NOW() - INTERVAL 10 HOUR),
('NODE_01','NW_CORNER', 23.6, 78, 38, 1880, 'MODERATE', 62.1, NOW() - INTERVAL 9 HOUR),
('NODE_01','NW_CORNER', 23.1, 80, 40, 1920, 'MODERATE', 66.3, NOW() - INTERVAL 8 HOUR),
('NODE_01','NW_CORNER', 22.8, 81, 41, 1950, 'MODERATE', 69.5, NOW() - INTERVAL 7 HOUR),
('NODE_01','NW_CORNER', 22.5, 82, 42, 1980, 'MODERATE', 71.2, NOW() - INTERVAL 6 HOUR),
('NODE_01','NW_CORNER', 22.3, 83, 43, 2000, 'MODERATE', 73.8, NOW() - INTERVAL 5 HOUR),
('NODE_01','NW_CORNER', 22.1, 84, 44, 2020, 'MODERATE', 75.1, NOW() - INTERVAL 4 HOUR),
('NODE_01','NW_CORNER', 22.0, 85, 44, 2040, 'HIGH',     78.6, NOW() - INTERVAL 3 HOUR),
('NODE_01','NW_CORNER', 21.8, 86, 45, 2060, 'HIGH',     80.2, NOW() - INTERVAL 2 HOUR),
('NODE_01','NW_CORNER', 22.1, 84, 45, 2080, 'MODERATE', 74.3, NOW() - INTERVAL 1 HOUR),

-- NODE_02 (NE_CORNER) — Partial sun, high risk
('NODE_02','NE_CORNER', 22.8, 85, 28, 1650, 'HIGH', 82.1, NOW() - INTERVAL 24 HOUR),
('NODE_02','NE_CORNER', 22.5, 87, 27, 1630, 'HIGH', 84.5, NOW() - INTERVAL 23 HOUR),
('NODE_02','NE_CORNER', 22.2, 89, 26, 1610, 'HIGH', 87.2, NOW() - INTERVAL 22 HOUR),
('NODE_02','NE_CORNER', 22.0, 90, 25, 1590, 'HIGH', 89.1, NOW() - INTERVAL 21 HOUR),
('NODE_02','NE_CORNER', 22.3, 88, 25, 1580, 'HIGH', 86.3, NOW() - INTERVAL 20 HOUR),
('NODE_02','NE_CORNER', 23.1, 84, 26, 1600, 'HIGH', 78.9, NOW() - INTERVAL 19 HOUR),
('NODE_02','NE_CORNER', 24.5, 76, 25, 1590, 'MODERATE', 62.4, NOW() - INTERVAL 18 HOUR),
('NODE_02','NE_CORNER', 25.8, 70, 24, 1570, 'MODERATE', 51.8, NOW() - INTERVAL 17 HOUR),
('NODE_02','NE_CORNER', 27.1, 65, 23, 1540, 'LOW',      42.3, NOW() - INTERVAL 16 HOUR),
('NODE_02','NE_CORNER', 27.8, 62, 22, 1520, 'LOW',      38.7, NOW() - INTERVAL 15 HOUR),
('NODE_02','NE_CORNER', 27.3, 64, 22, 1510, 'LOW',      40.1, NOW() - INTERVAL 14 HOUR),
('NODE_02','NE_CORNER', 26.5, 67, 23, 1530, 'LOW',      44.6, NOW() - INTERVAL 13 HOUR),
('NODE_02','NE_CORNER', 25.8, 71, 24, 1550, 'MODERATE', 52.3, NOW() - INTERVAL 12 HOUR),
('NODE_02','NE_CORNER', 25.1, 74, 25, 1570, 'MODERATE', 58.1, NOW() - INTERVAL 11 HOUR),
('NODE_02','NE_CORNER', 24.5, 77, 26, 1600, 'MODERATE', 63.7, NOW() - INTERVAL 10 HOUR),
('NODE_02','NE_CORNER', 23.8, 80, 26, 1610, 'HIGH',     70.2, NOW() - INTERVAL 9 HOUR),
('NODE_02','NE_CORNER', 23.3, 82, 27, 1630, 'HIGH',     74.5, NOW() - INTERVAL 8 HOUR),
('NODE_02','NE_CORNER', 23.0, 83, 27, 1640, 'HIGH',     76.8, NOW() - INTERVAL 7 HOUR),
('NODE_02','NE_CORNER', 22.8, 84, 28, 1650, 'HIGH',     79.1, NOW() - INTERVAL 6 HOUR),
('NODE_02','NE_CORNER', 22.6, 85, 28, 1660, 'HIGH',     81.3, NOW() - INTERVAL 5 HOUR),
('NODE_02','NE_CORNER', 22.4, 86, 27, 1640, 'HIGH',     83.5, NOW() - INTERVAL 4 HOUR),
('NODE_02','NE_CORNER', 22.2, 87, 27, 1630, 'HIGH',     85.2, NOW() - INTERVAL 3 HOUR),
('NODE_02','NE_CORNER', 22.5, 86, 28, 1650, 'HIGH',     82.7, NOW() - INTERVAL 2 HOUR),
('NODE_02','NE_CORNER', 22.8, 85, 28, 1660, 'HIGH',     80.4, NOW() - INTERVAL 1 HOUR),

-- NODE_03 (SW_CORNER) — Near path, moderate conditions
('NODE_03','SW_CORNER', 23.5, 72, 42, 2050, 'MODERATE', 48.2, NOW() - INTERVAL 24 HOUR),
('NODE_03','SW_CORNER', 23.2, 74, 41, 2030, 'MODERATE', 50.8, NOW() - INTERVAL 22 HOUR),
('NODE_03','SW_CORNER', 22.8, 76, 40, 2010, 'MODERATE', 55.3, NOW() - INTERVAL 20 HOUR),
('NODE_03','SW_CORNER', 24.1, 71, 39, 1980, 'MODERATE', 46.7, NOW() - INTERVAL 18 HOUR),
('NODE_03','SW_CORNER', 26.2, 64, 36, 1870, 'LOW',      35.1, NOW() - INTERVAL 16 HOUR),
('NODE_03','SW_CORNER', 27.5, 60, 34, 1810, 'LOW',      30.5, NOW() - INTERVAL 14 HOUR),
('NODE_03','SW_CORNER', 26.8, 63, 33, 1790, 'LOW',      33.8, NOW() - INTERVAL 12 HOUR),
('NODE_03','SW_CORNER', 25.5, 68, 35, 1850, 'LOW',      41.2, NOW() - INTERVAL 10 HOUR),
('NODE_03','SW_CORNER', 24.5, 72, 37, 1900, 'MODERATE', 48.9, NOW() - INTERVAL 8 HOUR),
('NODE_03','SW_CORNER', 23.8, 74, 39, 1950, 'MODERATE', 52.6, NOW() - INTERVAL 6 HOUR),
('NODE_03','SW_CORNER', 23.3, 76, 40, 1990, 'MODERATE', 56.1, NOW() - INTERVAL 4 HOUR),
('NODE_03','SW_CORNER', 23.5, 75, 41, 2020, 'MODERATE', 54.3, NOW() - INTERVAL 2 HOUR),

-- NODE_04 (SE_CORNER) — Most sun, low risk, dry soil
('NODE_04','SE_CORNER', 24.2, 68, 38, 1900, 'LOW', 38.5, NOW() - INTERVAL 24 HOUR),
('NODE_04','SE_CORNER', 23.8, 70, 37, 1880, 'LOW', 42.1, NOW() - INTERVAL 22 HOUR),
('NODE_04','SE_CORNER', 23.5, 72, 36, 1860, 'MODERATE', 45.8, NOW() - INTERVAL 20 HOUR),
('NODE_04','SE_CORNER', 24.8, 66, 34, 1810, 'LOW', 36.2, NOW() - INTERVAL 18 HOUR),
('NODE_04','SE_CORNER', 27.5, 58, 30, 1720, 'LOW', 25.4, NOW() - INTERVAL 16 HOUR),
('NODE_04','SE_CORNER', 28.8, 54, 27, 1650, 'LOW', 21.8, NOW() - INTERVAL 14 HOUR),
('NODE_04','SE_CORNER', 28.2, 56, 26, 1620, 'LOW', 23.5, NOW() - INTERVAL 12 HOUR),
('NODE_04','SE_CORNER', 27.1, 60, 28, 1670, 'LOW', 28.9, NOW() - INTERVAL 10 HOUR),
('NODE_04','SE_CORNER', 25.8, 64, 31, 1740, 'LOW', 35.2, NOW() - INTERVAL 8 HOUR),
('NODE_04','SE_CORNER', 25.1, 67, 33, 1780, 'LOW', 39.7, NOW() - INTERVAL 6 HOUR),
('NODE_04','SE_CORNER', 24.5, 69, 35, 1830, 'LOW', 42.3, NOW() - INTERVAL 4 HOUR),
('NODE_04','SE_CORNER', 24.2, 68, 37, 1870, 'LOW', 40.1, NOW() - INTERVAL 2 HOUR),

-- NODE_05 (CENTER) — Reference point, moderate
('NODE_05','CENTER', 23.0, 78, 42, 2050, 'MODERATE', 62.4, NOW() - INTERVAL 24 HOUR),
('NODE_05','CENTER', 22.7, 80, 41, 2030, 'MODERATE', 66.8, NOW() - INTERVAL 22 HOUR),
('NODE_05','CENTER', 22.3, 82, 40, 2010, 'MODERATE', 70.5, NOW() - INTERVAL 20 HOUR),
('NODE_05','CENTER', 23.5, 76, 39, 1980, 'MODERATE', 58.2, NOW() - INTERVAL 18 HOUR),
('NODE_05','CENTER', 25.8, 68, 35, 1860, 'LOW',      42.1, NOW() - INTERVAL 16 HOUR),
('NODE_05','CENTER', 26.8, 64, 33, 1790, 'LOW',      36.7, NOW() - INTERVAL 14 HOUR),
('NODE_05','CENTER', 26.2, 66, 32, 1770, 'LOW',      38.9, NOW() - INTERVAL 12 HOUR),
('NODE_05','CENTER', 25.2, 70, 34, 1820, 'MODERATE', 46.3, NOW() - INTERVAL 10 HOUR),
('NODE_05','CENTER', 24.2, 74, 37, 1890, 'MODERATE', 54.8, NOW() - INTERVAL 8 HOUR),
('NODE_05','CENTER', 23.5, 77, 39, 1940, 'MODERATE', 60.2, NOW() - INTERVAL 6 HOUR),
('NODE_05','CENTER', 23.0, 79, 41, 1990, 'MODERATE', 64.7, NOW() - INTERVAL 4 HOUR),
('NODE_05','CENTER', 23.0, 78, 42, 2040, 'MODERATE', 63.1, NOW() - INTERVAL 2 HOUR);

-- ─── MOCKUP: CLR ALERTS ──────────────────────────────────────────────────────
INSERT INTO clr_alerts (node_id, risk_level, temperature, humidity, soil_pct, alert_message, is_resolved, created_at) VALUES
('NODE_02', 'HIGH', 22.0, 90, 25, 'CLR risk HIGH at NE Corner: Temperature 22.0°C and humidity 90% create ideal conditions for Hemileia vastatrix. Irrigation WITHHELD to prevent further humidity increase.', 0, NOW() - INTERVAL 21 HOUR),
('NODE_01', 'HIGH', 21.5, 88, 43, 'CLR risk HIGH at NW Corner: Sustained humidity above 85% with temperature in CLR optimal range (21-25°C). Monitor leaf undersides for orange-yellow pustules.', 1, NOW() - INTERVAL 22 HOUR),
('NODE_02', 'HIGH', 22.2, 89, 26, 'CLR risk HIGH at NE Corner: Humidity remains critically elevated at 89%. Soil moisture low (26%) but irrigation withheld due to CLR conditions.', 0, NOW() - INTERVAL 22 HOUR),
('NODE_01', 'MODERATE', 22.5, 82, 42, 'CLR risk MODERATE at NW Corner: Humidity trending upward toward danger threshold. Continue monitoring — conditions may escalate overnight.', 1, NOW() - INTERVAL 6 HOUR),
('NODE_05', 'MODERATE', 22.3, 82, 40, 'CLR risk MODERATE at Center: Environmental conditions approaching CLR-favorable range. Humidity 82% is above optimal but below critical threshold.', 0, NOW() - INTERVAL 20 HOUR);

-- ─── MOCKUP: GEMINI RECOMMENDATIONS ──────────────────────────────────────────
INSERT INTO recommendations (alert_id, node_id, risk_level, what_happened, why_it_matters, what_to_do, full_response, generated_at) VALUES
(1, 'NODE_02', 'HIGH',
 'The NE Corner sensor node is reporting 22.0°C temperature and 90% relative humidity — both within the critical range for Coffee Leaf Rust (Hemileia vastatrix) development. Soil moisture is at 25%, which is below the irrigation threshold, but the automated irrigation system has withheld watering.',
 'These conditions are ideal for CLR spore germination. At 90% humidity and 22°C, urediniospores can germinate within 6-8 hours of sustained exposure. Watering the plants now would further increase leaf surface moisture and accelerate infection. The NE Corner is the highest-risk zone on the plot.',
 'DO NOT irrigate this zone manually. The system has correctly withheld irrigation. Walk through the NE Corner and inspect the undersides of coffee leaves for small yellow-orange spots or powdery residue. If any are found, photograph them and notify the agronomist immediately. Apply copper-based fungicide (Bordeaux mixture) within 48 hours as a preventive measure. Expected treatment cost: approximately ₱2,400.',
 'Full Gemini API response for NODE_02 HIGH risk event', NOW() - INTERVAL 21 HOUR),

(2, 'NODE_01', 'HIGH',
 'The NW Corner sensor node recorded sustained humidity above 85% (peaking at 88%) with temperature at 21.5°C over the past 3 hours. These readings place this zone in the HIGH risk category for Coffee Leaf Rust.',
 'Sustained high humidity combined with temperatures in the 21-25°C range creates the microclimate conditions most favorable for Hemileia vastatrix infection. The NW Corner''s proximity to tree canopy may be contributing to reduced airflow and elevated humidity retention.',
 'Monitor the NW Corner closely over the next 12 hours. If humidity remains above 85%, consider pruning nearby shade tree branches to improve air circulation. Do not irrigate until humidity drops below 75%. Inspect leaves for early rust signs during the next field walk. The alert has been marked for agronomist review.',
 'Full Gemini API response for NODE_01 HIGH risk event', NOW() - INTERVAL 22 HOUR),

(4, 'NODE_01', 'MODERATE',
 'The NW Corner is showing humidity at 82% with temperature at 22.5°C. While not yet in the critical range, these values are trending upward toward CLR-favorable conditions, particularly as nighttime cooling begins.',
 'Evening and early morning hours typically see humidity increases of 5-10% at this location due to reduced evapotranspiration. If the current trend continues, this zone may enter HIGH risk status within 4-6 hours.',
 'No immediate action required. Continue standard monitoring schedule. The system will automatically alert if conditions escalate to HIGH risk. Ensure drip emitters are not leaking, as ground-level moisture can contribute to canopy humidity. Next recommended check: in 4 hours.',
 'Full Gemini API response for NODE_01 MODERATE risk event', NOW() - INTERVAL 6 HOUR);

-- ─── MOCKUP: SYSTEM LOGS ─────────────────────────────────────────────────────
INSERT INTO system_logs (level, source, message, logged_at) VALUES
('INFO',    'NODE_01', 'Sensor reading published successfully via MQTT', NOW() - INTERVAL 1 HOUR),
('INFO',    'NODE_02', 'Irrigation WITHHELD — CLR risk HIGH detected', NOW() - INTERVAL 21 HOUR),
('INFO',    'NODE_04', 'Irrigation ACTIVATED — soil moisture below 30% threshold', NOW() - INTERVAL 14 HOUR),
('WARNING', 'NODE_02', 'Humidity exceeded 85% danger threshold for 3+ consecutive readings', NOW() - INTERVAL 22 HOUR),
('INFO',    'node-red', 'Data quality pipeline: 5/5 node readings validated successfully', NOW() - INTERVAL 1 HOUR),
('INFO',    'ml-model', 'CLR risk model inference completed — 5 nodes scored in 1.2s', NOW() - INTERVAL 1 HOUR),
('INFO',    'node-red', 'MQTT broker: all 5 nodes connected and publishing', NOW() - INTERVAL 2 HOUR),
('WARNING', 'NODE_04', 'Soil moisture critically low at 26% — drip irrigation activated', NOW() - INTERVAL 12 HOUR),
('INFO',    'ml-model', 'Model confidence: NODE_02=80.4%, NODE_01=74.3%, NODE_05=63.1%', NOW() - INTERVAL 1 HOUR);

-- ─── VERIFY ──────────────────────────────────────────────────────────────────
SELECT 'Sensor Readings:' AS '', COUNT(*) AS total FROM sensor_readings;
SELECT 'CLR Alerts:' AS '', COUNT(*) AS total FROM clr_alerts;
SELECT 'Recommendations:' AS '', COUNT(*) AS total FROM recommendations;
SELECT 'System Logs:' AS '', COUNT(*) AS total FROM system_logs;
