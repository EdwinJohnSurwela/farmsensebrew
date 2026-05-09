# FarmSense Brew — Project Codebase Reference
**A Scalable IoT Microclimate and Disease Risk Management System for Coffee Farming**
Javier Permaculture Farm, San Jose, Batangas | Batangas State University CICS

---

## Project Structure

```
farmsense-brew/
│
├── firmware/                        ← ESP32 Arduino code (flash to each sensor node)
│   └── node1/
│       └── node1_main.ino           ← TEMPLATE: copy and rename for nodes 02–05
│
├── node-red-flows/                  ← Import into Node-RED on Raspberry Pi
│   └── farmsense_main_flow.json     ← Main data pipeline: MQTT → validate → AWS → ML → Gemini
│
├── ml-model/                        ← Python ML service (runs on Raspberry Pi)
│   ├── app.py                       ← Flask API server (POST /predict)
│   ├── train_model.py               ← Train and save the CLR risk model
│   ├── data/
│   │   └── sensor_history.csv       ← [YOU COLLECT THIS] Real sensor data for training
│   └── models/
│       ├── clr_risk_model.pkl       ← [GENERATED] Trained Random Forest model
│       └── scaler.pkl               ← [GENERATED] Feature scaler
│
├── backend/                         ← Node.js Express REST API
│   ├── server.js                    ← Main entry point
│   ├── package.json
│   ├── middleware/
│   │   └── auth.middleware.js       ← JWT token verification + role checks
│   ├── routes/
│   │   ├── auth.routes.js           ← POST /api/auth/login
│   │   ├── sensor.routes.js         ← GET /api/sensors/latest, /history, /summary
│   │   ├── alert.routes.js          ← GET/PATCH /api/alerts
│   │   └── recommendation.routes.js ← GET /api/recommendations, POST /generate
│   └── services/
│       ├── db.service.js            ← MySQL connection pool
│       └── gemini.service.js        ← Google Gemini API integration
│
├── database/
│   ├── migrations/
│   │   └── 001_create_all_tables.sql  ← Run FIRST — creates all tables
│   └── seeds/
│       └── 001_seed_nodes_and_users.sql ← Run SECOND — initial data
│
├── dashboard/
│   └── grafana_agronomist_view.json  ← Import into Grafana Cloud
│
└── config/
    └── .env.example                  ← Copy to .env and fill in credentials
```

---

## Hardware Summary (5-Node X Formation, 50 sqm)

| Node | Position | Components |
|------|----------|-----------|
| NODE_01 | NW Corner | ESP32 + DHT22 + Soil Moisture Sensor |
| NODE_02 | NE Corner | ESP32 + DHT22 + Soil Moisture Sensor |
| NODE_03 | SW Corner | ESP32 + DHT22 + Soil Moisture Sensor |
| NODE_04 | SE Corner | ESP32 + DHT22 + Soil Moisture Sensor |
| NODE_05 | Center    | ESP32 + DHT22 + Soil Moisture Sensor |
| Gateway | Farm Building | Raspberry Pi 4 (4GB RAM) |

**Total: 5 ESP32s + 5 DHT22s + 5 Soil Moisture Sensors + 1 Raspberry Pi**

---

## Setup Order (Follow This Exactly)

### Step 1 — Database
```bash
mysql -h YOUR_RDS_ENDPOINT -u admin -p < database/migrations/001_create_all_tables.sql
mysql -h YOUR_RDS_ENDPOINT -u admin -p farmsense_db < database/seeds/001_seed_nodes_and_users.sql
```

### Step 2 — Environment Variables
```bash
cp config/.env.example .env
# Edit .env and fill in all values
```

### Step 3 — Backend API (on Raspberry Pi or server)
```bash
cd backend
npm install
npm start
# Test: curl http://localhost:3000/health
```

### Step 4 — ML Model (on Raspberry Pi)
```bash
cd ml-model
pip install flask scikit-learn pandas numpy joblib
python3 train_model.py        # Generates model files
python3 app.py                # Starts prediction API on port 5000
# Test: curl http://localhost:5000/health
```

### Step 5 — Node-RED (on Raspberry Pi)
```bash
# Install Node-RED if not already installed
npm install -g node-red
# Install required nodes
cd ~/.node-red && npm install node-red-node-mysql node-red-contrib-mqtt-broker
node-red
# Open browser: http://localhost:1880
# Import: node-red-flows/farmsense_main_flow.json
# Update MQTT broker IP, AWS API Gateway URL, MySQL config, Gemini API key
```

### Step 6 — ESP32 Firmware
```
- Open Arduino IDE
- Install libraries: PubSubClient, DHT sensor library (Adafruit), ArduinoJson
- Open firmware/node1/node1_main.ino
- Update WIFI_SSID, WIFI_PASSWORD, MQTT_BROKER (Raspberry Pi IP)
- Change NODE_ID and NODE_POSITION per node
- Flash to each ESP32
- Open Serial Monitor → verify readings are printing and MQTT: OK
```

### Step 7 — Grafana Dashboard
```
- Log in to Grafana Cloud
- Add MySQL data source: name it "farmsense-mysql"
- Dashboards → Import → paste grafana_agronomist_view.json
- Verify panels are pulling data
```

---

## CLR Risk Thresholds (from Literature)

| Risk Level | Temperature | Humidity |
|-----------|-------------|---------|
| HIGH | 21–25°C | ≥ 80% |
| MODERATE | 20–26°C | 70–79% |
| LOW | Any other | < 70% |

---

## Key Endpoints Reference

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | /api/auth/login | None | Returns JWT token |
| GET | /api/sensors/latest | JWT | Latest reading per node |
| GET | /api/sensors/history | JWT | Historical data with filters |
| GET | /api/sensors/summary | JWT | Farm-level averages (Farm Owner) |
| GET | /api/recommendations/latest | JWT | Most recent Gemini recommendations |
| POST | /api/recommendations/generate | JWT | Manually trigger Gemini (testing) |
| GET | /api/alerts | JWT | All CLR alerts |
| POST | /predict | None (local) | ML model risk prediction |

---

## Team Responsibilities Suggestion

| Member | Module |
|--------|--------|
| Member 1 | Firmware (ESP32 nodes) + hardware assembly |
| Member 2 | Node-RED pipeline + Raspberry Pi setup |
| Member 3 | ML model training + Flask API + Backend routes |

All members: database setup, Grafana dashboard, testing & documentation
