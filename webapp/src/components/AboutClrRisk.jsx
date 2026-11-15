import { useState } from 'react';
import { riskColor } from '../api';
import { RISK_LEVELS, RISK_BANDS, levelLabel } from '../risk';
import { IconInfo, IconCaretDown } from '../icons';

const PARTS = [
  ['Temperature', 35],
  ['Humidity', 25],
  ['Leaf wetness (est.)', 40],
];
const KEY = 'farmsense_about_clr_open';

/// Sidebar "About CLR risk": a one-line toggle; opens to the score's three
/// parts and the five bands. Remembers open/closed in this browser only.
export default function AboutClrRisk() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
  });
  const toggle = () => {
    setOpen((o) => {
      try { localStorage.setItem(KEY, o ? '0' : '1'); } catch { /* private window */ }
      return !o;
    });
  };
  return (
    <div className={`about-card ${open ? 'open' : ''}`}>
      <button className="about-toggle" aria-expanded={open} aria-controls="about-clr-body" onClick={toggle}>
        <span className="about-title"><IconInfo size={14} /> About CLR risk</span>
        <IconCaretDown size={13} className="about-caret" />
      </button>
      {open && (
        <div id="about-clr-body" className="about-body">
          <p className="about-sub">Score 0 to 100, from:</p>
          <ul className="about-parts">
            {PARTS.map(([name, pts]) => (
              <li key={name}><span>{name}</span><span className="about-pts">{pts}</span></li>
            ))}
          </ul>
          <p className="about-sub">Bands</p>
          <ul className="about-bands">
            {[...RISK_LEVELS].map((lv) => (
              <li key={lv}>
                <span className="about-dot" style={{ background: riskColor(lv) }} />
                <span>{levelLabel(lv)}</span>
                <span className="about-pts">{RISK_BANDS[lv].replace('-', '–')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
