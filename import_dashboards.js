/**
 * Re-imports all 3 Grafana dashboards via the Grafana HTTP API.
 * Run: node import_dashboards.js
 */

const fs   = require('fs');
const path = require('path');
const http = require('http');

const GRAFANA_URL = 'http://127.0.0.1:3000';
const AUTH = Buffer.from('admin:farmsense').toString('base64');

const dashboards = [
  'grafana_agronomist_view.json',
  'grafana_farmowner_view.json',
  'grafana_fieldstaff_view.json',
  'grafana_scaleup_view.json',
];

async function importDashboard(filename) {
  const filePath = path.join(__dirname, 'dashboard', filename);
  const dashJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  // Remove version/id to allow overwrite
  delete dashJson.id;
  delete dashJson.version;

  const body = JSON.stringify({
    dashboard: dashJson,
    overwrite: true,
    message: `Re-imported from ${filename} — fixed No Data panels`
  });

  return new Promise((resolve, reject) => {
    const url = new URL('/api/dashboards/db', GRAFANA_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Basic ${AUTH}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log(`✅ ${filename}: ${data}`);
        } else {
          console.error(`❌ ${filename} (HTTP ${res.statusCode}): ${data}`);
        }
        resolve();
      });
    });

    req.on('error', err => {
      console.error(`❌ ${filename}: ${err.message}`);
      reject(err);
    });

    req.write(body);
    req.end();
  });
}

(async () => {
  console.log('Importing dashboards into Grafana...\n');
  for (const f of dashboards) {
    await importDashboard(f);
  }
  console.log('\nDone! Refresh your Grafana browser tab to see updates.');
})();
