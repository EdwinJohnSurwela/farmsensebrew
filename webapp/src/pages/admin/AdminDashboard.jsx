import { useEffect, useState } from 'react';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { toast, confirmDialog } from '../../ui';
import KpiCard from '../../components/KpiCard';
import PasswordInput from '../../components/PasswordInput';
import { IconUsers, IconAdd, IconKey, IconCheck, IconClose, IconEdit, IconLock, IconUnlock, IconDelete } from '../../icons';

const ROLE_TONES = {
  admin: 'purple',
  agronomist: 'blue',
  farm_owner: 'green',
  field_staff: 'orange',
};

const ROLE_LABELS = {
  admin: 'Admin',
  agronomist: 'Agronomist',
  farm_owner: 'Farm Owner',
  field_staff: 'Field Staff',
};
const ROLE_COLORS = {
  admin: '#6b4a30',
  agronomist: '#2a6479',
  farm_owner: '#2f6b3a',
  field_staff: '#a4532c',
};

/// Admin dashboard — live user CRUD against /api/admin/users,
/// mirroring the Flutter admin screen.
export default function AdminDashboard() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [resetRequests, setResetRequests] = useState([]);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null | 'new' | user object

  const load = async () => {
    try {
      const res = await api.adminUsers();
      setUsers(res.data || []);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load users');
    }
    // Reset requests are secondary — never block the user table on them
    try {
      const rr = await api.resetRequests();
      setResetRequests(rr.data || []);
    } catch {
      /* ignore */
    }
  };

  const decideRequest = async (r, approve) => {
    try {
      await api.decideResetRequest(r.id, approve);
      approve
        ? toast.success(`${r.username} can now set a new password from the login screen`)
        : toast.success(`Request from ${r.username} rejected`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const filtered = users.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return [u.username, u.full_name, u.role].some((f) =>
      (f || '').toLowerCase().includes(q)
    );
  });

  const toggleActive = async (u) => {
    try {
      await api.updateUser(u.id, { is_active: !u.is_active });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (u) => {
    const ok = await confirmDialog({
      title: `Delete ${u.full_name}?`,
      text: `The "${u.username}" account will be permanently removed and can no longer log in.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteUser(u.id);
      toast.success(`${u.username} deleted`);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const activeTotal = users.filter((u) => u.is_active).length;

  return (
    <div>
      <header className="banner grad-admin">
        <div className="banner-row">
          <div>
            <h1>Overview</h1>
            <p className="sub">User Role Management &amp; Access Control</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 20, fontWeight: 800 }}>
              {activeTotal}/{users.length}
            </div>
            <div style={{ fontSize: 11, opacity: 0.8 }}>Active Users</div>
            <div style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>
              Welcome, {me?.full_name}
            </div>
          </div>
        </div>
      </header>

      <div className="page">
        {error && <p className="error-text">{error}</p>}

        {/* Role stat tiles */}
        <div className="kpi-row cols-4" style={{ marginBottom: 16 }}>
          {Object.entries(ROLE_LABELS).map(([role, label]) => (
            <KpiCard
              key={role}
              icon={<IconUsers />}
              tone={ROLE_TONES[role]}
              label={label}
              value={users.filter((u) => u.role === role && u.is_active).length}
              unit="active"
              status={`${users.filter((u) => u.role === role).length} total account(s)`}
              statusTone={ROLE_TONES[role]}
            />
          ))}
        </div>

        {/* Password change requests (admin approval) */}
        {resetRequests.length > 0 && (
          <div
            className="card"
            style={{
              marginBottom: 14,
              border: resetRequests.some((r) => r.status === 'pending')
                ? '1px solid #e8d09f'
                : undefined,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <strong style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IconKey /> Password change requests</strong>
              {resetRequests.some((r) => r.status === 'pending') && (
                <span className="pill" style={{ background: 'var(--amber)', color: '#fff' }}>
                  {resetRequests.filter((r) => r.status === 'pending').length} pending
                </span>
              )}
            </div>
            {resetRequests
              .filter((r) => r.status === 'pending')
              .map((r) => (
                <div
                  key={r.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {r.full_name} ({r.username})
                    </div>
                    <div className="muted" style={{ fontSize: 11 }}>
                      {ROLE_LABELS[r.role] || r.role} · requested {r.requested_at}
                    </div>
                  </div>
                  <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={() => decideRequest(r, false)}>
                    Reject
                  </button>
                  <button className="btn sm" style={{ background: 'var(--green)' }} onClick={() => decideRequest(r, true)}>
                    Approve
                  </button>
                </div>
              ))}
            {resetRequests
              .filter((r) => r.status !== 'pending')
              .slice(0, 3)
              .map((r) => (
                <div
                  key={r.id}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}
                >
                  <div style={{ flex: 1, fontSize: 12 }} className="muted">
                    {r.full_name} ({r.username})
                  </div>
                  <span
                    className="pill"
                    style={{
                      background:
                        r.status === 'rejected' ? 'rgba(239,68,68,.12)' : 'rgba(34,197,94,.12)',
                      color: r.status === 'rejected' ? 'var(--red)' : 'var(--green)',
                    }}
                  >
                    {r.status.toUpperCase()}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <input
            style={{
              flex: 1,
              padding: '9px 12px',
              border: '1px solid var(--border)',
              borderRadius: 10,
            }}
            placeholder="Search by name, username or role…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="btn purple" onClick={() => setEditing('new')}>
            <IconAdd weight="bold" /> Add User
          </button>
        </div>
        <div className="chip-row" style={{ marginBottom: 14, '--accent': 'var(--admin)' }}>
          {['all', ...Object.keys(ROLE_LABELS)].map((r) => (
            <button
              key={r}
              className={`chip ${roleFilter === r ? 'active' : ''}`}
              onClick={() => setRoleFilter(r)}
            >
              {r === 'all'
                ? `All (${users.length})`
                : `${ROLE_LABELS[r]} (${users.filter((u) => u.role === r).length})`}
            </button>
          ))}
        </div>

        {/* User table */}
        <div className="card table-wrap" style={{ padding: 0 }}>
          <table className="data">
            <thead>
              <tr>
                <th>NAME</th>
                <th>USERNAME</th>
                <th>ROLE</th>
                <th>STATUS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.full_name}</td>
                  <td>{u.username}</td>
                  <td>
                    <span
                      className="pill"
                      style={{
                        background: `${ROLE_COLORS[u.role]}1a`,
                        color: ROLE_COLORS[u.role],
                      }}
                    >
                      {ROLE_LABELS[u.role] || u.role}
                    </span>
                  </td>
                  <td>
                    <span style={{ color: u.is_active ? 'var(--green)' : 'var(--red)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {u.is_active ? <><IconCheck weight="bold" /> Granted</> : <><IconClose weight="bold" /> Revoked</>}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn sm ghost" onClick={() => setEditing(u)} title="Edit / change password"><IconEdit /></button>{' '}
                    <button className="btn sm ghost" onClick={() => toggleActive(u)} title={u.is_active ? 'Revoke access' : 'Grant access'}>
                      {u.is_active ? <IconLock /> : <IconUnlock />}
                    </button>{' '}
                    <button className="btn sm ghost" onClick={() => remove(u)} title="Delete user"><IconDelete /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">No users match this filter</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <UserModal
          user={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UserModal({ user, onClose, onSaved }) {
  const isEdit = !!user;
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    username: user?.username || '',
    role: user?.role || 'field_staff',
    password: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const save = async () => {
    if (!form.username.trim() || !form.full_name.trim()) {
      setError('Username and full name are required');
      return;
    }
    if (!isEdit && form.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setBusy(true);
    try {
      if (isEdit) {
        await api.updateUser(user.id, {
          username: form.username.trim(),
          full_name: form.full_name.trim(),
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        });
      } else {
        await api.createUser({
          username: form.username.trim(),
          full_name: form.full_name.trim(),
          role: form.role,
          password: form.password,
        });
      }
      onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{isEdit ? `Edit User: ${user.username}` : 'Add User'}</h2>
        <div className="field"><label>Full Name</label><input value={form.full_name} onChange={set('full_name')} /></div>
        <div className="field"><label>Username</label><input value={form.username} onChange={set('username')} /></div>
        <div className="field">
          <label>Role</label>
          <select value={form.role} onChange={set('role')}>
            {Object.entries(ROLE_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>{isEdit ? 'New Password (leave blank to keep current)' : 'Password'}</label>
          <PasswordInput value={form.password} onChange={set('password')} autoComplete="new-password" />
        </div>
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn purple" disabled={busy} onClick={save}>
            {busy ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}
