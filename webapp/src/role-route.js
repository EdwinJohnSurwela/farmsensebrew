const ROLES = new Set(['admin', 'agronomist', 'farm_owner', 'field_staff']);

export function dashboardPath(role) {
  return ROLES.has(role) ? `/${role}/dashboard` : '/login';
}
