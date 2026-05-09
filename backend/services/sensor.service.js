/**
 * FarmSense Brew — Sensor Data Service
 * All DB queries for sensor data live here (Data Access Layer)
 */
const db = require("./db.service");

async function getLatestReadings() {
  const [rows] = await db.query(`
    SELECT sr.node_id, sr.position, sr.temperature, sr.humidity,
           sr.soil_pct, sr.clr_risk, sr.confidence_pct, sr.recorded_at
    FROM sensor_readings sr
    INNER JOIN (
      SELECT node_id, MAX(recorded_at) AS max_ts
      FROM sensor_readings
      GROUP BY node_id
    ) latest ON sr.node_id = latest.node_id AND sr.recorded_at = latest.max_ts
    ORDER BY sr.node_id
  `);
  return rows;
}

async function getHistory(hours = 24, node_id = null) {
  let query = `SELECT node_id, position, temperature, humidity, soil_pct,
               clr_risk, confidence_pct, recorded_at
               FROM sensor_readings
               WHERE recorded_at >= NOW() - INTERVAL ? HOUR`;
  const params = [hours];
  if (node_id) { query += " AND node_id = ?"; params.push(node_id); }
  query += " ORDER BY recorded_at DESC LIMIT 5000";
  const [rows] = await db.query(query, params);
  return rows;
}

async function getNodeReadings(node_id, limit = 100) {
  const [rows] = await db.query(
    `SELECT * FROM sensor_readings WHERE node_id = ?
     ORDER BY recorded_at DESC LIMIT ?`,
    [node_id, limit]
  );
  return rows;
}

async function getSummary() {
  const [rows] = await db.query(`
    SELECT ROUND(AVG(temperature),1) AS avg_temperature,
           ROUND(AVG(humidity),1)    AS avg_humidity,
           ROUND(AVG(soil_pct),1)    AS avg_soil_pct,
           MAX(clr_risk)             AS worst_clr_risk,
           COUNT(*)                  AS reading_count,
           MAX(recorded_at)          AS latest_reading
    FROM sensor_readings
    WHERE recorded_at >= NOW() - INTERVAL 1 HOUR
  `);
  return rows[0];
}

module.exports = { getLatestReadings, getHistory, getNodeReadings, getSummary };