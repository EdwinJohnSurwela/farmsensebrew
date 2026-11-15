import { riskColor } from '../api';

/// Soft risk-level chip (tinted background, coloured text).
export default function RiskChip({ level, children }) {
  const c = riskColor(level);
  const text = (level || 'MINIMAL').toString();
  return (
    <span className="risk-chip" style={{ background: `${c}1f`, color: c }}>
      {children ?? text.charAt(0) + text.slice(1).toLowerCase()}
    </span>
  );
}
