#ifndef CONFIG_H
#define CONFIG_H
// FarmSense Brew valve controller: the 6th ESP32, in the valve box (VB).
 
 
// matching valves.
 
 
// Label the board "VB / VALVE".

 
#define WIFI_HOME_SSID ""
#define WIFI_HOME_PASS ""                  
#define WIFI_FARM_SSID ""    
#define WIFI_FARM_PASS ""                  

 
#define SERVER_MDNS_NAME  "jpcf"
#define SERVER_HOST_OCTET 151
#define SERVER_PORT       3001
#define UPDATE_CHECK_MS   21600000UL       

// ===== 3. Valves =====
 
// Each valve opens when ANY of the nodes listed on its row is switched ON.
 
 
#define VALVE_COUNT 3
static const uint8_t VALVE_PINS[VALVE_COUNT] = { 26, 27, 32 };    
static const uint8_t VALVE_NODES[VALVE_COUNT][5] = {
  { 1, 4, 0, 0, 0 },   // valve 1: west side  (S1, S4)
  { 3, 0, 0, 0, 0 },   // valve 2: centre     (S3)
  { 2, 5, 0, 0, 0 },   // valve 3: east side  (S2, S5)
};

// Relay board with the trigger jumper on HIGH: pin HIGH = relay ON = valve open.
 
 
// through the opto and the valve can stay open. With the jumper on HIGH, 0 V is
 
 
 
 
 
// still opens the valve. Never go to LOW without the transistor: a 3.3 V "off"
// on a 12 V-referenced input can leave the valve open.
#define RELAY_ACTIVE_LOW false

// Only this many valves open at the same time. Each direct-acting valve can
 
 
#define MAX_VALVES_OPEN_AT_ONCE 1

#define LED_PIN 2                          // on-board blue LED: ON while any valve is open

 
#define POLL_INTERVAL_MS    3000UL          
#define FAILSAFE_CLOSE_MS   60000UL        // Pi unreachable for 60 s: close every valve
#define MAX_VALVE_OPEN_MS   2400000UL       
#define NO_WIFI_REBOOT_MS   600000UL        

#endif
