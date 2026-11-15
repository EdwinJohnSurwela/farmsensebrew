 
// by the field node and the valve controller. The two copies
// (esp32_field_node/ and esp32_valve_controller/) must stay identical.
 
 
 
 
 
 
 
 
 
 
 
 
 
 
#pragma once
#include <WiFi.h>
#include <WiFiMulti.h>
#include <HTTPClient.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <Update.h>

WiFiMulti wifiMulti;
IPAddress serverIp;               
String connectedSsid;
unsigned long lastWifiOk = 0;

Preferences prefs;
char deviceId[13] = "";           
String deviceToken;               
int assignedNode = 0;             

static bool ipIsZero(const IPAddress& ip) {
  return ip[0] == 0 && ip[1] == 0 && ip[2] == 0 && ip[3] == 0;
}

 
void loadIdentity() {
  uint64_t mac = ESP.getEfuseMac();
  snprintf(deviceId, sizeof(deviceId), "%02X%02X%02X%02X%02X%02X",
           (uint8_t)mac, (uint8_t)(mac >> 8), (uint8_t)(mac >> 16),
           (uint8_t)(mac >> 24), (uint8_t)(mac >> 32), (uint8_t)(mac >> 40));
  prefs.begin("farmsense", false);
  deviceToken = prefs.getString("token", "");
  assignedNode = prefs.getInt("node", 0);
}

 
void makeHostname(char* out, size_t len) {
  snprintf(out, len, "farmsense-%c%c%c%c%c%c",
           tolower(deviceId[6]), tolower(deviceId[7]), tolower(deviceId[8]),
           tolower(deviceId[9]), tolower(deviceId[10]), tolower(deviceId[11]));
}

void netBegin(const char* hostname) {
  WiFi.mode(WIFI_STA);
   
   
   
  WiFi.setSleep(false);
  WiFi.setHostname(hostname);
   
   
  if (strlen(WIFI_HOME_SSID) > 0 && strlen(WIFI_HOME_PASS) > 0) wifiMulti.addAP(WIFI_HOME_SSID, WIFI_HOME_PASS);
  if (strlen(WIFI_FARM_SSID) > 0 && strlen(WIFI_FARM_PASS) > 0) wifiMulti.addAP(WIFI_FARM_SSID, WIFI_FARM_PASS);
  Serial.printf("Board ID: %c%c:%c%c:%c%c:%c%c:%c%c:%c%c\n",
                deviceId[0], deviceId[1], deviceId[2], deviceId[3], deviceId[4], deviceId[5],
                deviceId[6], deviceId[7], deviceId[8], deviceId[9], deviceId[10], deviceId[11]);
  lastWifiOk = millis();
}

 
 
bool netEnsure(const char* hostname) {
  if (WiFi.status() == WL_CONNECTED) {
    lastWifiOk = millis();
    return true;
  }
  Serial.println("[WiFi] connecting...");
  if (wifiMulti.run(15000) == WL_CONNECTED) {
    lastWifiOk = millis();
    if (WiFi.SSID() != connectedSsid) {       
      connectedSsid = WiFi.SSID();
      serverIp = IPAddress();
    }
    Serial.printf("[WiFi] connected to %s, IP %s, signal %d dBm\n",
                  WiFi.SSID().c_str(), WiFi.localIP().toString().c_str(), WiFi.RSSI());
    MDNS.end();
    MDNS.begin(hostname);
    return true;
  }
  if (millis() - lastWifiOk > NO_WIFI_REBOOT_MS) {
    Serial.println("[WiFi] no known network for too long: restarting the board");
    delay(200);
    ESP.restart();
  }
  return false;
}

IPAddress findServer() {
  if (!ipIsZero(serverIp)) return serverIp;
  IPAddress ip = MDNS.queryHost(SERVER_MDNS_NAME, 2000);
  if (!ipIsZero(ip)) {
    Serial.printf("[Pi] found %s.local at %s\n", SERVER_MDNS_NAME, ip.toString().c_str());
  } else {
    IPAddress me = WiFi.localIP();
    ip = IPAddress(me[0], me[1], me[2], SERVER_HOST_OCTET);
    Serial.printf("[Pi] %s.local did not answer, trying %s\n", SERVER_MDNS_NAME, ip.toString().c_str());
  }
  serverIp = ip;
  return ip;
}

static String serverUrl(const char* path) {
  return "http://" + findServer().toString() + ":" + String(SERVER_PORT) + path;
}

static void addIdentityHeaders(HTTPClient& http) {
  http.addHeader("X-Device-Id", deviceId);
  if (deviceToken.length()) http.addHeader("X-Device-Token", deviceToken);
}

int httpPostJson(const char* path, const String& body, String* reply = nullptr) {
  WiFiClient client;
  HTTPClient http;
  http.setConnectTimeout(3000);
  http.setTimeout(5000);
  if (!http.begin(client, serverUrl(path))) { serverIp = IPAddress(); return -1; }
  http.addHeader("Content-Type", "application/json");
  addIdentityHeaders(http);
  int code = http.POST(body);
  if (reply && code > 0) *reply = http.getString();
  http.end();
  if (code <= 0) serverIp = IPAddress();      
  return code;
}

 
 
 
 
 
 
WiFiClient liveClient;
HTTPClient liveHttp;

int httpPostJsonFast(const char* path, const String& body) {
  liveHttp.setReuse(true);
  liveHttp.setConnectTimeout(1500);
  liveHttp.setTimeout(1500);
  if (!liveHttp.begin(liveClient, serverUrl(path))) { serverIp = IPAddress(); return -1; }
  liveHttp.addHeader("Content-Type", "application/json");
  addIdentityHeaders(liveHttp);
  int code = liveHttp.POST(body);
  if (code > 0) liveHttp.getString();         
  liveHttp.end();
  if (code <= 0) {
    liveClient.stop();
    serverIp = IPAddress();
  }
  return code;
}

int httpGet(const char* path, String& out) {
  WiFiClient client;
  HTTPClient http;
  http.setConnectTimeout(3000);
  http.setTimeout(5000);
  if (!http.begin(client, serverUrl(path))) { serverIp = IPAddress(); return -1; }
  addIdentityHeaders(http);
  int code = http.GET();
  if (code == 200) out = http.getString();
  http.end();
  if (code <= 0) serverIp = IPAddress();
  return code;
}

 
String jsonField(const String& body, const char* key) {
  String pat = String("\"") + key + "\":";
  int i = body.indexOf(pat);
  if (i < 0) return "";
  i += pat.length();
  while (i < (int)body.length() && body[i] == ' ') i++;
  if (i < (int)body.length() && body[i] == '"') {
    int j = body.indexOf('"', i + 1);
    return j < 0 ? "" : body.substring(i + 1, j);
  }
  int j = i;
  while (j < (int)body.length() && body[j] != ',' && body[j] != '}') j++;
  String v = body.substring(i, j);
  v.trim();
  return v == "null" ? "" : v;
}

// Signs this board on to the Pi. kind is "node" or "valve"; requestedNode is
 
// assignedNode then holds the node number (0 for the valve box).
bool registerWithPi(const char* kind, int requestedNode, const char* firmware) {
  char body[160];
  snprintf(body, sizeof(body), "{\"device_id\":\"%s\",\"kind\":\"%s\",\"node\":%d,\"firmware\":\"%s\"}",
           deviceId, kind, requestedNode, firmware);
  String reply;
  int code = httpPostJson("/api/devices/hello", String(body), &reply);
  if (code != 200) {
    Serial.printf("[Pi] sign-on refused (HTTP %d): %s\n", code, jsonField(reply, "error").c_str());
    return false;
  }
  String token = jsonField(reply, "token");
  if (token.length()) {                       
    deviceToken = token;
    prefs.putString("token", token);
    Serial.println("[Pi] received this board's key and saved it");
  }
  int node = jsonField(reply, "node").toInt();
  if (node != assignedNode) {
    assignedNode = node;
    prefs.putInt("node", node);
  }
  String note = jsonField(reply, "note");
  if (note.length()) Serial.printf("[Pi] %s\n", note.c_str());
  return true;
}

 
 
 
 
 
// beforeFlash runs just before writing starts (the valve box closes its valves).
void checkForFirmwareUpdate(const char* firmware, void (*beforeFlash)() = nullptr) {
  if (!deviceToken.length()) return;
  WiFiClient client;
  HTTPClient http;
  http.setConnectTimeout(3000);
  http.setTimeout(15000);
  if (!http.begin(client, serverUrl("/api/devices/firmware"))) { serverIp = IPAddress(); return; }
  addIdentityHeaders(http);
  http.addHeader("X-Firmware", firmware);
  const char* keys[] = { "X-Firmware-Version", "X-MD5" };
  http.collectHeaders(keys, 2);
  int code = http.GET();
  if (code != 200) {
    if (code == 204) Serial.println("[Update] firmware is up to date");
    else Serial.printf("[Update] check failed (HTTP %d)\n", code);
    http.end();
    if (code <= 0) serverIp = IPAddress();
    return;
  }
  int len = http.getSize();
  String version = http.header("X-Firmware-Version");
  String md5 = http.header("X-MD5");
  Serial.printf("[Update] new firmware \"%s\", %d bytes: installing\n", version.c_str(), len);
  if (len <= 0 || !Update.begin(len)) {
    Serial.printf("[Update] cannot start: %s\n", Update.errorString());
    http.end();
    return;
  }
  if (md5.length() == 32) Update.setMD5(md5.c_str());
  if (beforeFlash) beforeFlash();
  size_t written = Update.writeStream(*http.getStreamPtr());
  http.end();
  if (written != (size_t)len || !Update.end(true)) {
    Serial.printf("[Update] failed (%u of %d bytes): %s. Keeping the old firmware.\n",
                  (unsigned)written, len, Update.errorString());
    Update.abort();
    return;
  }
  Serial.println("[Update] installed and checked: restarting into it");
  delay(300);
  ESP.restart();
}
