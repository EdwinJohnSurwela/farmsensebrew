/**
 * Coffee Leaf Rust (CLR) risk score, the one rule used everywhere in the system.
 *
 * Weights follow the panel's suggestion (IT 331 defense, July 2026):
 *   temperature 35 %   thermal factor; Hemileia vastatrix germinates best at 21-25 °C
 *   humidity    25 %   atmospheric moisture
 *   leaf wetness 40 %  direct moisture on the leaf; the fungus needs free water to infect
 *   soil moisture      supporting factor only: shown and used for watering, not scored
 *
 * There is no leaf wetness sensor (the boxes carry only a DHT22 and a soil probe),
 * so leaf wetness is ESTIMATED from the DHT22 through the dew point: the closer the
 * air is to its dew point, the more likely water condenses on the leaves. Within
 * about 2 °C of the dew point (about 88 % humidity at 23 °C) the leaves are treated
 * as wet. Because the estimate comes from humidity, humidity counts in two parts of
 * the score; that is a stated limitation.
 *
 * A consequence worth knowing: temperature and humidity together give at most 60
 * points, so a reading only reaches HIGH (61+) or CRITICAL (81+) when the leaves are
 * estimated to be damp or wet.
 */

const LEVELS = ["MINIMAL", "LOW", "MODERATE", "HIGH", "CRITICAL"];
const STATUS = { MINIMAL: "Healthy", LOW: "Watch", MODERATE: "At Risk", HIGH: "Severe", CRITICAL: "Critical" };
const BANDS = { MINIMAL: [0, 20], LOW: [21, 40], MODERATE: [41, 60], HIGH: [61, 80], CRITICAL: [81, 100] };
// Same colours as the web app (webapp/src/api.js riskColor): leaf, olive, amber, orange, cherry.
const COLORS = { MINIMAL: "#2F6B3A", LOW: "#6F7D1E", MODERATE: "#A36B10", HIGH: "#C4561C", CRITICAL: "#A8322A" };
const colorOf = (level) => COLORS[String(level || "").toUpperCase()] || "#9CA3AF";

/** Position of a level, 0 (MINIMAL) to 4 (CRITICAL); -1 if unknown. */
const rank = (level) => LEVELS.indexOf(String(level || "").toUpperCase());

/** What each level makes the system do. */
const ALERT_FROM = rank("MODERATE");   // MODERATE and up open an alert
const ACTION_FROM = rank("HIGH");      // HIGH and CRITICAL need a recorded action
const HOLD_WATER_FROM = rank("HIGH");  // HIGH and CRITICAL hold automatic watering

function levelFromScore(score) {
  if (score <= 20) return "MINIMAL";
  if (score <= 40) return "LOW";
  if (score <= 60) return "MODERATE";
  if (score <= 80) return "HIGH";
  return "CRITICAL";
}

/** Dew point (°C) by the Magnus formula. */
function dewPoint(temperature, humidity) {
  const rh = Math.min(100, Math.max(1, humidity));
  const a = 17.62, b = 243.12;
  const g = Math.log(rh / 100) + (a * temperature) / (b + temperature);
  return (b * g) / (a - g);
}

function temperaturePoints(t) {
  if (t >= 21 && t <= 25) return 35;                       // best range for germination
  if ((t >= 18 && t < 21) || (t > 25 && t <= 28)) return 22;
  if ((t >= 15 && t < 18) || (t > 28 && t <= 30)) return 10;
  return 0;
}

function humidityPoints(h) {
  if (h >= 90) return 25;
  if (h >= 85) return 20;
  if (h >= 80) return 15;
  if (h >= 70) return 8;
  return 0;
}

/** Leaf wetness estimate from the dew point depression (air temperature minus dew point). */
function leafWetness(temperature, humidity) {
  const depression = temperature - dewPoint(temperature, humidity);
  let points = 0;
  if (depression <= 1) points = 40;        // condensation very likely: leaves wet
  else if (depression <= 2) points = 30;   // leaves probably wet
  else if (depression <= 3) points = 15;   // leaves may be damp
  return { points, depression: Math.round(depression * 10) / 10, wet: depression <= 2 };
}

/**
 * Score one reading. soil_pct is accepted for the record but not scored.
 * Returns { level, score, status, parts, dew_point_depression, leaf_wet }.
 */
function computeClrRisk(temperature, humidity, soil_pct) {   // eslint-disable-line no-unused-vars
  const t = Number(temperature), h = Number(humidity);
  const leaf = leafWetness(t, h);
  const parts = { temperature: temperaturePoints(t), humidity: humidityPoints(h), leaf_wetness: leaf.points };
  const score = Math.min(100, parts.temperature + parts.humidity + parts.leaf_wetness);
  const level = levelFromScore(score);
  return { level, score, status: STATUS[level], parts, dew_point_depression: leaf.depression, leaf_wet: leaf.wet };
}

module.exports = {
  LEVELS, STATUS, BANDS, COLORS, colorOf, rank, levelFromScore, computeClrRisk, dewPoint, leafWetness,
  ALERT_FROM, ACTION_FROM, HOLD_WATER_FROM,
};
