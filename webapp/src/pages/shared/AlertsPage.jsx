import { formatTimestamp } from '../../time';
import { useEffect, useState } from 'react';
import { api, toNum, riskColor } from '../../api';
import { useAuth } from '../../auth';
import { useLiveRefresh } from '../../live';
import RecordActionModal from '../../components/RecordActionModal';
import { useShellNav } from '../../components/shellNav';
import DownloadDataMenu from '../../components/DownloadDataMenu';
import { IconAlerts, IconRefresh, IconCheckCircle, IconChecklist, IconClock } from '../../icons';

const timeAgo = formatTimestamp;
const clock = formatTimestamp;
const span = (from, to) => {
  const h = Math.round((new Date(to) - new Date(from)) / 3600000);
  return h < 1 ? 'under an hour' : h === 1 ? '1 hour' : `${h} hours`;
};
const nodeName = (id) => `Node ${parseInt(String(id).replace(/\D/g, ''), 10) || id}`;

const CLOSED = { cleared: 'Cleared on its own', merged: 'Merged: hourly repeat' };

/// CLR alerts: one open alert per node (updated while the risk lasts), closed
/// by recording what was done; the history keeps every action and note.
export default function AlertsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('open');
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [showMerged, setShowMerged] = useState(false);
  const [recording, setRecording] = useState(null); // alert being acted on
  const [error, setError] = useState('');
  // The agronomist records actions here; field staff record theirs from their
  // Overview. Owner and field staff see this list read-only.
  const canAct = user?.role === 'agronomist';
  // Opened from the bell: show the Open list and bring that alert into view.
  const { focus, clearFocus } = useShellNav();
  const [flash, setFlash] = useState(null);
  useEffect(() => {
    if (focus?.type !== 'alert') return;
    setTab('open');
    let tries = 0;
    const t = setInterval(() => {
      const el = document.getElementById(`alert-${focus.id}`);
      if (el || ++tries > 20) {
        clearInterval(t);
        if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); setFlash(focus.id); setTimeout(() => setFlash(null), 2600); }
        clearFocus();
      }
    }, 150);
    return () => clearInterval(t);
  }, [focus]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    try {
      const [open, past] = await Promise.all([api.alerts(), api.alertHistory(200)]);
      setAlerts(open.data || []);
      setHistory(past.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load alerts');
    }
  };
  useLiveRefresh(load, { fallbackMs: 30000 });

  const shownHistory = history.filter((h) => showMerged || h.closed_reason !== 'merged');
  const mergedCount = history.filter((h) => h.closed_reason === 'merged').length;

  return (
    <div>
      <header className="banner grad-alerts">
        <div className="banner-row">
          <div>
            <h1><IconAlerts /> CLR Alerts</h1>
            <p className="sub">{alerts.length ? `${alerts.length} open, at most one per node` : 'No open alerts'}</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <DownloadDataMenu kind="alerts" />
            <button className="btn ghost sm" onClick={load}><IconRefresh /> Refresh</button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
          {[['open', 'Open'], ['history', 'History']].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                background: 'none', border: 'none', color: 'var(--text)',
                opacity: tab === k ? 1 : 0.6, fontWeight: tab === k ? 700 : 500,
                borderBottom: tab === k ? '3px solid var(--brand)' : '3px solid transparent',
                paddingBottom: 6, fontSize: 13,
              }}
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      <div className="page">
        {error && <p className="error-text">{error}</p>}

        {tab === 'open' && (alerts.length === 0 ? (
          <div className="empty-state"><IconCheckCircle /> No open alerts</div>
        ) : alerts.map((a) => (
          <div className={`alert-card ${flash === a.id ? 'flash' : ''}`} id={`alert-${a.id}`} key={a.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span className="pill" style={{ background: riskColor(a.risk_level) }}>{a.risk_level}</span>
              <strong>{nodeName(a.node_id)}</strong>
              {a.reminded_at && <span className="alert-reminder"><IconClock /> No action for 12 h</span>}
              <span className="muted" style={{ marginLeft: 'auto' }}>opened {timeAgo(a.created_at)}</span>
            </div>
            <p className="muted" style={{ marginBottom: 6 }}>
              Since {clock(a.created_at)}, last seen at risk {clock(a.last_seen_at || a.created_at)}
              {' '}({span(a.created_at, a.last_seen_at || a.created_at)}){a.peak_humidity ? ` · peak humidity ${toNum(a.peak_humidity).toFixed(0)}%` : ''}
            </p>
            <p className="muted" style={{ marginBottom: 8 }}>
              When it opened: {toNum(a.temperature).toFixed(1)}°C • Humidity {toNum(a.humidity).toFixed(0)}% • Soil {toNum(a.soil_pct).toFixed(0)}%
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>{a.alert_message}</p>
            {canAct && (
              <div style={{ textAlign: 'right', marginTop: 10 }}>
                <button className="btn green sm" onClick={() => setRecording(a)}><IconChecklist /> Record action</button>
              </div>
            )}
          </div>
        )))}

        {tab === 'history' && (
          <>
            {mergedCount > 0 && (
              <label className="muted" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 13 }}>
                <input type="checkbox" checked={showMerged} onChange={(e) => setShowMerged(e.target.checked)} />
                Show {mergedCount} merged hourly repeats
              </label>
            )}
            {shownHistory.length === 0 ? (
              <div className="empty-state">Nothing closed yet</div>
            ) : shownHistory.map((h) => (
              <div className="alert-card" key={h.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span className="pill" style={{ background: riskColor(h.risk_level) }}>{h.risk_level}</span>
                  <strong>{nodeName(h.node_id)}</strong>
                  <span className="muted">{clock(h.created_at)}</span>
                  <span className="muted" style={{ marginLeft: 'auto' }}>closed {timeAgo(h.resolved_at || h.created_at)}</span>
                </div>
                {h.action ? (
                  <div className="alert-action">
                    <strong>{h.action_label}</strong>
                    <p>{h.note}</p>
                    <p className="muted">
                      by {h.done_by}{h.done_by_role ? ` (${String(h.done_by_role).replace('_', ' ')})` : ''} · {clock(h.resolved_at)}
                      {h.quiet_until ? ` · quiet until ${clock(h.quiet_until)}` : ''}
                    </p>
                  </div>
                ) : (
                  <p className="muted">
                    {CLOSED[h.closed_reason] || 'Closed before action notes existed'}
                    {h.merged_into ? ` into alert #${h.merged_into}` : ''}
                  </p>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {recording && (
        <RecordActionModal
          nodeId={recording.node_id}
          nodeName={nodeName(recording.node_id)}
          role={user?.role}
          lang="en"
          onClose={() => setRecording(null)}
          onSaved={() => { setRecording(null); load(); }}
        />
      )}
    </div>
  );
}
