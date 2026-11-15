/**
 * FarmSense Brew — MySQL Database Service
 * File: backend/services/db.service.js
 *
 * Shared MySQL connection pool used by all route handlers.
 * Uses mysql2 with promise support.
 */

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host:               process.env.DB_HOST,         // Local MySQL (XAMPP / Raspberry Pi)
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME || "farmsense_db",
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  // Must match the MySQL server's clock, because every timestamp is written
  // with NOW(). XAMPP on the laptop runs on Philippine time (+08:00); the
  // MariaDB container on the Pi runs on UTC, so the Pi sets DB_TIMEZONE=Z.
  // A mismatch made fresh readings look 8 hours old (nodes stuck offline).
  timezone:           process.env.DB_TIMEZONE || "+08:00"
});

// Test connection on startup — warn but do NOT exit (allows starting before MySQL)
pool.getConnection()
  .then(async conn => {
    console.log("[DB] MySQL connected to:", process.env.DB_HOST);
    conn.release();
    // Self-healing schema: ensure optional columns exist on fresh DBs
    // (GitHub clone / container seed). Safe to run every boot.
    try {
      await pool.query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS active_session_device VARCHAR(120) NULL"
      );
    } catch (e) {
      console.warn("[DB] active_session_device ensure skipped:", e.message);
    }
    // Five CLR bands (clr-risk.js): widen the risk columns once if they still
    // only allow LOW / MODERATE / HIGH. Existing values keep their meaning.
    try {
      const FIVE = "ENUM('MINIMAL','LOW','MODERATE','HIGH','CRITICAL')";
      const cols = [["sensor_readings", "clr_risk", "NULL DEFAULT 'LOW'"],
                    ["clr_alerts", "risk_level", "NOT NULL DEFAULT 'LOW'"],
                    ["recommendations", "risk_level", "NULL DEFAULT NULL"]];
      for (const [table, col, rest] of cols) {
        const [r] = await pool.query(
          "SELECT COLUMN_TYPE t FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
          [table, col]);
        if (r[0] && /^enum/i.test(r[0].t) && !/CRITICAL/i.test(r[0].t)) {
          await pool.query(`ALTER TABLE ${table} MODIFY ${col} ${FIVE} ${rest}`);
          console.log(`[DB] ${table}.${col} now allows the five CLR bands`);
        }
      }
    } catch (e) {
      console.warn("[DB] CLR band columns ensure skipped:", e.message);
    }
    // A reading may carry only one sensor's values (2 Oct 2026): the other
    // sensor's columns are left empty, never filled with 0.
    try {
      const [r] = await pool.query(
        "SELECT IS_NULLABLE n FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sensor_readings' AND COLUMN_NAME = 'temperature'");
      if (r[0] && r[0].n === "NO") {
        await pool.query("ALTER TABLE sensor_readings MODIFY temperature DECIMAL(5,2) NULL, MODIFY humidity DECIMAL(5,2) NULL, MODIFY soil_pct INT NULL");
        console.log("[DB] sensor_readings can now record one sensor while the other is not reading");
      }
    } catch (e) {
      console.warn("[DB] partial readings ensure skipped:", e.message);
    }
    // Sensor fault log: when a box's air or soil sensor stopped giving good
    // values for a minute, and when (if ever) it came back.
    try {
      const [c] = await pool.query(
        "SELECT COLLATION_NAME c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sensor_nodes' AND COLUMN_NAME = 'node_id'");
      const coll = c[0] && c[0].c ? ` COLLATE ${c[0].c}` : "";
      await pool.query(`CREATE TABLE IF NOT EXISTS node_sensor_faults (
        id INT AUTO_INCREMENT PRIMARY KEY,
        node_id VARCHAR(20)${coll} NOT NULL,
        sensor ENUM('air','soil') NOT NULL,
        started_at DATETIME NOT NULL,
        ended_at DATETIME NULL,
        detail VARCHAR(160) NULL,
        KEY idx_open (node_id, sensor, ended_at)
      )`);
    } catch (e) {
      console.warn("[DB] sensor fault table ensure skipped:", e.message);
    }
  })
  .catch(err => {
    console.error("[DB] MySQL connection failed:", err.message);
    console.error("[DB] The server will keep running. Start MySQL (XAMPP) and queries will auto-reconnect.");
  });

module.exports = pool;
