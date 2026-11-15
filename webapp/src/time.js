// Database timestamps without an offset are UTC; display farm time on every device.
export function parseTimestamp(value) {
  if (value == null || value === '') return null;
  const input = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(value) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(value)
    ? value.replace(' ', 'T') + 'Z' : value;
  const date = new Date(input);
  return Number.isFinite(date.getTime()) ? date : null;
}
const clock = { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true };
export function formatTime(value) {
  return parseTimestamp(value)?.toLocaleTimeString('en-PH', clock) || '—';
}
export function formatDate(value) {
  return parseTimestamp(value)?.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'long', day: 'numeric' }) || '—';
}
export function formatTimestamp(value) {
  return parseTimestamp(value)?.toLocaleString('en-PH', { ...clock, year: 'numeric', month: 'short', day: 'numeric' }) || '—';
}
