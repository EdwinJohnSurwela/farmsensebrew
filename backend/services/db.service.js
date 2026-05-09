/**
 * FarmSense Brew — MySQL Database Service
 * File: backend/services/db.service.js
 *
 * Shared MySQL connection pool used by all route handlers.
 * Uses mysql2 with promise support.
 */

const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host:               process.env.DB_HOST,         // AWS RDS endpoint
  port:               parseInt(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER,
  password:           process.env.DB_PASSWORD,
  database:           process.env.DB_NAME || "farmsense_db",
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone:           "+08:00"                     // Philippine Standard Time
});

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log("[DB] MySQL connected to:", process.env.DB_HOST);
    conn.release();
  })
  .catch(err => {
    console.error("[DB] MySQL connection failed:", err.message);
    process.exit(1);
  });

module.exports = pool;
