import { useEffect, useRef, useState } from 'react';
import { api } from '../../api';
import { toast } from '../../ui';
import { IconPower, IconWarning, IconServer, IconRefresh } from '../../icons';

const CONFIRM_WAIT = 10;      // seconds before Confirm can be pressed
const GIVE_UP_AFTER = 60;     // seconds: still answering by then = the shutdown or restart failed
const SETTLE = 20;            // seconds to let it finish after the server stops answering
const COME_BACK_NOTICE = 300; // seconds: a restart not back by then = tell the admin (the page keeps checking)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// A request to a server that is going down can hang for minutes: cap it.
const withTimeout = (promise, ms) =>
  Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

const uptimeLabel = (s) => {
  if (s == null) return '—';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
};

// true if the FarmSense server still answers within 1.5 s
async function serverAnswers() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 1500);
  try {
    const r = await fetch(`/health?ts=${Date.now()}`, { cache: 'no-store', signal: ctl.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/// Raspberry Pi 4 Server: shows the server's health, restarts it, or shuts it
/// down properly and tells the admin when it is safe to unplug (same steps as
/// RESTART_PI.bat and SHUTDOWN_PI.bat, done from the browser). Every wait has
/// a limit and ends in a clear BACK, OFF or FAILED message.
export default function ServerPage() {
  const [status, setStatus] = useState(null);
  const [reachable, setReachable] = useState(true);
  const [asking, setAsking] = useState(null);   // null | 'shutdown' | 'restart'
  const [mode, setMode] = useState('shutdown'); // which one is running or ran last
  // idle | sending | waiting | settling | off | returning | back | failed
  const [phase, setPhase] = useState('idle');
  const [lines, setLines] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [settleLeft, setSettleLeft] = useState(SETTLE);
  const stop = useRef(false);

  const ready = phase === 'idle' || phase === 'failed' || phase === 'back';
  useEffect(() => {
    const load = () =>
      withTimeout(api.serverStatus(), 5000)
        .then((s) => { setStatus(s); setReachable(true); })
        .catch(() => setReachable(false));
    load();
    const t = setInterval(() => { if (ready) load(); }, 15000);
    return () => clearInterval(t);
  }, [ready]);
  useEffect(() => () => { stop.current = true; }, []);   // leaving the page stops the wait

  const say = (text, tone) => setLines((l) => [...l, { text, tone }]);

  const run = async (action) => {
    const restart = action === 'restart';
    const word = restart ? 'restart' : 'shutdown';
    setAsking(null);
    setMode(action);
    setPhase('sending');
    setLines([]);
    setElapsed(0);
    say(`Sending the ${word} to the Raspberry Pi ...`);
    let prevAt = null;
    try {
      const r = await withTimeout(restart ? api.restartServer() : api.shutdownServer(), 10000);
      prevAt = r?.previous_result_at ?? null;
    } catch (err) {
      if (err.status === undefined) {
        say("FAILED: can't reach the Pi from this device. The Pi is still on.", 'red');
        say('Check that this phone or laptop is on the farm Wi-Fi, then press the button again.');
      } else {
        say(`FAILED: the Pi refused the ${word} (${err.message}). It is still on.`, 'red');
      }
      setPhase('failed');
      return;
    }

    setPhase('waiting');
    say(`${restart ? 'Restart' : 'Shutdown'} sent. Waiting for the Pi to stop answering ...`);
    const started = Date.now();
    let quiet = 0;
    let checks = 0;
    while (!stop.current) {
      const secs = Math.round((Date.now() - started) / 1000);
      setElapsed(secs);
      if (secs >= GIVE_UP_AFTER) break;
      const up = await serverAnswers();
      quiet = up ? 0 : quiet + 1;
      if (quiet >= 3) break;
      if (up && ++checks % 2 === 0) {
        // Still up: did the Pi's power service turn the request down?
        try {
          const s = await withTimeout(api.serverStatus(), 2500);
          const r = s?.shutdown_result;
          if (r && r.at !== prevAt && r.result === 'ignored') {
            say(`FAILED: the Pi did not ${restart ? 'restart' : 'shut down'}. ${r.reason}`, 'red');
            say(restart ? 'The Pi is still on and working.' : 'The Pi is still on. Do NOT unplug it.');
            setPhase('failed');
            return;
          }
        } catch { /* going down, or busy: keep waiting */ }
      }
      await sleep(2000);
    }
    if (stop.current) return;
    if (quiet < 3) {
      say(restart
        ? `FAILED: the Pi is still running after ${GIVE_UP_AFTER} seconds, so it did not restart.`
        : `FAILED: the Pi is still running after ${GIVE_UP_AFTER} seconds. Do NOT unplug it.`, 'red');
      say(`Press the button again. If it fails twice, the ${word} service on the Pi needs checking.`);
      setPhase('failed');
      return;
    }

    if (restart) {
      // Down: now wait for it to come back by itself.
      setPhase('returning');
      setElapsed(0);
      say('It stopped answering and is starting again. Waiting for FarmSense to come back ...');
      const down = Date.now();
      let warned = false;
      while (!stop.current) {
        const secs = Math.round((Date.now() - down) / 1000);
        setElapsed(secs);
        if (await serverAnswers()) break;
        if (!warned && secs >= COME_BACK_NOTICE) {
          warned = true;
          say(`NOT BACK YET after ${COME_BACK_NOTICE / 60} minutes. Check that the Pi's power light is on and that the farm Wi-Fi works. This page keeps checking.`, 'red');
        }
        await sleep(3000);
      }
      if (stop.current) return;
      setPhase('back');
      say('BACK: the Pi restarted and FarmSense is running again.', 'green');
      withTimeout(api.serverStatus(), 5000).then((s) => { setStatus(s); setReachable(true); }).catch(() => {});
      toast.success('The server restarted');
      return;
    }

    setPhase('settling');
    say(`It stopped answering. Letting it finish (${SETTLE} seconds) ...`);
    for (let s = SETTLE; s > 0 && !stop.current; s--) {
      setSettleLeft(s);
      await sleep(1000);
    }
    setPhase('off');
    say('OFF: safe to unplug the Pi now.', 'green');
  };

  const memUsed = status ? status.memory_total_mb - status.memory_free_mb : null;
  const going = ['sending', 'waiting', 'settling', 'returning'].includes(phase);
  const statusText = phase === 'off' ? 'Off'
    : going ? (mode === 'restart' ? 'Restarting' : 'Shutting down')
    : !reachable ? "Can't reach" : status ? 'Running' : 'Checking…';

  return (
    <div>
      <header className="banner grad-admin">
        <div className="banner-row">
          <div>
            <h1><IconServer /> Raspberry Pi 4 Server</h1>
            <p className="sub">The computer that runs FarmSense: web app, database, Grafana and alerts</p>
          </div>
        </div>
      </header>

      <div className="page">
        <div className="kpi-row cols-4" style={{ marginBottom: 16 }}>
          {[
            ['Status', statusText],
            ['Running for', uptimeLabel(status?.uptime_seconds)],
            ['Temperature', status?.temperature_c != null ? `${status.temperature_c} °C` : '—'],
            ['Memory in use', memUsed != null ? `${memUsed} / ${status.memory_total_mb} MB` : '—'],
          ].map(([label, value]) => (
            <div key={label} className="kpi-card">
              <div className="kpi-label">{label}</div>
              <div className="kpi-value" style={{ fontSize: 28 }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 6 }}><IconPower /> Restart or shut down the server</h3>
          <p className="muted" style={{ marginBottom: 6 }}>
            <strong>Restart</strong> when the server is slow or acting up: it switches off and comes back by itself
            in about 2 minutes.
          </p>
          <p className="muted" style={{ marginBottom: 14 }}>
            <strong>Shut down</strong> only when the Raspberry Pi must be unplugged. Pulling the plug while it is
            running can damage its database and memory card, so wait until this page says it is safe.
          </p>

          {ready && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" style={{ background: 'var(--amber)' }} onClick={() => setAsking('restart')}>
                <IconRefresh /> Restart Raspberry Pi
              </button>
              <button className="btn" style={{ background: 'var(--red)' }} onClick={() => setAsking('shutdown')}>
                <IconPower /> Shut down Raspberry Pi
              </button>
            </div>
          )}

          {lines.length > 0 && (
            <div
              style={{
                marginTop: 14, background: '#1d271f', color: '#e9e2d3', borderRadius: 10,
                padding: '14px 16px', fontFamily: 'Consolas, Menlo, monospace', fontSize: 13, lineHeight: 1.7,
              }}
            >
              {lines.map((l, i) => (
                <div
                  key={i}
                  style={{
                    color: l.tone === 'green' ? '#a9d49a' : l.tone === 'red' ? '#f0a097' : undefined,
                    fontWeight: l.tone ? 700 : 400,
                  }}
                >
                  {l.text}
                  {i === lines.length - 1 && phase === 'waiting' ? ` ${elapsed} s of ${GIVE_UP_AFTER}` : ''}
                  {i === lines.length - 1 && phase === 'returning' ? ` ${elapsed} s` : ''}
                  {i === lines.length - 1 && phase === 'settling' ? ` ${settleLeft}` : ''}
                </div>
              ))}
            </div>
          )}

          {phase === 'off' && (
            <p style={{ marginTop: 12, fontWeight: 600 }}>
              The green light on the Pi should now be off. To start it again, plug it back in: the web app
              returns in about 2 minutes.
            </p>
          )}
        </div>

        <FunnelCard />
      </div>

      {asking && <PowerDialog action={asking} onDiscard={() => setAsking(null)} onConfirm={() => run(asking)} />}
    </div>
  );
}

// Restarts the public link (Tailscale Funnel) when the web app cannot be opened from outside the farm.
// The Pi resets Funnel and restarts its Tailscale service; the farm network and the sensor boxes are not touched.
function FunnelCard() {
  const [busyUntil, setBusyUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (busyUntil <= Date.now()) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [busyUntil]);
  const left = Math.max(0, Math.ceil((busyUntil - now) / 1000));
  const restart = async () => {
    if (!window.confirm('Restart the public link now? The web app is unreachable from outside the farm for about 30 seconds.')) return;
    try {
      await api.restartFunnel();
      setBusyUntil(Date.now() + 60000); setNow(Date.now());
      toast.info('Restarting the public link. It is back in about 30 seconds; if this page stops answering, reload it then.');
    } catch (err) {
      toast.error(err.message || 'The server could not restart the public link');
    }
  };
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h3 style={{ marginBottom: 6 }}><IconRefresh /> Restart the public link</h3>
      <p className="muted" style={{ marginBottom: 14 }}>
        Use this when the web app opens through Tailscale but not from the public address
        (farmsense.tail274238.ts.net) on mobile data or another Wi-Fi. Only the public link restarts: the sensor
        boxes, watering and the farm network keep running.
      </p>
      <button className="btn" style={{ background: '#1f5f9e', color: '#fff' }} onClick={restart} disabled={left > 0}>
        <IconRefresh /> {left > 0 ? `Restarting public link… ${left} s` : 'Restart public link'}
      </button>
    </div>
  );
}

const DIALOG = {
  restart: {
    title: 'Restart the Raspberry Pi?',
    intro: 'This switches the FarmSense server off and straight back on:',
    points: [
      <>The web app, Grafana and the alerts stop for <strong>everyone</strong> for about 2 minutes.</>,
      'No sensor readings are saved until it is back.',
      'The valve box closes every valve within a minute, until the server is back.',
      'It starts again by itself: nobody needs to unplug it.',
    ],
    color: 'var(--amber)',
  },
  shutdown: {
    title: 'Shut down the Raspberry Pi?',
    intro: 'This switches the whole FarmSense server off:',
    points: [
      <>The web app, Grafana and the alerts stop for <strong>everyone</strong>.</>,
      'No sensor readings are saved while it is off.',
      'The valve box closes every valve within a minute.',
      'It only starts again when someone unplugs it and plugs it back in.',
    ],
    color: 'var(--red)',
  },
};

function PowerDialog({ action, onDiscard, onConfirm }) {
  const d = DIALOG[action];
  const [left, setLeft] = useState(CONFIRM_WAIT);
  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft(left - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <div className="modal-backdrop" onClick={onDiscard}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
        <h2><IconWarning style={{ color: d.color }} /> {d.title}</h2>
        <p style={{ marginBottom: 10 }}>{d.intro}</p>
        <ul style={{ paddingLeft: 20, lineHeight: 1.7, marginBottom: 10 }}>
          {d.points.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
        <p className="muted">Take a moment to be sure. Confirm unlocks in {CONFIRM_WAIT} seconds.</p>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onDiscard}>Discard</button>
          <button
            className="btn"
            style={{ background: d.color, opacity: left > 0 ? 0.55 : 1, minWidth: 130 }}
            disabled={left > 0}
            onClick={onConfirm}
          >
            {left > 0 ? `Confirm (${left}s)` : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
