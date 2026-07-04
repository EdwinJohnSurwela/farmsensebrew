/**
 * FarmSense Brew — Mock Sensor Script
 * Simulates all 5 ESP32 nodes publishing sensor data via MQTT
 * AND inserts readings directly into MySQL so Grafana dashboards
 * always have fresh data.
 *
 * Run with:
 *   node mock_sensor.js            — continuous mode (MQTT + MySQL every 30s)
 *   node mock_sensor.js --seed     — seed 24h of historical data then run continuous
 *   node mock_sensor.js --seed-only — seed 24h of historical data then exit
 */

const mqtt  = require('mqtt');
const mysql = require('mysql2/promise');

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const MQTT_URL = 'mqtt://127.0.0.1:1883';
const DB_CONFIG = {
  host:     '127.0.0.1',
  port:     3306,
  user:     'root',
  password: '',
  database: 'farmsense_db'
};
const PUBLISH_INTERVAL_MS = 30_000;  // 30 seconds

const nodes = [
  { node_id: 'NODE_01', position: 'NW_CORNER' },
  { node_id: 'NODE_02', position: 'NE_CORNER' },
  { node_id: 'NODE_03', position: 'SW_CORNER' },
  { node_id: 'NODE_04', position: 'SE_CORNER' },
  { node_id: 'NODE_05', position: 'CENTER' },
];

// ─── Realistic per-node profiles ─────────────────────────────────────────────
// Each node has characteristic baseline values that simulate real microclimate
const nodeProfiles = {
  NODE_01: { tempBase: 22.5, humBase: 83, soilBase: 43, riskBias: 'MODERATE', shade: 'heavy' },
  NODE_02: { tempBase: 22.0, humBase: 86, soilBase: 27, riskBias: 'HIGH',     shade: 'partial' },
  NODE_03: { tempBase: 23.5, humBase: 74, soilBase: 40, riskBias: 'MODERATE', shade: 'light' },
  NODE_04: { tempBase: 24.5, humBase: 66, soilBase: 34, riskBias: 'LOW',      shade: 'none' },
  NODE_05: { tempBase: 23.0, humBase: 78, soilBase: 41, riskBias: 'MODERATE', shade: 'moderate' },
};

// ─── Helper: generate a single reading ───────────────────────────────────────
function generateReading(node, hoursAgo = 0) {
  const profile = nodeProfiles[node.node_id];

  // Simulate diurnal pattern: cooler & more humid at night, warmer & drier midday
  const now = new Date(Date.now() - hoursAgo * 3600_000);
  const hour = now.getHours();
  const diurnalTemp = Math.sin((hour - 6) * Math.PI / 12) * 3;  // peaks at noon
  const diurnalHum  = -Math.sin((hour - 6) * Math.PI / 12) * 8; // inverse of temp

  const temperature = parseFloat((profile.tempBase + diurnalTemp + (Math.random() - 0.5) * 1.5).toFixed(1));
  const humidity    = parseFloat(Math.min(95, Math.max(50, profile.humBase + diurnalHum + (Math.random() - 0.5) * 6)).toFixed(1));
  const soil_pct    = Math.max(15, Math.min(80, Math.round(profile.soilBase + (Math.random() - 0.5) * 8)));
  const soil_raw    = Math.round(1400 + soil_pct * 14);

  // CLR risk logic (mirrors the ML model's decision boundaries)
  let clr_risk, confidence_pct;
  if (temperature >= 21 && temperature <= 25 && humidity >= 85) {
    clr_risk = 'HIGH';
    confidence_pct = parseFloat((75 + Math.random() * 15).toFixed(1));
  } else if (temperature >= 20 && temperature <= 26 && humidity >= 75) {
    clr_risk = 'MODERATE';
    confidence_pct = parseFloat((45 + Math.random() * 25).toFixed(1));
  } else {
    clr_risk = 'LOW';
    confidence_pct = parseFloat((20 + Math.random() * 20).toFixed(1));
  }

  // Override to keep each node's characteristic risk profile
  if (profile.riskBias === 'HIGH' && clr_risk === 'LOW') {
    clr_risk = 'MODERATE';
    confidence_pct = parseFloat((50 + Math.random() * 15).toFixed(1));
  }

  const recorded_at = now.toISOString().slice(0, 19).replace('T', ' ');

  return {
    node_id:     node.node_id,
    position:    node.position,
    temperature,
    humidity,
    soil_pct,
    soil_raw,
    clr_risk,
    confidence_pct,
    recorded_at,
    timestamp: now.getTime()
  };
}

// ─── MySQL: insert a reading ─────────────────────────────────────────────────
async function insertReading(pool, r) {
  await pool.execute(
    `INSERT INTO sensor_readings
       (node_id, position, temperature, humidity, soil_pct, soil_raw, clr_risk, confidence_pct, recorded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [r.node_id, r.position, r.temperature, r.humidity, r.soil_pct, r.soil_raw, r.clr_risk, r.confidence_pct, r.recorded_at]
  );
}

// ─── Seed 24h of historical data ─────────────────────────────────────────────
async function seedHistoricalData(pool) {
  console.log('🌱 Seeding 24 hours of historical sensor data...');

  // Clear old mockup data
  await pool.execute('DELETE FROM recommendations');
  await pool.execute('DELETE FROM clr_alerts');
  await pool.execute('DELETE FROM sensor_readings');
  await pool.execute('DELETE FROM system_logs');
  console.log('   Cleared old data.');

  // Insert 24h of readings (every 30 minutes = 48 readings per node)
  let insertCount = 0;
  for (let minutesAgo = 24 * 60; minutesAgo >= 0; minutesAgo -= 30) {
    const hoursAgo = minutesAgo / 60;
    for (const node of nodes) {
      const reading = generateReading(node, hoursAgo);
      await insertReading(pool, reading);
      insertCount++;
    }
  }
  console.log(`   ✅ Inserted ${insertCount} sensor readings (${insertCount / 5} per node)`);

  // ─── Seed CLR Alerts ─────────────────────────────────────────────────────
  const alertsData = [
    ['NODE_02', 'HIGH',     22.0, 90, 25,
     'CLR risk HIGH at NE Corner: Temperature 22.0°C and humidity 90% create ideal conditions for Hemileia vastatrix. Irrigation WITHHELD to prevent further humidity increase.',
     0, 'NOW() - INTERVAL 3 HOUR'],
    ['NODE_01', 'HIGH',     21.5, 88, 43,
     'CLR risk HIGH at NW Corner: Sustained humidity above 85% with temperature in CLR optimal range (21-25°C). Monitor leaf undersides for orange-yellow pustules.',
     1, 'NOW() - INTERVAL 8 HOUR'],
    ['NODE_02', 'HIGH',     22.2, 89, 26,
     'CLR risk HIGH at NE Corner: Humidity remains critically elevated at 89%. Soil moisture low (26%) but irrigation withheld due to CLR conditions.',
     0, 'NOW() - INTERVAL 5 HOUR'],
    ['NODE_01', 'MODERATE', 22.5, 82, 42,
     'CLR risk MODERATE at NW Corner: Humidity trending upward toward danger threshold. Continue monitoring — conditions may escalate overnight.',
     1, 'NOW() - INTERVAL 2 HOUR'],
    ['NODE_05', 'MODERATE', 22.3, 82, 40,
     'CLR risk MODERATE at Center: Environmental conditions approaching CLR-favorable range. Humidity 82% is above optimal but below critical threshold.',
     0, 'NOW() - INTERVAL 4 HOUR'],
    ['NODE_03', 'MODERATE', 23.2, 76, 39,
     'CLR risk MODERATE at SW Corner: Humidity at 76% trending upward. Night conditions may push this zone into HIGH risk territory.',
     0, 'NOW() - INTERVAL 1 HOUR'],
  ];

  const alertIds = [];
  for (const a of alertsData) {
    const [result] = await pool.execute(
      `INSERT INTO clr_alerts (node_id, risk_level, temperature, humidity, soil_pct, alert_message, is_resolved, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ${a[7]})`,
      [a[0], a[1], a[2], a[3], a[4], a[5], a[6]]
    );
    alertIds.push(result.insertId);
  }
  console.log(`   ✅ Inserted ${alertsData.length} CLR alerts (IDs: ${alertIds.join(', ')})`);

  // ─── Seed Recommendations (Gemini AI) ────────────────────────────────────
  // Uses actual alert IDs from inserts above
  const recsData = [
    [alertIds[0], 'NODE_02', 'HIGH',
     'The NE Corner sensor node is reporting 22.0°C temperature and 90% relative humidity — both within the critical range for Coffee Leaf Rust (Hemileia vastatrix) development. Soil moisture is at 25%, which is below the irrigation threshold, but the automated irrigation system has withheld watering.',
     'These conditions are ideal for CLR spore germination. At 90% humidity and 22°C, urediniospores can germinate within 6-8 hours of sustained exposure. Watering the plants now would further increase leaf surface moisture and accelerate infection. The NE Corner is the highest-risk zone on the plot.',
     'DO NOT irrigate this zone manually. The system has correctly withheld irrigation. Walk through the NE Corner and inspect the undersides of coffee leaves for small yellow-orange spots or powdery residue. If any are found, photograph them and notify the agronomist immediately. Apply copper-based fungicide (Bordeaux mixture) within 48 hours as a preventive measure. Expected treatment cost: approximately ₱2,400.',
     'NOW() - INTERVAL 3 HOUR'],
    [alertIds[1], 'NODE_01', 'HIGH',
     'The NW Corner sensor node recorded sustained humidity above 85% (peaking at 88%) with temperature at 21.5°C over the past 3 hours. These readings place this zone in the HIGH risk category for Coffee Leaf Rust.',
     'Sustained high humidity combined with temperatures in the 21-25°C range creates the microclimate conditions most favorable for Hemileia vastatrix infection. The NW Corner\'s proximity to tree canopy may be contributing to reduced airflow and elevated humidity retention.',
     'Monitor the NW Corner closely over the next 12 hours. If humidity remains above 85%, consider pruning nearby shade tree branches to improve air circulation. Do not irrigate until humidity drops below 75%. Inspect leaves for early rust signs during the next field walk. The alert has been marked for agronomist review.',
     'NOW() - INTERVAL 8 HOUR'],
    [alertIds[3], 'NODE_01', 'MODERATE',
     'The NW Corner is showing humidity at 82% with temperature at 22.5°C. While not yet in the critical range, these values are trending upward toward CLR-favorable conditions, particularly as nighttime cooling begins.',
     'Evening and early morning hours typically see humidity increases of 5-10% at this location due to reduced evapotranspiration. If the current trend continues, this zone may enter HIGH risk status within 4-6 hours.',
     'No immediate action required. Continue standard monitoring schedule. The system will automatically alert if conditions escalate to HIGH risk. Ensure drip emitters are not leaking, as ground-level moisture can contribute to canopy humidity. Next recommended check: in 4 hours.',
     'NOW() - INTERVAL 2 HOUR'],
    [alertIds[4], 'NODE_05', 'MODERATE',
     'The Center reference node reports humidity at 82% and temperature at 22.3°C. As the central monitoring point, this reading suggests elevated humidity conditions are not localized to the corners.',
     'System-wide elevated humidity indicates a broader weather pattern rather than localized microclimate effects. When the center node shows MODERATE risk, it confirms that the entire 50 sqm plot is experiencing conditions favorable for CLR development.',
     'Increase field patrol frequency to every 2 hours. Check all zones, focusing on leaf undersides for early CLR symptoms. Ensure drainage channels are clear. If rain is forecast, prepare copper-based fungicide spray for immediate application after precipitation stops.',
     'NOW() - INTERVAL 4 HOUR'],
  ];

  for (const r of recsData) {
    await pool.execute(
      `INSERT INTO recommendations (alert_id, node_id, risk_level, what_happened, why_it_matters, what_to_do, full_response, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'Full Gemini API response', ${r[6]})`,
      [r[0], r[1], r[2], r[3], r[4], r[5]]
    );
  }
  console.log(`   ✅ Inserted ${recsData.length} AI recommendations`);

  // ─── Seed System Logs ────────────────────────────────────────────────────
  const logsData = [
    ['INFO',    'NODE_01',  'Sensor reading published successfully via MQTT',                        'NOW() - INTERVAL 10 MINUTE'],
    ['INFO',    'NODE_02',  'Irrigation WITHHELD — CLR risk HIGH detected',                          'NOW() - INTERVAL 3 HOUR'],
    ['INFO',    'NODE_04',  'Irrigation ACTIVATED — soil moisture below 30% threshold',              'NOW() - INTERVAL 6 HOUR'],
    ['WARNING', 'NODE_02',  'Humidity exceeded 85% danger threshold for 3+ consecutive readings',    'NOW() - INTERVAL 5 HOUR'],
    ['INFO',    'node-red', 'Data quality pipeline: 5/5 node readings validated successfully',       'NOW() - INTERVAL 15 MINUTE'],
    ['INFO',    'ml-model', 'CLR risk model inference completed — 5 nodes scored in 1.2s',           'NOW() - INTERVAL 15 MINUTE'],
    ['INFO',    'node-red', 'MQTT broker: all 5 nodes connected and publishing',                     'NOW() - INTERVAL 30 MINUTE'],
    ['WARNING', 'NODE_04',  'Soil moisture critically low at 26% — drip irrigation activated',       'NOW() - INTERVAL 8 HOUR'],
    ['INFO',    'ml-model', 'Model confidence: NODE_02=80.4%, NODE_01=74.3%, NODE_05=63.1%',        'NOW() - INTERVAL 20 MINUTE'],
    ['INFO',    'NODE_03',  'Sensor reading published successfully via MQTT',                        'NOW() - INTERVAL 5 MINUTE'],
    ['INFO',    'NODE_05',  'Sensor reading published successfully via MQTT',                        'NOW() - INTERVAL 5 MINUTE'],
    ['INFO',    'node-red', 'Data pipeline health check: All systems operational',                   'NOW() - INTERVAL 1 HOUR'],
  ];

  for (const l of logsData) {
    await pool.execute(
      `INSERT INTO system_logs (level, source, message, logged_at) VALUES (?, ?, ?, ${l[3]})`,
      [l[0], l[1], l[2]]
    );
  }
  console.log(`   ✅ Inserted ${logsData.length} system logs`);

  console.log('🌱 Seeding complete!\n');
}

// ─── Publish all nodes (MQTT + MySQL) ────────────────────────────────────────
async function publishAll(client, pool) {
  for (const node of nodes) {
    const reading = generateReading(node);

    // Publish to MQTT
    const mqttPayload = JSON.stringify({
      node_id:     reading.node_id,
      position:    reading.position,
      temperature: reading.temperature,
      humidity:    reading.humidity,
      soil_pct:    reading.soil_pct,
      timestamp:   reading.timestamp
    });

    if (client && client.connected) {
      client.publish('farmsense/sensors', mqttPayload);
    }

    // Insert into MySQL
    try {
      await insertReading(pool, reading);
    } catch (err) {
      console.error(`  ⚠ MySQL insert failed for ${reading.node_id}: ${err.message}`);
    }

    console.log(`[${new Date().toLocaleTimeString()}] ${reading.node_id} → T:${reading.temperature}°C H:${reading.humidity}% S:${reading.soil_pct}% CLR:${reading.clr_risk} (${reading.confidence_pct}%)`);
  }
  console.log('---');
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const doSeed   = args.includes('--seed') || args.includes('--seed-only');
  const seedOnly = args.includes('--seed-only');

  // Connect to MySQL
  let pool;
  try {
    pool = mysql.createPool(DB_CONFIG);
    await pool.execute('SELECT 1');
    console.log('✅ Connected to MySQL (farmsense_db)');
  } catch (err) {
    console.error('❌ MySQL connection failed:', err.message);
    console.error('   Make sure MySQL/XAMPP is running and farmsense_db exists.');
    process.exit(1);
  }

  // Seed historical data if requested
  if (doSeed) {
    await seedHistoricalData(pool);
    if (seedOnly) {
      console.log('✅ Seed-only mode — exiting. Dashboards should now show data!');
      await pool.end();
      process.exit(0);
    }
  }

  // Connect to MQTT (non-fatal if broker is down)
  let mqttClient = null;
  try {
    mqttClient = mqtt.connect(MQTT_URL);
    mqttClient.on('connect', () => {
      console.log('✅ Connected to MQTT broker on localhost:1883');
    });
    mqttClient.on('error', (err) => {
      console.warn('⚠ MQTT error (non-fatal, MySQL still works):', err.message);
    });
  } catch (err) {
    console.warn('⚠ MQTT not available — publishing to MySQL only');
  }

  // Publish immediately, then at interval
  console.log(`\n📡 Publishing sensor data every ${PUBLISH_INTERVAL_MS / 1000}s...\n`);
  await publishAll(mqttClient, pool);
  setInterval(() => publishAll(mqttClient, pool), PUBLISH_INTERVAL_MS);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});