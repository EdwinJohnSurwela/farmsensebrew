import { sensorProblem, SENSOR_PURPLE } from '../nodes';

/// "Sensor problem" with the sensor's name under it (temperature and humidity, or soil moisture),
/// for status cells. Renders nothing when both sensors are reading.
export default function SensorStatus({ n }) {
  const p = sensorProblem(n);
  if (!p) return null;
  return (
    <span title={p.full} style={{ display: 'inline-flex', flexDirection: 'column', lineHeight: 1.25, whiteSpace: 'nowrap' }}>
      <strong style={{ color: SENSOR_PURPLE, fontWeight: 600 }}>Sensor problem</strong>
      <span style={{ fontSize: 11, color: SENSOR_PURPLE, opacity: 0.85 }}>{p.sensor}</span>
    </span>
  );
}
