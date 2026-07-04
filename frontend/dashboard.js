/**
 * FarmSense Brew — Built-in Dashboard (mirrors Grafana panels)
 * File: frontend/dashboard.js
 *
 * Renders role-specific dashboard views using data from /api/dashboard/*.
 * Each panel corresponds to a panel in the Grafana JSON definitions:
 *   - grafana_agronomist_view.json
 *   - grafana_farmowner_view.json
 *   - grafana_fieldstaff_view.json
 */

/* ─── AUTH GUARD ─── */
const user = (function guardSession() {
  const raw = localStorage.getItem("farmsense_user");
  const token = localStorage.getItem("farmsense_token");
  if (!raw || !token) { window.location.href = "/"; return null; }
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.clear(); window.location.href = "/?login=required"; return null;
    }
    return JSON.parse(raw);
  } catch { window.location.href = "/"; return null; }
})();
if (!user) throw new Error("No session");

const ROLE_LABELS = { agronomist: "🔬 Agronomist", farm_owner: "🏡 Farm Owner", field_staff: "👷 Field Staff" };
const REFRESH_MS = 15000;
let chartInstances = {};

/* ─── INIT ─── */
const GRAFANA_PREFIX = "/grafana";
const GRAFANA_DASHBOARD_MAP = {
  agronomist:  "/d/farmsense-agro-001/farmsense-brew-agronomist-dashboard",
  farm_owner:  "/d/farmsense-owner-001/farmsense-brew-farm-owner-dashboard",
  field_staff: "/d/farmsense-staff-001/farmsense-brew-field-staff-dashboard"
};

(function init() {
  document.getElementById("nav-role-badge").textContent = ROLE_LABELS[user.role] || user.role;
  document.getElementById("nav-role-badge").classList.add(user.role);
  document.getElementById("nav-user").textContent = user.full_name || user.username;

  // Show only the matching role view
  document.querySelectorAll(".role-view").forEach(v => {
    v.classList.toggle("active", v.dataset.role === user.role);
  });

  // Set Grafana link and check availability
  const grafanaBtn = document.getElementById("btn-grafana");
  const grafanaPath = GRAFANA_DASHBOARD_MAP[user.role];
  if (grafanaBtn && grafanaPath) {
    const grafanaUrl = GRAFANA_PREFIX + grafanaPath;
    grafanaBtn.href = grafanaUrl;
    // Probe: is Grafana actually running?
    fetch(grafanaUrl, { method: "HEAD", credentials: "include", redirect: "follow" })
      .then(r => {
        if (r.status === 502) grafanaBtn.classList.add("hidden");
      })
      .catch(() => grafanaBtn.classList.add("hidden"));
  }

  updateClock(); setInterval(updateClock, 1000);
  refreshAll(); setInterval(refreshAll, REFRESH_MS);
})();

function updateClock() {
  document.getElementById("nav-clock").textContent = new Date().toLocaleTimeString("en-PH", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
  });
}

/* ─── API ─── */
async function api(path) {
  const token = localStorage.getItem("farmsense_token");
  const res = await fetch(path, {
    credentials: "include",
    headers: token ? { Authorization: "Bearer " + token } : {}
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.clear(); window.location.href = "/?login=required"; throw new Error("Session expired");
  }
  if (!res.ok) throw new Error("API " + res.status);
  return res.json();
}

/* ─── REFRESH ─── */
async function refreshAll() {
  const loaders = {
    agronomist: loadAgronomist,
    farm_owner: loadFarmOwner,
    field_staff: loadFieldStaff
  };
  const fn = loaders[user.role];
  if (fn) {
    try { await fn(); } catch (e) { console.warn("[Dashboard]", e.message); }
  }
}

/* ═══════════════════════════════════════════════════════════════════
   AGRONOMIST DASHBOARD
   ═══════════════════════════════════════════════════════════════════ */
async function loadAgronomist() {
  const [kpi, nodes, trends, riskFactors, irrigCount, alerts, recs, scaleUp] = await Promise.all([
    api("/api/dashboard/kpi"),
    api("/api/dashboard/nodes"),
    api("/api/dashboard/trends"),
    api("/api/dashboard/risk-factors"),
    api("/api/dashboard/irrigation-count"),
    api("/api/alerts/history?limit=20"),
    api("/api/recommendations/latest"),
    api("/api/dashboard/scale-up")
  ]);

  // Gauge: CLR Risk Score
  const score = Math.round(kpi.clr_risk_score || 25);
  renderDoughnutGauge("agro-gauge-clr", score);
  const lbl = document.getElementById("agro-gauge-label");
  lbl.textContent = score + "%";
  lbl.style.color = score >= 70 ? "var(--red)" : score >= 50 ? "var(--amb)" : "var(--g4)";

  // Per-node CLR stat chips
  const riskWrap = document.getElementById("agro-node-risks");
  riskWrap.innerHTML = (nodes.data || []).map(n =>
    `<div class="stat-chip ${n.clr_risk || 'LOW'}"><div class="chip-node">${esc(n.node_id)}</div><div class="chip-val">${n.clr_risk || 'LOW'}</div></div>`
  ).join("");

  // KPIs
  setText("agro-kpi-temp", kpi.avg_temperature != null ? kpi.avg_temperature + "°C" : "--", ".kpi-value");
  setText("agro-kpi-hum", kpi.avg_humidity != null ? kpi.avg_humidity + "%" : "--", ".kpi-value");
  setText("agro-kpi-soil", kpi.avg_soil_pct != null ? kpi.avg_soil_pct + "%" : "--", ".kpi-value");
  setText("agro-kpi-irrig", irrigCount.count != null ? irrigCount.count + " / 5" : "--", ".kpi-value");

  // Node status table
  renderTable("agro-node-table", nodes.data || [], [
    { key: "node_id" },
    { key: "position", fmt: v => (v || "").replace(/_/g, " ") },
    { key: "temperature", fmt: v => v != null ? Number(v).toFixed(1) : "--" },
    { key: "humidity", fmt: v => v != null ? Number(v).toFixed(1) : "--" },
    { key: "soil_pct" },
    { key: "clr_risk", fmt: v => `<span class="risk-tag ${v || 'LOW'}">${v || 'LOW'}</span>` },
    { key: "confidence_pct", fmt: v => v != null ? Number(v).toFixed(1) + "%" : "--" },
    { key: "irrigation_status", fmt: v => {
      const icons = { ACTIVE: "💧", WITHHELD: "🚫", STANDBY: "⏸" };
      return `<span class="irrig-tag ${v}">${icons[v] || ""} ${v}</span>`;
    }},
    { key: "recorded_at", fmt: fmtTime }
  ]);

  // Charts
  renderEnvChart("agro-chart-env", trends.data || []);
  renderClrSoilChart("agro-chart-clr", trends.data || []);

  // Risk factor bars
  renderRiskBars("agro-risk-bars", riskFactors.data || []);

  // Alerts table
  document.getElementById("agro-alert-badge").textContent = (alerts.data || []).filter(a => !a.is_resolved).length;
  renderTable("agro-alert-table", alerts.data || [], [
    { key: "created_at", fmt: fmtTime },
    { key: "node_id" },
    { key: "position", fmt: v => (v || "").replace(/_/g, " ") },
    { key: "risk_level", fmt: v => `<span class="risk-tag ${v}">${v}</span>` },
    { key: "_conditions", fmt: (_, r) => `${r.temperature}°C / ${r.humidity}% RH / ${r.soil_pct}% SM` },
    { key: "alert_message", fmt: v => v || "" },
    { key: "is_resolved", fmt: v => v ? "✅ Resolved" : "⚠️ Active" }
  ]);

  // Scale-up
  renderScaleUp(scaleUp);
}

/* ═══════════════════════════════════════════════════════════════════
   FARM OWNER DASHBOARD
   ═══════════════════════════════════════════════════════════════════ */
async function loadFarmOwner() {
  const [biz, nodes, trends, recs, irrigCount] = await Promise.all([
    api("/api/dashboard/business"),
    api("/api/dashboard/node-comparison"),
    api("/api/dashboard/trends"),
    api("/api/recommendations/latest"),
    api("/api/dashboard/irrigation-count")
  ]);

  // Business KPIs
  document.getElementById("owner-revenue").textContent = biz.revenue || "--";
  document.getElementById("owner-yield").textContent = biz.yield || "--";
  document.getElementById("owner-irrig").textContent = (irrigCount.count || 0) + " / 5";
  document.getElementById("owner-plot").textContent = biz.plot_size || "--";
  document.getElementById("owner-water").textContent = biz.water_usage || "--";
  document.getElementById("owner-highrisk").textContent = biz.high_risk_zones != null ? biz.high_risk_zones : "--";
  document.getElementById("owner-uptime").textContent = biz.uptime || "--";

  // CLR mini gauge
  renderDoughnutGauge("owner-gauge-clr", Math.round(biz.clr_risk_score || 25), true);

  // Bar chart: CLR vs Soil per node
  renderBarChart("owner-chart-bar", nodes.data || []);

  // Environmental trends
  renderEnvChart("owner-chart-env", trends.data || []);

  // AI Recommendations table
  renderTable("owner-rec-table", recs.data || [], [
    { key: "generated_at", fmt: fmtTime },
    { key: "node_id" },
    { key: "risk_level", fmt: v => `<span class="risk-tag ${(v||'').toUpperCase()}">${v}</span>` },
    { key: "what_happened", fmt: v => v || "" },
    { key: "why_it_matters", fmt: v => v || "" },
    { key: "what_to_do", fmt: v => v || "" }
  ]);

  // Color high-risk count
  const hrEl = document.getElementById("owner-highrisk");
  hrEl.style.color = (biz.high_risk_zones || 0) > 0 ? "var(--red)" : "var(--g4)";
}

/* ═══════════════════════════════════════════════════════════════════
   FIELD STAFF DASHBOARD
   ═══════════════════════════════════════════════════════════════════ */
async function loadFieldStaff() {
  const { data, urgent_count } = await api("/api/dashboard/field-actions");

  // Urgent banner
  const urgentEl = document.getElementById("staff-urgent");
  if (urgent_count > 0) {
    const urgentNodes = data.filter(r => r.status === "CRITICAL" || r.status === "WATERING");
    const desc = urgentNodes.map(n => `${(n.position||"").replace(/_/g," ")} (${n.status})`).join(", ");
    urgentEl.innerHTML = `⚠️ ${urgent_count} zone(s) need attention — ${esc(desc)}`;
    urgentEl.className = "staff-urgent";
  } else {
    urgentEl.innerHTML = "✅ All zones are healthy — continue regular monitoring";
    urgentEl.className = "staff-urgent clear";
  }

  // Node status cards
  const grid = document.getElementById("staff-node-grid");
  grid.innerHTML = data.map(n => {
    const posLabel = (n.position || "").replace(/_/g, " ");
    const statusIcon = { CRITICAL: "🔴", WATCH: "🟡", GOOD: "🟢", WATERING: "🔵" };
    const statusText = {
      CRITICAL: "CRITICAL — Check for disease signs NOW",
      WATCH: "WATCH — Monitor this area closely",
      GOOD: "GOOD — Continue regular work",
      WATERING: "WATERING — Drip irrigation is ON. Check for leaks."
    };
    return `<div class="staff-card ${n.status}">
      <div class="card-node">🗺️ ${esc(n.node_id)} — ${esc(posLabel)}</div>
      ${statusIcon[n.status] || "⬜"} ${statusText[n.status] || n.status}
    </div>`;
  }).join("");

  // Action instructions table
  renderTable("staff-action-table", data, [
    { key: "position", fmt: v => (v || "").replace(/_/g, " ") },
    { key: "action_text" },
    { key: "soil_pct", fmt: v => {
      if (v < 30) return "💧 Very Dry";
      if (v < 35) return "💧 Needs Water";
      return "✓ Good";
    }},
    { key: "clr_risk", fmt: v => {
      if (v === "HIGH") return "🦠 HIGH";
      if (v === "MODERATE") return "⚠️ WATCH";
      return "✓ Safe";
    }},
    { key: "valve_status", fmt: v => {
      if (v === "ON") return "💧 ON";
      if (v === "STOPPED") return "🚫 STOP";
      return "⏸ OFF";
    }}
  ]);
}

/* ═══════════════════════════════════════════════════════════════════
   CHART RENDERERS (Chart.js)
   ═══════════════════════════════════════════════════════════════════ */

const CHART_DEFAULTS = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: "#a7c4b8", font: { size: 11, family: "Inter" } } },
    tooltip: { backgroundColor: "#1a2b22", borderColor: "rgba(74,222,128,.2)", borderWidth: 1 }
  },
  scales: {
    x: { ticks: { color: "#6b8f7e", font: { size: 10 } }, grid: { color: "rgba(255,255,255,.04)" } },
    y: { ticks: { color: "#6b8f7e", font: { size: 10 } }, grid: { color: "rgba(255,255,255,.06)" } }
  }
};

function destroyChart(id) { if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; } }

function renderEnvChart(canvasId, data) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !data.length) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => fmtTimeShort(d.time)),
      datasets: [
        { label: "Avg Temperature (°C)", data: data.map(d => d.avg_temperature), borderColor: "#fbbf24", backgroundColor: "rgba(251,191,36,.1)", fill: true, tension: .3, borderWidth: 2, pointRadius: 2 },
        { label: "Avg Humidity (%)", data: data.map(d => d.avg_humidity), borderColor: "#38bdf8", backgroundColor: "rgba(56,189,248,.1)", fill: true, tension: .3, borderWidth: 2, pointRadius: 2 }
      ]
    },
    options: { ...CHART_DEFAULTS }
  });
}

function renderClrSoilChart(canvasId, data) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !data.length) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.map(d => fmtTimeShort(d.time)),
      datasets: [
        { label: "CLR Risk Score (%)", data: data.map(d => d.avg_clr_score), borderColor: "#f87171", backgroundColor: "rgba(248,113,113,.15)", fill: true, tension: .3, borderWidth: 2, pointRadius: 2 },
        { label: "Avg Soil Moisture (%)", data: data.map(d => d.avg_soil_pct), borderColor: "#4ade80", backgroundColor: "rgba(74,222,128,.15)", fill: true, tension: .3, borderWidth: 2, pointRadius: 2 }
      ]
    },
    options: { ...CHART_DEFAULTS }
  });
}

function renderBarChart(canvasId, data) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx || !data.length) return;
  chartInstances[canvasId] = new Chart(ctx, {
    type: "bar",
    data: {
      labels: data.map(d => (d.position || d.node_id || "").replace(/_/g, " ")),
      datasets: [
        { label: "CLR Risk %", data: data.map(d => d.clr_risk_pct), backgroundColor: "rgba(248,113,113,.6)", borderColor: "#f87171", borderWidth: 1 },
        { label: "Soil Moisture %", data: data.map(d => d.soil_pct), backgroundColor: "rgba(74,222,128,.6)", borderColor: "#4ade80", borderWidth: 1 }
      ]
    },
    options: { ...CHART_DEFAULTS, plugins: { ...CHART_DEFAULTS.plugins, legend: { ...CHART_DEFAULTS.plugins.legend } } }
  });
}

function renderDoughnutGauge(canvasId, value, mini) {
  destroyChart(canvasId);
  const ctx = document.getElementById(canvasId);
  if (!ctx) return;
  const color = value >= 70 ? "#f87171" : value >= 50 ? "#fb923c" : value >= 35 ? "#fbbf24" : "#4ade80";
  chartInstances[canvasId] = new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [value, 100 - value],
        backgroundColor: [color, "rgba(255,255,255,.06)"],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: mini ? "70%" : "75%",
      rotation: -90, circumference: 180,
      plugins: { legend: { display: false }, tooltip: { enabled: false } }
    }
  });
}

/* ─── RISK BARS ─── */
function renderRiskBars(containerId, data) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = data.map(d => {
    const v = Math.round(d.value || 0);
    const cls = v >= 75 ? "red" : v >= 60 ? "orange" : v >= 40 ? "yellow" : "green";
    return `<div class="risk-bar-item">
      <div class="risk-bar-label">${esc(d.factor)}</div>
      <div class="risk-bar-track"><div class="risk-bar-fill ${cls}" style="width:${v}%">${v}%</div></div>
    </div>`;
  }).join("");
}

/* ─── SCALE-UP ─── */
function renderScaleUp(data) {
  const kpiWrap = document.getElementById("agro-scaleup-kpis");
  if (kpiWrap) {
    kpiWrap.innerHTML = [
      { icon: "📏", value: data.total_coverage, label: "Total Coverage" },
      { icon: "📡", value: data.total_nodes, label: "Total ESP32 Nodes" },
      { icon: "🟢", value: data.active_nodes, label: "Active Zones" },
      { icon: "♾️", value: data.capacity, label: "Scale Capacity" }
    ].map(k => `<div class="kpi"><div class="kpi-icon">${k.icon}</div><div class="kpi-body"><span class="kpi-value">${k.value}</span><span class="kpi-label">${k.label}</span></div></div>`).join("");
  }
  renderTable("agro-scaleup-table", data.nodes || [], [
    { key: "node_id" },
    { key: "position", fmt: v => (v||"").replace(/_/g," ") },
    { key: "description" },
    { key: "_area", fmt: () => "50 sqm" },
    { key: "status", fmt: v => v === "ACTIVE" ? "🟢 ACTIVE" : "🔴 OFFLINE" },
    { key: "installed_at", fmt: fmtTime },
    { key: "_gps", fmt: (_, r) => r.latitude ? `${r.latitude}, ${r.longitude}` : "Not set" }
  ]);
}

/* ─── TABLE RENDERER ─── */
function renderTable(tableId, rows, cols) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  if (!tbody) return;
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${cols.length}" style="text-align:center;color:var(--mute);padding:1.5rem">No data available</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(r =>
    "<tr>" + cols.map(c => {
      const raw = c.key.startsWith("_") ? null : r[c.key];
      const val = c.fmt ? c.fmt(raw, r) : (raw != null ? esc(String(raw)) : "--");
      return `<td>${val}</td>`;
    }).join("") + "</tr>"
  ).join("");
}

/* ─── LOGOUT ─── */
async function handleLogout() {
  try { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); } catch {}
  localStorage.clear();
  window.location.href = "/";
}

/* ─── UTILITIES ─── */
function setText(parentId, text, selector) {
  const parent = document.getElementById(parentId);
  if (!parent) return;
  const el = selector ? parent.querySelector(selector) : parent;
  if (el) el.textContent = text;
}

function esc(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

function fmtTime(v) {
  if (!v) return "--";
  return new Date(v).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtTimeShort(v) {
  if (!v) return "";
  return new Date(v).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", hour12: false });
}
