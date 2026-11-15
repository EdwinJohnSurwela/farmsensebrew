/// Loading screen in the app's own style: three coffee beans hopping in turn,
/// with a caption. Used while Grafana starts up inside the Analytics frame.
/// phase: 'loading' (beans hop), 'growing' (the dashboard is ready: the middle
/// bean is planted and grows into a small coffee plant), 'done' (fades out).
export const GROW_MS = 1700;

function Bean() {
  return (
    <svg className="brew-bean" viewBox="0 0 24 32" aria-hidden="true">
      <ellipse cx="12" cy="16" rx="10" ry="14" className="brew-bean-body" />
      <ellipse cx="8.5" cy="10" rx="3" ry="5" className="brew-bean-shine" />
      <path d="M12.5 3.5 C 6 10, 18 22, 11.5 28.5" className="brew-bean-crease" />
    </svg>
  );
}

// One coffee leaf pointing right from (0,0): glossy oval with a pale midrib.
const LEAF = 'M0 0 C 6 -8, 19 -9, 26 -1 C 18 5, 6 5, 0 0 Z';
const RIB = 'M2 0 C 9 -2.4, 16 -2.6, 23 -1.2';

function LeafPair({ y, size, delay, tilt = 18 }) {
  const leaf = (side) => (
    <g transform={`translate(40 ${y}) scale(${side} 1) rotate(${-tilt})`}>
      <g className="brew-leaf" style={{ '--t': `${delay}s`, '--s': size }}>
        <path d={LEAF} className="brew-leaf-blade" />
        <path d={RIB} className="brew-leaf-rib" />
      </g>
    </g>
  );
  return <>{leaf(1)}{leaf(-1)}</>;
}

/// The coffee plant that grows out of the middle bean (drawn above it).
function Plant() {
  return (
    <svg className="brew-plant" viewBox="0 0 80 104" aria-hidden="true">
      <path d="M40 104 C 40 88, 37.5 76, 40 62 C 42.5 48, 38.5 36, 40 20" pathLength="100" className="brew-stem" />
      <LeafPair y={86} size={1} delay={0.55} tilt={14} />
      <LeafPair y={64} size={0.86} delay={0.75} tilt={20} />
      <LeafPair y={43} size={0.7} delay={0.95} tilt={26} />
      {/* the new sprout at the tip */}
      <g transform="translate(40 21)">
        <g className="brew-leaf" style={{ '--t': '1.12s', '--s': 0.42 }}>
          <path d={LEAF} transform="rotate(-58)" className="brew-leaf-blade brew-leaf-young" />
          <path d={LEAF} transform="scale(-1 1) rotate(-58)" className="brew-leaf-blade brew-leaf-young" />
        </g>
      </g>
      {/* two ripe coffee cherries in the lowest leaf axils */}
      <circle cx="35.5" cy="90" r="3.4" className="brew-cherry" style={{ '--t': '1.3s' }} />
      <circle cx="44.5" cy="91.5" r="3.4" className="brew-cherry" style={{ '--t': '1.38s' }} />
    </svg>
  );
}

export default function BrewLoader({ phase = 'loading', caption = 'Brewing the live dashboard', readyCaption = 'Freshly brewed' }) {
  const growing = phase === 'growing';
  const done = phase === 'done';
  return (
    <div
      className={`brew-loader${growing ? ' growing' : ''}${done ? ' gone' : ''}`}
      role="status" aria-live="polite" aria-hidden={done}
    >
      <div className="brew-beans">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`brew-slot${i === 1 ? ' mid' : ''}`} style={{ '--d': `${i * 0.16}s` }}>
            {i === 1 && (growing || done) && <Plant />}
            <Bean />
            <span className="brew-shadow" />
          </div>
        ))}
      </div>
      <p className={`brew-caption${growing || done ? ' still' : ''}`}>{growing || done ? readyCaption : caption}</p>
    </div>
  );
}
