import { useState } from 'react';
import { riskColor } from '../api';
import { IconLeaf } from '../icons';

// Panel wording in English, everyday Tagalog and Taglish.
const T = {
  en: {
    title: 'Recommendations',
    empty: 'No readings yet. Advice appears here once a node starts sending data.',
    what: 'What is happening', why: 'Why it matters', action: 'What to do',
    level: { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MODERATE: 'MODERATE', LOW: 'LOW', MINIMAL: 'MINIMAL' },
    source: { gemini: 'Gemini AI', rules: 'Rule-based' },
  },
  // Everyday Tagalog, the way the staff talk: short, no deep words.
  tl: {
    title: 'Mga Payo',
    empty: 'Wala pang reading. Dito lalabas ang payo pag nagpapadala na ang isang node.',
    what: "Ano'ng nangyayari", why: 'Bakit mahalaga', action: "Ano'ng gagawin",
    level: { CRITICAL: 'DELIKADO', HIGH: 'MATAAS', MODERATE: 'MEDYO MATAAS', LOW: 'MABABA', MINIMAL: 'NAPAKABABA' },
    source: { gemini: 'Gemini AI', rules: 'Batay sa rules' },
  },
  taglish: {
    title: 'Mga Payo',
    empty: 'Wala pang reading. Dito lalabas yung advice once mag-send na ng data ang node.',
    what: 'Anong nangyayari', why: 'Bakit importante', action: 'Anong gagawin',
    level: { CRITICAL: 'CRITICAL', HIGH: 'HIGH', MODERATE: 'MODERATE', LOW: 'LOW', MINIMAL: 'MINIMAL' },
    source: { gemini: 'Gemini AI', rules: 'Rule-based' },
  },
};

/** The chosen recommendation language, remembered per role on this device. */
export function useRecoLang(role, fallback) {
  const key = `farmsense_reco_lang_${role}`;
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
  });
  const setLang = (l) => {
    setLangState(l);
    try { localStorage.setItem(key, l); } catch { /* storage blocked */ }
  };
  return [lang, setLang];
}

/// One recommendation per online node: what is happening, why it matters,
/// what to do. The text comes from the system's fixed rules, or from Google
/// Gemini (a large language model) when an API key is set; the pill says which.
export default function LiveAlertPanel({ alerts, source, lang = 'en', onLang }) {
  const t = T[lang] || T.en;
  const src = source === 'gemini' ? 'gemini' : 'rules';
  return (
    <div className="card callout leaf" style={{ color: 'var(--ink)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 20, display: 'inline-flex', color: 'var(--leaf)' }}><IconLeaf /></span>
        <h3 style={{ margin: 0, flex: 1 }}>{t.title}</h3>
        {onLang && (
          <div className="lang-toggle" role="group" aria-label="Language">
            <button className={lang === 'en' ? 'on' : ''} aria-pressed={lang === 'en'} onClick={() => onLang('en')}>English</button>
            <button className={lang === 'tl' ? 'on' : ''} aria-pressed={lang === 'tl'} onClick={() => onLang('tl')}>Tagalog</button>
            <button className={lang === 'taglish' ? 'on' : ''} aria-pressed={lang === 'taglish'} onClick={() => onLang('taglish')}>Taglish</button>
          </div>
        )}
        <span
          className="pill"
          style={{ background: 'var(--water-soft)', color: 'var(--water)' }}
          title={src === 'gemini'
            ? 'Written by Google Gemini, a large language model (LLM)'
            : 'Written from fixed rules that follow the CLR risk level'}
        >
          {t.source[src]}
        </span>
      </div>
      {alerts.length === 0 ? (
        <p className="muted">{t.empty}</p>
      ) : (
        alerts.map((a, i) => {
          const color = riskColor(a.risk_level);
          const level = (a.risk_level || 'MINIMAL').toUpperCase();
          return (
            <div key={i} className="alert-card" style={{ borderColor: `${color}55`, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                <span className="pill" style={{ background: color }}>{t.level[level] || level}</span>
                <strong style={{ fontSize: 13 }}>{a.node_id}</strong>
                <span style={{ fontSize: 12, fontWeight: 600, color }}>{a.headline}</span>
              </div>
              {['what', 'why', 'action'].map((k) => a[k] && (
                <p key={k} style={{ fontSize: 12.5, color: 'var(--text-2)', marginBottom: 4 }}>
                  <strong style={{ color: 'var(--text)' }}>{t[k]}: </strong>
                  {a[k]}
                </p>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
