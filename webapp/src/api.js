// Thin fetch wrapper over the FarmSense backend. Same-origin in
// production (/app served by the backend) and proxied in `vite dev`.
const TOKEN_KEY = 'farmsense_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    credentials: 'include', // sets the cookie the Grafana proxy needs
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  // Session ended (signed in elsewhere, or expired): tell the shell so it can
  // say so plainly instead of leaving old numbers on screen.
  if (!res.ok && !path.startsWith('/api/auth/') &&
      (res.status === 401 || data?.code === 'SESSION_DISPLACED' || data?.error === 'Invalid or expired token')) {
    window.dispatchEvent(new CustomEvent('farmsense:signed-out'));
  }
  if (!res.ok) {
    const message = data?.error || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),

  // Auth
  login: (username, password, force = false) =>
    request('POST', '/api/auth/login', { username, password, ...(force ? { force: true } : {}) }),
  logout: () => request('POST', '/api/auth/logout'),
  // Admin-approved password reset flow
  requestPasswordReset: (username) => request('POST', '/api/auth/reset-request', { username }),
  resetRequestStatus: (username) =>
    request('GET', `/api/auth/reset-request/status?username=${encodeURIComponent(username)}`),
  completePasswordReset: (username, newPassword) =>
    request('POST', '/api/auth/reset-request/complete', { username, new_password: newPassword }),

  // Sensors / dashboard
  sensorLatest: () => request('GET', '/api/sensors/latest'),
  kpi: () => request('GET', '/api/dashboard/kpi'),
  trends: (params) => request('GET', `/api/dashboard/trends?${params}`),
  riskFactors: () => request('GET', '/api/dashboard/risk-factors'),
  scaleUp: () => request('GET', '/api/dashboard/scale-up'),
  registerZone: (body) => request('POST', '/api/dashboard/scale-up', body),
  updateNodePosition: (body) => request('PATCH', '/api/dashboard/node-position', body),
  deleteNode: (nodeId) => request('DELETE', `/api/admin/nodes/${nodeId}`), // admins; never a node with readings

  // Alerts
  alerts: () => request('GET', '/api/alerts'),
  alertHistory: (limit = 100) => request('GET', `/api/alerts/history?limit=${limit}`),
  alertActions: ({ limit = 10, node_id } = {}) =>
    request('GET', `/api/alerts/actions?limit=${limit}${node_id ? `&node_id=${node_id}` : ''}`),
  alertActionTypes: () => request('GET', '/api/alerts/action-types'),
  recordAlertAction: (nodeId, body) => request('POST', `/api/alerts/node/${nodeId}/action`, body),

  // Irrigation
  irrigationStatus: () => request('GET', '/api/irrigation/status'),
  irrigationControl: (body) => request('POST', '/api/irrigation/control', body),
  schedules: () => request('GET', '/api/irrigation/schedule'),
  createSchedule: (body) => request('POST', '/api/irrigation/schedule', body),
  updateSchedule: (id, body) => request('PUT', `/api/irrigation/schedule/${id}`, body),
  deleteSchedule: (id) => request('DELETE', `/api/irrigation/schedule/${id}`),
  autoWater: () => request('GET', '/api/irrigation/auto'),
  updateAutoWater: (body) => request('PUT', '/api/irrigation/auto', body),
  resetAutoWater: () => request('POST', '/api/irrigation/auto/reset'),

  // LLM alert layer
  liveRecommendations: (lang = 'en') => request('GET', `/api/recommendations/live?lang=${lang}`),

  // Admin
  adminUsers: () => request('GET', '/api/admin/users'),
  createUser: (body) => request('POST', '/api/admin/users', body),
  updateUser: (id, body) => request('PUT', `/api/admin/users/${id}`, body),
  deleteUser: (id) => request('DELETE', `/api/admin/users/${id}`),
  auditLog: (limit = 200) => request('GET', `/api/admin/audit-log?limit=${limit}`),
  adminDevices: () => request('GET', '/api/admin/devices'),
  shutdownServer: () => request('POST', '/api/admin/server/shutdown'),
  restartServer: () => request('POST', '/api/admin/server/restart'),
  restartFunnel: () => request('POST', '/api/admin/server/restart-funnel'),
  serverStatus: () => request('GET', '/api/admin/server/status'),
  releaseDevice: (id) => request('POST', `/api/admin/devices/${id}/release`),
  assignDevice: (id, nodeId) => request('POST', `/api/admin/devices/${id}/assign`, { node_id: nodeId }),
  newDeviceKey: (id) => request('POST', `/api/admin/devices/${id}/new-key`),
  resetRequests: () => request('GET', '/api/admin/reset-requests'),
  decideResetRequest: (id, approve) =>
    request('POST', `/api/admin/reset-requests/${id}/${approve ? 'approve' : 'reject'}`),
};

/**
 * Build an authenticated report-download URL and open it. The export
 * routes accept ?token= so the browser's download manager works without
 * needing the Authorization header.
 */
export function downloadReport(path, params = {}) {
  const q = new URLSearchParams(params);
  const token = getToken();
  if (token) q.set('token', token);
  const url = `${path}?${q.toString()}`;
  const a = document.createElement('a');
  a.href = url;
  a.download = '';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export const toNum = (v, f = 0) => {
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : f;
};

// One colour per Coffee Leaf Rust band (leaf, olive, amber, orange, cherry);
// the server's reports use the same (backend/services/clr-risk.js).
export const riskColor = (level) => {
  switch ((level || '').toUpperCase()) {
    case 'CRITICAL':
      return '#A8322A';
    case 'HIGH':
      return '#C4561C';
    case 'MODERATE':
    case 'MEDIUM':
      return '#A36B10';
    case 'LOW':
      return '#6F7D1E';
    default:
      return '#2F6B3A';
  }
};
