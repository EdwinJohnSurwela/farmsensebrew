/**
 * FarmSense Brew — Mock Sensor Script
 * Simulates all 5 ESP32 nodes publishing sensor data via MQTT
 * Run with: node mock_sensor.js
 */

const mqtt = require('mqtt');

const client = mqtt.connect('mqtt://127.0.0.1:1883');

const nodes = [
  { node_id: 'NODE_01', position: 'NW_CORNER' },
  { node_id: 'NODE_02', position: 'NE_CORNER' },
  { node_id: 'NODE_03', position: 'SW_CORNER' },
  { node_id: 'NODE_04', position: 'SE_CORNER' },
  { node_id: 'NODE_05', position: 'CENTER' },
];

client.on('connect', () => {
  console.log('Mock sensor connected to MQTT broker on localhost:1883');
  console.log('Publishing sensor data every 10 seconds...\n');

  // Publish immediately on connect
  publishAll();

  // Then every 10 seconds
  setInterval(publishAll, 10000);
});

function publishAll() {
  nodes.forEach(node => {
    const payload = JSON.stringify({
      node_id:     node.node_id,
      position:    node.position,
      temperature: parseFloat((22 + Math.random() * 4).toFixed(1)),
      humidity:    parseFloat((75 + Math.random() * 15).toFixed(1)),
      soil_pct:    Math.floor(50 + Math.random() * 30),
      timestamp:   Date.now()
    });

    client.publish('farmsense/sensors', payload);
    console.log(`[${new Date().toLocaleTimeString()}] Published: ${node.node_id} → ${payload}`);
  });
  console.log('---');
}

client.on('error', (err) => {
  console.error('MQTT connection error:', err.message);
});

client.on('close', () => {
  console.log('MQTT connection closed');
});