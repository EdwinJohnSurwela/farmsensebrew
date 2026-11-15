import { useEffect, useState } from 'react';
import { api } from '../../api';
import { toast, confirmDialog } from '../../ui';
import { IconValve, IconWater, IconRefresh, IconAdd, IconWarning, IconClock, IconDelete, IconClose, IconInfo } from '../../icons';

// Which valve each node switch opens. Must match VALVE_NODES in
// esp32_valve_controller/config.h: the valve box decides, this only explains it.
const VALVES = [
  { n: 1, side: 'west', nodes: [1, 4] },
  { n: 2, side: 'centre', nodes: [3] },
  { n: 3, side: 'east', nodes: [2, 5] },
];
const MAX_RUN_SECONDS = 30 * 60;
/** "06:00" or "17:30:00" -> "6:00 AM" / "5:30 PM". */
const clock12 = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return hhmm || '';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const nodeNum = (nodeId) => parseInt(String(nodeId).replace(/\D/g, ''), 10);
const valveOfNode = (nodeId) => VALVES.find((v) => v.nodes.includes(nodeNum(nodeId)));
const valveByNum = (n) => VALVES.find((v) => v.n === Number(n));

function ValveMap() {
  return (
    <div className="callout water">
      <h3 style={{ marginBottom: 4 }}><IconValve /> Which valve waters which nodes</h3>
      <p className="muted" style={{ fontSize: 12, marginBottom: 10 }}>One valve runs at a time.</p>
      <div className="chip-row">
        {VALVES.map((v) => (
          <span key={v.n} className="chip" style={{ fontSize: 12 }}>
            <strong>Valve {v.n}</strong>&nbsp;({v.side}): Node {v.nodes.join(' + Node ')}
          </span>
        ))}
      </div>
    </div>
  );
}

/// Automatic watering: the system's own logic (research defaults) with an
/// on/off switch and what each valve is doing now. Field staff see the valve
/// status only; the switch and the rules are for the agronomist and owner.
function AutoPanel({ auto, onChanged }) {
  const [busy, setBusy] = useState(false);

  if (!auto) {
    return <div className="callout leaf"><p className="muted">Loading automatic watering…</p></div>;
  }
  const s = auto.settings;
  const p = auto.depletionFraction;

  const toggle = async () => {
    const on = !s.enabled;
    const ok = await confirmDialog({
      title: on ? 'Turn on automatic watering?' : 'Turn off automatic watering?',
      text: on
        ? `The system will open a valve by itself when its soil drops below ${auto.refillPct}%. `
          + 'Check that the soil probes read correctly first, or the soil numbers can be off.'
        : 'Valves then only open by hand or on a schedule. A valve the system opened closes now.',
      confirmText: on ? 'Turn on' : 'Turn off',
      danger: !on,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await api.updateAutoWater({ enabled: on });
      toast.success(on ? 'Automatic watering is ON' : 'Automatic watering is OFF');
      onChanged(res);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="alert-card auto-head">
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0 }}><IconWater /> Automatic watering</h3>
          <p className="muted" style={{ marginTop: 4 }}>
            {s.enabled
              ? (auto.canEdit ? 'On: valves open and close by the rules below.' : 'On: the system opens and closes the valves by itself.')
              : 'Off: valves open only by hand or on a schedule.'}
          </p>
        </div>
        {auto.canEdit ? (
          <label className="switch">
            <input type="checkbox" checked={!!s.enabled} disabled={busy} onChange={toggle} />
            <span className="track"><span className="thumb" /></span>
          </label>
        ) : (
          <span className="pill" style={{ background: s.enabled ? 'var(--green)' : 'var(--muted)' }}>
            {s.enabled ? 'ON' : 'OFF'}
          </span>
        )}
      </div>

      {auto.valves.map((v) => (
        <div key={v.n} className="alert-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className={`auto-valve-num${v.on ? ' on' : ''}`}>{v.n}</div>
          <div style={{ flex: 1 }}>
            <strong>Valve {v.n} ({v.side})</strong>
            <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>Node {v.nodes.join(' + Node ')}</span>
            <p style={{ fontSize: 13, marginTop: 2 }}>{v.note}</p>
            {v.skipped.length > 0 && (
              <p className="muted" style={{ fontSize: 11 }}>
                Not counted: {v.skipped.map((x) => `Node ${x.node} (${x.why})`).join(', ')}
              </p>
            )}
          </div>
          <span className="pill" style={{ background: v.on ? 'var(--green)' : 'var(--muted)' }}>
            {v.on ? (v.auto ? 'WATERING' : 'ON') : 'OFF'}
          </span>
        </div>
      ))}

      {auto.canEdit && (
        <div className="callout leaf">
          <h3 style={{ marginBottom: 8 }}><IconInfo /> How it decides</h3>
          <ul className="rule-chips">
            <li>Opens below <strong>{auto.refillPct}%</strong></li>
            <li>Stops at <strong>{auto.targetPct}%</strong> or <strong>{s.maxRunMinutes} min</strong></li>
            <li>Held at <strong>High</strong> or <strong>Critical</strong> risk</li>
            <li>Waters <strong>{clock12(s.startTime)}</strong> to <strong>{clock12(s.endTime)}</strong></li>
            <li><strong>One valve</strong> at a time, driest first</li>
            <li><strong>{s.minGapMinutes} min</strong> rest after a run</li>
            <li>Skips offline nodes and 0% probes</li>
          </ul>
          <details className="more">
            <summary>Why these rules</summary>
            <ul className="auto-rules">
              <li><strong>{auto.refillPct}%:</strong> {Math.round(p * 100)}% of the soil's available water is used (FAO-56, coffee).</li>
              <li><strong>{auto.targetPct}%:</strong> field capacity; more water only drains away.</li>
              <li><strong>High or Critical:</strong> extra moisture helps rust spread. Cannot be switched off.</li>
              <li><strong>Daytime only:</strong> spores germinate on leaves left wet overnight.</li>
              <li><strong>Rest:</strong> lets the water spread before the probes are read again.</li>
              <li><strong>Skipped sensors:</strong> a bad probe cannot keep a valve open.</li>
            </ul>
          </details>
        </div>
      )}
    </>
  );
}

const durationLabel = (sec) => {
  if (!sec) return '';
  if (sec < 60) return `${sec} sec`;
  if (sec < 3600) {
    const m = Math.floor(sec / 60), s = sec % 60;
    return s ? `${m} min ${s} sec` : `${m} min`;
  }
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};

/// Irrigation Control: Automatic (the system's own watering logic, plus optional
/// custom rules), Manual (one switch per valve) and Schedule tabs.
export default function IrrigationPage() {
  const [tab, setTab] = useState('automatic');
  const [zones, setZones] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [editingSchedule, setEditingSchedule] = useState(null); // null | 'new' | schedule
  const [auto, setAuto] = useState(null); // automatic watering status

  const load = async () => {
    try {
      const [status, sched, aw] = await Promise.all([
        api.irrigationStatus(),
        api.schedules(),
        api.autoWater().catch(() => null),
      ]);
      if (aw) setAuto(aw);
      setZones(status.data || []);
      setSchedules(sched.data || []);
    } catch {
      /* keep last */
    }
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  // Manual tab: one switch per valve. The Pi and the valve box still work per
  // node, so a valve is ON when any of its nodes is on; switching it on turns
  // on its first node, switching it off turns off every node on it.
  const valveNodes = (v) => zones.filter((z) => v.nodes.includes(nodeNum(z.node_id)));
  const valveOn = (v) => valveNodes(v).some((z) => z.relay_on);
  const toggleValve = async (v) => {
    const on = !valveOn(v);
    const busy = VALVES.filter((o) => o.n !== v.n && valveOn(o)).map((o) => `Valve ${o.n}`);
    const ok = await confirmDialog({
      title: on ? `Open valve ${v.n} (${v.side})?` : `Close valve ${v.n} (${v.side})?`,
      text: on
        ? `It waters Node ${v.nodes.join(' and Node ')}.` +
          (busy.length ? ` ${busy.join(' and ')} is already on, so this valve waits until that one closes.` : '')
        : `Node ${v.nodes.join(' and Node ')} stop watering.`,
      confirmText: on ? 'Open' : 'Close',
      danger: !on,
    });
    if (!ok) return;
    try {
      const targets = on ? [valveNodes(v)[0]] : valveNodes(v).filter((z) => z.relay_on);
      for (const z of targets.filter(Boolean)) {
        await api.irrigationControl({ node_id: z.node_id, mode: 'manual', relay_on: on });
      }
      toast.success(`Valve ${v.n} ${on ? 'ON' : 'OFF'}`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteScheduleRow = async (s) => {
    const ok = await confirmDialog({
      title: 'Delete this schedule?',
      text: `Valve ${s.valve ?? '?'} • ${clock12(s.time)}`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteSchedule(s.id);
      toast.success('Schedule deleted');
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };


  return (
    <div>
      <header className="banner grad-irrigation">
        <div className="banner-row">
          <div>
            <h1><IconWater /> Irrigation Control</h1>
            <p className="sub">
              {`${VALVES.filter(valveOn).length}/${VALVES.length} valves watering`}
            </p>
          </div>
          <button className="btn ghost sm" onClick={load} title="Refresh"><IconRefresh /></button>
        </div>
        <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
          {['automatic', 'manual', 'schedule'].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                background: 'none', border: 'none', color: 'var(--text)',
                opacity: tab === t ? 1 : 0.6, fontWeight: tab === t ? 700 : 500,
                borderBottom: tab === t ? '3px solid var(--brand)' : '3px solid transparent',
                paddingBottom: 6, fontSize: 13, textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </header>

      <div className="page">
        <ValveMap />
        {tab === 'automatic' && (
          <>
            <AutoPanel auto={auto} onChanged={(a) => { setAuto(a); load(); }} />
          </>
        )}

        {tab === 'manual' && (
          <>
            <div className="callout amber">
              <p style={{ fontSize: 12, color: 'var(--text-2)' }}>
                <IconWarning style={{ verticalAlign: '-3px' }} /> Manual mode overrides automatic settings. One switch per valve.
              </p>
            </div>
            {VALVES.map((v) => {
              const on = valveOn(v);
              const othersOn = VALVES.some((o) => o.n !== v.n && valveOn(o));
              return (
                <div key={v.n} className="alert-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 800, fontSize: 17,
                    background: on ? 'var(--leaf-soft)' : 'var(--surface-2)',
                    color: on ? 'var(--green)' : 'var(--muted)',
                  }}>
                    {v.n}
                  </div>
                  <div style={{ flex: 1 }}>
                    <strong>Valve {v.n} ({v.side})</strong>
                    <p className="muted">Waters Node {v.nodes.join(' + Node ')}</p>
                    <p className="muted">
                      {on ? (othersOn ? 'ON, may be waiting for the other valve to close' : 'ON, watering') : 'OFF, idle'}
                    </p>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={on} onChange={() => toggleValve(v)} disabled={!valveNodes(v).length} />
                    <span className="track"><span className="thumb" /></span>
                  </label>
                </div>
              );
            })}
          </>
        )}

        {tab === 'schedule' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0 }}>Active Schedules</h3>
              <button className="btn sm" onClick={() => setEditingSchedule('new')}><IconAdd weight="bold" /> Add</button>
            </div>
            <div className="callout amber">
              <ul className="rule-chips" style={{ fontSize: 12 }}>
                <li><IconWarning style={{ verticalAlign: '-2px' }} /> Opens one valve at a set time</li>
                <li>Skipped at <strong>High</strong> or <strong>Critical</strong> risk</li>
                <li>Stops after <strong>30 min</strong> at most</li>
              </ul>
            </div>
            {schedules.length === 0 ? (
              <div className="card empty-state">No schedules yet. Tap "Add" to create one.</div>
            ) : (
              schedules.map((s) => (
                <div key={s.id} className="alert-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18, display: 'inline-flex', color: 'var(--coffee)' }}><IconClock /></span>
                    <div style={{ flex: 1 }}>
                      <strong>{valveByNum(s.valve) ? `Valve ${s.valve} (${valveByNum(s.valve).side})` : s.node_id}</strong>
                      {valveByNum(s.valve) && (
                        <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>Waters Node {valveByNum(s.valve).nodes.join(' + Node ')}</span>
                      )}
                      <p className="muted">{clock12(s.time)} • {durationLabel(s.duration_seconds)}</p>
                    </div>
                    <span className="pill" style={{ background: s.is_active ? 'var(--green)' : 'var(--muted)' }}>
                      {s.is_active ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  {(s.specific_dates || []).length > 0 && (
                    <div className="chip-row" style={{ marginTop: 8 }}>
                      {s.specific_dates.map((d) => (
                        <span key={d} className="chip" style={{ fontSize: 10 }}>{d}</span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d, i) => (
                      <span
                        key={d}
                        className="pill"
                        style={{
                          background: (s.days_of_week || []).includes(i + 1) ? 'var(--agronomist)' : 'var(--bg)',
                          color: (s.days_of_week || []).includes(i + 1) ? '#fff' : 'var(--muted)',
                        }}
                      >
                        {d}
                      </span>
                    ))}
                    <span style={{ marginLeft: 'auto' }}>
                      <button className="btn sm ghost" onClick={() => setEditingSchedule(s)}>Edit</button>{' '}
                      <button className="btn sm ghost" onClick={() => deleteScheduleRow(s)} title="Delete schedule"><IconDelete /></button>
                    </span>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>

      {editingSchedule && (
        <ScheduleModal
          schedule={editingSchedule === 'new' ? null : editingSchedule}
          onClose={() => setEditingSchedule(null)}
          onSaved={() => {
            setEditingSchedule(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ScheduleModal({ schedule, onClose, onSaved }) {
  const isEdit = !!schedule;
  const [valve, setValve] = useState(schedule?.valve || valveOfNode(schedule?.node_id)?.n || 1);
  const [time, setTime] = useState(schedule?.time?.slice(0, 5) || '06:00');
  const [durationValue, setDurationValue] = useState(() => {
    const d = schedule?.duration_seconds ?? 1800;
    return d >= 60 && d % 60 === 0 ? d / 60 : d;
  });
  const [durationUnit, setDurationUnit] = useState(() => {
    const d = schedule?.duration_seconds ?? 1800;
    return d >= 60 && d % 60 === 0 ? 'minutes' : 'seconds';
  });
  const [days, setDays] = useState(schedule?.days_of_week || [1, 2, 3, 4, 5]);
  const [dates, setDates] = useState(schedule?.specific_dates || []);
  const [newDate, setNewDate] = useState('');
  const [busy, setBusy] = useState(false);

  const toggleDay = (d) =>
    setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());

  const save = async () => {
    const durationSeconds = durationUnit === 'minutes' ? durationValue * 60 : durationValue;
    if (durationSeconds > MAX_RUN_SECONDS) {
      toast.error('A run can be at most 30 minutes: the Pi stops any valve after that.');
      return;
    }
    const body = {
      valve: Number(valve),
      time,
      duration_seconds: Number(durationSeconds),
      days_of_week: days,
      specific_dates: dates,
      active: true,
    };
    setBusy(true);
    try {
      if (isEdit) await api.updateSchedule(schedule.id, body);
      else await api.createSchedule(body);
      onSaved();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? 'Edit Schedule' : 'Add Schedule'}</h2>
        <div className="field">
          <label>Valve</label>
          <select value={valve} onChange={(e) => setValve(Number(e.target.value))}>
            {VALVES.map((v) => (
              <option key={v.n} value={v.n}>Valve {v.n} ({v.side}): Node {v.nodes.join(' + Node ')}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Time</label>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="field">
          <label>Duration (up to 30 minutes)</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span className="muted" style={{ display: 'block', marginBottom: 4 }}>Amount</span>
              <input
                type="number" min={1} value={durationValue} aria-label="Duration amount"
                style={{ width: '100%' }}
                onChange={(e) => setDurationValue(Number(e.target.value) || 1)}
              />
            </div>
            <div>
              <span className="muted" style={{ display: 'block', marginBottom: 4 }}>Unit</span>
              <select value={durationUnit} aria-label="Duration unit" onChange={(e) => setDurationUnit(e.target.value)}>
                <option>seconds</option>
                <option>minutes</option>
              </select>
            </div>
          </div>
        </div>
        <div className="field">
          <label>Specific dates (optional)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} style={{ flex: 1 }} />
            <button
              className="btn sm ghost"
              onClick={() => {
                if (newDate && !dates.includes(newDate)) setDates([...dates, newDate]);
                setNewDate('');
              }}
            >
              + Add date
            </button>
          </div>
          <div className="chip-row">
            {dates.map((d) => (
              <button key={d} className="chip" onClick={() => setDates(dates.filter((x) => x !== d))}>
                {d} <IconClose size={11} weight="bold" />
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Days</label>
          <div className="chip-row">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
              <button
                key={d}
                className={`chip ${days.includes(i + 1) ? 'active' : ''}`}
                onClick={() => toggleDay(i + 1)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
