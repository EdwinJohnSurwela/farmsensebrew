-- FarmSense Brew database schema (MariaDB 11).
-- Public copy: table definitions only. The rows of the farm (readings, accounts,
-- logs) are not published. On a new database, create the first administrator
-- account from the server, then add the other users from the Admin page.

-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: farmsense_db
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `farmsense_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `farmsense_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `farmsense_db`;

--
-- Table structure for table `audit_log`
--

DROP TABLE IF EXISTS `audit_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_log` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `action` varchar(40) NOT NULL,
  `actor` varchar(60) DEFAULT NULL,
  `target` varchar(80) DEFAULT NULL,
  `details` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_log`
--

LOCK TABLES `audit_log` WRITE;
/*!40000 ALTER TABLE `audit_log` DISABLE KEYS */;
/*!40000 ALTER TABLE `audit_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `calibration_params`
--

DROP TABLE IF EXISTS `calibration_params`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `calibration_params` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `node_id` varchar(20) NOT NULL,
  `dry_raw` int(11) NOT NULL,
  `wet_raw` int(11) NOT NULL,
  `offset_pct` int(11) DEFAULT 0,
  `notes` varchar(255) DEFAULT NULL,
  `calibrated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `node_id` (`node_id`),
  KEY `idx_cal_node` (`node_id`),
  CONSTRAINT `calibration_params_ibfk_1` FOREIGN KEY (`node_id`) REFERENCES `sensor_nodes` (`node_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `calibration_params`
--

LOCK TABLES `calibration_params` WRITE;
/*!40000 ALTER TABLE `calibration_params` DISABLE KEYS */;
/*!40000 ALTER TABLE `calibration_params` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `clr_alerts`
--

DROP TABLE IF EXISTS `clr_alerts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `clr_alerts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `node_id` varchar(20) NOT NULL,
  `risk_level` enum('MINIMAL','LOW','MODERATE','HIGH','CRITICAL') NOT NULL DEFAULT 'LOW',
  `temperature` decimal(5,2) DEFAULT NULL,
  `humidity` decimal(5,2) DEFAULT NULL,
  `soil_pct` int(11) DEFAULT NULL,
  `alert_message` text DEFAULT NULL,
  `is_resolved` tinyint(1) DEFAULT 0,
  `resolved_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `node_id` (`node_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_resolved` (`is_resolved`),
  CONSTRAINT `clr_alerts_ibfk_1` FOREIGN KEY (`node_id`) REFERENCES `sensor_nodes` (`node_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `clr_alerts`
--

LOCK TABLES `clr_alerts` WRITE;
/*!40000 ALTER TABLE `clr_alerts` DISABLE KEYS */;
/*!40000 ALTER TABLE `clr_alerts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `irrigation_schedules`
--

DROP TABLE IF EXISTS `irrigation_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `irrigation_schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `node_id` varchar(32) NOT NULL,
  `schedule_time` varchar(8) NOT NULL,
  `duration_seconds` int(11) NOT NULL,
  `days_of_week` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`days_of_week`)),
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_irrigation_node` (`node_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `irrigation_schedules`
--

LOCK TABLES `irrigation_schedules` WRITE;
/*!40000 ALTER TABLE `irrigation_schedules` DISABLE KEYS */;
/*!40000 ALTER TABLE `irrigation_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recommendations`
--

DROP TABLE IF EXISTS `recommendations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recommendations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `alert_id` int(11) DEFAULT NULL,
  `node_id` varchar(20) DEFAULT NULL,
  `risk_level` enum('MINIMAL','LOW','MODERATE','HIGH','CRITICAL') DEFAULT NULL,
  `what_happened` text DEFAULT NULL,
  `why_it_matters` text DEFAULT NULL,
  `what_to_do` text DEFAULT NULL,
  `full_response` text DEFAULT NULL,
  `generated_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `alert_id` (`alert_id`),
  KEY `idx_generated_at` (`generated_at`),
  CONSTRAINT `recommendations_ibfk_1` FOREIGN KEY (`alert_id`) REFERENCES `clr_alerts` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recommendations`
--

LOCK TABLES `recommendations` WRITE;
/*!40000 ALTER TABLE `recommendations` DISABLE KEYS */;
/*!40000 ALTER TABLE `recommendations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sensor_nodes`
--

DROP TABLE IF EXISTS `sensor_nodes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sensor_nodes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `node_id` varchar(20) NOT NULL,
  `position` varchar(30) NOT NULL,
  `description` varchar(100) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `installed_at` datetime DEFAULT current_timestamp(),
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `node_id` (`node_id`),
  KEY `idx_node_id` (`node_id`)
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sensor_nodes`
--

LOCK TABLES `sensor_nodes` WRITE;
/*!40000 ALTER TABLE `sensor_nodes` DISABLE KEYS */;
/*!40000 ALTER TABLE `sensor_nodes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `sensor_readings`
--

DROP TABLE IF EXISTS `sensor_readings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `sensor_readings` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `node_id` varchar(20) NOT NULL,
  `position` varchar(30) DEFAULT NULL,
  `temperature` decimal(5,2) DEFAULT NULL,
  `humidity` decimal(5,2) DEFAULT NULL,
  `soil_pct` int(11) DEFAULT NULL,
  `soil_raw` int(11) DEFAULT NULL,
  `clr_risk` enum('MINIMAL','LOW','MODERATE','HIGH','CRITICAL') DEFAULT 'LOW',
  `confidence_pct` decimal(5,2) DEFAULT NULL,
  `recorded_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_recorded_at` (`recorded_at`),
  KEY `idx_node_recorded` (`node_id`,`recorded_at`),
  KEY `idx_clr_risk` (`clr_risk`),
  CONSTRAINT `sensor_readings_ibfk_1` FOREIGN KEY (`node_id`) REFERENCES `sensor_nodes` (`node_id`)
) ENGINE=InnoDB AUTO_INCREMENT=10155 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sensor_readings`
--

LOCK TABLES `sensor_readings` WRITE;
/*!40000 ALTER TABLE `sensor_readings` DISABLE KEYS */;
/*!40000 ALTER TABLE `sensor_readings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `system_logs`
--

DROP TABLE IF EXISTS `system_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `system_logs` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `level` enum('INFO','WARNING','ERROR') DEFAULT 'INFO',
  `source` varchar(50) DEFAULT NULL,
  `message` text DEFAULT NULL,
  `logged_at` datetime DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_logged_at` (`logged_at`),
  KEY `idx_level` (`level`)
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `system_logs`
--

LOCK TABLES `system_logs` WRITE;
/*!40000 ALTER TABLE `system_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `system_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('admin','agronomist','farm_owner','field_staff') NOT NULL,
  `full_name` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT current_timestamp(),
  `is_active` tinyint(1) DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  KEY `idx_username` (`username`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=15 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-11 12:43:47
