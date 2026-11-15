import { useEffect, useState } from 'react';
import { api } from '../api';
import { toast } from '../ui';
import { IconClose, IconSettings, IconAdd } from '../icons';

/// "Scale Up System" modal: registers a new sensor node. One 50 sqm plot holds
/// NODES_PER_PLOT nodes (NW, NE, Centre, SW, SE), so the area covered is
/// whole plots: 5 nodes = 50 sqm, the 6th node starts a second plot.
/// ("Zone" is kept for the 3 irrigation valve areas.)
/// Mirrors the Flutter ScaleUpModal: suggested name is the highest
/// existing node number + 1 (numbers are never reused). No readings are
/// entered here: the new node stays offline until its sensor box posts.
const PLOT_SQM = 50;
const NODES_PER_PLOT = 5;
const plotsFor = (nodes) => Math.ceil(nodes / NODES_PER_PLOT);

export default function ScaleUpModal({ onClose, onAdded }) {
  const [zoneName, setZoneName] = useState('Node …');
  const [zoneCount, setZoneCount] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .scaleUp()
      .then((data) => {
        const nodes = data.nodes || [];
        let maxNum = 0;
        for (const n of nodes) {
          const num = parseInt(String(n.node_id).replace(/\D/g, ''), 10) || 0;
          if (num > maxNum) maxNum = num;
        }
        setZoneCount(nodes.length);
        setZoneName(`Node ${maxNum + 1}`);
      })
      .catch(() => setZoneName('Node 6'));
  }, []);

  const addZone = async () => {
    if (!zoneName.trim()) {
      toast.error('Node name is required');
      return;
    }
    setBusy(true);
    try {
      const res = await api.registerZone({ zone_name: zoneName.trim() });
      toast.success(res.message || `${zoneName} registered`);
      onAdded?.();
      onClose();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ padding: 0, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: 'var(--leaf-deep)', color: '#fff', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, color: '#fff' }}>Scale Up System</h2>
              <p style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Add a new sensor node</p>
            </div>
            <button className="btn ghost sm" style={{ background: 'transparent', color: '#fff', border: 'none', fontSize: 18 }} onClick={onClose} title="Close">
              <IconClose />
            </button>
          </div>
        </div>

        <div style={{ padding: 24 }}>
          {/* Info box */}
          <div className="callout leaf" style={{ marginBottom: 18 }}>
            <strong style={{ color: 'var(--owner)', fontSize: 14 }}><IconSettings style={{ verticalAlign: '-3px' }} /> System scalability</strong>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.5 }}>
              FarmSense Brew supports modular expansion. Each new node is one sensor box (ESP32 with a
              a temperature and humidity sensor and a soil moisture sensor). One {PLOT_SQM} sqm plot holds {NODES_PER_PLOT} nodes,
              so every {NODES_PER_PLOT} more nodes cover another {PLOT_SQM} sqm plot. New nodes appear on all
              dashboards, irrigation and analytics by themselves.
            </p>
          </div>

          <div className="field">
            <label>Node Name</label>
            <input value={zoneName} onChange={(e) => setZoneName(e.target.value)} />
            <p className="muted" style={{ marginTop: 6 }}>
              The new node shows grey (offline) until its sensor box sends its first reading.
            </p>
          </div>

          {/* Current system status */}
          <div className="card" style={{ background: 'var(--bg)', marginBottom: 0 }}>
            <strong style={{ fontSize: 14 }}>Current System Status</strong>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
              <div>
                <p className="muted">Sensor Nodes</p>
                <p style={{ fontSize: 22, fontWeight: 800 }}>{zoneCount}</p>
              </div>
              <div>
                <p className="muted">After Adding</p>
                <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--owner)' }}>{zoneCount + 1}</p>
              </div>
              <div>
                <p className="muted">Area Covered</p>
                <p style={{ fontSize: 18, fontWeight: 800 }}>{plotsFor(zoneCount) * PLOT_SQM} sqm</p>
                <p className="muted" style={{ fontSize: 11 }}>{plotsFor(zoneCount)} plot{plotsFor(zoneCount) === 1 ? '' : 's'} of {PLOT_SQM} sqm</p>
              </div>
              <div>
                <p className="muted">After Adding</p>
                <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--owner)' }}>{plotsFor(zoneCount + 1) * PLOT_SQM} sqm</p>
                <p className="muted" style={{ fontSize: 11 }}>
                  {plotsFor(zoneCount + 1) > plotsFor(zoneCount)
                    ? `Node ${zoneCount + 1} starts plot ${plotsFor(zoneCount + 1)}`
                    : `Same plot (${(zoneCount + 1) % NODES_PER_PLOT || NODES_PER_PLOT} of ${NODES_PER_PLOT} nodes)`}
                </p>
              </div>
            </div>
          </div>

          <div className="modal-actions">
            <button className="btn ghost" onClick={onClose}>Cancel</button>
            <button className="btn green" disabled={busy} onClick={addZone}>
              {busy ? 'Adding…' : <><IconAdd weight="bold" /> Add node</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
