import { useMemo, useState } from 'react';
import { useShellNav } from '../../components/shellNav';
import { IconManual, IconCaretRight, IconInfo } from '../../icons';
import ManualBook from '../../manual/ManualBook';
import { ROLE_NAMES, UI, LANGS, defaultLang, manualGroups } from '../../manual/content';

/// User Manual tab: a page-turning book (default) or a searchable text view
/// with "Open this screen" buttons, in Tagalog, Taglish or English (field
/// staff start in Tagalog). Content lives in src/manual/content.js.

function Section({ s, L, tabLabel, onOpen, number }) {
  return (
    <section id={`manual-${s.id}`} className="card manual-section">
      <div className="manual-section-head">
        <h3><span className="manual-num">{number}</span>{s.title}</h3>
        {s.tab && onOpen && (
          <button className="btn ghost sm" onClick={() => onOpen(s.tab)}>
            {L.open(tabLabel)} <IconCaretRight />
          </button>
        )}
      </div>
      <p className="manual-purpose"><strong>{L.purpose}</strong> {s.purpose}</p>
      <div className="manual-label">{L.how}</div>
      <ol className="manual-steps">
        {s.steps.map((t, i) => <li key={i}>{t}</li>)}
      </ol>
      {s.features && <p className="manual-features"><strong>{L.features}</strong> {s.features}</p>}
      {s.note && (
        <div className="callout water manual-note">
          <IconInfo style={{ verticalAlign: '-3px' }} /> {s.note}
        </div>
      )}
    </section>
  );
}

function TextView({ role, lang }) {
  const { goTo, tabs } = useShellNav();
  const [query, setQuery] = useState('');
  const groups = useMemo(() => manualGroups(role, lang), [role, lang]);
  const L = UI[lang] || UI.en;

  const q = query.trim().toLowerCase();
  const matches = (s) => !q || [s.title, s.purpose, s.features, s.note, ...s.steps]
    .filter(Boolean).join(' ').toLowerCase().includes(q);
  const tabLabel = (key) => tabs.find((t) => t.key === key)?.label;
  const canOpen = (s) => s.tab && tabs.some((t) => t.key === s.tab);

  let n = 0;
  const numbered = groups.map((g) => ({
    ...g,
    items: g.items.map((s) => ({ ...s, number: ++n })).filter(matches),
  }));
  const total = numbered.reduce((a, g) => a + g.items.length, 0);
  const jump = (id) => document.getElementById(`manual-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="page manual">
      <div className="manual-tools">
        <input
          className="manual-search"
          type="search"
          placeholder={L.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={L.search}
        />
      </div>

      {!q && (
        <nav className="card manual-toc" aria-label={L.contents}>
          <h3>{L.contents}</h3>
          {numbered.map((g) => (
            <div key={g.title} className="manual-toc-group">
              <div className="manual-label">{g.title}</div>
              <div className="chip-row">
                {g.items.map((s) => (
                  <button key={s.id} className="chip" onClick={() => jump(s.id)}>
                    {s.number}. {s.title}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      )}

      {total === 0 && <div className="empty-state">{L.nothing(query)}</div>}

      {numbered.map((g) => g.items.length > 0 && (
        <div key={g.title} className="manual-group">
          <h2 className="manual-group-title">{g.title}</h2>
          {g.items.map((s) => (
            <Section key={s.id} s={s} L={L} number={s.number} tabLabel={tabLabel(s.tab)} onOpen={canOpen(s) ? goTo : null} />
          ))}
        </div>
      ))}
    </div>
  );
}

/// The role's how-to video, served by the Pi from /app/manual-videos/ (no internet needed).
function VideoView({ role, L }) {
  const [missing, setMissing] = useState(false);
  const base = `${import.meta.env.BASE_URL}manual-videos/${role}`;
  return (
    <div className="page manual">
      <div className="card manual-video">
        {missing ? (
          <div className="empty-state">{L.noVideo}</div>
        ) : (
          <video key={role} controls playsInline preload="none" poster={`${base}.jpg`} onError={() => setMissing(true)}>
            <source src={`${base}.mp4`} type="video/mp4" onError={() => setMissing(true)} />
          </video>
        )}
        <p className="muted manual-video-note">{L.videoNote}</p>
      </div>
    </div>
  );
}

const VIEWS = ['book', 'video', 'text'];
const store = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage blocked */ } };
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

export default function ManualPage({ role }) {
  const [view, setView] = useState(() => (VIEWS.includes(read('fsb_manual_view')) ? read('fsb_manual_view') : 'book'));
  const [lang, setLang] = useState(() => {
    const saved = read(`fsb_manual_lang_${role}`);
    return LANGS.some((l) => l.key === saved) ? saved : defaultLang(role);
  });
  const choose = (v) => { setView(v); store('fsb_manual_view', v); };
  const pickLang = (l) => { setLang(l); store(`fsb_manual_lang_${role}`, l); };
  const L = UI[lang] || UI.en;

  return (
    <div>
      <header className="banner">
        <div className="banner-row">
          <div>
            <h1><IconManual /> User Manual</h1>
            <p className="sub">{L.guideFor(ROLE_NAMES[role])}</p>
          </div>
          <div className="manual-switches">
          <div className="lang-toggle" role="group" aria-label="View">
            {VIEWS.map((v) => (
              <button key={v} className={view === v ? 'on' : ''} aria-pressed={view === v} onClick={() => choose(v)}>
                {L.views[v]}
              </button>
            ))}
          </div>
          <div className="lang-toggle" role="group" aria-label="Language">
            {LANGS.map((l) => (
              <button key={l.key} className={lang === l.key ? 'on' : ''} aria-pressed={lang === l.key} onClick={() => pickLang(l.key)}>
                {l.label}
              </button>
            ))}
          </div>
          </div>
        </div>
      </header>
      {view === 'book' && (
        <div className="page manual-book-page">
          <ManualBook role={role} lang={lang} />
        </div>
      )}
      {view === 'video' && <VideoView role={role} L={L} />}
      {view === 'text' && <TextView role={role} lang={lang} />}
    </div>
  );
}
