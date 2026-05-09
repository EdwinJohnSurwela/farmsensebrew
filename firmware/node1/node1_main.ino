/**
 * FarmSense Brew — ESP32 Node Firmware
 * Node: NODE_01 (replace NODE_ID per node 01–05)
 * Sensors: DHT22 (Temperature + Humidity) + Capacitive Soil Moisture Sensor v1.2
 * Protocol: MQTT over Wi-Fi → Raspberry Pi broker
 *
 * TEAM INSTRUCTIONS:
 * - Copy this file for each of the 5 nodes, change NODE_ID and pin config
 * - Flash using Arduino IDE or PlatformIO
 * - Required libraries: PubSubClient, DHT sensor library by Adafruit, ArduinoJson
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ─── NODE IDENTITY (change per node) ──────────────────────────────────────────
#define NODE_ID        "NODE_01"
#define NODE_POSITION  "NW_CORNER"   // NW_CORNER, NE_CORNER, SW_CORNER, SE_CORNER, CENTER

// ─── PIN CONFIGURATION ────────────────────────────────────────────────────────
#define DHT_PIN        4             // GPIO4 — DHT22 data pin
#define DHT_TYPE       DHT22
#define SOIL_PIN       34            // GPIO34 — ADC1 (analog-capable pin)

// ─── SOIL MOISTURE CALIBRATION (calibrate per sensor in your actual soil) ─────
#define SOIL_AIR_VALUE    3200       // Raw ADC reading in dry air (0% moisture)
#define SOIL_WATER_VALUE  1200       // Raw ADC reading submerged in water (100%)

// ─── NETWORK CONFIG (store in config.h for security) ──────────────────────────
const char* WIFI_SSID     = "JavierFarm_WiFi";       // Replace with actual SSID
const char* WIFI_PASSWORD = "your_wifi_password";     // Replace with actual password
const char* MQTT_BROKER   = "192.168.1.100";          // Raspberry Pi local IP
const int   MQTT_PORT     = 1883;
const char* MQTT_TOPIC    = "farmsense/sensors";      // All nodes publish to same topic

// ─── READING INTERVAL ─────────────────────────────────────────────────────────
const unsigned long READ_INTERVAL_MS = 300000;        // 5 minutes = 300,000 ms

// ─── OBJECTS ──────────────────────────────────────────────────────────────────
DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient espClient;
PubSubClient mqttClient(espClient);
unsigned long lastReadTime = 0;

// ─── SETUP ────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.println("FarmSense Brew — Node: " + String(NODE_ID));

  dht.begin();
  connectWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────
void loop() {
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();

  unsigned long now = millis();
  if (now - lastReadTime >= READ_INTERVAL_MS) {
    lastReadTime = now;
    readAndPublish();
  }
}

// ─── READ SENSORS AND PUBLISH ─────────────────────────────────────────────────
void readAndPublish() {
  float temperature = dht.readTemperature();
  float humidity    = dht.readHumidity();
  int   soilRaw     = analogRead(SOIL_PIN);
  int   soilPct     = map(soilRaw, SOIL_AIR_VALUE, SOIL_WATER_VALUE, 0, 100);
  soilPct           = constrain(soilPct, 0, 100);

  // Validate readings
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("[ERROR] DHT22 read failed. Skipping publish.");
    return;
  }

  // Build JSON payload
  StaticJsonDocument<256> doc;
  doc["node_id"]     = NODE_ID;
  doc["position"]    = NODE_POSITION;
  doc["temperature"] = round(temperature * 10) / 10.0;
  doc["humidity"]    = round(humidity * 10) / 10.0;
  doc["soil_pct"]    = soilPct;
  doc["soil_raw"]    = soilRaw;
  doc["timestamp"]   = millis();

  char payload[256];
  serializeJson(doc, payload);

  // Publish
  bool success = mqttClient.publish(MQTT_TOPIC, payload);
  Serial.printf("[%s] Temp: %.1f°C | Hum: %.1f%% | Soil: %d%% | MQTT: %s\n",
                NODE_ID, temperature, humidity, soilPct, success ? "OK" : "FAIL");
}

// ─── WIFI CONNECTION ──────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("Connecting to WiFi: " + String(WIFI_SSID));
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());
}

// ─── MQTT RECONNECT ───────────────────────────────────────────────────────────
void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT broker...");
    String clientId = "ESP32_" + String(NODE_ID);
    if (mqttClient.connect(clientId.c_str())) {
      Serial.println("connected.");
    } else {
      Serial.printf("failed (rc=%d). Retrying in 5s.\n", mqttClient.state());
      delay(5000);
    }
  }
}
