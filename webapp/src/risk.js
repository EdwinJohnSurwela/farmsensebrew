// Coffee Leaf Rust risk bands, the same as the server (backend/services/clr-risk.js).
// Score 0-100 from temperature (35), humidity (25) and estimated leaf wetness (40).
export const RISK_LEVELS = ['MINIMAL', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'];
export const RISK_STATUS = { MINIMAL: 'Healthy', LOW: 'Watch', MODERATE: 'At Risk', HIGH: 'Severe', CRITICAL: 'Critical' };
export const RISK_BANDS = { MINIMAL: '0-20', LOW: '21-40', MODERATE: '41-60', HIGH: '61-80', CRITICAL: '81-100' };

export const riskRank = (level) => RISK_LEVELS.indexOf(String(level || '').toUpperCase());
/** HIGH and CRITICAL: an alert needs a recorded action and watering is held. */
export const isActionLevel = (level) => riskRank(level) >= 3;

export const levelFromScore = (score) => {
  if (score == null || !Number.isFinite(Number(score))) return null;
  const s = Number(score);
  return s <= 20 ? 'MINIMAL' : s <= 40 ? 'LOW' : s <= 60 ? 'MODERATE' : s <= 80 ? 'HIGH' : 'CRITICAL';
};

/** "High" from "HIGH". */
export const levelLabel = (level) => {
  const t = String(level || '');
  return t ? t.charAt(0) + t.slice(1).toLowerCase() : '';
};
