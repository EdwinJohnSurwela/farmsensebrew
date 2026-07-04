# FarmSense Brew — Grafana Dashboards

## Overview

This folder contains **4 Grafana dashboard JSON files** for the FarmSense Brew IoT Monitoring System. Each dashboard is designed for a specific stakeholder role as specified in the capstone manuscript.

| Dashboard | File | UID | Target User |
|-----------|------|-----|-------------|
| Agronomist | `grafana_agronomist_view.json` | `farmsense-agro-001` | Technical data analysis, CLR risk scoring, sensor trends |
| Farm Owner | `grafana_farmowner_view.json` | `farmsense-owner-001` | Business summaries, Gemini AI recommendations |
| Field Staff | `grafana_fieldstaff_view.json` | `farmsense-staff-001` | Color-coded zones, plain-language action instructions |
| Scale-Up | `grafana_scaleup_view.json` | `farmsense-scaleup-001` | Zone registration, modular expansion management |

## 3-Tier Architecture Mapping (IT322)

These dashboards serve as **Tier 1 (Presentation Layer)** in the 3-Tier Architecture:

```
Tier 1: Grafana Dashboards (this folder)
   ↕ SQL Queries via MySQL Data Source
Tier 2: Backend API (backend/) + Node-RED Pipeline + ML Model
   ↕ MQTT + MySQL Connector
Tier 3: MySQL Database (database/)
```

> **Note:** Grafana queries MySQL directly for dashboard visualization. The Backend API (Tier 2) handles authentication, Gemini API integration, and business logic processing.

## Setup Instructions

### 1. Prerequisites
- Grafana OSS (v10+) or Grafana Cloud (free tier available)
- MySQL 8.0+ with `farmsense_db` database
- Data source configured in Grafana

### 2. Create the Database
```bash
mysql -u root -p < database/migrations/001_create_all_tables.sql
mysql -u root -p farmsense_db < database/seeds/001_seed_nodes_and_users.sql
mysql -u root -p farmsense_db < database/seeds/002_seed_mockup_sensor_data.sql
```

### 3. Configure Grafana Data Source
1. Go to **Configuration → Data Sources → Add data source**
2. Select **MySQL**
3. Configure:
   - **Name:** `farmsense-mysql`
   - **Host:** `localhost:3306` (or your MySQL host)
   - **Database:** `farmsense_db`
   - **User/Password:** Your MySQL credentials
4. Click **Save & Test**

### 4. Import Dashboards
For each JSON file:
1. Go to **Dashboards → Import**
2. Click **Upload JSON file** or paste the JSON content
3. Select `farmsense-mysql` as the data source
4. Click **Import**

### 5. Role-Based Access (Optional)
In Grafana, set up organizations or folder permissions:
- **Agronomist role** → Access to all 4 dashboards
- **Farm Owner role** → Access to Farm Owner + Scale-Up dashboards
- **Field Staff role** → Access to Field Staff dashboard only

## Mockup Data

The file `database/seeds/002_seed_mockup_sensor_data.sql` provides realistic mockup data for the demo:
- **24 hours** of sensor readings for all 5 nodes
- **5 CLR alerts** (2 HIGH, 2 MODERATE, 1 resolved)
- **3 Gemini AI recommendations** (with full what/why/do format)
- **9 system log entries** (pipeline events, irrigation actions)

## Design Reference

The visual design for these dashboards was prototyped in Figma. The Figma Make export is in `FIGMA MAKE_DASHBOARD/` and serves as the design specification document (as described in Chapter 2, Section 2.1.1 of the manuscript).
