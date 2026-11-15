 
 
 
 
 
 
 
// (about 8 s of silence = offline):
 
 
 
// Sensor boxes do NOT control valves; the valve controller does that.
#include <DHT.h>
#include <Wire.h>
#include "config.h"
#include "net_helpers.h"

#if NODE_ID < 0 || NODE_ID > 99
#error "NODE_ID must be 0 (let the Pi choose) or the node number wanted"
#endif

#ifdef REMOTE_SERVER_URL
#define FIRMWARE_VERSION "field-node 2026-10-12 sht31 remote"    
#else
#define FIRMWARE_VERSION "field-node 2026-10-12 sht31"
#endif
#define SIGN_ON_RETRY_MS 30000UL     

DHT dht(DHT_PIN, DHT22);

 
#define SHT_FIND_RETRY_MS 30000UL    
#define SHT_FAILS_RESET   3          
uint8_t shtAddr = 0;                 
unsigned long lastShtFind = 0;
int  shtFails = 0;
const char* airSource = "none";      

uint8_t crc8(const uint8_t *d, int n) {
  uint8_t c = 0xFF;
  for (int i = 0; i < n; i++) {
    c ^= d[i];
    for (int b = 0; b < 8; b++) c = (c & 0x80) ? (c << 1) ^ 0x31 : (c << 1);
  }
  return c;
}

bool shtCommand(uint16_t cmd) {
  Wire.beginTransmission(shtAddr);
  Wire.write(cmd >> 8);
  Wire.write(cmd & 0xFF);
  return Wire.endTransmission() == 0;
}

void findSht31() {
  lastShtFind = millis();
  shtAddr = 0;
  for (uint8_t a : {0x44, 0x45}) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) { shtAddr = a; break; }
  }
  if (shtAddr) {
    shtCommand(0x3066);    
    Serial.printf("[SHT31] probe found at 0x%02X\n", shtAddr);
  } else {
    Serial.println("[SHT31] no probe on D21/D22: using the DHT22 on D4 until one is found");
  }
  shtFails = 0;
}

 
 
bool readSht31(float &t, float &h) {
  if (!shtAddr) return false;
  if (!shtCommand(0x2400)) return false;
  delay(20);
  if (Wire.requestFrom((int)shtAddr, 6) != 6) return false;
  uint8_t d[6];
  for (int i = 0; i < 6; i++) d[i] = Wire.read();
  if (crc8(d, 2) != d[2] || crc8(d + 3, 2) != d[5]) return false;
  t = -45.0f + 175.0f * ((d[0] << 8) | d[1]) / 65535.0f;
  h = 100.0f * ((d[3] << 8) | d[4]) / 65535.0f;
  if (h > 100.0f) h = 100.0f;    
  return true;
}

 
 
bool readAir(float &t, float &h) {
  if (shtAddr) {
    if (readSht31(t, h)) { shtFails = 0; airSource = "sht31"; return true; }
    if (++shtFails >= SHT_FAILS_RESET) {
      Serial.println("[SHT31] 3 bad reads in a row: restarting the I2C bus");
      Wire.end();
      Wire.begin(SHT_SDA_PIN, SHT_SCL_PIN);
      Wire.setClock(50000);
      findSht31();
    }
  } else if (millis() - lastShtFind >= SHT_FIND_RETRY_MS) {
    findSht31();
    if (shtAddr && readSht31(t, h)) { airSource = "sht31"; return true; }
  }
  t = dht.readTemperature();
  h = dht.readHumidity();
   
  if (!isnan(t) && !isnan(h) && !(t == 0.0f && h == 0.0f)) { airSource = "dht22"; return true; }
  airSource = "none";
  return false;
}

 
 
#define SOIL_MIN_VALID 50
#define SOIL_SAMPLES   15
 
 
 
 
#define SOIL_STALE_LIMIT_MS 30000UL

char hostname[24];
bool signedOn = false;
unsigned long lastUpdateCheck = 0;
unsigned long lastSignOnTry = 0;
int  lastGoodSoilRaw = -1;
unsigned long lastGoodSoilAt = 0;
unsigned long lastSoilRead = 0;
bool soilDue = true;
unsigned long lastSampleAt = 0;
unsigned long lastPostOk = 0;
unsigned long lastFlash = 0;
int  failsInRow = 0;

void blink(int times, int ms) {
  for (int i = 0; i < times; i++) {
    digitalWrite(LED_PIN, HIGH); delay(ms);
    digitalWrite(LED_PIN, LOW);  delay(ms);
  }
}

 
void blinkNodeNumber(int node) {
  delay(1000);
  for (int i = 0; i < node; i++) {
    digitalWrite(LED_PIN, HIGH); delay(600);
    digitalWrite(LED_PIN, LOW);  delay(400);
  }
  delay(1000);
}

void trySignOn() {
  lastSignOnTry = millis();
  if (!netEnsure(hostname)) return;
  signedOn = registerWithPi("node", NODE_ID, FIRMWARE_VERSION);
  if (signedOn) {
    Serial.printf("[Pi] this board is NODE_%02d (post S%d). Label it now.\n", assignedNode, assignedNode);
    blinkNodeNumber(assignedNode);
    soilDue = true;                           
    lastUpdateCheck = millis();
    checkForFirmwareUpdate(FIRMWARE_VERSION);    
  } else {
    blink(3, 150);
  }
}

 
 
 
int readSoilRaw() {
  digitalWrite(SOIL_POWER_PIN, HIGH);
  digitalWrite(SOIL_POWER_PIN2, HIGH);
  delay(120);
  int early = analogRead(SOIL_PIN);          
  if (SOIL_WARMUP_MS > 120) delay(SOIL_WARMUP_MS - 120);
  int s[SOIL_SAMPLES];
  int valid = 0;
  for (int i = 0; i < SOIL_SAMPLES; i++) {
    s[i] = analogRead(SOIL_PIN);
    if (s[i] >= SOIL_MIN_VALID) valid++;
    delay(4);
  }
  digitalWrite(SOIL_POWER_PIN, LOW);
  digitalWrite(SOIL_POWER_PIN2, LOW);
  Serial.printf("[Soil] raw after 0.12 s = %d, after %.1f s = %d\n", early, SOIL_WARMUP_MS / 1000.0, s[SOIL_SAMPLES - 1]);
  if (valid < SOIL_SAMPLES / 2 + 1) return -1;
  for (int i = 1; i < SOIL_SAMPLES; i++) {
    int key = s[i], j = i - 1;
    while (j >= 0 && s[j] > key) { s[j + 1] = s[j]; j--; }
    s[j + 1] = key;
  }
  return s[SOIL_SAMPLES / 2];
}

 
 
 
int currentSoilRaw(unsigned long now) {
  if (soilDue || now - lastSoilRead >= SOIL_READ_INTERVAL_MS) {
    soilDue = false;
    lastSoilRead = now;
    int soil = readSoilRaw();
    if (soil >= 0) {
      lastGoodSoilRaw = soil;
      lastGoodSoilAt = now;
    } else {
      Serial.println("[Soil] dropout: reusing the last good value. Check AOUT on GPIO 34 and VCC on GPIO 25 or 27.");
    }
  }
  if (lastGoodSoilRaw >= 0 && now - lastGoodSoilAt < SOIL_STALE_LIMIT_MS) return lastGoodSoilRaw;
  return -1;
}

void takeAndSendSample() {
  unsigned long now = millis();
   
   
  float t = NAN, h = NAN;
  bool dhtOk = readAir(t, h);    
  int soil = currentSoilRaw(now);

  char tb[16], hb[16], sb[12];
  if (dhtOk) { snprintf(tb, sizeof(tb), "%.2f", t); snprintf(hb, sizeof(hb), "%.2f", h); }
  else       { strcpy(tb, "null"); strcpy(hb, "null"); }
  if (soil >= 0) snprintf(sb, sizeof(sb), "%d", soil); else strcpy(sb, "null");

  if (!netEnsure(hostname)) return;
  char body[240];
  snprintf(body, sizeof(body),
           "{\"device_id\":\"%s\",\"node_id\":%d,\"temperature\":%s,\"humidity\":%s,\"soil_moisture\":%s,\"air_sensor\":\"%s\"}",
           deviceId, assignedNode, tb, hb, sb, airSource);
  int code = httpPostJsonFast("/api/sensors/live", String(body));

  if (code == 200) {
    lastPostOk = now;
    if (failsInRow > 0) Serial.printf("[Pi] sending again after %d failed tries\n", failsInRow);
    failsInRow = 0;
    if (!dhtOk) Serial.println("[Air] no reading from the SHT31 or the DHT22 (sent without temperature). Check the probe wires on D21/D22.");
    if (now - lastFlash >= 30000UL) {         
      lastFlash = now;
      Serial.printf("[NODE_%02d] live: temp=%s C  hum=%s %% (%s)  soil raw=%s\n", assignedNode, tb, hb, airSource, sb);
      blink(1, 30);
    }
  } else {
    failsInRow++;
    if (failsInRow == 1 || failsInRow % 15 == 0) Serial.printf("[Pi] sample not accepted -> HTTP %d\n", code);
    if (code == 401 || code == 409) {
      Serial.println("[Pi] the Pi no longer recognises this board: signing on again");
      signedOn = false;
      lastSignOnTry = 0;
    }
    blink(3, 100);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  pinMode(LED_PIN, OUTPUT);
  pinMode(SOIL_POWER_PIN, OUTPUT);
  digitalWrite(SOIL_POWER_PIN, LOW);
  pinMode(SOIL_POWER_PIN2, OUTPUT);
  digitalWrite(SOIL_POWER_PIN2, LOW);
  analogReadResolution(12);
  dht.begin();
  Wire.begin(SHT_SDA_PIN, SHT_SCL_PIN);
  Wire.setClock(50000);    
  findSht31();

  loadIdentity();
  makeHostname(hostname, sizeof(hostname));
  Serial.printf("\n=== FarmSense field node (%s) ===\n", FIRMWARE_VERSION);
  netBegin(hostname);
  delay(2000);    
  trySignOn();
  lastPostOk = millis();
}

void loop() {
  unsigned long now = millis();
  if (!signedOn) {
    if (now - lastSignOnTry >= SIGN_ON_RETRY_MS) trySignOn();
  } else {
    if (now - lastUpdateCheck >= UPDATE_CHECK_MS) {
      lastUpdateCheck = now;
      checkForFirmwareUpdate(FIRMWARE_VERSION);
    }
    if (now - lastSampleAt >= LIVE_INTERVAL_MS) {
      lastSampleAt = now;
      takeAndSendSample();
    }
  }

  if (millis() - lastPostOk > NO_POST_REBOOT_MS) {
    Serial.println("[Watchdog] nothing accepted by the Pi for 30 minutes: restarting the board");
    delay(200);
    ESP.restart();
  }
  delay(20);
}
