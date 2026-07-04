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
  timezone:           "+08:00"                     // Philippine Standard Time
});

// Test connection on startup — warn but do NOT exit (allows starting before MySQL)
pool.getConnection()
  .then(conn => {
    console.log("[DB] MySQL connected to:", process.env.DB_HOST);
    conn.release();
  })
  .catch(err => {
    console.error("[DB] MySQL connection failed:", err.message);
    console.error("[DB] The server will keep running. Start MySQL (XAMPP) and queries will auto-reconnect.");
  });

module.exports = pool;
