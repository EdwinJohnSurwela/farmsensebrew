import { useEffect, useState } from 'react';
import { api } from '../api';
import { toast } from '../ui';

// The same actions as backend/services/alert.service.js, in the three
// languages the field staff can pick. Quiet periods come from the server.
const TEXT = {
  en: {
    title: (node) => `What did you do at ${node}?`,
    pick: 'What was done', note: 'Short note', save: 'Save', cancel: 'Cancel', saving: 'Saving…',
    placeholder: 'What did you do or see? e.g. Tree 3, lower leaves, 4 spots, removed and bagged.',
    quiet: (d) => `No new alerts for this node for ${d}, unless the risk gets worse.`,
    days: (n) => (n === 1 ? '1 day' : `${n} days`),
    done: 'Action saved. The alert is closed.',
    actions: {
      inspected_none: 'Inspected, no rust found',
      removed_leaves: 'Found rust, removed infected leaves',
      fungicide: 'Applied fungicide (copper)',
      pruned: 'Pruned or cleared for air flow',
      false_alarm: 'False alarm / sensor problem',
      other: 'Other',
    },
  },
  tl: {
    title: (node) => `Ano ang ginawa mo sa ${node}?`,
    pick: 'Ano ang ginawa', note: 'Maikling tala', save: 'I-save', cancel: 'Wag na', saving: 'Sine-save…',
    placeholder: 'Ano ang ginawa o nakita mo? hal. Puno 3, mga dahon sa baba, 4 na batik, tinanggal at isinako.',
    quiet: (d) => `Walang bagong alert sa node na 'to sa loob ng ${d}, maliban kung lumala.`,
    days: (n) => `${n} araw`,
    done: 'Na-save na. Sarado na ang alert.',
    actions: {
      inspected_none: 'Sinilip, walang kalawang',
      removed_leaves: 'May kalawang, tinanggal ang mga dahong may sakit',
      fungicide: 'Nag-spray ng fungicide (copper)',
      pruned: 'Nagpungos o naglinis para humangin',
      false_alarm: 'Mali ang alarma / may sira ang sensor',
      other: 'Iba pa',
    },
  },
  taglish: {
    title: (node) => `Ano ang ginawa mo sa ${node}?`,
    pick: 'Anong ginawa', note: 'Short note', save: 'Save', cancel: 'Cancel', saving: 'Sine-save…',
    placeholder: 'Ano ang ginawa o nakita mo? e.g. Tree 3, lower leaves, 4 spots, tinanggal at binag.',
    quiet: (d) => `Walang bagong alert sa node na 'to for ${d}, unless lumala ang risk.`,
    days: (n) => (n === 1 ? '1 day' : `${n} days`),
    done: 'Saved na. Closed na ang alert.',
    actions: {
      inspected_none: 'Na-inspect, walang rust',
      removed_leaves: 'May rust, tinanggal ang infected leaves',
      fungicide: 'Nag-apply ng fungicide (copper)',
      pruned: 'Nag-prune o nag-clear para sa air flow',
      false_alarm: 'False alarm / sensor problem',
      other: 'Iba pa',
    },
  },
};

export const actionText = (lang = 'en') => TEXT[lang] || TEXT.en;

/// Record what was done about a node's open alert. Closes the alert and starts
/// the action's quiet period (see alert.service.js).
export default function RecordActionModal({ nodeId, nodeName, role, lang = 'en', onClose, onSaved }) {
  const t = TEXT[lang] || TEXT.en;
  const [types, setTypes] = useState([]);
  const [action, setAction] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.alertActionTypes().then((r) => setTypes((r.data || []).filter((a) => a.roles.includes(role) && !a.retired))).catch(() => {});
  }, [role]);

  const chosen = types.find((a) => a.key === action);
  const save = async () => {
    if (!action) return toast.error(t.pick);
    if (note.trim().length < 5) return toast.error(t.note);
    setBusy(true);
    try {
      await api.recordAlertAction(nodeId, { action, note: note.trim() });
      toast.success(t.done);
      onSaved();
    } catch (err) {
      toast.error(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t.title(nodeName)}</h2>
        <div className="field">
          <label>{t.pick}</label>
          <div className="act-list">
            {types.map((a) => (
              <label key={a.key} className={`act-option${action === a.key ? ' on' : ''}`}>
                <input type="radio" name="act" value={a.key} checked={action === a.key} onChange={() => setAction(a.key)} />
                {t.actions[a.key] || a.label}
              </label>
            ))}
          </div>
          {chosen && <p className="muted" style={{ marginTop: 8 }}>{t.quiet(t.days(Math.round(chosen.quietHours / 24)))}</p>}
        </div>
        <div className="field">
          <label htmlFor="act-note">{t.note}</label>
          <textarea
            id="act-note" rows={3} maxLength={500} value={note} placeholder={t.placeholder}
            onChange={(e) => setNote(e.target.value)} className="act-note"
          />
        </div>
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>{t.cancel}</button>
          <button className="btn green" disabled={busy} onClick={save}>{busy ? t.saving : t.save}</button>
        </div>
      </div>
    </div>
  );
}
