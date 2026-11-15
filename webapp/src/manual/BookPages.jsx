import { forwardRef } from 'react';
import farmLogo from '../assets/jpcf-logo.jpg';
import bsuSeal from './bsu-seal.png';
import coverImg from './cover.webp'; // Canva cover (WIP), design "FarmSense Brew User Manual Cover (WIP)"
import { ROLE_NAMES, ROLES_TABLE, UI, manualGroups } from './content';

// Screenshots: emitted as separate files, fetched only when a page shows them.
const SHOTS = import.meta.glob('./shots/*.webp', { eager: true, query: '?url', import: 'default' });
export const shotUrl = (name) => SHOTS[`./shots/${name}.webp`];

const FARM = {
  name: 'JAVIER PERMACULTURE',
  sub: 'FARM & CAMP SITE',
  loc1: 'Sitio Karot, Lapo Lapu 2nd',
  loc2: 'San Jose, Batangas 4227, Philippines',
  mobile: '+63 916 555 9549',
  email: 'javierpermaculturefarm@gmail.com',
  web: 'javierpermaculturefarm.wordpress.com',
  tagline: 'Nurturing Earth • Building Community • Inspiring Sustainable Living',
};

export const TITLE = 'FarmSense Brew: A Scalable IoT Microclimate Monitoring, Coffee Leaf Rust Risk Prevention, and Automated Irrigation System for Liberica Coffee Farming at Javier Permaculture Farm';

/// Figure numbers and "page N" for every content page, computed once.
export function annotate(pages, firstNumber = 1) {
  let fig = 0;
  return pages.map((p, i) => ({
    ...p,
    pageNo: i + firstNumber,
    fig: p.shot ? ++fig : null,
  }));
}

// ------------------------------------------------------------- page frame
function FarmHeader() {
  return (
    <header className="mb-head mb-head-farm">
      <img className="mb-logo" src={farmLogo} alt="" />
      <div className="mb-farm-name">
        <div className="mb-farm-title">{FARM.name}</div>
        <div className="mb-farm-sub">{FARM.sub}</div>
      </div>
      <div className="mb-contact">
        <div><b>Location:</b> {FARM.loc1}</div>
        <div>{FARM.loc2}</div>
        <div><b>Mobile:</b> {FARM.mobile}</div>
        <div><b>Email:</b> {FARM.email}</div>
        <div><b>Web:</b> {FARM.web}</div>
      </div>
    </header>
  );
}

function BsuHeader() {
  return (
    <header className="mb-head mb-head-bsu">
      <img className="mb-seal" src={bsuSeal} alt="" />
      <div className="mb-bsu-text">
        <div className="mb-bsu-1">BATANGAS STATE UNIVERSITY</div>
        <div className="mb-bsu-2">The National Engineering University</div>
        <div className="mb-bsu-2">Lipa Campus</div>
        <div className="mb-bsu-3">College of Informatics and Computing Sciences</div>
      </div>
    </header>
  );
}

/// One short-bond (8.5 x 11 in) page. `variant`: 'farm' (in-app) or 'bsu'
/// (manuscript appendix). The crop-mark frame copies the BSU page border.
export const Page = forwardRef(function Page({ variant, pageNo, plain, footer = 'FarmSense Brew User Manual', className = '', children }, ref) {
  return (
    <div ref={ref} className={`mb-page mb-${variant} ${plain ? 'mb-plain' : ''} ${className}`} data-density="soft">
      <div className="mb-sheet">
        {!plain && (
          <>
            {variant === 'farm' && <div className="mb-bar" />}
            <span className="mb-line h top" /><span className="mb-line h mid" /><span className="mb-line h bot" />
            <span className="mb-line v left" /><span className="mb-line v right" />
            {variant === 'farm' ? <FarmHeader /> : <BsuHeader />}
          </>
        )}
        <div className="mb-body">{children}</div>
        {!plain && (
          <footer className="mb-foot">
            {variant === 'farm' ? (
              <>
                <div className="mb-tagline">{FARM.tagline}</div>
                <div className="mb-foot-row">
                  <span>{footer}</span>
                  <span>{pageNo}</span>
                </div>
              </>
            ) : (
              <div className="mb-foot-bsu">{pageNo}</div>
            )}
          </footer>
        )}
      </div>
    </div>
  );
});

// ------------------------------------------------------------- page kinds
function Cover({ role, L }) {
  if (coverImg) return <img className="mb-cover-img" src={coverImg} alt="FarmSense Brew User Manual" />;
  return (
    <div className="mb-cover">
      <div className="mb-cover-top">
        <div className="mb-cover-brand">FarmSense Brew</div>
        <div className="mb-cover-title">USER<br />MANUAL</div>
        <div className="mb-cover-rule" />
        {role !== 'all' && <div className="mb-cover-role">{L.edition(ROLE_NAMES[role])}</div>}
      </div>
      <div className="mb-cover-art">
        <img src={farmLogo} alt="" />
      </div>
      <div className="mb-cover-bottom">
        <div className="mb-cover-full">{TITLE}</div>
        <div className="mb-cover-inst">Javier Permaculture Farm & Camp Site · Batangas State University – TNEU Lipa</div>
      </div>
    </div>
  );
}

function Contents({ role, pages, L, lang }) {
  const first = new Map();
  pages.forEach((p) => {
    if (p.kind === 'section' && !first.has(`${p.group}:${p.section.id}`)) first.set(`${p.group}:${p.section.id}`, p.pageNo);
  });
  const about = pages.find((p) => p.kind === 'about');
  const many = manualGroups(role, lang).reduce((a, g) => a + g.items.length, 0) > 16;
  return (
    <div className={many ? 'mb-contents-cols' : ''}>
      <h1 className="mb-h1">{L.contents}</h1>
      <ol className="mb-toc">
        <li className="mb-toc-row"><span>{L.overviewTitle}</span><i /><b>{about?.pageNo}</b></li>
      </ol>
      {manualGroups(role, lang).map((g) => (
        <div key={g.title} className="mb-toc-group">
          <div className="mb-kicker">{g.title}</div>
          <ol className="mb-toc">
            {g.items.map((s) => {
              const pg = pages.find((p) => p.kind === 'section' && p.group === g.title && p.section.id === s.id);
              return (
                <li key={s.id} className="mb-toc-row">
                  <span>{pg?.number}. {s.title}</span><i /><b>{pg?.pageNo}</b>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

function About({ role, L, lang }) {
  return (
    <>
      <h1 className="mb-h1">{L.overviewTitle}</h1>
      <p className="mb-p">{L.about}</p>
      <figure className="mb-fig small">
        <img src={shotUrl('01-landing')} alt="FarmSense Brew home page" />
        <figcaption><b>{L.figure} A.</b> {L.homeFig} {L.caption}</figcaption>
      </figure>
      <table className="mb-table">
        <thead><tr><th>{L.roleCol}</th><th>{L.doesCol}</th></tr></thead>
        <tbody>
          {(ROLES_TABLE[lang] || ROLES_TABLE.en).map(([r, d]) => (
            <tr key={r} className={ROLE_NAMES[role] === r ? 'mine' : ''}><td>{r}</td><td>{d}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="mb-p small">{L.terms}</p>
    </>
  );
}

function Section({ p, L }) {
  const s = p.section;
  const showIntro = p.part !== 'rest';
  const showEnd = p.part !== 'first';
  return (
    <>
      {p.groupStart && <div className="mb-kicker">{p.group}</div>}
      <h2 className="mb-h2">
        <span className="mb-num">{p.number}</span>
        {s.title}{p.part === 'rest' && <em className="mb-cont"> {L.continued}</em>}
      </h2>
      {p.shot && (
        <figure className="mb-fig">
          <img src={shotUrl(p.shot)} alt={s.screen} loading="lazy" />
          <figcaption><b>{L.figure} {p.fig}.</b> {s.screen}. {L.caption}</figcaption>
        </figure>
      )}
      {showIntro && (
        <>
          <p className="mb-p"><b className="mb-label">{L.purpose}</b> {s.purpose}</p>
          <div className="mb-label">{L.how}</div>
          <ol className="mb-steps">{s.steps.map((t, i) => <li key={i}>{t}</li>)}</ol>
        </>
      )}
      {showEnd && s.features && <p className="mb-p"><b className="mb-label">{L.features}</b> {s.features}</p>}
      {showEnd && s.note && <div className="mb-note"><b>{L.note}</b> {s.note}</div>}
    </>
  );
}

function Back() {
  return (
    <div className="mb-back">
      <img src={farmLogo} alt="" />
      <div className="mb-back-name">FarmSense Brew</div>
      <p>Developed by Ron Andrei C. Cerantes, Kenchin Solisa and Edwin John L. Surwela</p>
      <p>BS Information Technology, Network Technology · Batangas State University – TNEU Lipa</p>
      <p>Adviser: Richelle M. Sulit, MSCS, LPT</p>
      <p className="mb-back-farm">For Javier Permaculture Farm & Camp Site · {FARM.loc1}, {FARM.loc2}</p>
    </div>
  );
}

/// Renders every page of the book as <Page> elements (children of the flipbook,
/// or stacked for printing).
export function renderPages(pages, { role, variant, lang = 'en' }) {
  const L = UI[lang] || UI.en;
  const common = { variant, footer: L.footer };
  return pages.map((p, i) => {
    switch (p.kind) {
      case 'cover':
        return <Page key={i} {...common} plain className="mb-hard" pageNo={p.pageNo}><Cover role={role} L={L} /></Page>;
      case 'back':
        return <Page key={i} {...common} plain className="mb-hard" pageNo={p.pageNo}><Back /></Page>;
      case 'contents':
        return <Page key={i} {...common} pageNo={p.pageNo}><Contents role={role} pages={pages} L={L} lang={lang} /></Page>;
      case 'about':
        return <Page key={i} {...common} pageNo={p.pageNo}><About role={role} L={L} lang={lang} /></Page>;
      case 'notes':
        return <Page key={i} {...common} pageNo={p.pageNo}><h1 className="mb-h1">{L.notes}</h1><div className="mb-lines" /></Page>;
      default:
        return <Page key={i} {...common} pageNo={p.pageNo}><Section p={p} L={L} /></Page>;
    }
  });
}
