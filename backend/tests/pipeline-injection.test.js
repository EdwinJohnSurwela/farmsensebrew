/**
 * FarmSense Brew — Pipeline Injection Tests (FB-56)
 *
 * Injects synthetic readings through the REAL device endpoint
 * (POST /api/sensors/reading) and asserts every stage of the pipeline:
 *   1. reading lands in MySQL with the correct computed CLR risk
 *   2. a HIGH-risk reading auto-creates a clr_alerts row
 *   3. a threshold rule triggers the relay and auto-shuts off
 *   4. SAFETY: automation is withheld while the zone's CLR risk is HIGH
 *
 * Run:  node tests/pipeline-injection.test.js   (backend must be running)
 * Cleans up everything it injects.
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const db = require("../services/db.service");

const BASE = process.env.TEST_BASE_URL || "http://localhost:3001";
const TEST_NODE_HIGH = 4;  // NODE_04 gets the HIGH-risk injection
const TEST_NODE_AUTO = 3;  // NODE_03 gets the threshold automation test

let passed = 0, failed = 0;
function check(name, cond, extra = "") {
  if (cond) { passed++; console.log(`  ✅ ${name}`); }
  else { failed++; console.log(`  ❌ ${name} ${extra}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(pathname, body) {
  const res = await fetch(BASE + pathname, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function get(pathname) {
  const res = await fetch(BASE + pathname);
  return { status: res.status, body: await res.json().catch(() => null) };
}
async function del(pathname) {
  return fetch(BASE + pathname, { method: "DELETE" });
}

(async () => {
  console.log(`\nPipeline Injection Tests — ${BASE}\n`);

  // ── 1. Normal reading → MySQL row with computed CLR ─────────────
  console.log("1) Reading ingestion + CLR computation");
  // 30°C / 60% / raw 2000 → soil 51% → score 8+8+10 = 26 → LOW
  let r = await post("/api/sensors/reading", {
    node_id: TEST_NODE_AUTO, temperature: 30, humidity: 60, soil_moisture: 2000,
  });
  check("POST /sensors/reading returns 200", r.status === 200, `got ${r.status}`);
  check("node id normalized to NODE_03", r.body?.node_id === "NODE_03");
  let [rows] = await db.query(
    "SELECT * FROM sensor_readings WHERE node_id='NODE_03' ORDER BY id DESC LIMIT 1"
  );
  check("row exists in MySQL", rows.length === 1);
  check("CLR computed as LOW", rows[0]?.clr_risk === "LOW", `got ${rows[0]?.clr_risk}`);

  // ── 2. HIGH-risk reading → alert row ────────────────────────────
  console.log("2) HIGH risk detection + auto alert");
  // 23°C / 92% / raw 800 → soil 80% → score 45+35+15 = 95 → HIGH
  r = await post("/api/sensors/reading", {
    node_id: TEST_NODE_HIGH, temperature: 23, humidity: 92, soil_moisture: 800,
  });
  check("HIGH reading accepted", r.status === 200);
  [rows] = await db.query(
    "SELECT * FROM sensor_readings WHERE node_id='NODE_04' ORDER BY id DESC LIMIT 1"
  );
  check("CLR computed as HIGH", rows[0]?.clr_risk === "HIGH", `got ${rows[0]?.clr_risk}`);
  await sleep(500); // alert insert is fire-and-forget
  const [alerts] = await db.query(
    "SELECT * FROM clr_alerts WHERE node_id='NODE_04' AND risk_level='HIGH' AND created_at >= NOW() - INTERVAL 1 MINUTE"
  );
  check("HIGH alert auto-created", alerts.length >= 1);

  // ── 3. Threshold automation + auto-off ──────────────────────────
  console.log("3) Threshold trigger + duration auto-off");
  await post(`/api/irrigation/threshold/${TEST_NODE_AUTO}`, {
    sensor: "soil_pct", condition: "below", value: 40, duration_seconds: 3,
  });
  // 30°C / 60% / raw 3600 → soil 12% → LOW risk, below threshold
  await post("/api/sensors/reading", {
    node_id: TEST_NODE_AUTO, temperature: 30, humidity: 60, soil_moisture: 3600,
  });
  let relay = await get(`/api/irrigation/relay/${TEST_NODE_AUTO}`);
  check("relay activated by threshold", relay.body?.state === true);
  await sleep(4500);
  relay = await get(`/api/irrigation/relay/${TEST_NODE_AUTO}`);
  check("relay auto-off after 3s duration", relay.body?.state === false);

  // ── 4. SAFETY: withheld while CLR HIGH ──────────────────────────
  console.log("4) Safety — no auto-irrigation on HIGH-risk zone");
  await post(`/api/irrigation/threshold/${TEST_NODE_HIGH}`, {
    sensor: "soil_pct", condition: "below", value: 90, duration_seconds: 3,
  });
  // NODE_04's last risk is HIGH (step 2). Soil 80% < 90 → would trigger,
  // but safety must withhold it.
  await post("/api/sensors/reading", {
    node_id: TEST_NODE_HIGH, temperature: 23, humidity: 92, soil_moisture: 800,
  });
  relay = await get(`/api/irrigation/relay/${TEST_NODE_HIGH}`);
  check("relay stays OFF (withheld — CLR HIGH)", relay.body?.state === false,
        `got state=${relay.body?.state}`);

  // ── Cleanup ─────────────────────────────────────────────────────
  console.log("Cleanup");
  await del(`/api/irrigation/threshold/${TEST_NODE_AUTO}`);
  await del(`/api/irrigation/threshold/${TEST_NODE_HIGH}`);
  await post("/api/irrigation/control", { node_id: TEST_NODE_AUTO, relay_on: false });
  await db.query(
    "DELETE FROM sensor_readings WHERE node_id IN ('NODE_03','NODE_04') AND recorded_at >= NOW() - INTERVAL 2 MINUTE"
  );
  await db.query(
    "UPDATE clr_alerts SET is_resolved=1, resolved_at=NOW() WHERE node_id='NODE_04' AND created_at >= NOW() - INTERVAL 2 MINUTE"
  );
  console.log("  injected rows removed, alerts resolved, rules cleared");

  console.log(`\nRESULT: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error("Test run crashed:", err.message);
  process.exit(1);
});
