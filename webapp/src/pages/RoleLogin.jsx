import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { api } from '../api';
import { toast } from '../ui';
import PasswordInput from '../components/PasswordInput';
import { dashboardPath } from '../role-route';
import farmLogo from '../assets/jpcf-logo.jpg';


/// Turn any login failure into a message a farm user can act on,
/// never a raw technical error.
function loginErrorMessage(err) {
  if (err?.status === 401) return 'Invalid username or password.';
  if (err?.status === 400) return 'Please enter your username and password.';
  if (err?.status === 409) return 'This account is still signed in on another device.';
  if (err?.status === 429) return 'Too many wrong sign-in attempts. Wait a few minutes and try again.';
  if (err?.status >= 500) return 'The server had a problem. Please try again in a moment.';
  if (err instanceof TypeError) return "Can't reach the server. Check that you're connected to the farm WiFi.";
  return 'Something went wrong. Please try again.';
}

/// "14 min 05 s", or "45 s" in the last minute.
function timeLeft(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`;
}

export default function RoleLogin() {
  const accent = 'var(--owner)';
  const location = useLocation();
  const [username, setUsername] = useState(location.state?.username || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  // Sign-in block from the server (per username): which name and when it lifts.
  const [lock, setLock] = useState(null); // { user, until }
  const [now, setNow] = useState(Date.now());
  const { login } = useAuth();
  const navigate = useNavigate();

  const lockActive = lock && lock.user === username.trim().toLowerCase() && lock.until > now;
  useEffect(() => {
    if (!lock) return undefined;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= lock.until) {
        setLock(null);
        setError('');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [lock]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const user = await login(username.trim(), password);
      const destination = dashboardPath(user?.role);
      if (destination === '/login') throw new Error('Invalid login response');
      navigate(destination, { replace: true });
    } catch (err) {
      const secs = Number(err?.data?.retry_after);
      if (err?.status === 429 && secs > 0) {
        setLock({ user: username.trim().toLowerCase(), until: Date.now() + secs * 1000 });
        setNow(Date.now());
        setError('');
      } else {
        setError(loginErrorMessage(err));
      }
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap" style={{ '--accent': accent }}>
      <div className="login-card">
        <img src={farmLogo} alt="Javier Permaculture Farm" style={{ width: 68, height: 68, objectFit: 'contain', borderRadius: '50%' }} />
        <h1>FarmSense Brew</h1>
        <p className="sub">Sign in to your account</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-username">Username</label>
            <input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              autoComplete="username"
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="login-password">Password</label>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
          <div style={{ textAlign: 'right', marginBottom: 14 }}>
            <button type="button" className="link-btn" onClick={() => setShowForgot(true)}>
              Forgot password?
            </button>
          </div>
          {lockActive && (
            <p className="error-text" role="alert" style={{ marginBottom: 10 }}>
              Too many wrong sign-in attempts. Try again in <strong>{timeLeft(lock.until - now)}</strong>.
            </p>
          )}
          {error && <p className="error-text" role="alert" style={{ marginBottom: 10 }}>{error}</p>}
          <button className="btn" style={{ width: '100%', background: accent, padding: 12 }} disabled={busy || lockActive}>
            {busy ? 'Logging in…' : lockActive ? `Try again in ${timeLeft(lock.until - now)}` : 'Login'}
          </button>
        </form>
        {/* Privacy consent (RA 10173): logging in = consent */}
        <p className="muted" style={{ fontSize: 11, marginTop: 10 }}>
          By logging in you agree to the{' '}
          <button type="button" className="link-btn" style={{ fontSize: 11, color: accent }}
            onClick={() => setShowPrivacy(true)}>
            Terms &amp; Conditions and Privacy Notice
          </button>
        </p>
        <div style={{ marginTop: 16 }}>
          <button className="link-btn" style={{ color: 'var(--text-2)' }} onClick={() => navigate('/')}>
            ← Back to home
          </button>
        </div>
      </div>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
      {showPrivacy && (
        <div className="modal-backdrop" onClick={() => setShowPrivacy(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Privacy Notice &amp; Terms</h2>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-2)', maxHeight: '55vh', overflowY: 'auto' }}>
              <p><strong>FarmSense Brew: Data Privacy Notice (RA 10173)</strong></p>
              <p><strong>What we collect:</strong> the full name and username of authorized
                farm staff, any contact details saved in their account profile, plus farm sensor telemetry (temperature, humidity, soil moisture).</p>
              <p><strong>Why we collect it:</strong> to authenticate users, apply role-based access, operate
                monitoring and irrigation, and keep an audit trail of sign-ins, sign-outs and administrative actions.</p>
              <p><strong>How it is protected:</strong> data stays on the farm's local server; passwords are
                stored only as bcrypt hashes; access is role-restricted; one active session per account;
                signing out ends the session at once, and a session ends after 7 days.</p>
              <p><strong>Your rights:</strong> you may request access, correction, or deletion of your account
                data from the farm support contact at any time (right to erasure).</p>
              <p><strong>Terms of use:</strong> the system is for authorized personnel of Javier Permaculture
                Farm only. Actions performed under your account are recorded in the audit log and attributed
                to you. By logging in, you consent to this notice.</p>
            </div>
            <div className="modal-actions">
              <button className="btn" style={{ background: accent }} onClick={() => setShowPrivacy(false)}>
                I understand
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ForgotPasswordModal({ onClose }) {
  const [username, setUsername] = useState('');
  const [status, setStatus] = useState(null); // none|pending|approved|rejected|completed
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null); // { text, error }

  const approved = status === 'approved';

  const submitRequest = async () => {
    if (!username.trim()) {
      setMsg({ text: 'Enter your username', error: true });
      return;
    }
    setBusy(true);
    try {
      const res = await api.requestPasswordReset(username.trim());
      setMsg({ text: res?.message || 'Request submitted. Ask the farm support contact to approve it.', error: false });
      await checkStatus(true);
    } catch {
      setMsg({ text: 'Could not reach the server. Try again.', error: true });
    }
    setBusy(false);
  };

  const checkStatus = async (silent = false) => {
    if (!username.trim()) {
      setMsg({ text: 'Enter your username first', error: true });
      return;
    }
    if (!silent) setBusy(true);
    try {
      const res = await api.resetRequestStatus(username.trim());
      const s = res?.status || 'none';
      setStatus(s);
      if (!silent) {
        const texts = {
          approved: { text: 'Approved! Set your new password below.', error: false },
          pending: { text: 'Still waiting for the farm support contact to approve it. Check again in a bit.', error: false },
          rejected: { text: 'Your request was rejected. Contact your farm support contact.', error: true },
          completed: { text: 'That request was already used. Submit a new one if needed.', error: false },
          none: { text: 'No request found for that account. Submit one first.', error: true },
        };
        setMsg(texts[s] || texts.none);
      }
    } catch {
      setMsg({ text: 'Could not reach the server. Try again.', error: true });
    }
    if (!silent) setBusy(false);
  };

  const setNewPassword = async () => {
    if (pw.length < 6) return setMsg({ text: 'Password must be at least 6 characters', error: true });
    if (pw !== pw2) return setMsg({ text: 'Passwords do not match', error: true });
    setBusy(true);
    try {
      await api.completePasswordReset(username.trim(), pw);
      onClose();
      toast.success('Password updated. Log in with your new password.');
    } catch (err) {
      setMsg({ text: err.message || 'Reset failed', error: true });
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{approved ? 'Set New Password' : 'Request Password Change'}</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          {approved
            ? 'Your request was approved by your farm support contact.'
            : 'Enter your username and request a password change. The farm support contact approves it in the account management screen, then you come back here to set a new password.'}
        </p>
        <div className="field">
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        {approved && (
          <>
            <div className="field">
              <label>New password</label>
              <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="field">
              <label>Confirm new password</label>
              <PasswordInput value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" />
            </div>
          </>
        )}
        {msg && <p className={msg.error ? 'error-text' : 'ok-text'}>{msg.text}</p>}
        <div className="modal-actions">
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn ghost" disabled={busy} onClick={() => checkStatus(false)}>
            Check status
          </button>
          <button className="btn" disabled={busy} onClick={approved ? setNewPassword : submitRequest}>
            {busy ? 'Working…' : approved ? 'Set New Password' : 'Request Change'}
          </button>
        </div>
      </div>
    </div>
  );
}
