// FarmSense Brew valve controller (valve box VB): 3 solenoid valves on an
 
// node states to valves with VALVE_NODES in config.h.
 
 
//   - every valve starts CLOSED at power-on;
//   - if the Pi cannot be reached for FAILSAFE_CLOSE_MS, every valve closes;
//   - a valve open longer than MAX_VALVE_OPEN_MS closes and stays closed until
 
//   - at most MAX_VALVES_OPEN_AT_ONCE valves open together, one new valve per poll.
// At power-on the board signs on to the Pi as the valve box (see net_helpers.h);
 
#include "config.h"
#include "net_helpers.h"

#define FIRMWARE_VERSION "valve-box 2026-09-26 jpcf"
#define SIGN_ON_RETRY_MS 30000UL

const char* hostname = "farmsense-valve";
bool signedOn = false;
unsigned long lastSignOnTry = 0;
bool valveOpen[VALVE_COUNT] = { false };
bool lockedOut[VALVE_COUNT] = { false };
bool waitingNoted[VALVE_COUNT] = { false };
unsigned long openSince[VALVE_COUNT] = { 0 };
unsigned long lastPoll = 0;
unsigned long lastPollOk = 0;
bool failsafeActive = false;
unsigned long lastUpdateCheck = 0;

void driveValve(int v, bool open) {
  int level = open ? (RELAY_ACTIVE_LOW ? LOW : HIGH) : (RELAY_ACTIVE_LOW ? HIGH : LOW);
  digitalWrite(VALVE_PINS[v], level);
  valveOpen[v] = open;
  if (open) openSince[v] = millis();
}

void setValve(int v, bool open, const char* why) {
  if (valveOpen[v] == open) return;
  driveValve(v, open);
  Serial.printf(">>> VALVE %d %s (%s)\n", v + 1, open ? "OPEN" : "CLOSED", why);
}

void closeAll(const char* why) {
  for (int v = 0; v < VALVE_COUNT; v++) setValve(v, false, why);
}

int openCount() {
  int n = 0;
  for (int v = 0; v < VALVE_COUNT; v++) if (valveOpen[v]) n++;
  return n;
}

 
// in which case the valves are left as they are for this cycle.
bool pollNodes(bool nodeOn[6]) {
  for (int n = 1; n <= 5; n++) {
    String payload;
    char path[40];
    snprintf(path, sizeof(path), "/api/irrigation/relay/%d", n);
    int code = httpGet(path, payload);
    if (code != 200) {
      Serial.printf("[Pi] relay poll for node %d failed (HTTP %d)\n", n, code);
      if (code == 401) signedOn = false;      
      return false;
    }
    nodeOn[n] = payload.indexOf("\"state\":true") >= 0;
  }
  return true;
}

void applyStates(const bool nodeOn[6]) {
  unsigned long now = millis();
  bool want[VALVE_COUNT];
  for (int v = 0; v < VALVE_COUNT; v++) {
    want[v] = false;
    for (int k = 0; k < 5; k++) {
      int n = VALVE_NODES[v][k];
      if (n >= 1 && n <= 5 && nodeOn[n]) want[v] = true;
    }
  }
   
  for (int v = 0; v < VALVE_COUNT; v++) {
    if (!want[v]) {
      lockedOut[v] = false;
      waitingNoted[v] = false;
      setValve(v, false, "switched off");
    } else if (valveOpen[v] && now - openSince[v] > MAX_VALVE_OPEN_MS) {
      setValve(v, false, "SAFETY: open too long");
      lockedOut[v] = true;
    }
  }
  bool openedOne = false;
  for (int v = 0; v < VALVE_COUNT; v++) {
    if (!want[v] || valveOpen[v] || lockedOut[v]) continue;
    if (!openedOne && openCount() < MAX_VALVES_OPEN_AT_ONCE) {
      setValve(v, true, "switched on");
      openedOne = true;               // one new valve per poll spreads the inrush current
      waitingNoted[v] = false;
    } else if (!waitingNoted[v]) {
      Serial.printf("[Valve %d] switched on, waiting for another valve to finish\n", v + 1);
      waitingNoted[v] = true;
    }
  }
}

// Every valve shut before new firmware is written (the board restarts after).
void closeAllForUpdate() { closeAll("firmware update"); }

void trySignOn() {
  lastSignOnTry = millis();
  if (!netEnsure(hostname)) return;
  signedOn = registerWithPi("valve", 0, FIRMWARE_VERSION);
  if (signedOn) {
    Serial.println("[Pi] signed on as the valve box");
    lastUpdateCheck = millis();
    checkForFirmwareUpdate(FIRMWARE_VERSION, closeAllForUpdate);
  }
}

void setup() {
  for (int v = 0; v < VALVE_COUNT; v++) {
    pinMode(VALVE_PINS[v], OUTPUT);
    driveValve(v, false);              
  }
  pinMode(LED_PIN, OUTPUT);
  Serial.begin(115200);
  delay(500);
  Serial.printf("\n=== FarmSense valve controller (VB, %s) ===\n", FIRMWARE_VERSION);
  for (int v = 0; v < VALVE_COUNT; v++) {
    Serial.printf("valve %d on GPIO %d opens for nodes:", v + 1, VALVE_PINS[v]);
    for (int k = 0; k < 5; k++) if (VALVE_NODES[v][k]) Serial.printf(" %d", VALVE_NODES[v][k]);
    Serial.println();
  }
  loadIdentity();
  netBegin(hostname);
  trySignOn();
  lastPollOk = millis();
}

void loop() {
  unsigned long now = millis();
  if (!signedOn && now - lastSignOnTry >= SIGN_ON_RETRY_MS) trySignOn();
  if (signedOn && now - lastUpdateCheck >= UPDATE_CHECK_MS) {
    lastUpdateCheck = now;
    checkForFirmwareUpdate(FIRMWARE_VERSION, closeAllForUpdate);
  }
  if (now - lastPoll >= POLL_INTERVAL_MS) {
    lastPoll = now;
    bool nodeOn[6] = { false };
    if (netEnsure(hostname) && pollNodes(nodeOn)) {
      lastPollOk = millis();
      if (failsafeActive) Serial.println("[Pi] reachable again");
      failsafeActive = false;
      applyStates(nodeOn);
    }
  }
  if (millis() - lastPollOk > FAILSAFE_CLOSE_MS && !failsafeActive) {
    closeAll("FAILSAFE: Pi unreachable");
    failsafeActive = true;
  }
  digitalWrite(LED_PIN, openCount() > 0 ? HIGH : LOW);
  delay(50);
}
