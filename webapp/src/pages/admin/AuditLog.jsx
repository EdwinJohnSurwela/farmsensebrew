import { formatTimestamp } from '../../time';
import { useEffect, useState } from 'react';
import { api, downloadReport } from '../../api';
import {
  IconAdd, IconEdit, IconRemove, IconKey, IconSync, IconMail, IconCheckCircle, IconBlocked, IconUnlock, IconLock,
  IconReport, IconSignIn, IconSignOut, IconBoxes, IconPower, IconInfo, IconAudit, IconDownload, IconRefresh,
} from '../../icons';

const ACTION_META = {
  USER_CREATED: { icon: <IconAdd />, color: '#3b7d46', label: 'Created' },
  USER_UPDATED: { icon: <IconEdit />, color: '#2a6479', label: 'Updated' },
  USER_DELETED: { icon: <IconRemove />, color: '#a8322a', label: 'Deleted' },
  PASSWORD_CHANGED: { icon: <IconKey />, color: '#6b4a30', label: 'Password' },
  PASSWORD_RESET: { icon: <IconSync />, color: '#6b4a30', label: 'Reset' },
  RESET_REQUESTED: { icon: <IconMail />, color: '#a36b10', label: 'Reset Req.' },
  RESET_APPROVED: { icon: <IconCheckCircle />, color: '#3b7d46', label: 'Reset OK' },
  RESET_REJECTED: { icon: <IconBlocked />, color: '#a8322a', label: 'Reset Denied' },
  ACCESS_GRANTED: { icon: <IconUnlock />, color: '#3b7d46', label: 'Granted' },
  ACCESS_REVOKED: { icon: <IconLock />, color: '#a36b10', label: 'Revoked' },
  REPORT_EXPORT: { icon: <IconReport />, color: '#2a6479', label: 'Export' },
  LOGIN: { icon: <IconSignIn />, color: '#3b7d46', label: 'Sign in' },
  LOGOUT: { icon: <IconSignOut />, color: '#847d6d', label: 'Sign out' },
  SESSION_DISPLACED: { icon: <IconSync />, color: '#a36b10', label: 'Replaced' },
  SENSOR_BOX_MOVED: { icon: <IconBoxes />, color: '#2a6479', label: 'Box moved' },
  SENSOR_BOX_RELEASED: { icon: <IconBoxes />, color: '#a8322a', label: 'Box released' },
  SENSOR_BOX_NEW_KEY: { icon: <IconBoxes />, color: '#6b4a30', label: 'Box key' },
  SERVER_SHUTDOWN: { icon: <IconPower />, color: '#a8322a', label: 'Shutdown' },
};

const timeAgo = formatTimestamp;

/// Audit Log — account lifecycle events, mirrors the Flutter screen.
export default function AuditLog() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const res = await api.auditLog(200);
      setEvents(res.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load audit log');
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = filter === 'ALL' ? events : events.filter((e) => e.action === filter);

  return (
    <div>
      <header className="banner grad-admin">
        <div className="banner-row">
          <div>
            <h1><IconAudit /> Audit Log</h1>
            <p className="sub">{events.length} recorded events</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost sm" onClick={() => downloadReport('/api/export/audit.csv')}>
              <IconDownload /> Audit CSV
            </button>
            <button className="btn ghost sm" onClick={() => downloadReport('/api/export/users.csv')}>
              <IconDownload /> Users CSV
            </button>
            <button className="btn ghost sm" onClick={load}><IconRefresh /> Refresh</button>
          </div>
        </div>
        <div className="chip-row" style={{ marginTop: 12, '--accent': 'var(--admin)' }}>
          {['ALL', ...Object.keys(ACTION_META)].map((a) => (
            <button
              key={a}
              className={`chip ${filter === a ? 'active' : ''}`}
              onClick={() => setFilter(a)}
            >
              {a === 'ALL' ? 'ALL' : ACTION_META[a].label.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <div className="page">
        {error && <p className="error-text">{error}</p>}
        {filtered.length === 0 ? (
          <div className="empty-state">No events for this filter</div>
        ) : (
          filtered.map((e) => {
            const meta = ACTION_META[e.action] || { icon: <IconInfo />, color: 'var(--muted)', label: e.action };
            return (
              <div className="alert-card" key={e.id}>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: `${meta.color}1a`, display: 'flex',
                      alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}
                  >
                    {meta.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="pill" style={{ background: `${meta.color}1a`, color: meta.color }}>
                        {(e.action || '').replace(/_/g, ' ')}
                      </span>
                      <strong style={{ fontSize: 14 }}>{e.target}</strong>
                      <span className="muted" style={{ marginLeft: 'auto' }}>{timeAgo(e.created_at)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{e.details}</p>
                    {e.actor && <p className="muted" style={{ marginTop: 2 }}>by {e.actor}</p>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
