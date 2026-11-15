import plotPhoto from '../assets/plot-drone.webp';
import { riskColor } from '../api';
import { RISK_LEVELS, levelLabel } from '../risk';
import { nodeColor, sensorProblem, offlineWord, fmt, SENSOR_PURPLE, OFFLINE_GREY } from '../nodes';

// Drone photo of the 50 sqm pilot plot (23 Oct 2026, 10:23 AM), north at the top.
// Each post's spot on the photo, in percent of its width and height, by node number.
// Nothing is drawn on the post: a line leads from just outside it to a round balloon with the
// node number in its status colour, above the post (`below` when there is no room above, `edge` opens it inward near a side).
const POSTS = {
  1: { x: 27.8, y: 17.7, below: true },
  2: { x: 89.1, y: 27.4, edge: 'right' },
  3: { x: 54.3, y: 56.0 },
  4: { x: 13.0, y: 73.7, edge: 'left' },
  5: { x: 65.1, y: 85.6 },
};

/// Status of one node in a few words: risk level and score, the sensor that is not reading, or Offline.
function statusText(n, riskWord) {
  if (!n.hasRisk) return offlineWord(n);
  return `${riskWord(n.risk)} · ${fmt(n.score)}`;
}

/**
 * The plot map shared by every role: the five posts on the drone photo with a balloon
 * per node, coloured by the same rule everywhere (risk level, purple for a sensor problem,
 * grey when offline). Clicking a post or its balloon selects that node.
 *   riskWord: label for a risk level (the staff page passes its own words or Tagalog)
 *   labels:   { sensor, offline } legend words
 */
export default function PlotMap({ nodes, selectedId, onSelect, riskWord = levelLabel, labels = {} }) {
  const onPhoto = nodes.filter((n) => POSTS[n.num]);
  const extra = nodes.filter((n) => !POSTS[n.num]);
  const count = (pred) => nodes.filter(pred).length;
  return (
    <div>
      <div className="plot-map">
        <img src={plotPhoto} alt="Drone photo of the pilot plot with the five sensor posts" draggable="false" />
        {onPhoto.map((n) => {
          const p = POSTS[n.num];
          const color = nodeColor(n);
          const fault = sensorProblem(n);
          const sel = selectedId === n.nodeId;
          return (
            <button
              key={n.nodeId}
              type="button"
              className={`plot-post${p.below ? ' below' : ''}${p.edge ? ` edge-${p.edge}` : ''}${sel ? ' selected' : ''}`}
              style={{ left: `${p.x}%`, top: `${p.y}%`, '--node': color }}
              onClick={() => onSelect?.(n)}
              title={`${n.name}: ${n.hasRisk ? statusText(n, riskWord) : offlineWord(n)}${fault && n.hasRisk ? `. ${fault.full}` : ''}`}
              aria-pressed={sel}
              aria-label={`${n.name}: ${statusText(n, riskWord)}`}
            >
              <span className="plot-line" />
              <span className="plot-balloon" style={fault && n.hasRisk ? { boxShadow: `0 0 0 3px ${SENSOR_PURPLE}` } : undefined}>{n.num}</span>
            </button>
          );
        })}
      </div>
      {extra.length > 0 && (
        <div className="map-legend" style={{ marginTop: 8 }}>
          {extra.map((n) => (
            <button key={n.nodeId} type="button" className="plot-extra" onClick={() => onSelect?.(n)}>
              <span className="risk-dot" style={{ background: nodeColor(n) }} />{n.name}: {statusText(n, riskWord)}
            </button>
          ))}
        </div>
      )}
      <div className="map-legend" style={{ marginTop: 12 }}>
        {[...RISK_LEVELS].reverse().map((lv) => (
          <span key={lv}><span className="risk-dot" style={{ background: riskColor(lv) }} />{riskWord(lv)} {count((n) => n.hasRisk && n.risk === lv)}</span>
        ))}
        <span><span className="risk-dot" style={{ background: SENSOR_PURPLE }} />{labels.sensor || 'Sensor problem'} {count((n) => !!sensorProblem(n))}</span>
        <span><span className="risk-dot" style={{ background: OFFLINE_GREY }} />{labels.offline || 'Offline'} {count((n) => !n.boxOnline)}</span>
      </div>
    </div>
  );
}
