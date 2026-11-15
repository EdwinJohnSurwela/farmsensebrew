import OverviewNodeSelector from '../../components/OverviewNodeSelector';
import PlotMap from '../../components/PlotMap';
import { formatTimestamp } from '../../time';
import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { api, toNum, riskColor, downloadReport } from '../../api';
import { RISK_LEVELS, RISK_STATUS, levelFromScore, levelLabel } from '../../risk';
import LiveAlertPanel, { useRecoLang } from '../../components/LiveAlertPanel';
import ScaleUpModal from '../../components/ScaleUpModal';
import KpiCard, { tempStatus, humidityStatus, soilStatus } from '../../components/KpiCard';
import { loadNodes, useLiveNodes, onlineAvg, lastSeenLabel, offlineWord, sensorNote, sensorProblem, fmt, SENSOR_PURPLE, nodeColor, LIVE_POLL_MS, OFFLINE_GREY } from '../../nodes';
import { useLiveRefresh } from '../../live';
import Fresh from '../../components/Fresh';
import { IconTemperature, IconHumidity, IconSoil, IconBoxes, IconShield, IconDownload, IconAdd } from '../../icons';
import { C, axisProps, gridProps, tooltipProps } from '../../palette';

const RECOMMENDATION_POLL_MS = 60000;


/// Farm Owner dashboard: KPIs from the online nodes' latest readings,
/// recommendations, node risk distribution and 7-day trends. Refreshes itself.
export default function OwnerDashboard() {
  const [nodeList, setNodes] = useState([]);
  const [overviewNode, setOverviewNode] = useState('all');
  const nodes = useLiveNodes(nodeList); // values change every 2 s without re-fetching
  const [alerts, setAlerts] = useState([]);
  const [alertSource, setAlertSource] = useState('');
  const [trends, setTrends] = useState([]);
  const [live, setLive] = useState(false);
  const [showScaleUp, setShowScaleUp] = useState(false);
  const [lang, setLang] = useRecoLang('farm_owner', 'en');
  const irrigation = useIrrigation();

  const load = async () => {
    try {
      const [list, trendRes] = await Promise.all([loadNodes(), api.trends('hours=168')]);
      setNodes(list);
      setTrends(
        (trendRes.data || []).map((t) => ({
          time: new Date(t.time).toLocaleDateString([], { month: 'short', day: 'numeric' }),
          temperature: toNum(t.avg_temperature),
          humidity: toNum(t.avg_humidity),
          clr: toNum(t.avg_clr_score),
        }))
      );
      setLive(true);
    } catch {
      setLive(false);
    }
  };
  const loadRecommendations = async () => {
    try {
      const rec = await api.liveRecommendations(lang);
      setAlerts(rec.data || []);
      setAlertSource(rec.source || '');
    } catch {
      /* optional */
    }
  };

  // Re-fetch when a reading is saved or a node goes online/offline (see
  // live.js), on tab return, and on a safety timer. Recommendations reload when the language changes.
  useLiveRefresh(load);
  useLiveRefresh(loadRecommendations, { fallbackMs: RECOMMENDATION_POLL_MS });
  useEffect(() => { loadRecommendations(); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const summaryNodes = overviewNode === 'all' ? nodes : nodes.filter(n => n.nodeId === overviewNode);
  const summaryLabel = overviewNode === 'all' ? 'Online nodes, latest readings' : summaryNodes[0]?.name || 'Selected node';
  const online = nodes.filter((n) => n.online);
  const withRisk = nodes.filter((n) => n.hasRisk);
  const score = onlineAvg(summaryNodes, 'score');
  const level = levelFromScore(score);
  const clrStatus = level == null
    ? ['Waiting for readings', 'muted']
    : {
      CRITICAL: ['Critical: act now', 'red'], HIGH: ['High (Severe): act today', 'red'],
      MODERATE: ['Moderate (At Risk): monitor', 'orange'], LOW: ['Low (Watch): normal care', 'green'],
      MINIMAL: ['Minimal (Healthy)', 'green'],
    }[level];
  const waiting = ['Waiting for readings', 'muted'];
  const avgT = onlineAvg(summaryNodes, 'temperature');
  const avgH = onlineAvg(summaryNodes, 'humidity');
  const avgS = onlineAvg(summaryNodes, 'soil');
  const [tLabel, tTone] = avgT == null ? waiting : tempStatus(avgT);
  const [hLabel, hTone] = avgH == null ? waiting : humidityStatus(avgH);
  const [sLabel, sTone] = avgS == null ? waiting : soilStatus(avgS);

  return (
    <div>
      <header className="banner grad-owner">
        <div className="banner-row">
          <div>
            <span className="badge-live">
              <span className={`dot ${live ? '' : 'off'}`} /> {live ? 'Live' : 'Not connected'}
            </span>
            <h1 style={{ marginTop: 8 }}>Overview</h1>
            <p className="sub">Business Intelligence &amp; Recommendations</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn ghost sm"
              title="Download the farm status report as PDF"
              onClick={() => downloadReport('/api/export/summary.pdf')}
            >
              <IconDownload /> PDF report
            </button>
            <button className="btn ghost sm" onClick={() => setShowScaleUp(true)}>
              <IconAdd weight="bold" /> Expand coverage
            </button>
          </div>
        </div>
      </header>

      {showScaleUp && (
        <ScaleUpModal onClose={() => setShowScaleUp(false)} onAdded={load} />
      )}

      <div className="page">
        <OverviewNodeSelector nodes={nodes} value={overviewNode} onChange={setOverviewNode} />
        <div className="kpi-row cols-5" style={{ marginBottom: 16 }}>
          <KpiCard icon={<IconShield />} tone={level ? clrStatus[1] : 'green'} label={overviewNode === 'all' ? 'Average CLR Risk Score' : 'CLR Risk Score'} value={score == null ? '—' : <Fresh>{score.toFixed(0)}</Fresh>} unit={score == null ? '' : '/ 100'} status={clrStatus[0]} statusTone={clrStatus[1]} sub={summaryLabel} />
          <KpiCard icon={<IconBoxes />} tone={online.length ? 'green' : 'orange'} label="Nodes Online" value={online.length} unit={`/ ${nodes.length}`} status={online.length ? 'Reporting' : 'None reporting yet'} statusTone={online.length ? 'green' : 'muted'} sub="Sending data right now" />
          <KpiCard icon={<IconTemperature />} tone="red" label={overviewNode === 'all' ? 'Avg Temperature' : 'Temperature'} value={avgT == null ? '—' : <Fresh>{avgT.toFixed(1)}</Fresh>} unit={avgT == null ? '' : '°C'} status={tLabel} statusTone={tTone} sub={summaryLabel} />
          <KpiCard icon={<IconHumidity />} tone="blue" label={overviewNode === 'all' ? 'Avg Humidity' : 'Humidity'} value={avgH == null ? '—' : <Fresh>{avgH.toFixed(0)}</Fresh>} unit={avgH == null ? '' : '%'} status={hLabel} statusTone={hTone} sub={summaryLabel} />
          <KpiCard icon={<IconSoil />} tone="green" label={overviewNode === 'all' ? 'Avg Soil Moisture' : 'Soil Moisture'} value={avgS == null ? '—' : <Fresh>{avgS.toFixed(0)}</Fresh>} unit={avgS == null ? '' : '%'} status={sLabel} statusTone={sTone} sub={summaryLabel} />
        </div>

        {/* Recommendation layer */}
        <LiveAlertPanel alerts={alerts} source={alertSource} lang={lang} onLang={setLang} />

        <div className="grid-21">
          <div className="card">
            <h3>7-Day Environmental Trend</h3>
            {trends.length === 0 ? (
              <div className="empty-state">No readings in the last 7 days yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trends}>
                  <CartesianGrid {...gridProps} strokeDasharray="3 3" vertical={false} />
                  <XAxis {...axisProps} dataKey="time" tick={{ fontSize: 10 }} minTickGap={30} />
                  <YAxis {...axisProps} tick={{ fontSize: 10 }} />
                  <Tooltip {...tooltipProps} />
                  <Legend />
                  <Line type="monotone" dataKey="temperature" name="Temp (°C)" stroke={C.temperature} dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="humidity" name="Humidity (%)" stroke={C.humidity} dot={false} strokeWidth={2} isAnimationActive={false} />
                  <Line type="monotone" dataKey="clr" name="CLR Score" stroke={C.score} dot={false} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="card">
            <h3>CLR Risk Score by Node</h3>
            <PlotMap nodes={nodes} selectedId={overviewNode} onSelect={(n) => setOverviewNode((cur) => (cur === n.nodeId ? 'all' : n.nodeId))} />
          </div>
        </div>

        <div className="grid-2 cards-top">
          <IrrigationSnapshot irrigation={irrigation} />
          <SystemHealth live={live} nodes={nodes} valveBox={irrigation.valveBox} />
        </div>

        <FieldActions />
      </div>
    </div>
  );
}

/// What the field staff and agronomist recorded when they closed alerts.
function FieldActions() {
  const [rows, setRows] = useState(null);
  const load = () => api.alertActions({ limit: 6 }).then((r) => setRows(r.data || [])).catch(() => {});
  useLiveRefresh(load, { fallbackMs: 60000 });
  const when = formatTimestamp;
  return (
    <div className="card">
      <div className="card-head"><h3>Recent field actions</h3></div>
      <p className="card-sub">What was done about the CLR alerts, in the words of whoever did it.</p>
      {rows && rows.length === 0 && <p className="muted" style={{ fontSize: 13 }}>No actions recorded yet.</p>}
      <ul className="status-list">
        {(rows || []).map((a) => (
          <li key={a.id} className="status-row">
            <div>
              <strong>Node {parseInt(String(a.node_id).replace(/\D/g, ''), 10)}</strong> <span className="muted">· {a.label}</span>
              <p className="status-note">{a.note}</p>
            </div>
            <span className="muted action-by" style={{ fontSize: 12 }}>{a.done_by}<br />{when(a.created_at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/// Relay states, the valve box's last contact and automatic watering, every few seconds.
function useIrrigation() {
  const [state, setState] = useState({ zones: [], valveBox: null, auto: null });
  useEffect(() => {
    const load = () => Promise.all([
      api.irrigationStatus(),
      api.autoWater().catch(() => null),
    ]).then(([st, auto]) => setState({ zones: st.data || [], valveBox: st.valve_box || null, auto }))
      .catch(() => {});
    load();
    const t = setInterval(load, LIVE_POLL_MS);
    return () => clearInterval(t);
  }, []);
  return state;
}

// Must match VALVE_NODES in esp32_valve_controller/config.h.
const VALVES = [
  { n: 1, side: 'west', nodes: [1, 4] },
  { n: 2, side: 'centre', nodes: [3] },
  { n: 3, side: 'east', nodes: [2, 5] },
];

const Chip = ({ on, children }) => (
  <span
    className="risk-chip"
    style={on ? { background: 'var(--leaf-soft)', color: 'var(--leaf)' } : { background: 'var(--surface-2)', color: 'var(--muted)' }}
  >
    {children}
  </span>
);

function IrrigationSnapshot({ irrigation }) {
  const { zones, auto } = irrigation;
  const nodeOn = (n) => zones.some((z) => parseInt(String(z.node_id).replace(/\D/g, ''), 10) === n && z.relay_on);
  const valves = VALVES.map((v) => ({
    ...v,
    on: v.nodes.some(nodeOn),
    note: auto?.valves?.find((a) => a.n === v.n)?.note,
  }));
  const watering = valves.filter((v) => v.on).length;
  return (
    <div className="card">
      <div className="card-head">
        <h3>Irrigation</h3>
        {auto && <Chip on={auto.settings.enabled}>Automatic {auto.settings.enabled ? 'ON' : 'OFF'}</Chip>}
      </div>
      <p className="card-sub">{watering === 0 ? 'No valve is watering right now.' : `${watering} of 3 valves watering now.`}</p>
      <ul className="status-list">
        {valves.map((v) => (
          <li key={v.n}>
            <div>
              <strong>Valve {v.n}</strong> <span className="muted">· {v.side} · Node {v.nodes.join(' + ')}</span>
              {auto?.settings.enabled && v.note && <p className="status-note">{v.note}</p>}
            </div>
            <Chip on={v.on}>{v.on ? 'Watering' : 'Off'}</Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ago(iso) {
  if (!iso) return null;
  const s = Math.round((Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/// Server, each sensor node and the valve box: one line each, problems first in the summary.
function SystemHealth({ live, nodes, valveBox }) {
  const rows = [
    {
      key: 'server', label: 'Raspberry Pi server', ok: live,
      detail: live ? 'Connected' : 'Not reachable',
    },
    ...nodes.map((n) => ({
      key: n.nodeId, label: n.name, ok: n.online && !sensorNote(n),
      detail: !n.boxOnline ? `Offline · last reading ${lastSeenLabel(n).toLowerCase()}`
        : sensorProblem(n) ? sensorProblem(n).brief
        : 'Sending data',
      title: sensorNote(n) || undefined,
    })),
    {
      key: 'valves', label: 'Valve box', ok: !!valveBox?.online,
      detail: valveBox?.online ? 'Connected'
        : valveBox?.last_poll ? `No contact · last seen ${ago(valveBox.last_poll)}` : 'No contact since the Pi started',
    },
  ];
  const problems = rows.filter((r) => !r.ok);
  const boxesOn = nodes.filter((n) => n.boxOnline).length;
  const withProblem = nodes.filter((n) => sensorNote(n)).length;
  return (
    <div className="card">
      <div className="card-head">
        <h3>System Health</h3>
        <span className={`health-badge ${problems.length ? 'warn' : 'ok'}`}>
          {problems.length ? `${problems.length} need${problems.length === 1 ? 's' : ''} attention` : 'All working'}
        </span>
      </div>
      <p className="card-sub">
        {boxesOn} of {nodes.length} sensor boxes online
        {withProblem > 0 && <> · <span className="health-bad-text">{withProblem} with a sensor problem</span></>}
      </p>
      <ul className="status-list">
        {rows.map((r) => (
          <li key={r.key} className="status-row">
            <span className="health-row">
              <span className={`health-dot ${r.ok ? 'ok' : 'bad'}`} aria-hidden="true" />
              {r.label}
            </span>
            <span className={`status-detail ${r.ok ? 'muted' : 'health-bad-text'}`} title={r.title}>{r.detail}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
