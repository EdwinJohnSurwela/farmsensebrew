import { useEffect, useRef, useState } from 'react';
import { api, downloadReport } from '../api';
import { toast } from '../ui';
import { IconDownload, IconCaretDown } from '../icons';

// Calendar days are Philippine days, like the report files.
const phDay = (d = new Date()) => d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Manila' });
const daysAgo = (n) => phDay(new Date(Date.now() - n * 86400000));

const PERIODS = [
  ['24h', 'Last 24 hours'],
  ['7d', 'Last 7 days'],
  ['day', 'One day'],
  ['range', 'Date range'],
  ['all', 'All time'],
];

// What each file holds, per kind of download. Every file is made on the Pi on
// the farm letterhead, so none needs the internet.
const KINDS = {
  readings: {
    title: 'Sensor data',
    defaultPeriod: '24h',
    path: { pdf: '/api/export/summary.pdf', xlsx: '/api/export/readings.xlsx', csv: '/api/export/readings.csv' },
    hint: {
      pdf: 'Farm status report: averages, each node over the period, alerts and actions. For printing.',
      xlsx: 'Every saved reading (one a minute per node) in Excel.',
      csv: 'Every saved reading as plain CSV.',
    },
  },
  alerts: {
    title: 'CLR alerts',
    defaultPeriod: 'all',
    path: { pdf: '/api/export/alerts.pdf', xlsx: '/api/export/alerts.xlsx', csv: '/api/export/alerts.csv' },
    hint: {
      pdf: 'Each alert with what was done about it. For printing.',
      xlsx: 'Every alert in Excel, with its action and who recorded it.',
      csv: 'Every alert as plain CSV.',
    },
  },
};

const FORMATS = [['pdf', 'PDF'], ['xlsx', 'Excel'], ['csv', 'CSV']];

/// "Download file as" dropdown: PDF, Excel or CSV, for a period and all nodes
/// or one. kind = 'readings' (Analytics) or 'alerts' (Alerts page).
export default function DownloadDataMenu({ kind = 'readings' }) {
  const k = KINDS[kind];
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState('pdf');
  const [period, setPeriod] = useState(k.defaultPeriod);
  const [date, setDate] = useState(phDay());
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(phDay());
  const [node, setNode] = useState('');
  const [nodes, setNodes] = useState([]);
  const box = useRef(null);
  const today = phDay();

  useEffect(() => {
    if (!open) return undefined;
    api.scaleUp()
      .then((r) => setNodes((r.nodes || []).filter((n) => n.status === 'ACTIVE').map((n) => n.node_id).sort()))
      .catch(() => {});
    const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const download = () => {
    const params = { period };
    if (period === 'day') {
      if (!date) return toast.error('Pick a date');
      params.date = date;
    }
    if (period === 'range') {
      if (!from || !to) return toast.error('Pick both dates');
      if (from > to) return toast.error('The start date is after the end date');
      params.from = from;
      params.to = to;
    }
    if (node) params.node_id = node;
    downloadReport(k.path[format], params);
    setOpen(false);
  };

  const nodeLabel = (id) => `Node ${parseInt(id.replace(/\D/g, ''), 10)}`;

  return (
    <div className="dl-wrap" ref={box}>
      <button className="btn ghost sm" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        <IconDownload /> Download file as <IconCaretDown size={14} />
      </button>
      {open && (
        <div className="dl-menu" role="dialog" aria-label={`Download ${k.title.toLowerCase()}`}>
          <p className="dl-title">{k.title}</p>

          <span className="dl-label">File</span>
          <div className="dl-seg">
            {FORMATS.map(([v, l]) => (
              <button key={v} className={format === v ? 'on' : ''} onClick={() => setFormat(v)}>{l}</button>
            ))}
          </div>

          <label className="dl-label" htmlFor={`dl-period-${kind}`}>Period</label>
          <select id={`dl-period-${kind}`} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>

          {period === 'day' && (
            <input type="date" aria-label="Day" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          )}
          {period === 'range' && (
            <div className="dl-range">
              <label>From<input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} /></label>
              <label>To<input type="date" value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
          )}

          <label className="dl-label" htmlFor={`dl-node-${kind}`}>Nodes</label>
          <select id={`dl-node-${kind}`} value={node} onChange={(e) => setNode(e.target.value)}>
            <option value="">All nodes</option>
            {nodes.map((id) => <option key={id} value={id}>{nodeLabel(id)}</option>)}
          </select>

          <p className="dl-hint">
            {k.hint[format]}
            {period === 'all' && format !== 'pdf' && ' All time can be a large file.'}
          </p>
          <button className="btn sm" style={{ width: '100%', justifyContent: 'center' }} onClick={download}>
            <IconDownload /> Download {FORMATS.find(([v]) => v === format)[1]}
          </button>
        </div>
      )}
    </div>
  );
}
