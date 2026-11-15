import { lastSeenLabel, sensorNote } from '../nodes';

export default function OverviewNodeSelector({ nodes, value, onChange }) {
  const selected = nodes.find(n => n.nodeId === value);
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <label htmlFor="overview-node" style={{ fontWeight: 600 }}>Overview readings </label>
      <select id="overview-node" value={value} onChange={e => onChange(e.target.value)} style={{ margin: '0 8px', padding: 8, maxWidth: '100%' }}>
        <option value="all">All nodes</option>
        {nodes.map(n => <option key={n.nodeId} value={n.nodeId}>{n.name}{n.boxOnline ? '' : ' (Offline)'}</option>)}
      </select>
      <p className="muted" style={{ marginTop: 10, marginBottom: 0 }} data-testid="overview-node-detail">
        {value === 'all' ? 'Cards show averages from online nodes. Charts and recommendations cover the farm.'
          : selected ? `${selected.name} · ${selected.nodeId} · ${selected.boxOnline ? 'Online' : 'Offline'} · Last reading: ${lastSeenLabel(selected)}. ${sensorNote(selected) || ''}`
          : 'This node is no longer available.'}
      </p>
    </div>
  );
}
