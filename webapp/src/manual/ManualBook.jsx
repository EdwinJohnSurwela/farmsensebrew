import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import HTMLFlipBook from 'react-pageflip';
import { buildPages } from './content';
import { annotate, renderPages, shotUrl } from './BookPages';
import {
  IconCaretLeft, IconCaretRight, IconThumbs, IconZoomIn, IconZoomOut,
  IconFullscreen, IconFullscreenExit, IconSound, IconMute, IconPrint, IconTextView,
} from '../icons';
import './manual-book.css';

const RATIO = 11 / 8.5;              // page height / width (short bond)
const ZOOMS = [1, 1.35, 1.7, 2.1];

/// A soft paper "flip" made in the browser (no sound file to download).
function playFlip(ctxRef) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = ctxRef.current || (ctxRef.current = new Ctx());
    const len = Math.floor(ctx.sampleRate * 0.32);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.6)), 2) * (1 - t);
      d[i] = (Math.random() * 2 - 1) * env;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.6;
    const gain = ctx.createGain(); gain.gain.value = 0.22;
    src.connect(bp).connect(gain).connect(ctx.destination);
    src.start();
  } catch { /* sound is optional */ }
}

function pageLabel(p) {
  switch (p.kind) {
    case 'cover': return 'Cover';
    case 'contents': return 'Contents';
    case 'about': return 'System overview';
    case 'notes': return 'Notes';
    case 'back': return 'Back cover';
    default: return `${p.number}. ${p.section.title}${p.part === 'rest' ? ' (cont.)' : ''}`;
  }
}

export default function ManualBook({ role, lang = 'en', onTextView }) {
  const pages = useMemo(() => annotate(buildPages(role, lang)), [role, lang]);
  const book = useRef(null);
  const root = useRef(null);
  const stage = useRef(null);
  const audio = useRef(null);
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [thumbs, setThumbs] = useState(false);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('fsb_manual_sound') !== 'off'; } catch { return true; } });
  const [full, setFull] = useState(false);
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const [box, setBox] = useState({ w: 900, h: 700 });

  // Fit the book to the space available (re-measured on resize / fullscreen).
  useEffect(() => {
    const measure = () => {
      const el = stage.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const h = full ? window.innerHeight - 90 : Math.max(360, window.innerHeight - top - 78);
      setBox({ w: el.clientWidth, h });
    };
    measure();
    let t;
    const onResize = () => { clearTimeout(t); t = setTimeout(measure, 150); };
    window.addEventListener('resize', onResize);
    const onFs = () => { setFull(!!document.fullscreenElement); setTimeout(measure, 120); };
    document.addEventListener('fullscreenchange', onFs);
    return () => { window.removeEventListener('resize', onResize); document.removeEventListener('fullscreenchange', onFs); clearTimeout(t); };
  }, [full]);

  const portrait = box.w < 720;
  const fitW = portrait ? Math.min(box.w, box.h / RATIO) : Math.min(box.w / 2, box.h / RATIO);
  const pageW = Math.max(240, Math.floor(fitW * ZOOMS[zoom]));
  const pageH = Math.floor(pageW * RATIO);
  const bookKey = `${pageW}-${portrait ? 'p' : 'l'}-${lang}`;

  const api = () => book.current?.pageFlip?.();
  const go = useCallback((i) => { const pf = api(); if (pf) pf.turnToPage(Math.max(0, Math.min(pages.length - 1, i))); setPage(i); }, [pages.length]);
  const next = () => api()?.flipNext();
  const prev = () => api()?.flipPrev();

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') { e.preventDefault(); api()?.flipNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); api()?.flipPrev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSound = () => setSound((s) => {
    const n = !s;
    try { localStorage.setItem('fsb_manual_sound', n ? 'on' : 'off'); } catch { /* ignore */ }
    return n;
  });
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else root.current?.requestFullscreen?.();
  };
  const print = () => window.open(`${window.location.pathname}#/manual-print/${role}?lang=${lang}`, '_blank', 'noopener');

  const shown = portrait || page === 0 || page === pages.length - 1
    ? `${page + 1}`
    : `${page + 1}–${Math.min(page + 2, pages.length)}`;

  return (
    <div className="mbk" ref={root}>
      <div className={`mbk-stage ${zoom ? 'zoomed' : ''}`} ref={stage}>
        <div className="mbk-book-wrap" style={{ width: portrait ? pageW : pageW * 2 }}>
          <HTMLFlipBook
            key={bookKey}
            ref={book}
            width={pageW}
            height={pageH}
            size="fixed"
            showCover
            usePortrait={portrait}
            startPage={page}
            drawShadow
            maxShadowOpacity={0.45}
            flippingTime={750}
            mobileScrollSupport
            showPageCorners
            onFlip={(e) => { setPage(e.data); if (soundRef.current) playFlip(audio); }}
            className="mbk-book"
          >
            {renderPages(pages, { role, variant: 'farm', lang })}
          </HTMLFlipBook>
        </div>
      </div>

      {thumbs && (
        <div className="mbk-thumbs" role="dialog" aria-label="Pages">
          {pages.map((p, i) => (
            <button key={i} className={`mbk-thumb ${i === page || (!portrait && i === page + 1 && page > 0) ? 'cur' : ''}`}
              onClick={() => { setThumbs(false); go(i); }}>
              <div className="mbk-thumb-img" style={p.shot ? { backgroundImage: `url(${shotUrl(p.shot)})` } : undefined}>
                {!p.shot && pageLabel(p)}
              </div>
              <div className="mbk-thumb-cap"><b>{i + 1}</b>{pageLabel(p)}</div>
            </button>
          ))}
        </div>
      )}

      <div className="mbk-bar" role="toolbar" aria-label="Manual controls">
        <button onClick={prev} disabled={page === 0} title="Previous page" aria-label="Previous page"><IconCaretLeft size={18} /></button>
        <div className="mbk-pagebox" aria-live="polite">{shown} / {pages.length}</div>
        <button onClick={next} disabled={page >= pages.length - (portrait ? 1 : 2)} title="Next page" aria-label="Next page"><IconCaretRight size={18} /></button>
        <span className="mbk-sep" />
        <button className={thumbs ? 'on' : ''} onClick={() => setThumbs((v) => !v)} title="All pages" aria-label="All pages"><IconThumbs size={18} /></button>
        <button onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))} disabled={zoom === ZOOMS.length - 1} title="Zoom in" aria-label="Zoom in"><IconZoomIn size={18} /></button>
        <button onClick={() => setZoom((z) => Math.max(0, z - 1))} disabled={zoom === 0} title="Zoom out" aria-label="Zoom out"><IconZoomOut size={18} /></button>
        <button onClick={toggleFull} title={full ? 'Exit full screen' : 'Full screen'} aria-label="Full screen">
          {full ? <IconFullscreenExit size={18} /> : <IconFullscreen size={18} />}
        </button>
        <button className={`mbk-wide ${sound ? '' : 'on'}`} onClick={toggleSound} title={sound ? 'Mute page sound' : 'Turn page sound on'} aria-label="Page sound">
          {sound ? <IconSound size={18} /> : <IconMute size={18} />}
        </button>
        <span className="mbk-sep mbk-wide" />
        <button className="mbk-wide" onClick={print} title="Print or save as PDF" aria-label="Print"><IconPrint size={18} /></button>
        {onTextView && <button onClick={onTextView} title="Text view (searchable)" aria-label="Text view"><IconTextView size={18} /></button>}
      </div>
    </div>
  );
}
