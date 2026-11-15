/// Summary card: round icon, label, big value, coloured status line.
/// tone: green | blue | orange | red | purple (icon circle colour)
/// statusTone: same names, or 'muted' (status text colour)
export default function KpiCard({ icon, tone = 'green', label, value, unit, status, statusTone, sub }) {
  return (
    <div className="kpi-card">
      <div className={`kpi-icon tone-${tone}`}>{icon}</div>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">
          {value}
          {unit && <span className="kpi-unit">{unit}</span>}
        </div>
        {status && <div className={`kpi-status text-${statusTone || tone}`}>{status}</div>}
        {sub && <div className="kpi-sub">{sub}</div>}
      </div>
    </div>
  );
}

/// Status wording shared by the dashboards, from the system's own rules:
/// CLR favours 21 to 25 °C with humidity above 80 %; staff guidance treats
/// soil below 35 % as dry and below 30 % as very dry.
export const tempStatus = (t) =>
  t >= 21 && t <= 25 ? ['In the rust range', 'orange'] : ['Outside the rust range', 'green'];
export const humidityStatus = (h) =>
  h > 80 ? ['Above 80 %: favours rust', 'red'] : ['Below the 80 % rust threshold', 'green'];
export const soilStatus = (s) =>
  s < 30 ? ['Very dry', 'red'] : s < 35 ? ['Dry', 'orange'] : ['Adequate', 'green'];
