-- ══════════════════════════════════════════════════════════════════
-- FarmSense Brew — Database Schema
-- File: database/migrations/001_create_all_tables.sql
-- Database: farmsense_db (MySQL 8.0+ / AWS RDS MySQL)
--
-- TEAM INSTRUCTIONS:
-- Run this in MySQL Workbench or via CLI:
--   mysql -h YOUR_RDS_ENDPOINT -u admin -p farmsense_db < 001_create_all_tables.sql
-- ══════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS farmsense_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE farmsense_db;

-- ─── TABLE 1: SENSOR NODES ────────────────────────────────────────────────────
-- Stores the 5 physical ESP32 nodes deployed in the X formation
CREATE TABLE IF NOT EXISTS sensor_nodes (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  node_id       VARCHAR(20) NOT NULL UNIQUE,      -- e.g., NODE_01
  position      VARCHAR(30) NOT NULL,             -- e.g., NW_CORNER, CENTER
  description   VARCHAR(100),
  latitude      DECIMAL(10, 7),                   -- GPS coords (optional, for mapping)
  longitude     DECIMAL(10, 7),
  installed_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active     TINYINT(1) DEFAULT 1,
  INDEX idx_node_id (node_id)
) ENGINE=InnoDB;

-- ─── TABLE 2: SENSOR READINGS ─────────────────────────────────────────────────
-- Main time-series table. Every 5-minute reading from each node.
CREATE TABLE IF NOT EXISTS sensor_readings (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  node_id         VARCHAR(20) NOT NULL,
  position        VARCHAR(30),
  temperature     DECIMAL(5, 2) NOT NULL,          -- °C, from DHT22
  humidity        DECIMAL(5, 2) NOT NULL,           -- %, from DHT22
  soil_pct        INT NOT NULL,                    -- 0–100%, from capacitive sensor
  soil_raw        INT,                             -- Raw ADC value (for calibration)
  clr_risk        ENUM('LOW', 'MODERATE', 'HIGH') DEFAULT 'LOW',
  confidence_pct  DECIMAL(5, 2),                  -- ML model confidence score
  recorded_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES sensor_nodes(node_id),
  INDEX idx_recorded_at (recorded_at),
  INDEX idx_node_recorded (node_id, recorded_at),
  INDEX idx_clr_risk (clr_risk)
) ENGINE=InnoDB;

-- ─── TABLE 3: CLR RISK ALERTS ─────────────────────────────────────────────────
-- Stores alerts triggered when risk is MODERATE or HIGH
CREATE TABLE IF NOT EXISTS clr_alerts (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  node_id         VARCHAR(20) NOT NULL,
  risk_level      ENUM('MODERATE', 'HIGH') NOT NULL,
  temperature     DECIMAL(5, 2),
  humidity        DECIMAL(5, 2),
  soil_pct        INT,
  alert_message   TEXT,                            -- Auto-generated alert text
  is_resolved     TINYINT(1) DEFAULT 0,
  resolved_at     DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (node_id) REFERENCES sensor_nodes(node_id),
  INDEX idx_created_at (created_at),
  INDEX idx_resolved (is_resolved)
) ENGINE=InnoDB;

-- ─── TABLE 4: GEMINI RECOMMENDATIONS ─────────────────────────────────────────
-- Stores LLM-generated recommendations per alert
CREATE TABLE IF NOT EXISTS recommendations (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  alert_id        INT,
  node_id         VARCHAR(20),
  risk_level      ENUM('LOW', 'MODERATE', 'HIGH'),
  what_happened   TEXT,                            -- Part 1: WHAT
  why_it_matters  TEXT,                            -- Part 2: WHY
  what_to_do      TEXT,                            -- Part 3: WHAT TO DO
  full_response   TEXT,                            -- Raw Gemini response
  generated_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (alert_id) REFERENCES clr_alerts(id),
  INDEX idx_generated_at (generated_at)
) ENGINE=InnoDB;

-- ─── TABLE 5: USERS ───────────────────────────────────────────────────────────
-- Dashboard login accounts (2 roles: agronomist, farm_owner)
CREATE TABLE IF NOT EXISTS users (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  username        VARCHAR(50) NOT NULL UNIQUE,
  password_hash   VARCHAR(255) NOT NULL,           -- bcrypt hashed — NEVER store plain text
  role            ENUM('agronomist', 'farm_owner') NOT NULL,
  full_name       VARCHAR(100),
  email           VARCHAR(100),
  last_login      DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active       TINYINT(1) DEFAULT 1,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB;

-- ─── TABLE 6: SYSTEM LOGS ─────────────────────────────────────────────────────
-- Audit log for pipeline events (validation failures, API errors, etc.)
CREATE TABLE IF NOT EXISTS system_logs (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  level       ENUM('INFO', 'WARNING', 'ERROR') DEFAULT 'INFO',
  source      VARCHAR(50),                         -- e.g., NODE_01, node-red, ml-model
  message     TEXT,
  logged_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_logged_at (logged_at),
  INDEX idx_level (level)
) ENGINE=InnoDB;
