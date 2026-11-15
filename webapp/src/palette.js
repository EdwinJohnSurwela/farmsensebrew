// Chart and reading colours from the farm palette (theme.css). One colour per
// measurement on every page and chart, so a reader learns them once.
export const C = {
  temperature: '#b4532a',   // ember
  humidity: '#2a6479',      // water
  soil: '#2f6b3a',          // leaf
  score: '#6b4a30',         // roasted coffee
  low: '#3b7d46',
  moderate: '#a36b10',
  high: '#a8322a',
  offline: '#a79f8f',
  grid: '#e7dfcf',
  axis: '#847d6d',
  ink: '#1d271f',
};

// Recharts axis/tooltip styling that matches the theme.
export const axisProps = { stroke: C.axis, tick: { fill: C.axis, fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' } };
export const gridProps = { stroke: C.grid, strokeDasharray: '3 3' };
export const tooltipProps = {
  contentStyle: { background: '#fffdf8', border: '1px solid #e0d6c3', borderRadius: 8, fontFamily: 'IBM Plex Sans, sans-serif', fontSize: 12 },
  labelStyle: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#847d6d' },
};
