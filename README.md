# FarmSense Brew

A scalable IoT microclimate monitoring, Coffee Leaf Rust risk prevention and automated irrigation system for Liberica coffee farming, deployed at Javier Permaculture Farm and Camp Site, San Jose, Batangas.

Capstone project of Ron Andrei C. Cerantes, Kenchin Solisa and Edwin John L. Surwela, BSIT Network Technology, Batangas State University, The National Engineering University, Lipa Campus.

This branch holds the source of the system as it runs on the farm's Raspberry Pi 4 (copied from the Pi on 16 November 2026). Earlier files of the project are kept on the `archive-july-2026` branch.

## How the system works

Five ESP32 sensor boxes send air temperature, relative humidity and soil moisture every two seconds to the API on the Raspberry Pi 4. The API checks each reading, keeps one reading per node per minute in MariaDB, scores Coffee Leaf Rust risk on five levels and pushes live values to the web application. A valve box with a sixth ESP32 opens three solenoid valves for drip irrigation, which the server holds closed while the risk is High or Critical. Grafana draws the charts, and a Python service runs the Random Forest model that checks the risk rule under sensor noise. Everything runs on the farm network, so the system keeps working without internet; only the Gemini rewording of the advice needs it.

## Folders

```text
backend/        Node.js + Express API: readings, risk rule, alerts, irrigation, reports, accounts
frontend/       Static files served by the API; frontend/app/ is the compiled web app running on the Pi
webapp/         React (Vite) source of the web application
ml-service/     Python FastAPI service with the Random Forest model (train.py, app.py, model.joblib)
deploy/
  grafana/      Grafana datasource and dashboard provisioning
  initdb/       Database schema loaded on the first start of MariaDB
  pi/           Raspberry Pi maintenance scripts (port 80, safe shutdown)
  env.example   Settings to copy into .env before starting
firmware/
  esp32_field_node/        Sensor box firmware (SHT31 with DHT22 backup, capacitive soil probe)
  esp32_valve_controller/  Valve box firmware (relay board, failsafe close)
compose.yaml    Podman stack: api, mysql (MariaDB), grafana, ml
Containerfile   Image for the API and the web app
```

## Running the stack

1. Copy `deploy/env.example` to `.env` beside `compose.yaml` and set the database password, the JWT secret, the Grafana admin password and, if wanted, a Gemini API key.
2. Start the containers with `podman-compose up -d --build`.
3. Open `http://<pi-address>:3001/app/`.

To change the web application, edit `webapp/src`, run `npm install` and `npm run build` in `webapp/`, and copy the output to `frontend/app/`.

## Notes

- `frontend/app/` is the exact build running on the Pi (built 4 November 2026). `webapp/` is the team's latest working copy of its source and may include small changes made after that build.
- `deploy/initdb/` holds table definitions only. Farm data, user accounts and logs are not published.
- Wi-Fi names and passwords in `firmware/*/config.h` are left blank; each board receives its own key from the server when an administrator registers it.
- Secrets live only in `.env` on the Pi, which is not part of this repository.
