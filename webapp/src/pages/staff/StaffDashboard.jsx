import { formatTimestamp } from '../../time';
import { useEffect, useState } from 'react';
import { api, riskColor } from '../../api';
import PlotMap from '../../components/PlotMap';
import { isActionLevel, RISK_LEVELS } from '../../risk';
import { useAuth } from '../../auth';
import RecordActionModal, { actionText } from '../../components/RecordActionModal';
import LiveAlertPanel, { useRecoLang } from '../../components/LiveAlertPanel';
import RiskChip from '../../components/RiskChip';
import { loadNodes, useLiveNodes, nodeColor, fmt, SENSOR_PURPLE, OFFLINE_GREY } from '../../nodes';
import { useLiveRefresh } from '../../live';
import Fresh from '../../components/Fresh';
import { IconTemperature, IconHumidity, IconSoil, IconChecklist, IconTap } from '../../icons';
import { C } from '../../palette';

const Dot = ({ c }) => (
  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: c, margin: '0 5px 0 2px', verticalAlign: '0px' }} />
);

const RECOMMENDATION_POLL_MS = 60000;

// What the field staff should do at a node, in the language chosen on the
// recommendations toggle: English, everyday Tagalog, or Taglish.
const ACTIONS = {
  en: {
    offlineSeen: (ago) => `OFFLINE: this node's last reading was ${ago}. Check that its box has power and the WiFi is on. If it stays grey, contact the Farm Owner or the System Admin.`,
    offlineNever: 'OFFLINE: this node has not sent a reading yet. Check that its box has power and the WiFi is on. If it stays grey, contact the Farm Owner or the System Admin.',
    airFault: 'SENSOR PROBLEM: the temperature and humidity sensor (the white one in the cup) is not reading, so this node has no disease risk right now. Soil moisture still works. Check that the sensor is dry and its wires are pushed in, then tell the Farm Owner or the System Admin.',
    soilFault: 'SOIL SENSOR PROBLEM: the soil moisture sensor is not reading. Check that it is pushed into the soil and its wires are in, then tell the Farm Owner or the System Admin.',
    bothFault: 'SENSOR PROBLEM: the box is on, but neither of its sensors is reading. Check the sensor wires inside the box, then tell the Farm Owner or the System Admin.',
    highDry: (lvl) => `URGENT: DO NOT WATER around this node. Disease risk is ${lvl}. Check leaf undersides for yellow-orange spots. Report findings to the agronomist or the Farm Owner right away.`,
    high: (lvl) => `URGENT: Disease risk ${lvl}. Walk around this node and look for yellow spots on leaves. Take photos of suspicious leaves. Do NOT water.`,
    veryDry: 'ACTION: Soil is very dry. Check that the drip lines are running and not clogged, then report.',
    dry: 'ACTION: Soil is getting dry. Check the drip lines on your next walk.',
    moderate: 'AT RISK: Conditions may worsen. Walk around this node during the next check. Look for unusual leaf spots. Report anything unusual.',
    watch: 'WATCH: Some conditions favour leaf rust, but the leaves are likely dry. Keep up regular checks; no action needed yet.',
    ok: 'ALL GOOD: Continue regular monitoring. Check plants for pests. Remove fallen leaves from the ground.',
    legend: { MINIMAL: 'HEALTHY', LOW: 'WATCH', MODERATE: 'AT RISK', HIGH: 'SEVERE', CRITICAL: 'CRITICAL' },
    title: 'What to do now', last: 'Last reading', temp: 'Temp', hum: 'Humidity', soil: 'Soil',
    record: 'Record what you did', openSince: (lvl, t) => `Open ${lvl} alert since ${t}`, lastAction: 'Last action', by: 'by',
  },
  tl: {
    offlineSeen: (ago) => `OFFLINE: ${ago} pa ang huling reading ng node na 'to. Tingnan kung may kuryente ang box at kung naka-on ang WiFi. Kung grey pa rin, sabihan ang Farm Owner o ang System Admin.`,
    offlineNever: "OFFLINE: Wala pang naipapadalang reading ang node na 'to. Tingnan kung may kuryente ang box at kung naka-on ang WiFi. Kung grey pa rin, sabihan ang Farm Owner o ang System Admin.",
    airFault: 'MAY SIRA ANG SENSOR: Hindi bumabasa ang sensor ng init at halumigmig (ang puti sa loob ng cup), kaya walang disease risk ang node na ito ngayon. Gumagana pa ang sukat ng lupa. Tingnan kung tuyo ang sensor at nakabaon nang mabuti ang mga wire, tapos sabihan ang Farm Owner o ang System Admin.',
    soilFault: 'MAY SIRA ANG SENSOR NG LUPA: Hindi bumabasa ang sensor ng basa ng lupa. Tingnan kung nakabaon ito sa lupa at nakakabit ang mga wire, tapos sabihan ang Farm Owner o ang System Admin.',
    bothFault: 'MAY SIRA ANG SENSOR: Bukas ang box, pero walang bumabasang sensor. Tingnan ang mga wire ng sensor sa loob ng box, tapos sabihan ang Farm Owner o ang System Admin.',
    highDry: () => "URGENT: WAG DILIGAN ang paligid ng node na 'to. Mataas ang tsansa ng sakit. Silipin ang ilalim ng mga dahon kung may dilaw o orange na batik. Sabihan agad ang agronomist o ang Farm Owner.",
    high: () => "URGENT: Mataas ang tsansa ng sakit. Ikutin ang paligid ng node na 'to at hanapin ang dilaw na batik sa mga dahon. Kunan ng picture ang mga dahong mukhang may sakit. WAG diligan.",
    veryDry: 'GAWIN: Sobrang tuyo na ng lupa. Tingnan kung umaandar ang drip lines at kung walang bara, tapos i-report.',
    dry: 'GAWIN: Natutuyo na ang lupa. Silipin ang drip lines sa susunod mong ikot.',
    moderate: "MAG-INGAT: Pwedeng lumala ang lagay. Ikutin ang node na 'to sa susunod na check. Hanapin ang kakaibang batik sa dahon at i-report kung meron.",
    watch: 'BANTAYAN: May ilang lagay na gusto ng kalawang, pero mukhang tuyo pa ang mga dahon. Tuloy lang ang normal na bantay.',
    ok: 'OKAY LAHAT: Tuloy lang ang normal na bantay. Silipin kung may peste. Walisin ang mga nahulog na dahon.',
    legend: { MINIMAL: 'OKAY', LOW: 'BANTAYAN', MODERATE: 'MAG-INGAT', HIGH: 'MATAAS', CRITICAL: 'DELIKADO' },
    title: 'Ano ang gagawin', last: 'Huling reading', temp: 'Init', hum: 'Humidity', soil: 'Lupa',
    record: 'I-record ang ginawa mo', openSince: (lvl, t) => `May bukas na ${lvl} alert mula ${t}`, lastAction: 'Huling ginawa', by: 'ni',
  },
  taglish: {
    offlineSeen: (ago) => `OFFLINE: Yung last reading ng node na 'to ay ${ago}. I-check kung may power ang box at naka-on ang WiFi. Kung grey pa rin, i-contact ang Farm Owner o ang System Admin.`,
    offlineNever: "OFFLINE: Wala pang na-send na reading ang node na 'to. I-check kung may power ang box at naka-on ang WiFi. Kung grey pa rin, i-contact ang Farm Owner o ang System Admin.",
    airFault: "SENSOR PROBLEM: Hindi nagre-read ang temperature at humidity sensor (yung white sa loob ng cup), kaya walang disease risk ang node na 'to ngayon. Gumagana pa ang soil moisture. I-check kung dry ang sensor at naka-push in ang wires, tapos i-contact ang Farm Owner o ang System Admin.",
    soilFault: "SOIL SENSOR PROBLEM: Hindi nagre-read ang soil moisture sensor. I-check kung nakabaon ito sa soil at naka-connect ang wires, tapos i-contact ang Farm Owner o ang System Admin.",
    bothFault: "SENSOR PROBLEM: On ang box, pero walang nagre-read na sensor. I-check ang wires ng sensors sa loob ng box, tapos i-contact ang Farm Owner o ang System Admin.",
    highDry: (lvl) => `URGENT: WAG MAG-WATER sa paligid ng node na 'to. ${lvl} ang disease risk. I-check ang ilalim ng leaves kung may yellow-orange spots. I-report agad sa agronomist o sa Farm Owner.`,
    high: (lvl) => `URGENT: ${lvl} ang disease risk. Ikutin ang area ng node na 'to at hanapin ang yellow spots sa leaves. Picturan yung mga leaves na mukhang may sakit. Wag mag-water.`,
    veryDry: 'ACTION: Sobrang dry na ng soil. I-check kung tumatakbo ang drip lines at walang bara, tapos i-report.',
    dry: 'ACTION: Nagda-dry na ang soil. I-check ang drip lines sa next ikot mo.',
    moderate: "AT RISK: Pwedeng lumala ang conditions. Ikutin ang node na 'to sa next check. Hanapin ang weird na spots sa leaves at i-report kung meron.",
    watch: 'WATCH: May ilang conditions na gusto ng leaf rust, pero mukhang dry pa ang leaves. Tuloy lang ang regular monitoring.',
    ok: 'ALL GOOD: Tuloy lang ang regular monitoring. I-check kung may pests. Linisin ang mga nahulog na leaves.',
    legend: { MINIMAL: 'HEALTHY', LOW: 'WATCH', MODERATE: 'AT RISK', HIGH: 'SEVERE', CRITICAL: 'CRITICAL' },
    title: 'Anong gagawin', last: 'Last reading', temp: 'Temp', hum: 'Humidity', soil: 'Soil',
    record: 'I-record ang ginawa mo', openSince: (lvl, t) => `May open ${lvl} alert since ${t}`, lastAction: 'Last action', by: 'by',
  },
};

// Every other word on the Overview, in the same three languages (staff
// default: casual Tagalog). Chosen at the top of the page, remembered per device.
const UI = {
  en: {
    live: 'LIVE', offline: 'NOT CONNECTED', title: 'Overview', sub: 'Simple node status and instructions',
    map: 'Node Status Map', tap: 'Tap any node on the map to see what to do', quick: 'All Nodes: Quick View',
    cols: ['NODE', 'TEMP', 'HUMIDITY', 'SOIL', 'STATUS', 'LAST READING'],
    statusOffline: 'Offline', sensorLegend: 'SENSOR PROBLEM', offlineLegend: 'OFFLINE',
    sensor: { title: 'Sensor problem', air: 'Air sensor (temperature and humidity)', soil: 'Soil moisture sensor', both: 'Air and soil sensors' },
    chip: { air: 'Air sensor problem', soil: 'Soil sensor problem', both: 'Both sensors not reading' },
    seen: { none: 'No readings yet' },
    help: 'Need help?',
    helpText: ['Red or orange node = do NOT water, inspect the leaves.', 'Amber = check again soon.', 'Green or olive = routine care.',
      'Grey = the node is offline: check its power and WiFi, and if it stays grey, contact the Farm Owner or the System Admin. For questions about the plants, contact the agronomist or the Farm Owner.'],
    lang: 'Language',
  },
  tl: {
    live: 'LIVE', offline: 'WALANG KONEKSYON', title: 'Overview', sub: 'Lagay ng bawat node at kung ano ang gagawin',
    map: 'Mapa ng mga Node', tap: 'Pindutin ang kahit anong node sa mapa para makita kung ano ang gagawin', quick: 'Lahat ng Node: Mabilisang Silip',
    cols: ['NODE', 'INIT', 'HUMIDITY', 'LUPA', 'LAGAY', 'HULING READING'],
    statusOffline: 'Offline', sensorLegend: 'SIRANG SENSOR', offlineLegend: 'OFFLINE',
    sensor: { title: 'May sira ang sensor', air: 'Sensor ng init at humidity', soil: 'Sensor ng lupa', both: 'Sensor ng hangin at lupa' },
    chip: { air: 'Sira ang sensor ng hangin', soil: 'Sira ang sensor ng lupa', both: 'Parehong sira ang sensor' },
    seen: { none: 'Wala pang reading' },
    help: 'Kailangan ng tulong?',
    helpText: ['Pula o orange na node = WAG diligan, silipin ang mga dahon.', 'Dilaw = balikan ulit mamaya.', 'Berde = normal na alaga lang.',
      'Grey = offline ang node: tingnan kung may kuryente at WiFi. Kung grey pa rin, sabihan ang Farm Owner o ang System Admin. Kung tungkol sa halaman ang tanong, sa agronomist o sa Farm Owner.'],
    lang: 'Wika',
  },
  taglish: {
    live: 'LIVE', offline: 'NOT CONNECTED', title: 'Overview', sub: 'Status ng bawat node at kung anong gagawin',
    map: 'Node Status Map', tap: 'I-tap ang kahit anong node sa map para makita kung anong gagawin', quick: 'All Nodes: Quick View',
    cols: ['NODE', 'TEMP', 'HUMIDITY', 'SOIL', 'STATUS', 'LAST READING'],
    statusOffline: 'Offline', sensorLegend: 'SENSOR PROBLEM', offlineLegend: 'OFFLINE',
    sensor: { title: 'Sensor problem', air: 'Air sensor (temp at humidity)', soil: 'Soil moisture sensor', both: 'Air at soil sensors' },
    chip: { air: 'Air sensor problem', soil: 'Soil sensor problem', both: 'Parehong sensor, hindi nagre-read' },
    seen: { none: 'Wala pang reading' },
    help: 'Need help?',
    helpText: ['Red o orange na node = WAG mag-water, i-check ang leaves.', 'Amber = i-check ulit mamaya.', 'Green o olive = regular na alaga lang.',
      'Grey = offline ang node: i-check ang power at WiFi. Kung grey pa rin, i-contact ang Farm Owner o ang System Admin. Kung tungkol sa plants ang tanong, sa agronomist o sa Farm Owner.'],
    lang: 'Language',
  },
};
const ui = (lang) => UI[lang] || UI.en;

function seenLabel(n, lang) {
  const at = n.boxOnline && !n.online ? n.lastReading : n.lastSeen;
  return at ? formatTimestamp(at) : ui(lang).seen.none;
}

/** Status word in place of a risk level: which sensor is not reading, or Offline. */
function statusWord(n, lang) {
  const L = ui(lang);
  if (!n.boxOnline) return L.statusOffline;
  if (n.airFault && n.soilFault) return L.chip.both;
  if (n.airFault) return L.chip.air;
  if (n.soilFault) return L.chip.soil;
  return L.statusOffline;
}

function StaffSensorStatus({ n, lang }) {
  if (!n.boxOnline || (!n.airFault && !n.soilFault)) return null;
  const L = ui(lang).sensor;
  const which = n.airFault && n.soilFault ? L.both : n.airFault ? L.air : L.soil;
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.25, whiteSpace: 'nowrap' }}>
      <strong style={{ color: SENSOR_PURPLE, fontWeight: 600 }}>{L.title}</strong>
      <span style={{ fontSize: 11, color: SENSOR_PURPLE, opacity: 0.85 }}>{which}</span>
    </span>
  );
}

function LangSwitch({ lang, onLang }) {
  return (
    <div className="lang-toggle" role="group" aria-label={ui(lang).lang}>
      <button className={lang === 'tl' ? 'on' : ''} aria-pressed={lang === 'tl'} onClick={() => onLang('tl')}>Tagalog</button>
      <button className={lang === 'taglish' ? 'on' : ''} aria-pressed={lang === 'taglish'} onClick={() => onLang('taglish')}>Taglish</button>
      <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => onLang('en')}>English</button>
    </div>
  );
}

function fieldAction(n, lang = 'en') {
  const t = ACTIONS[lang] || ACTIONS.en;
  if (!n.boxOnline) return n.hasReading ? t.offlineSeen(seenLabel(n, lang).toLowerCase()) : t.offlineNever;
  if (n.airFault && n.soilFault) return t.bothFault;
  if (n.airFault) return t.airFault;
  const dry = (below) => n.soil != null && n.soil < below;
  if (isActionLevel(n.risk) && dry(35)) return t.highDry(n.risk);
  if (isActionLevel(n.risk)) return t.high(n.risk);
  if (n.soilFault) return t.soilFault;
  if (dry(30)) return t.veryDry;
  if (dry(35)) return t.dry;
  if (n.risk === 'MODERATE') return t.moderate;
  if (n.risk === 'LOW') return t.watch;
  return t.ok;
}

// Colour of the action panel: urgent, action, watch, all good, offline.
const actionTone = (n) =>
  !n.boxOnline ? 'offline' : isActionLevel(n.risk) ? 'cherry'
    : n.airFault || n.soilFault || (n.soil != null && n.soil < 35) || n.risk === 'MODERATE' ? 'amber' : 'leaf';

/// Field Staff dashboard: simple node status + what-to-do instructions,
/// plus the recommendation alerts. Refreshes itself.
export default function StaffDashboard() {
  const [nodeList, setNodes] = useState([]);
  const nodes = useLiveNodes(nodeList); // values change every 2 s without re-fetching
  const [selected, setSelected] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertSource, setAlertSource] = useState('');
  const [live, setLive] = useState(false);
  // Field staff read the recommendations in Tagalog by default; they can switch.
  const [lang, setLang] = useRecoLang('field_staff', 'tl');
  const { user } = useAuth();
  const [openAlerts, setOpenAlerts] = useState({});   // node_id -> open alert
  const [lastActions, setLastActions] = useState({}); // node_id -> latest recorded action
  const [recording, setRecording] = useState(null);   // node being recorded

  const load = async () => {
    try {
      setNodes(await loadNodes());
      setLive(true);
    } catch {
      setLive(false);
    }
  };
  const loadAlertInfo = async () => {
    try {
      const [open, acts] = await Promise.all([api.alerts(), api.alertActions({ limit: 50 })]);
      setOpenAlerts(Object.fromEntries((open.data || []).map((a) => [a.node_id, a])));
      const latest = {};
      for (const a of acts.data || []) if (!latest[a.node_id]) latest[a.node_id] = a;
      setLastActions(latest);
    } catch {
      /* keep the last values */
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
  useLiveRefresh(loadAlertInfo, { fallbackMs: 60000 });
  useLiveRefresh(loadRecommendations, { fallbackMs: RECOMMENDATION_POLL_MS });
  useEffect(() => { loadRecommendations(); }, [lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = selected != null ? nodes[selected] : null;
  const L = ui(lang);

  return (
    <div>
      <header className="banner grad-staff">
        <div className="banner-row">
          <div>
            <span className="badge-live">
              <span className={`dot ${live ? '' : 'off'}`} /> {live ? L.live : L.offline}
            </span>
            <h1 style={{ marginTop: 8 }}>{L.title}</h1>
            <p className="sub">{L.sub}</p>
          </div>
          <LangSwitch lang={lang} onLang={setLang} />
        </div>
      </header>

      <div className="page">
        <div className="grid-2">
          <div className="card">
            <h3 style={{ textAlign: 'center' }}>{L.map}</h3>
            <PlotMap nodes={nodes} selectedId={sel?.nodeId} onSelect={(n) => { const i = nodes.indexOf(n); setSelected((cur) => (cur === i ? null : i)); }}
              riskWord={(lv) => (ACTIONS[lang] || ACTIONS.en).legend[lv]} labels={{ sensor: L.sensorLegend, offline: L.offlineLegend }} />
          </div>

          {sel ? (
            <NodeCard
              n={sel}
              lang={lang}
              openAlert={openAlerts[sel.nodeId]}
              lastAction={lastActions[sel.nodeId]}
              onRecord={() => setRecording(sel)}
            />
          ) : (
            <div className="card empty-state node-card-empty"><IconTap /> {L.tap}</div>
          )}
        </div>

        <div className="card table-wrap">
          <h3>{L.quick}</h3>
          <table className="data">
            <thead>
              <tr>{L.cols.map((c) => <th key={c}>{c}</th>)}</tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.nodeId}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="risk-dot" style={{ background: nodeColor(n) }} />{n.name}
                  </td>
                  <td>{n.temperature != null ? <Fresh>{`${fmt(n.temperature, 1)}°C`}</Fresh> : '—'}</td>
                  <td>{n.humidity != null ? <Fresh>{`${fmt(n.humidity)}%`}</Fresh> : '—'}</td>
                  <td>{n.soil != null ? <Fresh>{`${fmt(n.soil)}%`}</Fresh> : '—'}</td>
                  <td>
                    {n.hasRisk ? <RiskChip level={n.risk}>{(ACTIONS[lang] || ACTIONS.en).legend[n.risk]}</RiskChip> : !n.boxOnline && <span className="status-offline">{L.statusOffline}</span>}
                    {n.boxOnline && (n.airFault || n.soilFault) && <div style={{ marginTop: n.hasRisk ? 4 : 0 }}><StaffSensorStatus n={n} lang={lang} /></div>}
                  </td>
                  <td>{seenLabel(n, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <LiveAlertPanel alerts={alerts} source={alertSource} lang={lang} onLang={setLang} />

        {recording && (
          <RecordActionModal
            nodeId={recording.nodeId}
            nodeName={recording.name}
            role={user?.role}
            lang={lang}
            onClose={() => setRecording(null)}
            onSaved={() => { setRecording(null); loadAlertInfo(); }}
          />
        )}

        <div className="callout amber">
          <h3>{L.help}</h3>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            <Dot c={riskColor('CRITICAL')} /><Dot c={riskColor('HIGH')} />{L.helpText[0]}{' '}
            <Dot c={riskColor('MODERATE')} />{L.helpText[1]}{' '}
            <Dot c={riskColor('MINIMAL')} /><Dot c={riskColor('LOW')} />{L.helpText[2]} <Dot c="#a79f8f" />{L.helpText[3]}
          </p>
        </div>
      </div>
    </div>
  );
}

/// The selected node: name and risk, three big readings, then what to do,
/// in a panel that takes the rest of the card's height.
function NodeCard({ n, lang, openAlert, lastAction, onRecord }) {
  const t = ACTIONS[lang] || ACTIONS.en;
  const at = actionText(lang);
  const when = formatTimestamp;
  const text = fieldAction(n, lang);
  const cut = text.indexOf(':');
  const tag = cut > 0 && cut < 16 ? text.slice(0, cut) : '';
  const body = tag ? text.slice(cut + 1).trim() : text;
  const readings = [
    { icon: <IconTemperature />, color: C.temperature, label: t.temp, value: n.temperature?.toFixed(1), unit: '°C' },
    { icon: <IconHumidity />, color: C.humidity, label: t.hum, value: n.humidity?.toFixed(0), unit: '%' },
    { icon: <IconSoil />, color: C.soil, label: t.soil, value: n.soil?.toFixed(0), unit: '%' },
  ];
  return (
    <div className="card node-card" style={{ '--node': nodeColor(n) }}>
      <div className="node-card-head">
        <div>
          <h3 style={{ margin: 0 }}>{n.name}</h3>
          <div className="eyebrow" style={{ marginTop: 4 }}>{n.nodeId} · {t.last}: {seenLabel(n, lang).toLowerCase()}</div>
        </div>
        {n.hasRisk ? <RiskChip level={n.risk}>{t.legend[n.risk]}</RiskChip>
          : <span className="risk-chip" style={n.boxOnline ? { background: SENSOR_PURPLE, color: '#fff' } : { background: 'var(--surface-2)', color: 'var(--muted)' }}>{statusWord(n, lang)}</span>}
      </div>
      <div className="node-readings">
        {readings.map((r) => (
          <div key={r.label} className="node-reading">
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ color: r.color, display: 'inline-flex' }}>{r.icon}</span>{r.label}
            </div>
            <div className="node-reading-value">
              {n.online && r.value != null ? <Fresh>{r.value}</Fresh> : '—'}
              {n.online && r.value != null && <span className="kpi-unit">{r.unit}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className={`node-action tone-${actionTone(n)}`}>
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><IconChecklist /> {t.title}</div>
        {tag && <div className="node-action-tag">{tag}</div>}
        <p>{body}</p>
      </div>
      {openAlert && (
        <div className="node-alert">
          <span>{t.openSince(openAlert.risk_level, when(openAlert.created_at))}</span>
          <button className="btn green sm" onClick={onRecord}><IconChecklist /> {t.record}</button>
        </div>
      )}
      {lastAction && (
        <p className="node-last-action">
          <strong>{t.lastAction}:</strong> {at.actions[lastAction.action] || lastAction.label} · {t.by} {lastAction.done_by} · {when(lastAction.created_at)}
        </p>
      )}
    </div>
  );
}

function Legend({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
      {label}
    </span>
  );
}
