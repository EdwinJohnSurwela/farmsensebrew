#ifndef CONFIG_H
#define CONFIG_H
 
 
 
 
 
 
 
 
 

 
 
 
 
#define NODE_ID 0

 
#define WIFI_HOME_SSID ""    
#define WIFI_HOME_PASS ""                  
#define WIFI_FARM_SSID ""    
#define WIFI_FARM_PASS ""                  

 
#define SERVER_MDNS_NAME  "jpcf"      
#define SERVER_HOST_OCTET 151             // fallback: <network>.151
#define SERVER_PORT       3001
 
 
#define REMOTE_SERVER_URL "https://farmsense.tail274238.ts.net"
#define UPDATE_CHECK_MS   21600000UL       

 
#define SHT_SDA_PIN    21    
#define SHT_SCL_PIN    22   // SHT31 probe yellow wire (I2C clock); red 3V3, black GND
#define DHT_PIN        4     
#define SOIL_PIN       34    
#define SOIL_POWER_PIN 25    
#define SOIL_POWER_PIN2 27   
                             
#define SOIL_WARMUP_MS 1000  
#define LED_PIN        2     

 
#define LIVE_INTERVAL_MS          2000UL    
                                            
#define SOIL_READ_INTERVAL_MS    20000UL    
#define NO_WIFI_REBOOT_MS       600000UL    
#define NO_POST_REBOOT_MS      1800000UL    

#endif
