import { parseTimestamp, formatTime, formatTimestamp, formatDate } from '../time';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../api';
import AboutClrRisk from './AboutClrRisk';
import { useLiveRefresh, useLiveStatus, onLive } from '../live';
import { toast } from '../ui';
import Fresh from './Fresh';
import { ShellNavContext } from './shellNav';
import NotificationPanel from './NotificationPanel';
import { BrandMark, IconAlerts, IconSignOut } from '../icons';

const ROLE_NAMES = {
  admin: 'Admin',
  agronomist: 'Agronomist',
  farm_owner: 'Farm Owner',
  field_staff: 'Field Staff',
};

/// Wide screens: dark-green sidebar + white top bar (panel suggestion,
/// Sept 2026). Narrow screens keep the original bottom navigation.
/// Logout still goes through the confirmation dialog.
export default function Shell({ role, meta }) {
  const [tab, setTab] = useState(meta.tabs[0].key);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [openAlerts, setOpenAlerts] = useState([]);
  const alertCount = openAlerts.length;
  const [notifOpen, setNotifOpen] = useState(false);
  const [focus, setFocus] = useState(null); // { type: 'alert', id } for the Alerts page
  const seenKey = `fsb_notif_seen_${role}`;
  const [seenBefore, setSeenBefore] = useState(() => { try { return Number(localStorage.getItem(seenKey)) || 0; } catch { return 0; } });
  const [lastReading, setLastReading] = useState(null);
  // Farm clock in the top bar: ticks every second, separate from the latest reading.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const [signedOut, setSignedOut] = useState(false);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const active = meta.tabs.find((t) => t.key === tab) ?? meta.tabs[0];
  const hasAlertsTab = meta.tabs.some((t) => t.key === 'alerts');

  // Top-bar status: time the Pi last heard from any node, and the alert count
  // for roles that have an Alerts tab. Refreshed on pushes (see live.js), on
  // tab return, and every 15 s as a safety net; live samples move it every 2 s.
  const loadStatus = async () => {
    try {
      const latest = await api.sensorLatest();
      const times = (latest.data || [])
        .map((s) => parseTimestamp(s.last_seen || s.recorded_at)?.getTime())
        .filter(Number.isFinite);
      setLastReading(times.length ? new Date(Math.max(...times)) : null);
    } catch {
      /* keep the last value */
    }
    if (hasAlertsTab) {
      try {
        const res = await api.alerts();
        setOpenAlerts(res.data || []);
      } catch {
        /* keep the last value */
      }
    }
  };
  useLiveRefresh(loadStatus);
  const pushOn = useLiveStatus();

  // Say which nodes just came online or went offline (grouped, so unplugging
  // several boxes at once gives one message) and which new box registered, so
  // a board can be identified by powering it on or unplugging it.
  useEffect(() => {
    const num = (id) => parseInt(String(id || '').replace(/\D/g, ''), 10) || '?';
    const changes = { on: new Set(), off: new Set() };
    let timer = null;
    const flush = () => {
      timer = null;
      const list = (set) => [...set].sort((a, b) => a - b).join(', ');
      const off = changes.off.size, on = changes.on.size;
      if (off) toast.warning(`${off > 1 ? 'Nodes' : 'Node'} ${list(changes.off)} went offline`);
      else if (on) toast.info(`${on > 1 ? 'Nodes' : 'Node'} ${list(changes.on)} ${on > 1 ? 'are' : 'is'} online`);
      changes.on.clear();
      changes.off.clear();
    };
    const off = onLive((type, data) => {
      if (type === 'node_live' && data?.at) setLastReading(parseTimestamp(data.at));
      if (type === 'alert' && data?.node_id && ['new', 'raised', 'reminder'].includes(data.kind)) {
        const node = `Node ${num(data.node_id)}`;
        if (data.kind === 'reminder') toast.warning(`${node}: ${data.level || 'HIGH'} alert still has no action after 12 hours`);
        else toast.warning(`${node}: ${data.kind === 'raised' ? 'risk rose to' : 'new'} ${data.level} CLR alert`);
      }
      if (type === 'node_status' && data?.node_id) {
        const n = num(data.node_id);
        (data.online ? changes.on : changes.off).add(n);
        (data.online ? changes.off : changes.on).delete(n);
        if (!timer) timer = setTimeout(flush, 800);
      }
      if (type === 'device' && data?.registered) {
        toast.success(data.kind === 'valve' ? 'New valve box registered' : `New sensor box registered as Node ${num(data.node_id)}`);
      }
    });
    return () => { off(); if (timer) clearTimeout(timer); };
  }, []);

  // A request came back "signed out": say so instead of showing old numbers.
  useEffect(() => {
    const onSignedOut = () => setSignedOut(true);
    window.addEventListener('farmsense:signed-out', onSignedOut);
    return () => window.removeEventListener('farmsense:signed-out', onSignedOut);
  }, []);

  // Bell dropdown. Closing it marks everything shown as seen (no more blue dots).
  const closeNotif = useCallback(() => {
    setNotifOpen(false);
    const now = Date.now();
    setSeenBefore(now);
    try { localStorage.setItem(seenKey, String(now)); } catch { /* storage blocked */ }
  }, [seenKey]);
  const openAlert = (id) => { closeNotif(); setFocus({ type: 'alert', id, at: Date.now() }); setTab('alerts'); };
  const unseen = openAlerts.filter((a) => Date.parse(a.created_at) > seenBefore).length;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const name = user?.full_name || user?.username || ROLE_NAMES[role];
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app-shell" style={{ '--accent': meta.accent }}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><BrandMark size={24} /></div>
          <div>
            <div className="brand-name">FarmSense Brew</div>
            <div className="brand-sub">CLR Monitoring System</div>
          </div>
        </div>
        <nav className="side-nav">
          {meta.tabs.map((t) => (
            <button
              key={t.key}
              className={t.key === tab ? 'active' : ''}
              onClick={() => setTab(t.key)}
            >
              <span className="ico">{t.icon}</span>
              <span className="lbl">{t.label}</span>
              {t.key === 'alerts' && alertCount > 0 && <span className="nav-badge">{alertCount}</span>}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          {role !== 'admin' && (
            <AboutClrRisk />
          )}
          <button className="side-logout" onClick={() => setConfirmLogout(true)}>
            <span className="ico"><IconSignOut /></span> Log out
          </button>
        </div>
      </aside>

      <div className="shell-main">
        <div className="topbar">
          <div className="topbar-brand" aria-hidden="true">
            <span className="topbar-brand-mark"><BrandMark size={20} /></span>
            <span>FarmSense Brew</span>
          </div>
          <div className="topbar-left">
            {ROLE_NAMES[role]} workspace <span className="muted-dot">·</span> Javier Permaculture Farm
          </div>
          <div className="topbar-right">
            {(
              <div
                className="sync"
                title={pushOn ? 'Live: new readings appear the moment the Pi receives them' : 'Reconnecting to the Pi'}
              >
                <span className={`live-dot ${pushOn ? 'on' : ''}`} />
                <div>
                  <div className="sync-label">
                    {pushOn ? 'Live' : 'Reconnecting…'} · {formatDate(now)} · <time>{formatTime(now)} PHT</time>
                  </div>
                  <div className="sync-time">
                    {lastReading ? (
                      <>Latest reading: <Fresh>{formatTimestamp(lastReading)}</Fresh></>
                    ) : 'No readings yet'}
                  </div>
                </div>
              </div>
            )}
            {hasAlertsTab && (
              <div className="bell-wrap">
                <button
                  className={`bell ${notifOpen ? 'on' : ''}`}
                  onClick={() => (notifOpen ? closeNotif() : setNotifOpen(true))}
                  title="Notifications"
                  aria-expanded={notifOpen}
                >
                  <IconAlerts size={21} />
                  {alertCount > 0 && <span className={`bell-badge ${unseen ? 'new' : ''}`}>{alertCount}</span>}
                </button>
                {notifOpen && (
                  <NotificationPanel
                    alerts={openAlerts}
                    seenBefore={seenBefore}
                    onOpenAlert={openAlert}
                    onSeeAll={() => { closeNotif(); setFocus(null); setTab('alerts'); }}
                    onClose={closeNotif}
                  />
                )}
              </div>
            )}
            <div className="user-chip">
              <div className="avatar">{initials}</div>
              <div>
                <div className="user-name">{name}</div>
                <div className="user-role">{ROLE_NAMES[role]}</div>
              </div>
            </div>
          </div>
        </div>
        {(
          <div className="topbar-sub">
            <span className={`live-dot ${pushOn ? 'on' : ''}`} />
            <span className="topbar-sub-label">
              {pushOn ? 'Live' : 'Reconnecting…'} · {formatDate(now)} · {formatTime(now)} PHT
            </span>
            <span className="topbar-sub-time">
              {lastReading ? <>Latest reading: <Fresh>{formatTimestamp(lastReading)}</Fresh></> : 'No readings yet'}
            </span>
          </div>
        )}
        <div className="shell-body">
          <ShellNavContext.Provider value={{ goTo: setTab, tabs: meta.tabs, focus, clearFocus: () => setFocus(null) }}>
            {active.element}
          </ShellNavContext.Provider>
        </div>
      </div>

      <nav className="bottom-nav">
        {meta.tabs.map((t) => (
          <button
            key={t.key}
            className={t.key === tab ? 'active' : ''}
            onClick={() => setTab(t.key)}
          >
            <span className="ico">{t.icon}</span>
            {t.short || t.label}
          </button>
        ))}
        <button onClick={() => setConfirmLogout(true)}>
          <span className="ico"><IconSignOut /></span>
          Log out
        </button>
      </nav>

      {signedOut && (
        <div className="modal-backdrop">
          <div className="modal" role="alertdialog" aria-labelledby="signed-out-title">
            <h2 id="signed-out-title">You were signed out</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
              This account signed in on another device or browser, or the session expired,
              so this screen stopped getting new readings. Sign in again to see live data.
            </p>
            <div className="modal-actions">
              <button className="btn green" onClick={async () => { await logout(); navigate(`/${role}/login`); }}>
                Sign in again
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmLogout && (
        <div className="modal-backdrop" onClick={() => setConfirmLogout(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Log out?</h2>
            <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
              {user?.full_name ? `${user.full_name}, you` : 'You'} will be signed
              out of FarmSense Brew and returned to the home page.
            </p>
            <div className="modal-actions">
              <button className="btn ghost" onClick={() => setConfirmLogout(false)}>
                Cancel
              </button>
              <button className="btn red" onClick={handleLogout}>
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
