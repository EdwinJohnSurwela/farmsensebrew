/**
 * FarmSense Brew — Report Export Routes
 * Mounted at /api/export. Auth: Bearer header, session cookie, or ?token=
 * (query token lets the mobile app open downloads in the phone's browser).
 *
 * GET /readings.csv  and  /readings.xlsx       — sensor readings (all roles)
 *     ?period=24h | 7d | day&date=YYYY-MM-DD | range&from=YYYY-MM-DD&to=YYYY-MM-DD | all
 *     &node_id=NODE_01 (optional). Dates are Philippine calendar days. Old links
 *     with ?hours=N still work.
 * GET /alerts.csv, /alerts.xlsx, /alerts.pdf  — CLR alert history (all roles), same
 *     ?period / &node_id as the readings (by when the alert opened; default all time)
 * GET /audit.csv                              — audit log (admin only)
 * GET /users.csv                              — user accounts (admin only)
 * GET /summary.pdf                            — farm status report (all roles), same
 *     ?period / &node_id (default last 24 hours)
 */
const clr = require("../services/clr-risk");
const express = require("express");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const db = require("../services/db.service");
const presence = require("../services/presence.service");
const audit = require("../services/audit.service");
const letterhead = require("../services/letterhead.service");
const xlsx = require("../services/xlsx.service");
const alerts = require("../services/alert.service");
const fs = require("fs");
const path = require("path");
const { COOKIE_NAME } = require("../middleware/grafana-auth.middleware");
const router = express.Router();

// ─── auth: Bearer / cookie / ?token= ───────────────────────────────
router.use((req, res, next) => {
  const authHeader = req.headers["authorization"];
  let token = authHeader && authHeader.split(" ")[1];
  if (!token && req.query.token) token = req.query.token;
  if (!token && req.cookies && req.cookies[COOKIE_NAME]) token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Access token required" });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token" });
    req.user = user;
    next();
  });
});

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

// ─── CSV helpers ────────────────────────────────────────────────────
// Dates go out as Philippine time, "2026-09-18 01:15:00" (sorts and opens cleanly in Excel).
function phStamp(d) {
  return d.toLocaleString("sv-SE", { timeZone: "Asia/Manila" });
}

function csvEscape(v) {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? phStamp(v) : String(v);
  // Spreadsheet formula injection: text such as a field note starting with
  // = + - @ (or a tab/CR) would run as a formula when the file is opened in
  // Excel. Numbers are left alone so -1.5 stays a number.
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\r\n") + "\r\n";
}

// CSV reports start with the farm letterhead block, then a blank line, then the table.
function sendCsv(req, res, filename, title, headers, rows, extra = []) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  const head = letterhead.csvPreamble(title, req.user,
    [...extra, `${rows.length} rows. Times are Philippine time.`]);
  // BOM so Excel opens UTF-8 correctly
  res.send("\ufeff" + head.join("\r\n") + "\r\n" + toCsv(headers, rows));
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
}

// ─── Reading exports: period + node filter ─────────────────────────
const DAY_MS = 86400000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Start of a Philippine calendar day ("2026-09-28") as a moment in time. */
const phDayStart = (d) => new Date(`${d}T00:00:00+08:00`);
const longDay = (d) => letterhead.phDate(new Date(`${d}T12:00:00+08:00`));

/**
 * Which rows a reading export covers. Returns { from, to, label, tag } where
 * from/to are Dates (to is exclusive; null means open-ended), or { error }.
 */
function readingPeriod(q) {
  const now = new Date();
  const period = q.period || (q.hours ? "hours" : "24h");
  if (period === "hours") {
    const h = Math.min(Math.max(parseInt(q.hours, 10) || 24, 1), 24 * 366);
    return { from: new Date(now - h * 3600000), to: null, label: `last ${h} hours`, tag: `last-${h}h` };
  }
  if (period === "24h") return { from: new Date(now - DAY_MS), to: null, label: "last 24 hours", tag: "last-24h" };
  if (period === "7d") return { from: new Date(now - 7 * DAY_MS), to: null, label: "last 7 days", tag: "last-7-days" };
  // Field data starts at the installation (27 Sept 2026, 1:32 PM); earlier test readings are archived.
  if (period === "all") return { from: null, to: null, label: "all field data (since September 27, 2026, 1:32 PM)", tag: "all-time" };
  if (period === "day") {
    if (!ISO_DAY.test(q.date || "")) return { error: "Pick a date" };
    const from = phDayStart(q.date);
    return { from, to: new Date(from.getTime() + DAY_MS), label: longDay(q.date), tag: q.date };
  }
  if (period === "range") {
    if (!ISO_DAY.test(q.from || "") || !ISO_DAY.test(q.to || "")) return { error: "Pick both dates" };
    if (q.from > q.to) return { error: "The start date is after the end date" };
    return {
      from: phDayStart(q.from), to: new Date(phDayStart(q.to).getTime() + DAY_MS),
      label: `${longDay(q.from)} to ${longDay(q.to)}`, tag: `${q.from}_to_${q.to}`,
    };
  }
  return { error: "Unknown period" };
}

// Big enough for months of 1-minute readings from 5 nodes; the file says so if it is cut.
const MAX_ROWS = { csv: 500000, xlsx: 250000 };
const POSITION = { NW_CORNER: "NW corner", NE_CORNER: "NE corner", CENTER: "Centre", SW_CORNER: "SW corner", SE_CORNER: "SE corner" };
const nodeLabel = (id) => `Node ${parseInt(String(id).replace(/\D/g, ""), 10) || id}`;

async function loadReadings(req, format) {
  const p = readingPeriod(req.query);
  if (p.error) return p;
  const nodeId = /^NODE_\d{2}$/.test(req.query.node_id || "") ? req.query.node_id : null;
  const where = [];
  const params = [];
  if (p.from) { where.push("sr.recorded_at >= ?"); params.push(p.from); }
  if (p.to) { where.push("sr.recorded_at < ?"); params.push(p.to); }
  if (nodeId) { where.push("sr.node_id = ?"); params.push(nodeId); }
  const limit = MAX_ROWS[format];
  const [rows] = await db.query(
    `SELECT sr.node_id, sn.position, sr.temperature, sr.humidity, sr.soil_pct, sr.soil_raw,
            sr.clr_risk, sr.confidence_pct, sr.recorded_at
     FROM sensor_readings sr LEFT JOIN sensor_nodes sn ON sn.node_id = sr.node_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY sr.recorded_at DESC LIMIT ${limit + 1}`,
    params
  );
  const cut = rows.length > limit;
  if (cut) rows.length = limit;
  const scope = nodeId ? nodeLabel(nodeId) : "All nodes";
  const notes = [
    `Period: ${p.label} (Philippine time)   ·   ${scope}`,
    `Generated ${letterhead.phDateTime(new Date())} by ${req.user.username} (${String(req.user.role || "").replace("_", " ")})`,
    `${rows.length.toLocaleString("en-US")} readings, newest first${cut ? `; only the newest ${limit.toLocaleString("en-US")} are included, pick a shorter period for the rest` : ""}`,
  ];
  const file = `farmsense-readings-${nodeId ? nodeId.toLowerCase() + "-" : ""}${p.tag}`;
  return { rows, p, notes, file, scope };
}

// ─── GET /readings.csv ──────────────────────────────────────────────
router.get("/readings.csv", async (req, res) => {
  try {
    const r = await loadReadings(req, "csv");
    if (r.error) return res.status(400).json({ error: r.error });
    audit.record("REPORT_EXPORT", req.user.username, "readings.csv", `${r.rows.length} rows, ${r.p.label}, ${r.scope}`);
    sendCsv(req, res, `${r.file}.csv`, `Sensor Readings, ${r.p.label}`,
      ["node_id", "temperature", "humidity", "soil_pct", "soil_raw", "clr_risk", "confidence_pct", "recorded_at"],
      r.rows, [r.scope]);
  } catch (err) {
    console.error("[Export] readings.csv failed:", err.message);
    res.status(500).json({ error: "Export failed" });
  }
});

// ─── GET /readings.xlsx ─────────────────────────────────────────────
// Built on the Pi (services/xlsx.service.js): no internet, no extra packages.
const ASSETS = path.join(__dirname, "..", "assets");
const readAsset = (f) => { try { return fs.readFileSync(path.join(ASSETS, f)); } catch { return null; } };

router.get("/readings.xlsx", async (req, res) => {
  try {
    const r = await loadReadings(req, "xlsx");
    if (r.error) return res.status(400).json({ error: r.error });
    const book = xlsx.buildReport({
      sheetName: "Sensor readings",
      title: "FarmSense Brew: Sensor Readings",
      lines: r.notes,
      columns: [
        { header: "Node", width: 13 },
        { header: "Position", width: 12 },
        { header: "Date and time (PH)", width: 23, type: "date" },
        { header: "Temperature (°C)", width: 13, type: "number", format: "0.0" },
        { header: "Humidity (%)", width: 12, type: "number", format: "0.0" },
        { header: "Soil moisture (%)", width: 12, type: "number" },
        { header: "Soil raw reading", width: 12, type: "number" },
        { header: "CLR risk", width: 11, type: "risk" },
        { header: "CLR score", width: 11, type: "number", format: "0.0" },
      ],
      rows: r.rows.map((x) => [
        nodeLabel(x.node_id), POSITION[x.position] || x.position || "", x.recorded_at,
        x.temperature, x.humidity, x.soil_pct, x.soil_raw, x.clr_risk, x.confidence_pct,
      ]),
      logoPng: readAsset("jpcf-letterhead-logo.png"),
      barPng: readAsset("jpcf-letterhead-bar.png"),
    });
    audit.record("REPORT_EXPORT", req.user.username, "readings.xlsx", `${r.rows.length} rows, ${r.p.label}, ${r.scope}`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${r.file}.xlsx"`);
    res.setHeader("Content-Length", book.length);
    res.end(book);
  } catch (err) {
    console.error("[Export] readings.xlsx failed:", err.message);
    if (!res.headersSent) res.status(500).json({ error: "Export failed" });
  }
});

// ─── Alert exports: CSV, Excel, PDF ─────────────────────────────────
// Same period and node choices as the readings, by when the alert opened.
// Without a period they cover all time, as the old alerts.csv link did.
const STATUS_TEXT = (a) => a.closed_reason === "merged" ? `Merged into alert ${a.merged_into}`
  : a.closed_reason === "cleared" ? "Cleared on its own"
  : a.is_resolved ? "Action recorded" : "Open";

async function loadAlerts(req) {
  await alerts.ensureSchema();
  const p = readingPeriod({ period: "all", ...req.query });
  if (p.error) return p;
  const nodeId = /^NODE_\d{2}$/.test(req.query.node_id || "") ? req.query.node_id : null;
  const where = [];
  const params = [];
  if (p.from) { where.push("ca.created_at >= ?"); params.push(p.from); }
  if (p.to) { where.push("ca.created_at < ?"); params.push(p.to); }
  if (nodeId) { where.push("ca.node_id = ?"); params.push(nodeId); }
  const [rows] = await db.query(
    `SELECT ca.id, ca.node_id, sn.position, ca.risk_level, ca.temperature, ca.humidity,
            ca.soil_pct, ca.peak_humidity, ca.alert_message, ca.is_resolved, ca.created_at, ca.last_seen_at,
            ca.resolved_at, ca.closed_reason, ca.merged_into, aa.action, aa.note AS action_note,
            aa.done_by AS action_by, aa.quiet_until
     FROM clr_alerts ca LEFT JOIN sensor_nodes sn ON ca.node_id = sn.node_id
     LEFT JOIN alert_actions aa ON aa.alert_id = ca.id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY ca.created_at DESC LIMIT 10000`, params);
  const scope = nodeId ? nodeLabel(nodeId) : "All nodes";
  const notes = [
    `Period: ${p.label} (by when the alert opened, Philippine time)   ·   ${scope}`,
    `Generated ${letterhead.phDateTime(new Date())} by ${req.user.username} (${String(req.user.role || "").replace("_", " ")})`,
    `${rows.length.toLocaleString("en-US")} alerts, newest first`,
  ];
  const file = `farmsense-alerts-${nodeId ? nodeId.toLowerCase() + "-" : ""}${p.tag}`;
  return { rows, p, notes, file, scope };
}

router.get("/alerts.csv", async (req, res) => {
  try {
    const r = await loadAlerts(req);
    if (r.error) return res.status(400).json({ error: r.error });
    audit.record("REPORT_EXPORT", req.user.username, "alerts.csv", `${r.rows.length} rows, ${r.p.label}, ${r.scope}`);
    sendCsv(req, res, `${r.file}.csv`, `CLR Alert History, ${r.p.label}`,
      ["id", "node_id", "position", "risk_level", "temperature", "humidity", "soil_pct", "peak_humidity",
       "alert_message", "is_resolved", "created_at", "last_seen_at", "resolved_at", "closed_reason", "merged_into",
       "action", "action_note", "action_by", "quiet_until"],
      r.rows, [r.scope, "closed_reason: action = someone recorded what was done; cleared = a MODERATE alert ended on its own; merged = an hourly repeat folded into the node's current alert."]);
  } catch (err) {
    console.error("[Export] alerts.csv failed:", err.message);
    res.status(500).json({ error: "Export failed" });
  }
});

router.get("/alerts.xlsx", async (req, res) => {
  try {
    const r = await loadAlerts(req);
    if (r.error) return res.status(400).json({ error: r.error });
    const book = xlsx.buildReport({
      sheetName: "CLR alerts",
      title: "FarmSense Brew: CLR Alert History",
      lines: r.notes,
      columns: [
        { header: "Opened (PH)", width: 20, type: "date" },
        { header: "Node", width: 10 },
        { header: "Position", width: 11 },
        { header: "Risk level", width: 11, type: "risk" },
        { header: "Status", width: 20 },
        { header: "Last at risk (PH)", width: 20, type: "date" },
        { header: "Closed (PH)", width: 20, type: "date" },
        { header: "Temp. at opening (°C)", width: 12, type: "number", format: "0.0" },
        { header: "Humidity at opening (%)", width: 12, type: "number", format: "0.0" },
        { header: "Soil at opening (%)", width: 11, type: "number" },
        { header: "Peak humidity (%)", width: 11, type: "number", format: "0.0" },
        { header: "Action recorded", width: 26 },
        { header: "Action note", width: 34 },
        { header: "Recorded by", width: 14 },
        { header: "Alert message", width: 60 },
      ],
      rows: r.rows.map((a) => [
        a.created_at, nodeLabel(a.node_id), POSITION[a.position] || a.position || "", a.risk_level, STATUS_TEXT(a),
        a.last_seen_at, a.resolved_at, a.temperature, a.humidity, a.soil_pct, a.peak_humidity,
        a.action ? ((alerts.ACTIONS[a.action] || {}).label || a.action) : "", a.action_note || "", a.action_by || "",
        a.alert_message || "",
      ]),
      logoPng: readAsset("jpcf-letterhead-logo.png"),
      barPng: readAsset("jpcf-letterhead-bar.png"),
    });
    audit.record("REPORT_EXPORT", req.user.username, "alerts.xlsx", `${r.rows.length} rows, ${r.p.label}, ${r.scope}`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${r.file}.xlsx"`);
    res.setHeader("Content-Length", book.length);
    res.end(book);
  } catch (err) {
    console.error("[Export] alerts.xlsx failed:", err.message);
    if (!res.headersSent) res.status(500).json({ error: "Export failed" });
  }
});

// The PDF is for reading and printing: merged repeats are left out, and a long
// period lists the newest PDF_ALERT_LIMIT (the Excel and CSV files have all).
const PDF_ALERT_LIMIT = 300;
const num = (v) => (v == null || !Number.isFinite(Number(v)) ? "—" : String(Number(v)));
router.get("/alerts.pdf", async (req, res) => {
  try {
    const r = await loadAlerts(req);
    if (r.error) return res.status(400).json({ error: r.error });
    const shown = r.rows.filter((a) => a.closed_reason !== "merged");
    const list = shown.slice(0, PDF_ALERT_LIMIT);
    audit.record("REPORT_EXPORT", req.user.username, "alerts.pdf", `${shown.length} alerts, ${r.p.label}, ${r.scope}`);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${r.file}.pdf"`);
    const C = letterhead.COLORS;
    const doc = letterhead.createLetterheadPdf(PDFDocument);
    doc.pipe(res);
    const L = letterhead.CONTENT.left;
    const W = letterhead.PAGE.width - letterhead.CONTENT.left - letterhead.CONTENT.right;
    const bottom = letterhead.PAGE.height - letterhead.CONTENT.bottom;

    doc.fillColor(C.accent).font("Helvetica-Bold").fontSize(10.5).text(letterhead.phDate(), L, doc.y);
    doc.moveDown(1.1);
    doc.fillColor(C.title).font("Helvetica-Bold").fontSize(16).text("FarmSense Brew: CLR Alert History");
    doc.moveDown(0.25);
    doc.fillColor(C.muted).font("Helvetica").fontSize(9.5)
       .text(`${r.p.label[0].toUpperCase()}${r.p.label.slice(1)}  ·  ${r.scope}  ·  Generated ${letterhead.phDateTime(new Date())} by ${req.user.username}`);
    doc.moveDown(0.6);
    const open = shown.filter((a) => !a.is_resolved).length;
    const count = (lv) => shown.filter((a) => a.risk_level === lv).length;
    doc.fillColor(C.body).fontSize(10)
       .text(`${shown.length} alerts: ${open} open, ${shown.length - open} closed.   Critical ${count("CRITICAL")}  ·  High ${count("HIGH")}  ·  Moderate ${count("MODERATE")}`);
    if (shown.length > list.length) {
      doc.fillColor(C.muted).fontSize(8.5).text(`Only the newest ${PDF_ALERT_LIMIT} are listed; the Excel or CSV file has all of them.`);
    }
    doc.moveDown(0.8);
    doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.8).strokeColor(C.rule).stroke();
    doc.moveDown(0.6);

    if (list.length === 0) doc.fillColor(C.muted).fontSize(10).text("No CLR alerts in this period.", L, doc.y);
    for (const a of list) {
      if (doc.y > bottom - 70) doc.addPage();
      doc.fillColor(clr.colorOf(a.risk_level)).font("Helvetica-Bold").fontSize(10)
         .text(`${a.risk_level}  ${nodeLabel(a.node_id)}`, L, doc.y, { continued: true })
         .fillColor(C.muted).font("Helvetica").fontSize(9)
         .text(`   opened ${letterhead.phDateTime(a.created_at)}  ·  ${STATUS_TEXT(a)}`);
      const facts = [
        a.last_seen_at ? `last at risk ${letterhead.phDateTime(a.last_seen_at)}` : null,
        a.peak_humidity != null ? `peak humidity ${num(a.peak_humidity)}%` : null,
        `at opening ${num(a.temperature)} °C, ${num(a.humidity)}% humidity, soil ${num(a.soil_pct)}%`,
      ].filter(Boolean).join("  ·  ");
      doc.fillColor(C.muted).font("Helvetica").fontSize(8.5).text(facts, L, doc.y, { width: W });
      if (a.action) {
        const label = (alerts.ACTIONS[a.action] || {}).label || a.action;
        doc.fillColor(C.title).font("Helvetica-Bold").fontSize(9)
           .text(`Action: ${label}${a.action_by ? `  (${a.action_by})` : ""}`, L, doc.y, { width: W });
        if (a.action_note) doc.fillColor(C.body).font("Helvetica").fontSize(9).text(String(a.action_note).slice(0, 300), L, doc.y, { width: W });
      }
      doc.moveDown(0.3);
      doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.4).strokeColor(C.rule).stroke();
      doc.moveDown(0.45);
    }
    letterhead.addPageNumbers(doc);
    doc.end();
  } catch (err) {
    console.error("[Export] alerts.pdf failed:", err.message);
    if (!res.headersSent) res.status(500).json({ error: "Export failed" });
  }
});

// ─── GET /audit.csv (admin) ─────────────────────────────────────────
router.get("/audit.csv", requireAdmin, async (req, res) => {
  try {
    const rows = await audit.list(parseInt(req.query.limit) || 5000);
    audit.record("REPORT_EXPORT", req.user.username, "audit.csv", `${rows.length} rows`);
    sendCsv(req, res, `farmsense-audit-log-${stamp()}.csv`, "Audit Log",
      ["id", "action", "actor", "target", "details", "created_at"],
      rows);
  } catch (err) {
    console.error("[Export] audit.csv failed:", err.message);
    res.status(500).json({ error: "Export failed" });
  }
});

// ─── GET /users.csv (admin) ─────────────────────────────────────────
router.get("/users.csv", requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, username, full_name, email, role, is_active, last_login, created_at
       FROM users ORDER BY FIELD(role,'admin','agronomist','farm_owner','field_staff'), full_name`
    );
    audit.record("REPORT_EXPORT", req.user.username, "users.csv", `${rows.length} rows`);
    sendCsv(req, res, `farmsense-users-${stamp()}.csv`, "User Accounts",
      ["id", "username", "full_name", "email", "role", "is_active", "last_login", "created_at"],
      rows);
  } catch (err) {
    console.error("[Export] users.csv failed:", err.message);
    res.status(500).json({ error: "Export failed" });
  }
});

// ─── GET /summary.pdf ───────────────────────────────────────────────
router.get("/summary.pdf", async (req, res) => {
  try {
    // Same period and node choices as the readings (default: last 24 hours).
    const p = readingPeriod(req.query);
    if (p.error) return res.status(400).json({ error: p.error });
    const nodeId = /^NODE_\d{2}$/.test(req.query.node_id || "") ? req.query.node_id : null;
    const scope = nodeId ? nodeLabel(nodeId) : "All nodes";
    const span = (col) => {
      const w = [], v = [];
      if (p.from) { w.push(`${col} >= ?`); v.push(p.from); }
      if (p.to) { w.push(`${col} < ?`); v.push(p.to); }
      return { w, v };
    };
    const rd = span("sr.recorded_at");
    if (nodeId) { rd.w.push("sr.node_id = ?"); rd.v.push(nodeId); }
    const rdWhere = rd.w.length ? "WHERE " + rd.w.join(" AND ") : "";
    const [kpi] = await db.query(
      `SELECT ROUND(AVG(temperature),1) AS avg_temperature,
              ROUND(AVG(humidity),0)    AS avg_humidity,
              ROUND(AVG(soil_pct),0)    AS avg_soil_pct,
              COUNT(*)                  AS reading_count,
              COUNT(DISTINCT node_id)   AS active_nodes
       FROM sensor_readings sr ${rdWhere}`, rd.v
    );
    const [[{ registered }]] = await db.query("SELECT COUNT(*) AS registered FROM sensor_nodes WHERE is_active = 1");
    // Per node over the period. Live boxes save one reading a minute, so
    // minutes at High or Critical = rows at those levels.
    const [perNode] = await db.query(
      `SELECT sr.node_id, COUNT(*) AS readings,
              ROUND(AVG(sr.temperature),1) AS t_avg, MIN(sr.temperature) AS t_min, MAX(sr.temperature) AS t_max,
              ROUND(AVG(sr.humidity),0) AS h_avg, MAX(sr.humidity) AS h_max,
              ROUND(AVG(sr.soil_pct),0) AS s_avg, MIN(sr.soil_pct) AS s_min,
              SUM(sr.clr_risk IN ('HIGH','CRITICAL')) AS high_rows
       FROM sensor_readings sr ${rdWhere} GROUP BY sr.node_id ORDER BY sr.node_id`, rd.v
    );
    const [nodes] = await db.query(
      `SELECT sr.node_id, sn.position, sr.temperature, sr.humidity, sr.soil_pct,
              sr.clr_risk, sr.recorded_at
       FROM sensor_readings sr
       INNER JOIN (SELECT node_id, MAX(recorded_at) AS latest FROM sensor_readings GROUP BY node_id) l
         ON sr.node_id = l.node_id AND sr.recorded_at = l.latest
       LEFT JOIN sensor_nodes sn ON sn.node_id = sr.node_id
       ${nodeId ? "WHERE sr.node_id = ?" : ""}
       ORDER BY sr.node_id`, nodeId ? [nodeId] : []
    );
    // Online = the Pi hears from the node right now (presence.service); a box can
    // be online while one of its sensors is not reading.
    const snap = new Map(presence.snapshot().map((x) => [x.node_id, x]));
    for (const n of nodes) {
      const x = snap.get(n.node_id);
      n.online = !!(x && x.online);
      n.problem = !n.online ? null
        : !x.air_ok && !x.soil_ok ? "Both sensors" : !x.air_ok ? "DHT22 problem" : !x.soil_ok ? "Soil sensor" : null;
      if (n.online) {
        const v = x.values || {};
        n.temperature = v.temperature ?? null; n.humidity = v.humidity ?? null;
        n.soil_pct = v.soil_pct ?? null; n.clr_risk = v.clr_risk ?? null;
      }
    }
    const al = span("created_at");
    if (nodeId) { al.w.push("node_id = ?"); al.v.push(nodeId); }
    const [recentAlerts] = await db.query(
      `SELECT node_id, risk_level, alert_message, is_resolved, closed_reason, created_at
       FROM clr_alerts WHERE (closed_reason IS NULL OR closed_reason <> 'merged')
       ${al.w.length ? "AND " + al.w.join(" AND ") : ""}
       ORDER BY created_at DESC LIMIT 15`, al.v
    );
    await alerts.ensureSchema();
    const [actionRows] = await db.query(
      `SELECT * FROM alert_actions ${al.w.length ? "WHERE " + al.w.join(" AND ") : ""} ORDER BY id DESC LIMIT 10`, al.v);
    const actions = actionRows.map((a) => ({ ...a, label: (alerts.ACTIONS[a.action] || {}).label || a.action }));

    audit.record("REPORT_EXPORT", req.user.username, "summary.pdf", `farm status report, ${p.label}, ${scope}`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="farmsense-report-${nodeId ? nodeId.toLowerCase() + "-" : ""}${p.tag}.pdf"`);

    const C = letterhead.COLORS;
    const doc = letterhead.createLetterheadPdf(PDFDocument);
    doc.pipe(res);
    const L = letterhead.CONTENT.left;
    const W = letterhead.PAGE.width - letterhead.CONTENT.left - letterhead.CONTENT.right;
    const role = String(req.user.role || "").replace("_", " ");

    // Date, title, prepared-for block (like the letterhead's recipient block)
    doc.fillColor(C.accent).font("Helvetica-Bold").fontSize(10.5).text(letterhead.phDate(), L, doc.y);
    doc.moveDown(1.1);
    doc.fillColor(C.title).font("Helvetica-Bold").fontSize(16).text("FarmSense Brew: Farm Status Report");
    doc.moveDown(0.25);
    doc.fillColor(C.muted).font("Helvetica").fontSize(9.5)
       .text(`Liberica coffee plot, 50 sq m  ·  ${p.label[0].toUpperCase()}${p.label.slice(1)}  ·  ${scope}`);
    doc.text(`Generated ${letterhead.phDateTime(new Date())} (Philippine time) by ${req.user.username} (${role})`);
    doc.moveDown(1.2);

    const heading = (t) => {
      if (doc.y > letterhead.PAGE.height - letterhead.CONTENT.bottom - 90) doc.addPage();
      doc.fillColor(C.title).font("Helvetica-Bold").fontSize(12).text(t, L, doc.y);
      doc.moveDown(0.15);
      doc.moveTo(L, doc.y).lineTo(L + W, doc.y).lineWidth(0.8).strokeColor(C.rule).stroke();
      doc.moveDown(0.5);
    };

    // KPI cards (last 24 h)
    const k = kpi[0] || {};
    heading(`Farm conditions, ${p.label}`);
    const cards = [
      ["Avg temperature", k.avg_temperature != null ? `${k.avg_temperature} °C` : "No readings"],
      ["Avg humidity", k.avg_humidity != null ? `${k.avg_humidity} %` : "No readings"],
      ["Avg soil moisture", k.avg_soil_pct != null ? `${k.avg_soil_pct} %` : "No readings"],
      ["Readings saved", String(k.reading_count ?? 0)],
      ["Nodes reporting", `${k.active_nodes ?? 0} of ${nodeId ? 1 : registered}`],
    ];
    const cw = (W - 4 * 8) / 5;
    const cy = doc.y;
    cards.forEach(([label, value], i) => {
      const x = L + i * (cw + 8);
      doc.roundedRect(x, cy, cw, 50, 6).fillAndStroke("#FFFFFF", C.rule);
      doc.fillColor(C.muted).font("Helvetica").fontSize(8).text(label, x + 9, cy + 9, { width: cw - 18, lineBreak: false });
      doc.fillColor(C.title).font("Helvetica-Bold").fontSize(13).text(value, x + 9, cy + 25, { width: cw - 18, lineBreak: false });
    });
    doc.x = L;
    doc.y = cy + 50 + 20;

    // Each node over the period
    heading(`Each node, ${p.label}`);
    {
      const pc = [["Node", 56], ["Readings", 58], ["Temp °C avg (min to max)", 132], ["Humidity % avg (max)", 104], ["Soil % avg (min)", 86], ["High/Critical", W - 436]];
      const rowH2 = 20;
      let y2 = doc.y;
      doc.rect(L, y2, W, rowH2).fill("#E8EFE3");
      let x2 = L;
      doc.fillColor(C.title).font("Helvetica-Bold").fontSize(8.5);
      for (const [h, w] of pc) { doc.text(h, x2 + 6, y2 + 6, { width: w - 8, lineBreak: false }); x2 += w; }
      y2 += rowH2;
      doc.font("Helvetica").fontSize(8.5);
      const dash = (v) => (v == null ? "—" : String(Number(v)));
      for (const n of perNode) {
        const hrs = Number(n.high_rows || 0) / 60;
        const cells = [
          nodeLabel(n.node_id),
          Number(n.readings).toLocaleString("en-US"),
          n.t_avg == null ? "—" : `${dash(n.t_avg)} (${dash(n.t_min)} to ${dash(n.t_max)})`,
          n.h_avg == null ? "—" : `${dash(n.h_avg)} (${dash(n.h_max)})`,
          n.s_avg == null ? "—" : `${dash(n.s_avg)} (${dash(n.s_min)})`,
          `${hrs < 10 ? hrs.toFixed(1) : Math.round(hrs)} h`,
        ];
        x2 = L;
        cells.forEach((v, i) => {
          doc.fillColor(i === 5 && hrs > 0 ? clr.colorOf("HIGH") : C.body).text(v, x2 + 6, y2 + 6, { width: pc[i][1] - 8, lineBreak: false });
          x2 += pc[i][1];
        });
        y2 += rowH2;
        doc.moveTo(L, y2).lineTo(L + W, y2).lineWidth(0.5).strokeColor(C.rule).stroke();
      }
      if (perNode.length === 0) { doc.fillColor(C.muted).text("No readings in this period.", L + 6, y2 + 6); y2 += rowH2; }
      doc.x = L;
      doc.y = y2 + 8;
      doc.fillColor(C.muted).font("Helvetica").fontSize(8)
         .text("High or Critical = time the node's CLR risk was High or Critical (one saved reading a minute). The sensor readings themselves are in the Excel or CSV download.", L, doc.y, { width: W });
      doc.moveDown(1.4);
    }

    // Node table
    heading("Current node status");
    const cols = [
      ["Node", 54], ["Position", 64], ["Status", 80], ["Temp °C", 58], ["Humidity %", 66], ["Soil %", 52], ["CLR risk", 62], ["Last reading", W - 436],
    ];
    const rowH = 20;
    let y = doc.y;
    doc.rect(L, y, W, rowH).fill("#E8EFE3");
    let x = L;
    doc.fillColor(C.title).font("Helvetica-Bold").fontSize(8.5);
    for (const [h, w] of cols) { doc.text(h, x + 6, y + 6, { width: w - 8, lineBreak: false }); x += w; }
    y += rowH;
    const POS = { NW_CORNER: "NW corner", NE_CORNER: "NE corner", CENTER: "Centre", SW_CORNER: "SW corner", SE_CORNER: "SE corner" };
    doc.font("Helvetica").fontSize(8.5);
    for (const n of nodes) {
      const on = !!n.online;
      const riskColor = !on ? "#9CA3AF" : clr.colorOf(n.clr_risk);
      const cells = [
        String(n.node_id ?? "").replace("NODE_0", "Node ").replace("NODE_", "Node "),
        POS[n.position] || String(n.position ?? ""),
        !on ? "Offline" : n.problem || "Online",
        on ? (n.temperature == null ? "—" : String(Number(Number(n.temperature).toFixed(1)))) : "—",
        on ? (n.humidity == null ? "—" : String(Math.round(Number(n.humidity)))) : "—",
        on ? (n.soil_pct == null ? "—" : String(Number(n.soil_pct))) : "—",
        on ? String(n.clr_risk ?? "—") : "—",
        letterhead.phShort(n.recorded_at),
      ];
      x = L;
      cells.forEach((v, i) => {
        const col = i === 2 ? (!on ? "#9CA3AF" : n.problem ? "#5B2A86" : "#16A34A") : i === 6 ? riskColor : C.body;
        doc.fillColor(col).font(i === 6 && on ? "Helvetica-Bold" : "Helvetica")
           .text(v, x + 6, y + 6, { width: cols[i][1] - 8, lineBreak: false });
        x += cols[i][1];
      });
      y += rowH;
      doc.moveTo(L, y).lineTo(L + W, y).lineWidth(0.5).strokeColor(C.rule).stroke();
    }
    if (nodes.length === 0) {
      doc.fillColor(C.muted).text("No node has sent a reading yet.", L + 6, y + 6);
      y += rowH;
    }
    doc.x = L;
    doc.y = y + 8;
    doc.fillColor(C.muted).font("Helvetica").fontSize(8)
       .text("Online means the Pi is hearing from the sensor box right now. Offline nodes, and a sensor that is not reading, show no values.", L, doc.y, { width: W });
    doc.moveDown(1.4);

    // Recent alerts
    heading(`CLR alerts, ${p.label}`);
    doc.fontSize(9).font("Helvetica");
    if (recentAlerts.length === 0) {
      doc.fillColor(C.muted).text("No CLR alerts in this period.", L, doc.y);
    }
    for (const a of recentAlerts) {
      if (doc.y > letterhead.PAGE.height - letterhead.CONTENT.bottom - 40) doc.addPage();
      const c = clr.colorOf(a.risk_level);
      doc.fillColor(c).font("Helvetica-Bold")
         .text(`${a.risk_level}  ${String(a.node_id ?? "").replace("NODE_0", "Node ")}`, L, doc.y, { continued: true })
         .fillColor(C.muted).font("Helvetica")
         .text(`   ${letterhead.phDateTime(a.created_at)}${a.closed_reason === "cleared" ? "  (cleared on its own)" : a.is_resolved ? "  (action recorded)" : "  (open)"}`);
      doc.fillColor(C.body).text(String(a.alert_message ?? "").slice(0, 200), L, doc.y, { width: W });
      doc.moveDown(0.45);
    }

    // What people did about the alerts
    doc.moveDown(0.6);
    heading(`Field actions, ${p.label}`);
    doc.fontSize(9).font("Helvetica");
    if (actions.length === 0) doc.fillColor(C.muted).text("No actions recorded in this period.", L, doc.y);
    for (const a of actions) {
      if (doc.y > letterhead.PAGE.height - letterhead.CONTENT.bottom - 40) doc.addPage();
      doc.fillColor(C.title).font("Helvetica-Bold")
         .text(`${String(a.node_id ?? "").replace("NODE_0", "Node ")}: ${a.label}`, L, doc.y, { continued: true })
         .fillColor(C.muted).font("Helvetica")
         .text(`   ${letterhead.phDateTime(a.created_at)}, by ${a.done_by}`);
      doc.fillColor(C.body).text(String(a.note ?? "").slice(0, 220), L, doc.y, { width: W });
      doc.moveDown(0.45);
    }

    // Sign-off, as in the letterhead
    if (doc.y > letterhead.PAGE.height - letterhead.CONTENT.bottom - 70) doc.addPage();
    doc.moveDown(1.2);
    doc.fillColor(C.title).font("Helvetica-Bold").fontSize(10.5).text("Farm Administration", L, doc.y);
    doc.fillColor(C.subtitle).font("Helvetica").fontSize(9.5).text(letterhead.FARM.fullName);
    doc.moveDown(0.3);
    doc.fillColor(C.muted).fontSize(7.5)
       .text("Prepared by FarmSense Brew: IoT microclimate monitoring and CLR prevention. IT 411 Capstone Project 2, Group 3.");

    letterhead.addPageNumbers(doc);
    doc.end();
  } catch (err) {
    console.error("[Export] summary.pdf failed:", err.message);
    if (!res.headersSent) res.status(500).json({ error: "Export failed" });
  }
});

module.exports = router;
