import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import farmLogo from '../assets/jpcf-logo.jpg';
import '../landing.css';
import fieldPlot from '../assets/field/plot.webp';
import fieldMounting from '../assets/field/mounting.webp';
import fieldWiring from '../assets/field/wiring.webp';
import fieldBoxes from '../assets/field/boxes.webp';
import fieldValveBox from '../assets/field/valvebox.webp';
import fieldRoofs from '../assets/field/roofs.webp';

// Photos from the installation at the farm (September to October 2026).
const FIELD_PHOTOS = [
  [fieldPlot, 'The pilot plot from above, 23 October 2026: five sensor posts among the Liberica coffee plants'],
  [fieldMounting, 'Mounting the power box and the valve box on the tree beside the plot'],
  [fieldWiring, 'Wiring the boxes at the tree'],
  [fieldBoxes, 'The power box and the valve box under their roofs'],
  [fieldValveBox, 'Inside the valve box: the ESP32 and the relay board that switch the three valves'],
  [fieldRoofs, 'The shared roofs on the tree that shelter the boxes'],
];

/// Slideshow of field photos: advances every 6 s, pauses on hover or focus, and stays still
/// for visitors who prefer reduced motion.
function FieldSlideshow() {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const n = FIELD_PHOTOS.length;
  useEffect(() => {
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (paused || still) return undefined;
    const t = setTimeout(() => setI((x) => (x + 1) % n), 6000);
    return () => clearTimeout(t);
  }, [i, paused, n]);
  const go = (d) => setI((x) => (x + d + n) % n);
  return (
    <div className="lp-show" data-reveal onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)} aria-roledescription="carousel" aria-label="Photos from the farm">
      <div className="lp-show-frame">
        {FIELD_PHOTOS.map(([src, cap], k) => (
          <figure key={src} className={`lp-show-slide${k === i ? ' on' : ''}`} aria-hidden={k !== i}>
            <img src={src} alt={cap} loading={k === 0 ? 'eager' : 'lazy'} />
            <figcaption>{cap}</figcaption>
          </figure>
        ))}
        <button type="button" className="lp-show-nav prev" onClick={() => go(-1)} aria-label="Previous photo">‹</button>
        <button type="button" className="lp-show-nav next" onClick={() => go(1)} aria-label="Next photo">›</button>
      </div>
      <div className="lp-show-dots">
        {FIELD_PHOTOS.map(([src], k) => (
          <button key={src} type="button" className={k === i ? 'on' : ''} onClick={() => setI(k)} aria-label={`Photo ${k + 1} of ${n}`} />
        ))}
      </div>
    </div>
  );
}

// Visual effects (aurora glow, grain, glass, parallax, kinetic title, card
// hover reveal, micro-interactions). On by default. To compare without them:
//   http://<pi-address>:3001/app/#/?fx=0        (?fx=1 forces them on)
const FX_DEFAULT = true;

const FARM_SITE = 'https://javierpermaculturefarm.wordpress.com';


const FARM_LINKS = [
  ['Growing Liberica Coffee', `${FARM_SITE}/growing-coffee/`],
  ['Join Our Journey to Sustainability', `${FARM_SITE}/about/`],
  ['TEMPLA Open House', `${FARM_SITE}/happy-international-womens-day/`],
];

// Farm contact details as listed on the farm's Facebook page.
const CONTACTS = [
  { label: 'Phone', href: 'tel:+639165559549', hint: 'Call the farm: 0916 555 9549', icon: 'phone' },
  { label: 'Email', href: 'mailto:javierpermaculturefarm@gmail.com', hint: 'Email the farm: javierpermaculturefarm@gmail.com', icon: 'mail' },
  { label: 'Directions', href: 'https://maps.app.goo.gl/ZSKRNkX4d43c5KQ59', hint: 'Open directions to the farm in Google Maps', icon: 'pin', external: true },
  { label: 'Facebook', href: 'https://www.facebook.com/javierpermaculturefarm/', hint: "Open the farm's Facebook page", icon: 'facebook', external: true },
  { label: 'WordPress', href: `${FARM_SITE}/`, hint: "Open the farm's WordPress site", icon: 'wordpress', external: true },
];

const ICONS = {
  phone: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z',
  mail: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm0 1.5 8 6 8-6',
  pin: 'M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
  // Line versions of the brand marks, matching the other outline icons
  facebook: 'M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm11 4.5h-1.5A2.5 2.5 0 0 0 12 10v11M9.5 13.5H15',
  wordpress: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM6.5 8.5l2.7 8 2.8-7.2 2.8 7.2 2.7-8',
};

function Icon({ name }) {
  return (
    <svg className="lp-ico" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[name]} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg className="lp-arrow" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
      <path className="stem" d="M0 5h7.5" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path className="head" d="M4.5 1.5 8 5l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useFx() {
  const { search } = useLocation();
  const p = new URLSearchParams(search).get('fx');
  if (p === '0' || p === 'off') return false;
  if (p === '1' || p === 'on') return true;
  return FX_DEFAULT;
}

// Public home page and unified sign-in.
export default function Landing() {
  const navigate = useNavigate();
  const fx = useFx();
  const root = useRef(null);
  const disc = useRef(null);

  // HashRouter owns the URL hash, so in-page links scroll instead of using #anchors.
  const scrollTo = (id) => () => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  useEffect(() => {
    if (!fx || !root.current) return undefined;
    const el = root.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Fade content in as it scrolls into view.
    const items = el.querySelectorAll('[data-reveal]');
    let io;
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach((n) => n.classList.add('in'));
    } else {
      io = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      }, { threshold: 0.15 });
      items.forEach((n) => io.observe(n));
    }

    // Scroll position drives the parallax layers and the kinetic title.
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (!reduce && y < 1400) el.style.setProperty('--sy', String(y));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      io?.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
    };
  }, [fx]);

  // Logo stack tilts slightly toward the pointer.
  const tilt = (e) => {
    if (!fx || !disc.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    disc.current.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
    disc.current.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
  };
  const untilt = () => {
    disc.current?.style.setProperty('--ry', '0deg');
    disc.current?.style.setProperty('--rx', '0deg');
  };

  return (
    <div ref={root} className={`lp${fx ? ' lp-fx' : ''}`}>
      <div className="lp-aurora" aria-hidden="true">
        <span className="a1" /><span className="a2" /><span className="a3" /><span className="a4" />
      </div>

      <header className="lp-nav">
        <div className="lp-wrap lp-nav-row">
          <button className="lp-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <img className="lp-logo-mark" src={farmLogo} alt="" />
            FarmSense Brew
          </button>
          <nav className="lp-links">
            
            <button className="lp-link" onClick={scrollTo('farm')}>The Farm</button>
            <button className="lp-link" onClick={scrollTo('contact')}>Contact</button>
          </nav>
          <button className="lp-btn lp-btn-dark lp-btn-sm" onClick={() => navigate('/login')}>
            Sign in <Arrow />
          </button>
        </div>
      </header>

      <section className="lp-hero" onPointerMove={tilt} onPointerLeave={untilt}>
        <div className="lp-wrap lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow lp-rise" style={{ '--d': '0ms' }}>
              <span className="lp-dot" /> Javier Permaculture Farm and Camp Site · San Jose, Batangas
            </span>
            <h1 className="lp-title">
              {['FarmSense', 'Brew'].map((w, i) => (
                <span key={w} className="lp-word" style={{ '--i': i }}>
                  <span className={`lp-word-k k${i}`}>{w}</span>
                </span>
              ))}
            </h1>
            <p className="lp-lead lp-rise" style={{ '--d': '420ms' }}>
              IoT microclimate monitoring, coffee leaf rust risk prevention and automated
              irrigation for Liberica coffee.
            </p>
            <div className="lp-cta lp-rise" style={{ '--d': '560ms' }}>
              <button className="lp-btn lp-btn-dark" onClick={() => navigate('/login')}>
                Sign in <Arrow />
              </button>
              <button className="lp-btn lp-btn-soft" onClick={scrollTo('farm')}>
                The Farm
              </button>
            </div>
          </div>
          <div className="lp-hero-visual">
            <div ref={disc} className="lp-stack">
              <span className="lp-layer l1" aria-hidden="true" />
              <span className="lp-layer l2" aria-hidden="true" />
              <div className="lp-disc">
                <img src={farmLogo} alt="Javier Permaculture Farm and Camp Site logo" />
              </div>
            </div>
          </div>
        </div>
      </section>


      <section id="field" className="lp-section lp-field">
        <div className="lp-wrap">
          <span className="lp-kicker" data-reveal>From the Field</span>
          <h2 className="lp-field-title" data-reveal>Built and installed at the farm</h2>
          <FieldSlideshow />
        </div>
      </section>

      <section id="farm" className="lp-section lp-farm">
        <div className="lp-wrap lp-farm-bento">
          <div className="lp-tile lp-farm-logo" data-reveal>
            <img src={farmLogo} alt="" />
          </div>
          <div className="lp-tile lp-farm-info" data-reveal style={{ '--d': '120ms' }}>
            <span className="lp-kicker">The Farm</span>
            <h2>Javier Permaculture Farm and Camp Site</h2>
            <p className="lp-place"><Icon name="pin" /> Sitio Karot, Brgy. Lapu-Lapu 2nd, San Jose, Batangas</p>
            <div className="lp-ext">
              {FARM_LINKS.map(([label, href]) => (
                <a key={label} href={href} target="_blank" rel="noopener noreferrer">
                  {label} <span aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <footer id="contact" className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-footer-top">
            <div className="lp-footer-brand">
              <img src={farmLogo} alt="" />
              <div>
                <strong>Javier Permaculture Farm and Camp Site</strong>
                <span>Sitio Karot, Brgy. Lapu-Lapu 2nd, San Jose, Batangas</span>
              </div>
            </div>
            <div className="lp-contacts" aria-label="Contact the farm">
              {CONTACTS.map((c) => (
                <a
                  key={c.label}
                  className="lp-contact"
                  href={c.href}
                  title={c.hint}
                  aria-label={c.hint}
                  {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                >
                  <Icon name={c.icon} />
                  <span>{c.label}</span>
                </a>
              ))}
            </div>
          </div>
          <div className="lp-footer-bottom">
            <span><strong>FarmSense Brew</strong> · BSIT Capstone Project</span>
            <span>Batangas State University, The National Engineering University, Lipa Campus · 2026</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
