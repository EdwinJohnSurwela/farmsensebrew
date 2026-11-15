import OverviewNodeSelector from '../../components/OverviewNodeSelector';
import PlotMap from '../../components/PlotMap';
import { formatTimestamp } from '../../time';
import { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { api, toNum, riskColor } from '../../api';
import KpiCard, { tempStatus, humidityStatus, soilStatus } from '../../components/KpiCard';
import RiskChip from '../../components/RiskChip';
import { RISK_LEVELS, RISK_STATUS, RISK_BANDS, isActionLevel, levelLabel, levelFromScore } from '../../risk';
import SensorStatus from '../../components/SensorStatus';
import { loadNodes, useLiveNodes, nodeColor, onlineAvg, lastSeenLabel, offlineWord, sensorNote, fmt, SENSOR_PURPLE, OFFLINE_GREY } from '../../nodes';
import { useLiveRefresh } from '../../live';
import Fresh from '../../components/Fresh';
import { IconTemperature, IconHumidity, IconSoil, IconBoxes, IconShield } from '../../icons';
import { C, axisProps, gridProps, tooltipProps } from '../../palette';


/// Agronomist dashboard: full sensor data, X-formation node map,
/// CLR analysis, the all-nodes table and 24h charts. Refreshes itself.
export default function AgronomistDashboard() {
  const [nodeList, setNodes] = useState([]);
  const [overviewNode, setOverviewNode] = useState('all');
  const nodes = useLiveNodes(nodeList); // values change every 2 s without re-fetching
  const [trends, setTrends] = useState([]);
  const [selected, setSelected] = useState(0);
  const [live, setLive] = useState(false);

  const load = async () => {
    try {
      const [list, trendRes] = await Promise.all([loadNodes(), api.trends('hours=24')]);
      setNodes(list);
      setTrends(
        (trendRes.data || []).map((t) => ({
          time: formatTimestamp(t.time),
          temperature: toNum(t.avg_temperature),
          humidity: toNum(t.avg_humidity),
          soil: toNum(t.avg_soil_pct),
        }))
      );
      setLive(true);
    } catch {
      setLive(false);
    }
  };

  // Refresh the moment the Pi pushes a new reading, on tab return, and on a safety timer.
  useLiveRefresh(load);

  const summaryNodes = overviewNode === 'all' ? nodes : nodes.filter(n => n.nodeId === overviewNode);
  const summaryLabel = overviewNode === 'all' ? 'Online nodes, latest readings' : summaryNodes[0]?.name || 'Selected node';
  const online = nodes.filter((n) => n.online);
  const avgT = onlineAvg(summaryNodes, 'temperature');
  const avgH = onlineAvg(summaryNodes, 'humidity');
  const avgS = onlineAvg(summaryNodes, 'soil');
  const score = onlineAvg(summaryNodes, 'score');
  const level = levelFromScore(score);
  const highCount = nodes.filter((n) => n.hasRisk && isActionLevel(n.risk)).length;
  const sel = nodes[selected] || nodes[0];
  const waiting = 'Waiting for readings';
  const [tLabel, tTone] = avgT == null ? [waiting, 'muted'] : tempStatus(avgT);
  const [hLabel, hTone] = avgH == null ? [waiting, 'muted'] : humidityStatus(avgH);
  const [sLabel, sTone] = avgS == null ? [waiting, 'muted'] : soilStatus(avgS);

  return (
    <div>
      <header className="banner grad-agronomist">
        <div className="banner-row">
          <div>
            <span className="badge-live">
              <span className={`dot ${live ? '' : 'off'}`} /> {live ? 'Live' : 'Not connected'}
            </span>
            <h1 style={{ marginTop: 8 }}>Overview</h1>
            <p className="sub">Full Sensor Data &amp; Analytics • Javier Permaculture Farm</p>
          </div>
        </div>
      </header>

      <div className="page">
        <OverviewNodeSelector nodes={nodes} value={overviewNode} onChange={value => { setOverviewNode(value); const index = nodes.findIndex(n => n.nodeId === value); if (index >= 0) setSelected(index); }} />
        <div className="kpi-row cols-5" style={{ marginBottom: 16 }}>
          <KpiCard icon={<IconShield />} label={overviewNode === 'all' ? 'Average CLR Risk Score' : 'CLR Risk Score'} value={score == null ? '—' : <Fresh>{score.toFixed(0)}</Fresh>} unit={score == null ? '' : '/ 100'} status={level ? levelLabel(level) : 'Waiting for readings'} sub={summaryLabel} />
          <KpiCard icon={<IconTemperature />} tone="red" label={overviewNode === 'all' ? 'Avg Temperature' : 'Temperature'} value={avgT == null ? '—' : <Fresh>{avgT.toFixed(1)}</Fresh>} unit={avgT == null ? '' : '°C'} status={tLabel} statusTone={tTone} sub={summaryLabel} />
          <KpiCard icon={<IconHumidity />} tone="blue" label={overviewNode === 'all' ? 'Avg Humidity' : 'Humidity'} value={avgH == null ? '—' : <Fresh>{avgH.toFixed(0)}</Fresh>} unit={avgH == null ? '' : '%'} status={hLabel} statusTone={hTone} sub={summaryLabel} />
          <KpiCard icon={<IconSoil />} tone="green" label={overviewNode === 'all' ? 'Avg Soil Moisture' : 'Soil Moisture'} value={avgS == null ? '—' : <Fresh>{avgS.toFixed(0)}</Fresh>} unit={avgS == null ? '' : '%'} status={sLabel} statusTone={sTone} sub={summaryLabel} />
          <KpiCard
            icon={<IconBoxes />} tone={online.length ? 'green' : 'orange'} label="Nodes Online"
            value={online.length} unit={`/ ${nodes.length}`}
            status={highCount > 0 ? `${highCount} at High or Critical: inspect` : online.length ? 'None at High or Critical' : waiting}
            statusTone={highCount > 0 ? 'red' : online.length ? 'green' : 'muted'}
            sub="Sending data right now"
          />
        </div>

        <div className="grid-3">
          {/* Node map with each node's CLR score (grey = offline) */}
          <div className="card">
            <h3>CLR Risk Score by Node</h3>
            <PlotMap nodes={nodes} selectedId={sel?.nodeId} onSelect={(n) => { setSelected(nodes.indexOf(n)); setOverviewNode(n.nodeId); }} />
          </div>

          {/* CLR score per online node */}
          <div className="card">
            <h3>Coffee Leaf Rust Risk Analysis</h3>
            {online.length === 0 ? (
              <div className="empty-state">No node online yet. Scores appear here as readings arrive.</div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={nodes.map((n) => ({ name: `N${n.num}`, score: n.hasRisk ? n.score : null, color: nodeColor(n) }))}>
                  <CartesianGrid {...gridProps} strokeDasharray="3 3" vertical={false} />
                  <XAxis {...axisProps} dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis {...axisProps} domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip {...tooltipProps} />
                  <Bar dataKey="score" name="CLR Score" radius={[4, 4, 0, 0]} isAnimationActive={false}
                       shape={(props) => {
                         const { x, y, width, height, payload } = props;
                         return <rect x={x} y={y} width={width} height={height} rx={4} fill={payload.color} />;
                       }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Live readings for the selected node */}
          <div className="card">
            <h3>{sel ? `${sel.name}: Live Readings` : 'Live Readings'}</h3>
            {sel && sel.online && (
              <>
                <Reading label="Temperature" value={sel.temperature == null ? '—' : `${fmt(sel.temperature, 1)}°C`} pct={(sel.temperature ?? 0) / 50} color={C.temperature} />
                <Reading label="Humidity" value={sel.humidity == null ? '—' : `${fmt(sel.humidity)}%`} pct={(sel.humidity ?? 0) / 100} color={C.humidity} />
                <Reading label="Soil Moisture" value={sel.soil == null ? '—' : `${fmt(sel.soil)}%`} pct={(sel.soil ?? 0) / 100} color={C.soil} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <span style={{ fontWeight: 600 }}>CLR Risk Score</span>
                  {sel.hasRisk
                    ? <RiskChip level={sel.risk}>{fmt(sel.score)}/100 · {levelLabel(sel.risk)} · {RISK_STATUS[sel.risk]}</RiskChip>
                    : <span className="muted">No risk level: temperature and humidity sensor not reading</span>}
                </div>
                {sensorNote(sel) && sel.hasRisk && <div className="muted" style={{ marginTop: 10 }}>{sensorNote(sel)}.</div>}
              </>
            )}
            {sel && !sel.online && (
              <div className="empty-state" style={{ padding: '28px 8px' }}>
                <strong style={{ color: 'var(--text-2)' }}>{offlineWord(sel)}</strong>
                <div style={{ marginTop: 6 }}>
                  {sel.boxOnline ? 'The box is on, but neither of its sensors is reading. ' : ''}
                  {sel.hasReading ? `Last reading ${lastSeenLabel(sel)}.` : 'This node has not sent a reading yet.'}
                </div>
              </div>
            )}
            {!sel && <div className="empty-state">No nodes registered.</div>}
            <p className="muted" style={{ marginTop: 12 }}>Tap a node on the map to switch.</p>
          </div>
        </div>

        <div className="grid-21">
          {/* All nodes table */}
          <div className="card table-wrap">
            <h3>Current Node Overview</h3>
            <table className="data">
              <thead>
                <tr>
                  <th>NODE</th><th>ID</th><th>CLR SCORE</th><th>CLR RISK</th>
                  <th>TEMP (°C)</th><th>HUMIDITY (%)</th><th>SOIL (%)</th><th>LAST READING</th><th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((n) => (
                  <tr key={n.nodeId}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="risk-dot" style={{ background: nodeColor(n) }} />
                      {n.name}
                    </td>
                    <td>{n.nodeId}</td>
                    <td>{n.hasRisk ? <Fresh>{fmt(n.score)}</Fresh> : '—'}</td>
                    <td>{n.hasRisk ? <RiskChip level={n.risk} /> : <span className="muted">—</span>}</td>
                    <td>{n.temperature != null ? <Fresh>{fmt(n.temperature, 1)}</Fresh> : '—'}</td>
                    <td>{n.humidity != null ? <Fresh>{fmt(n.humidity)}</Fresh> : '—'}</td>
                    <td>{n.soil != null ? <Fresh>{fmt(n.soil)}</Fresh> : '—'}</td>
                    <td>{lastSeenLabel(n)}</td>
                    <td className={n.online && !sensorNote(n) ? 'status-online' : 'status-offline'}>
                      {!n.boxOnline ? 'Offline' : sensorNote(n) ? <SensorStatus n={n} /> : 'Online'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 24h environmental trend */}
          <div className="card">
            <h3>Environmental Trend (24h)</h3>
            {trends.length === 0 ? (
              <div className="empty-state">No readings in the last 24 hours yet.</div>
            ) : (
              <>
                <div className="muted" style={{ marginBottom: 4 }}>Temperature &amp; humidity</div>
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={trends}>
                    <CartesianGrid {...gridProps} strokeDasharray="3 3" vertical={false} />
                    <XAxis {...axisProps} dataKey="time" tick={{ fontSize: 10 }} minTickGap={40} />
                    <YAxis {...axisProps} tick={{ fontSize: 10 }} domain={[0, 100]} width={30} />
                    <Tooltip {...tooltipProps} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="temperature" name="Temp (°C)" stroke={C.temperature} dot={false} strokeWidth={2} isAnimationActive={false} />
                    <Line type="monotone" dataKey="humidity" name="Humidity (%)" stroke={C.humidity} dot={false} strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="muted" style={{ margin: '12px 0 4px' }}>Soil moisture</div>
                <ResponsiveContainer width="100%" height={130}>
                  <LineChart data={trends}>
                    <CartesianGrid {...gridProps} strokeDasharray="3 3" vertical={false} />
                    <XAxis {...axisProps} dataKey="time" tick={{ fontSize: 10 }} minTickGap={40} />
                    <YAxis {...axisProps} tick={{ fontSize: 10 }} domain={[0, 100]} width={30} />
                    <Tooltip {...tooltipProps} />
                    <Line type="monotone" dataKey="soil" name="Soil (%)" stroke={C.soil} dot={false} strokeWidth={2} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Reading({ label, value, pct, color }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: 'var(--text-2)' }}>{label}</span>
        <strong>{value}</strong>
      </div>
      <div style={{ height: 8, borderRadius: 4, background: `${color}22` }}>
        <div
          style={{
            height: '100%', borderRadius: 4, background: color,
            width: `${Math.min(100, Math.max(0, pct * 100))}%`,
          }}
        />
      </div>
    </div>
  );
}
