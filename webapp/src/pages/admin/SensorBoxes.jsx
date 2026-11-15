import { useState } from 'react';
import { api } from '../../api';
import { toast, confirmDialog } from '../../ui';
import { useLiveRefresh, Ago } from '../../live';
import { IconBoxes } from '../../icons';

const POSITION = { NW_CORNER: 'NW', NE_CORNER: 'NE', CENTER: 'Centre', SW_CORNER: 'SW', SE_CORNER: 'SE' };
const nodeNum = (id) => parseInt(String(id || '').replace(/\D/g, ''), 10) || 0;
const nodeName = (id, position) => {
  const p = POSITION[position];
  return `Node ${nodeNum(id)}${p ? ` (${p})` : ''}`;
};
const toDate = (v) => (v ? new Date(v) : null);

/// Admin > Sensor Boxes: every ESP32 the Pi knows, by hardware ID. A new box
/// gets the lowest free node number by itself; here an admin can see which
/// board is which node, move a board to another node, release a node for a
/// replacement board, or give a board a new key.
export default function SensorBoxes() {
  const [boxes, setBoxes] = useState([]);
  const [freeNodes, setFreeNodes] = useState([]);
  const [boxless, setBoxless] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = async () => {
    try {
      const res = await api.adminDevices();
      setBoxes(res.data || []);
      setFreeNodes(res.free_nodes || []);
      setBoxless(res.nodes_without_box || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load the sensor boxes');
    }
  };
  useLiveRefresh(load);

  const act = async (key, fn, done) => {
    setBusy(key);
    try {
      await fn();
      toast.success(done);
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy('');
    }
  };

  const release = async (b) => {
    const what = b.kind === 'valve' ? 'the valve box' : nodeName(b.node_id, b.position);
    const ok = await confirmDialog({
      title: `Release ${what}?`,
      text: `Box ${b.box_id} is forgotten. The next new board that connects takes this place. Readings already saved stay.`,
      confirmText: 'Release',
      danger: true,
    });
    if (ok) act(`rel-${b.device_id}`, () => api.releaseDevice(b.device_id), `${what} released`);
  };

  const move = (b, nodeId) =>
    act(`mov-${b.device_id}`, () => api.assignDevice(b.device_id, nodeId), `Box ${b.box_id} is now ${nodeName(nodeId)}`);

  const newKey = async (b) => {
    const ok = await confirmDialog({
      title: `New key for box ${b.box_id}?`,
      text: 'Use this if the board was wiped or replaced its memory. It gets a new key the next time it starts or reconnects.',
      confirmText: 'Give new key',
    });
    if (ok) act(`key-${b.device_id}`, () => api.newDeviceKey(b.device_id), 'The box gets a new key when it next connects');
  };

  const removeNode = async (n) => {
    const what = nodeName(n.node_id, n.position);
    const ok = await confirmDialog({
      title: `Remove ${what}?`,
      text: `${what} has no sensor box and no saved readings. It disappears from every dashboard, and the next node added with Scale Up can take its number. This is recorded in the audit log.`,
      confirmText: 'Remove node',
      danger: true,
    });
    if (ok) act(`rm-${n.node_id}`, () => api.deleteNode(n.node_id), `${what} removed`);
  };

  const nodes = boxes.filter((b) => b.kind === 'node');
  const valve = boxes.find((b) => b.kind === 'valve');

  return (
    <div>
      <header className="banner grad-admin" style={{ paddingBottom: 14 }}>
        <div className="banner-row">
          <div>
            <h1><IconBoxes /> Sensor Boxes</h1>
            <p className="sub">Each ESP32 is recognised by its hardware ID and keeps its node number</p>
          </div>
        </div>
      </header>

      <div className="page">
        {error && <div className="card" style={{ color: 'var(--red)' }}>{error}</div>}

        <div className="card">
          <h3>How a new box joins</h3>
          <ol style={{ margin: '6px 0 0', paddingLeft: 20, fontSize: 13, color: 'var(--text-2)', display: 'grid', gap: 4 }}>
            <li>Upload the <code>esp32_field_node</code> sketch (with <code>NODE_ID 0</code>) and power the board on the farm WiFi.</li>
            <li>The Pi gives it the lowest free node number: {freeNodes.length ? <strong>{freeNodes.map((n) => nodeName(n)).join(', ')}</strong> : <strong>none free right now</strong>}.</li>
            <li>The board blinks its number slowly (3 slow blinks = Node 3). Label it, then install it at that post.</li>
          </ol>
          {!freeNodes.length && (
            <p style={{ fontSize: 13, marginTop: 8 }}>
              Every node has a box, so new boards are refused. Release a node below to swap in a replacement board.
            </p>
          )}
        </div>

        <div className="card table-wrap">
          <h3>Registered boxes</h3>
          {nodes.length === 0 && !valve ? (
            <div className="empty-state">No box has signed on yet.</div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>NODE</th><th>BOX ID</th><th>STATUS</th><th>LAST CONTACT</th><th>REGISTERED</th><th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((b) => {
                  const online = b.online; // decided by the Pi
                  return (
                    <tr key={b.device_id}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{nodeName(b.node_id, b.position)}</td>
                      <td style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{b.box_id}</td>
                      <td className={online ? 'status-online' : 'status-offline'}>
                        {online ? (b.live ? 'Live' : 'Sending readings') : 'Offline'}
                        {!b.has_key && <div className="muted" style={{ fontSize: 11 }}>new key pending</div>}
                      </td>
                      <td>{b.last_seen ? <Ago date={toDate(b.last_seen)} /> : 'Never'}</td>
                      <td>{toDate(b.first_seen)?.toLocaleDateString([], { month: 'short', day: 'numeric' })}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                          {freeNodes.length > 0 && (
                            <select
                              aria-label={`Move box ${b.box_id} to another node`}
                              value=""
                              disabled={!!busy}
                              onChange={(e) => e.target.value && move(b, e.target.value)}
                              style={{ padding: '4px 6px', borderRadius: 8, border: '1px solid var(--border)' }}
                            >
                              <option value="">Move to…</option>
                              {freeNodes.map((n) => <option key={n} value={n}>{nodeName(n)}</option>)}
                            </select>
                          )}
                          <button className="btn ghost sm" disabled={!!busy} onClick={() => newKey(b)}>New key</button>
                          <button className="btn red sm" disabled={!!busy} onClick={() => release(b)}>Release</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {valve && (() => {
                  const seen = toDate(valve.last_seen);
                  const connected = seen && Date.now() - seen.getTime() < 2 * 60 * 1000;
                  return (
                    <tr key={valve.device_id}>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>Valve box</td>
                      <td style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{valve.box_id}</td>
                      <td className={connected ? 'status-online' : 'status-offline'}>{connected ? 'Connected' : 'Offline'}</td>
                      <td>{seen ? <Ago date={seen} /> : 'Never'}</td>
                      <td>{toDate(valve.first_seen)?.toLocaleDateString([], { month: 'short', day: 'numeric' })}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn ghost sm" disabled={!!busy} onClick={() => newKey(valve)}>New key</button>
                          <button className="btn red sm" disabled={!!busy} onClick={() => release(valve)}>Release</button>
                        </div>
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          )}
        </div>

        {boxless.length > 0 && (
          <div className="card table-wrap">
            <h3>Nodes without a box</h3>
            <p className="muted" style={{ marginTop: 4 }}>
              A node added with Scale Up waits here until a board signs on. One that never saved a reading can be removed.
              A node with readings is kept: its readings are study data.
            </p>
            <table className="data">
              <thead>
                <tr><th>NODE</th><th>NOTE</th><th>SAVED READINGS</th><th>ACTIONS</th></tr>
              </thead>
              <tbody>
                {boxless.map((n) => (
                  <tr key={n.node_id}>
                    <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{nodeName(n.node_id, n.position)}</td>
                    <td className="muted">{n.description || ''}</td>
                    <td>{n.readings.toLocaleString()}</td>
                    <td>
                      {n.readings === 0
                        ? <button className="btn red sm" disabled={!!busy} onClick={() => removeNode(n)}>Remove node</button>
                        : <span className="muted" style={{ fontSize: 12 }}>Kept (has study data)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
