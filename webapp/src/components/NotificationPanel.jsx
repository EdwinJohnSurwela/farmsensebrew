import { formatTimestamp } from '../time';
import { useEffect, useRef } from 'react';
import { riskColor } from '../api';
import { IconAlerts, IconCaretRight, IconCheckCircle, IconClock } from '../icons';

const nodeName = (id) => `Node ${parseInt(String(id).replace(/\D/g, ''), 10) || id}`;
const timeAgo = formatTimestamp;
// "CLR risk CRITICAL at NODE_01: 27.7°C and 98.7% ..." -> the part after the colon
const summary = (msg = '') => {
  const i = msg.indexOf(':');
  const s = i > 0 && i < 40 ? msg.slice(i + 1).trim() : msg;
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/// Bell dropdown (YouTube-style): the open CLR alerts at a glance. Picking one
/// opens the Alerts module scrolled to that alert; "See all alerts" opens it.
/// A blue dot marks alerts that started after the panel was last opened.
export default function NotificationPanel({ alerts, seenBefore, onOpenAlert, onSeeAll, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.('.bell')) onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="notif-panel" ref={ref} role="dialog" aria-label="Notifications">
      <div className="notif-head">
        <span>Notifications</span>
        <span className="notif-count">{alerts.length} open</span>
      </div>
      <div className="notif-list">
        {alerts.length === 0 ? (
          <div className="notif-empty"><IconCheckCircle size={22} /> No open alerts</div>
        ) : alerts.map((a) => {
          const unread = seenBefore && Date.parse(a.created_at) > seenBefore;
          return (
            <button key={a.id} className="notif-item" onClick={() => onOpenAlert(a.id)}>
              <span className={`notif-dot ${unread ? 'on' : ''}`} aria-label={unread ? 'new' : undefined} />
              <span className="notif-icon" style={{ background: `${riskColor(a.risk_level)}1f`, color: riskColor(a.risk_level) }}>
                <IconAlerts size={18} />
              </span>
              <span className="notif-body">
                <span className="notif-title">
                  <span className="notif-level" style={{ color: riskColor(a.risk_level) }}>{a.risk_level}</span>
                  {nodeName(a.node_id)}
                </span>
                <span className="notif-text">{summary(a.alert_message || a.message)}</span>
                <span className="notif-meta">
                  opened {timeAgo(a.created_at)}
                  {a.reminded_at && <> · <IconClock size={12} style={{ verticalAlign: '-2px' }} /> no action for 12 h</>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <button className="notif-all" onClick={onSeeAll}>See all alerts <IconCaretRight size={14} /></button>
    </div>
  );
}
