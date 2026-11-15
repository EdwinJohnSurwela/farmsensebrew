import { useEffect, useRef, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { api, toNum, riskColor } from '../../api';
import { fmt, SENSOR_PURPLE } from '../../nodes';
import { levelFromScore } from '../../risk';
import { useAuth } from '../../auth';
import { useLiveRows } from '../../live';
import DownloadDataMenu from '../../components/DownloadDataMenu';
import BrewLoader, { GROW_MS } from '../../components/BrewLoader';
import { IconAnalytics, IconWarning, IconTemperature, IconHumidity, IconSoil } from '../../icons';
import { C, axisProps, gridProps, tooltipProps } from '../../palette';

/** Export control in the Analytics banner for every role: one "Download file as"
 *  menu (PDF farm report, or the readings as Excel or CSV). */
function ExportButtons() {
  return <DownloadDataMenu kind="readings" />;
}

// Role-specific provisioned Grafana dashboards
const ROLE_DASHBOARDS = {
  agronomist: 'farmsense-agro-001',
  farm_owner: 'farmsense-owner-001',
  field_staff: 'farmsense-staff-001',
  admin: 'farmsense-scaleup-001',
};

/// Analytics — the role's Grafana dashboard IS the screen (full kiosk,
/// no Grafana chrome). The native React panels render automatically
/// when Grafana is unreachable.
export default function AnalyticsPage() {
  const { user } = useAuth();
  const [grafanaOk, setGrafanaOk] = useState(null); // null = checking

  const uid = ROLE_DASHBOARDS[user?.role] || ROLE_DASHBOARDS.agronomist;

  const checkGrafana = () => {
    setGrafanaOk(null);
    fetch('/grafana/api/health', { credentials: 'include' })
      .then((r) => setGrafanaOk(r.ok))
      .catch(() => setGrafanaOk(false));
  };
  useEffect(checkGrafana, []);

  if (grafanaOk === null) {
    return (
      <div>
        <Banner subtitle="Connecting to Grafana…" />
        <div className="empty-state">Loading analytics…</div>
      </div>
    );
  }

  if (grafanaOk) {
    // Full kiosk: hides Grafana nav, sidebar and logo — panels only.
    // theme=light forces light mode (the panel's requirement) regardless of
    // Grafana's default theme.
    // refresh=2s: panels re-query every 2 seconds on their own, like the Overview.
    // hideLogo=1 removes the "Powered by Grafana" footer that kiosk mode
    // otherwise pins over the panels (Grafana 13).
    const src = `/grafana/d/${uid}/?kiosk&hideLogo=1&theme=light&refresh=2s`;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)' }}>
        <Banner
          subtitle={`${(user?.role || '').replace('_', ' ')} dashboard • live via Grafana`}
          action={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <ExportButtons />
            </div>
          }
        />
        <GrafanaFrame src={src} />
      </div>
    );
  }

  return (
    <NativeAnalytics
      grafanaDown={!grafanaOk}
      onBackToGrafana={checkGrafana}
    />
  );
}

/// Grafana in kiosk mode, kept in kiosk mode. Grafana's own shortcuts leave
/// kiosk when you press Escape (or "d k"), which brings back its menus and
/// sidebar. Grafana is served from the same address (/grafana), so the page
/// can catch Escape inside the frame before Grafana sees it, and put the
/// frame back into kiosk mode if it ever leaves it another way.
function GrafanaFrame({ src }) {
  const ref = useRef(null);
  const [phase, setPhase] = useState('loading'); // loading -> growing -> done

  // Our coffee-bean loader covers the frame until Grafana has drawn its panels,
  // so Grafana's own bouncing logo is never seen. Grafana removes its
  // ".preloader" once its app has started ("preloader--done" means it failed,
  // and its error text is then shown). If no panel turns up within 2.5 s of
  // start-up, or nothing happens in 20 s, the frame is shown anyway.
  // Once ready, the middle bean grows into a coffee plant (GROW_MS) before the
  // dashboard fades in; with "reduce motion" on, it is shown straight away.
  useEffect(() => {
    const frame = ref.current;
    if (!frame) return undefined;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let phaseNow = 'loading';
    let growTimer = null;
    const setP = (p) => { phaseNow = p; setPhase(p); };
    const report = (isShown) => {
      if (!isShown) {
        if (growTimer) { clearTimeout(growTimer); growTimer = null; }
        if (phaseNow !== 'loading') setP('loading');
        return;
      }
      if (phaseNow !== 'loading') return;
      if (reduceMotion) { setP('done'); return; }
      setP('growing');
      growTimer = setTimeout(() => { growTimer = null; setP('done'); }, GROW_MS);
    };
    setP('loading');
    let loadStart = Date.now(); // restarts whenever the frame begins loading again
    let shown = false;
    let bootedAt = 0;
    const probe = setInterval(() => {
      let state = 'loading';
      try {
        const doc = frame.contentDocument;
        if (doc && doc.body && doc.location.href !== 'about:blank') {
          const pre = doc.querySelector('.preloader');
          if (pre && pre.classList.contains('preloader--done')) state = 'show';
          else if (!pre) {
            if (!bootedAt) bootedAt = Date.now();
            const panel = doc.querySelector('[data-viz-panel-key], .react-grid-item, [data-testid*="Panel header"], .panel-container');
            if (panel || Date.now() - bootedAt > 2500) state = 'show';
          } else {
            bootedAt = 0; // the frame reloaded (e.g. put back into kiosk mode)
          }
        }
      } catch {
        state = 'show'; // Grafana on another address: we can't look inside, just show it
      }
      if (state === 'loading' && shown) loadStart = Date.now(); // a new load just began
      if (state === 'loading' && Date.now() - loadStart > 20000) state = 'show';
      shown = state === 'show';
      report(shown);
    }, 200);
    // Cover the frame the moment Grafana's page starts to unload, so its logo
    // can't flash between our checks when the frame reloads.
    const hide = () => { shown = false; bootedAt = 0; loadStart = Date.now(); report(false); };
    const watchUnload = () => {
      try { frame.contentWindow.addEventListener('pagehide', hide); } catch { /* not reachable */ }
    };
    frame.addEventListener('load', watchUnload);
    watchUnload();
    return () => {
      clearInterval(probe);
      if (growTimer) clearTimeout(growTimer);
      frame.removeEventListener('load', watchUnload);
    };
  }, [src]);

  useEffect(() => {
    const frame = ref.current;
    if (!frame) return undefined;
    const blockEscape = (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.stopImmediatePropagation();
        e.preventDefault();
      }
    };
    const attach = () => {
      try {
        frame.contentWindow.addEventListener('keydown', blockEscape, true);
      } catch { /* not reachable: Grafana on another address */ }
    };
    frame.addEventListener('load', attach);
    attach();
    const watch = setInterval(() => {
      try {
        const loc = frame.contentWindow.location;
        if (loc.pathname.startsWith('/grafana/') && !new URLSearchParams(loc.search).has('kiosk')) {
          frame.src = src;
        }
      } catch { /* not reachable */ }
    }, 1000);
    return () => {
      frame.removeEventListener('load', attach);
      clearInterval(watch);
    };
  }, [src]);
  return (
    <div className="grafana-wrap">
      <iframe ref={ref} title="Grafana" src={src} className={phase === 'done' ? 'ready' : ''} />
      <BrewLoader phase={phase} />
    </div>
  );
}

function Banner({ subtitle, action }) {
  return (
    <header className="banner grad-analytics" style={{ paddingBottom: 14 }}>
      <div className="banner-row">
        <div>
          <h1><IconAnalytics /> Live Analytics</h1>
          <p className="sub">{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {action}
          <span className="badge-live"><span className="dot" /> LIVE</span>
        </div>
      </div>
    </header>
  );
}

// ─── NATIVE FALLBACK (the original React panels) ─────────────────

const RANGES = [
  { label: 'Now (live)', minutes: 2 },
  { label: 'Recent (15 min)', minutes: 15 },
  { label: 'Last hour', minutes: 60 },
  { label: 'Last 6 hours', minutes: 360 },
  { label: 'Last 24 hours', minutes: 1440 },
];

function NativeAnalytics({ grafanaDown, onBackToGrafana }) {
  const [kpi, setKpi] = useState({});
  const [latestRows, setLatest] = useState([]);
  const [latestAt, setLatestAt] = useState(0);
  const latest = useLiveRows(latestRows, latestAt).filter((s) => s.online); // the Pi decides
  const [trends, setTrends] = useState([]);
  const [risk, setRisk] = useState([]);
  const [zones, setZones] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [range, setRange] = useState(RANGES[4]);

  const load = async (r = range) => {
    try {
      const at = Date.now();
      const [k, l, t, rf, irr, al] = await Promise.all([
        api.kpi().catch(() => ({})),
        api.sensorLatest().catch(() => ({ data: [] })),
        api.trends(`minutes=${r.minutes}`).catch(() => ({ data: [] })),
        api.riskFactors().catch(() => ({ data: [] })),
        api.irrigationStatus().catch(() => ({ data: [] })),
        api.alerts().catch(() => ({ data: [] })),
      ]);
      setKpi(k || {});
      // Current readings = online nodes only; an old reading is not current
      setLatestAt(at);
      setLatest(l.data || []);
      setZones(irr.data || []);
      setAlerts((al.data || []).slice(0, 5));
      setTrends(
        (t.data || []).map((row) => ({
          time: new Date(row.time).toLocaleTimeString([], {
            hour: 'numeric', hour12: true, minute: '2-digit',
            ...(r.minutes <= 30 ? { second: '2-digit' } : {}),
          }),
          temperature: toNum(row.avg_temperature),
          humidity: toNum(row.avg_humidity),
          soil: toNum(row.avg_soil_pct),
        }))
      );
      setRisk((rf.data || []).map((f) => ({ name: (f.factor || '').replace(' Risk', ''), value: toNum(f.value) })));
    } catch {
      /* keep last */
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(), 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const clrScore = toNum(kpi.clr_risk_score);
  const clrLevel = levelFromScore(clrScore) || 'MINIMAL';

  return (
    <div>
      <Banner
        subtitle="Native charts • auto-refreshes every 10s"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <ExportButtons />
            <button className="btn ghost sm" onClick={onBackToGrafana}>
              Retry Grafana
            </button>
          </div>
        }
      />

      <div className="page">
        {grafanaDown && (
          <div className="callout amber">
            <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
              <IconWarning style={{ verticalAlign: '-3px' }} /> Grafana is unreachable, so the built-in charts are shown instead.
            </p>
          </div>
        )}

        <h3 style={{ marginBottom: 10 }}>Farm KPIs (1h)</h3>
        <div className="kpi-row">
          <Kpi label="Avg temp" value={`${toNum(kpi.avg_temperature).toFixed(1)}°C`} />
          <Kpi label="Avg humidity" value={`${toNum(kpi.avg_humidity).toFixed(0)}%`} />
          <Kpi label="Avg soil" value={`${toNum(kpi.avg_soil_pct).toFixed(0)}%`} />
          <Kpi label="CLR risk" value={`${clrScore.toFixed(0)} • ${clrLevel}`} color={riskColor(clrLevel)} />
          <Kpi label="Active nodes" value={`${toNum(kpi.active_nodes).toFixed(0)}`} />
          <Kpi label="Readings (1 h)" value={`${toNum(kpi.reading_count).toFixed(0)}`} />
          <Kpi
            label="Irrigation"
            value={`${zones.filter((z) => z.relay_on).length}/${zones.length} ON`}
            color={zones.some((z) => z.relay_on) ? C.low : undefined}
          />
        </div>

        <h3 style={{ margin: '6px 0 10px' }}>Current Readings</h3>
        {latest.length === 0 && (
          <p className="muted" style={{ marginBottom: 12 }}>No node is sending data right now.</p>
        )}
        <div className="kpi-row">
          {latest.map((n) => (
            <div className="kpi" key={n.node_id}>
              <div className="label" style={{ color: 'var(--agronomist)', fontWeight: 700 }}>{n.node_id}</div>
              <div className="num" style={{ fontSize: 13, marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}><IconTemperature style={{ color: C.temperature }} /> {fmt(n.temperature, 1)}{n.temperature != null ? '°C' : ''}</div>
              <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
                <IconHumidity style={{ color: C.humidity, verticalAlign: '-3px' }} /> {fmt(n.humidity, 1)}{n.humidity != null ? '%' : ''} &nbsp;<IconSoil style={{ color: C.soil, verticalAlign: '-3px' }} /> {fmt(n.soil_pct)}{n.soil_pct != null ? '%' : ''}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '6px 0 10px' }}>
          <h3 style={{ margin: 0 }}>Trends</h3>
          <select
            value={range.label}
            onChange={(e) => setRange(RANGES.find((r) => r.label === e.target.value))}
            style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)' }}
          >
            {RANGES.map((r) => (
              <option key={r.label}>{r.label}</option>
            ))}
          </select>
        </div>

        <Trend title="Temperature Trend" data={trends} dataKey="temperature" color={C.temperature} unit="°C" domain={[15, 45]} />
        <Trend title="Humidity Trend" data={trends} dataKey="humidity" color={C.humidity} unit="%" domain={[30, 100]} />
        <Trend title="Soil Moisture Trend" data={trends} dataKey="soil" color={C.soil} unit="%" domain={[0, 100]} />

        {risk.length > 0 && (
          <div className="card">
            <h3>CLR Risk Factors (share of each part's points, last hour)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={risk}>
                <CartesianGrid {...gridProps} strokeDasharray="3 3" vertical={false} />
                <XAxis {...axisProps} dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis {...axisProps} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}
                     shape={(props) => {
                       const { x, y, width, height, payload } = props;
                       const c = riskColor(levelFromScore(payload.value));
                       return <rect x={x} y={y} width={width} height={height} rx={4} fill={c} />;
                     }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent CLR alerts — mirrors the Grafana panel */}
        {alerts.length > 0 && (
          <div className="card table-wrap">
            <h3>Recent CLR Alerts</h3>
            <table className="data">
              <thead>
                <tr><th>NODE</th><th>RISK</th><th>MESSAGE</th><th>WHEN</th></tr>
              </thead>
              <tbody>
                {alerts.map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{a.node_id}</td>
                    <td><span className="pill" style={{ background: riskColor(a.risk_level) }}>{a.risk_level}</span></td>
                    <td style={{ maxWidth: 420, whiteSpace: 'normal' }}>{a.alert_message}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(a.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', hour12: true, minute: '2-digit' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="card table-wrap">
          <h3>Node Comparison</h3>
          <table className="data">
            <thead>
              <tr><th>NODE</th><th>TEMP (°C)</th><th>HUMIDITY (%)</th><th>SOIL (%)</th><th>CLR</th></tr>
            </thead>
            <tbody>
              {latest.map((n) => (
                <tr key={n.node_id}>
                  <td style={{ fontWeight: 600 }}>{(n.node_id || '').replace('NODE_', 'N')}</td>
                  <td>{fmt(n.temperature, 1)}</td>
                  <td>{fmt(n.humidity, 1)}</td>
                  <td>{fmt(n.soil_pct)}</td>
                  <td>{n.clr_risk
                    ? <span className="pill" style={{ background: riskColor(n.clr_risk) }}>{n.clr_risk}</span>
                    : <span style={{ color: SENSOR_PURPLE, fontWeight: 600 }} title="Temperature and humidity sensor not reading">Temperature and humidity sensor problem</span>}
                    {n.soil_pct == null && <div style={{ fontSize: 11, color: SENSOR_PURPLE }} title="Capacitive soil moisture sensor not reading">Soil sensor problem</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value" style={color ? { color } : undefined}>{value}</div>
    </div>
  );
}

function Trend({ title, data, dataKey, color, unit, domain }) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {data.length === 0 ? (
        <p className="muted">No sensor data in this time range yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid {...gridProps} strokeDasharray="3 3" vertical={false} />
            <XAxis {...axisProps} dataKey="time" tick={{ fontSize: 10 }} minTickGap={40} />
            <YAxis {...axisProps} domain={domain} tick={{ fontSize: 10 }} unit={unit} width={48} />
            <Tooltip {...tooltipProps} />
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
