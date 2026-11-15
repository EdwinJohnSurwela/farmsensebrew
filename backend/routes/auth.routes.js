/**
 * FarmSense Brew — Auth Routes
 * File: backend/routes/auth.routes.js
 *
 * POST /api/auth/login  → returns JWT access token
 */

const express  = require("express");
const bcrypt   = require("bcrypt");
const jwt      = require("jsonwebtoken");
const db       = require("../services/db.service");
const { COOKIE_NAME } = require("../middleware/grafana-auth.middleware");
const sessions = require("../services/session.service");
const audit    = require("../services/audit.service");
const router   = express.Router();

// Token lifetime. Deliberately long (7 days) so a user who keeps the web app
// open is never signed out by a timer. A session ends on Logout, when the
// account signs in elsewhere, or after 7 days. Whether it still blocks a new
// sign-in depends on recent activity instead (session.service, 2 minutes).
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const JWT_EXPIRES_IN = "7d";
const COOKIE_MAX_AGE_MS = SESSION_TTL_MS; // match JWT expiry

/** Secure cookies are rejected by browsers on plain http:// — opt in when behind HTTPS. */
function sessionCookieAttrs() {
  const secure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE_MS,
    path: "/",
    secure
  };
}

function attachSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, sessionCookieAttrs());
}

// Best-effort human label for the device a session lives on. Prefers the
// client-sent X-Device-Label header (the Flutter app sends "an Android device"
// / "a web browser"); otherwise parses the browser User-Agent. Capped at the
// column width so it can't overflow.
function describeDevice(req) {
  const explicit = req.headers["x-device-label"];
  if (explicit && String(explicit).trim()) {
    return String(explicit).trim().slice(0, 120);
  }
  const ua = req.headers["user-agent"] || "";
  const os = /Windows/i.test(ua) ? "Windows"
    : /Android/i.test(ua) ? "Android"
    : /iPhone|iPad|iOS/i.test(ua) ? "iOS"
    : /Macintosh|Mac OS X/i.test(ua) ? "Mac"
    : /Linux/i.test(ua) ? "Linux" : "";
  const browser = /Edg\//i.test(ua) ? "Edge"
    : /Chrome\//i.test(ua) ? "Chrome"
    : /Firefox\//i.test(ua) ? "Firefox"
    : /Safari\//i.test(ua) ? "Safari" : "";
  const parts = [browser, os].filter(Boolean);
  return parts.length ? parts.join(" on ").slice(0, 120) : "another device";
}

// Mark this login as the active session. The device column is optional (older
// DBs may not have it) so fall back to the original UPDATE — login must never
// fail over a label.
async function markActiveSession(userId, deviceLabel) {
  try {
    await db.query(
      "UPDATE users SET last_login = NOW(), active_session_at = NOW(), active_session_device = ? WHERE id = ?",
      [deviceLabel, userId]
    );
  } catch (_) {
    await db.query(
      "UPDATE users SET last_login = NOW(), active_session_at = NOW() WHERE id = ?",
      [userId]
    );
  }
}

// POST /api/auth/login — body { username, password, force? }
// Single active session per account: logging in while another device holds
// a live session returns 409 ACTIVE_SESSION; retrying with force=true bumps
// session_version, which invalidates the other device's token.
// Wrong-password limit: 10 failed sign-ins for a username within 15 minutes
// blocks that username for the rest of the window. Counted per username only:
// behind the Pi's container network every visitor has the same address, so a
// per-address count would lock everyone out at once.
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_MAX = 10;
const failedLogins = new Map(); // key -> [timestamps]
function recentFailures(key) {
  const now = Date.now();
  const list = (failedLogins.get(key) || []).filter((t) => now - t < FAIL_WINDOW_MS);
  if (list.length) failedLogins.set(key, list); else failedLogins.delete(key);
  return list;
}
function noteFailure(...keys) {
  for (const k of keys) failedLogins.set(k, [...recentFailures(k), Date.now()]);
}
// Seconds until this username may try again (0 = not blocked). The block lifts
// when enough of the failures age out of the window to drop below FAIL_MAX.
function lockSecondsLeft(key) {
  const list = recentFailures(key);
  if (list.length < FAIL_MAX) return 0;
  const unblockAt = list[list.length - FAIL_MAX] + FAIL_WINDOW_MS;
  return Math.max(1, Math.ceil((unblockAt - Date.now()) / 1000));
}
function tooManyAttempts(res, seconds) {
  res.set("Retry-After", String(seconds));
  return res.status(429).json({
    code: "TOO_MANY_ATTEMPTS",
    retry_after: seconds,
    error: "Too many wrong sign-in attempts. Wait and try again.",
  });
}

router.post("/login", async (req, res) => {
  const { password, force } = req.body;
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }
  const userKey = `u:${String(username).toLowerCase()}`;
  const locked = lockSecondsLeft(userKey);
  if (locked) return tooManyAttempts(res, locked);

  try {
    // Fetch user from MySQL
    const [rows] = await db.query(
      "SELECT id, username, password_hash, role, full_name, session_version, active_session_at FROM users WHERE username = ? AND is_active = 1",
      [username]
    );

    if (rows.length === 0) {
      noteFailure(userKey);
      const nowLocked = lockSecondsLeft(userKey);
      if (nowLocked) return tooManyAttempts(res, nowLocked);
      return res.status(401).json({ error: "Invalid username or password" });
    }

    const user = rows[0];

    // Compare password against bcrypt hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      noteFailure(userKey);
      // the attempt that reaches the limit starts the countdown straight away
      const nowLocked = lockSecondsLeft(userKey);
      if (nowLocked) return tooManyAttempts(res, nowLocked);
      return res.status(401).json({ error: "Invalid username or password" });
    }
    failedLogins.delete(userKey);

    // Is another device using this account right now (seen in the last 2 minutes)?
    const sessionLive = sessions.isInUse(user.active_session_at);
    if (sessionLive && !force) {
      let activeDevice = null;
      try {
        const [d] = await db.query(
          "SELECT active_session_device FROM users WHERE id = ?", [user.id]
        );
        activeDevice = d[0]?.active_session_device || null;
      } catch (_) { /* device column may be absent on older DBs */ }
      const secs = Math.round(sessions.idleMs(user.active_session_at) / 1000);
      const seen = secs < 5 ? "just now" : `${secs} seconds ago`;
      return res.status(409).json({
        code: "ACTIVE_SESSION",
        active_device: activeDevice,
        active_seconds_ago: secs,
        error: `This account is in use on ${activeDevice || "another device"} (active ${seen}). Sign it out there and continue here?`
      });
    }

    // Every sign-in starts a new session version, so any older token (a tab
    // closed without logging out, or a device in use that is being replaced)
    // stops working.
    const sessionVersion = await sessions.bumpVersion(user.id);
    const device = describeDevice(req);
    if (sessionLive) {
      audit.record("SESSION_DISPLACED", user.username, user.username,
        "Signed in on a new device; the previous session was signed out");
    }
    audit.record("LOGIN", user.username, user.username, `Signed in on ${device}`);

    // Update last login + mark this as the active session (with device label)
    await markActiveSession(user.id, device);

    // Generate JWT (expires in 7 days — see SESSION_TTL_MS); sv ties it to the
    // account's current session_version for single-session enforcement.
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, sv: sessionVersion },
      process.env.JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    attachSessionCookie(res, token);

    res.json({
      message: "Login successful",
      token,
      user: {
        username: user.username,
        role: user.role,
        full_name: user.full_name
      }
    });
  } catch (err) {
    console.error("[Auth] Login error:", err.message);
    res.status(500).json({ error: "Server error during login" });
  }
});

// POST /api/auth/logout — ends this session for good: the token stops working
// and the next sign-in (any device) is not blocked. A device whose session had
// already been replaced by a newer sign-in changes nothing.
router.post("/logout", async (req, res) => {
  const { maxAge, ...clearOpts } = sessionCookieAttrs();
  res.clearCookie(COOKIE_NAME, clearOpts);
  try {
    const authHeader = req.headers.authorization;
    const raw = authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : (req.cookies && req.cookies[COOKIE_NAME]) || null;
    if (raw) {
      // An expired token cannot end anything: its session is already over.
      const decoded = jwt.verify(raw, process.env.JWT_SECRET);
      const current = await sessions.currentVersion(decoded.id);
      if ((decoded.sv ?? 0) === current) {
        await sessions.bumpVersion(decoded.id);
        await sessions.release(decoded.id);
        audit.record("LOGOUT", decoded.username, decoded.username, `Signed out on ${describeDevice(req)}`);
      }
    }
  } catch (_) { /* expired or missing token: nothing to end */ }
  res.json({ message: "Logged out" });
});

// ─── ADMIN-APPROVED PASSWORD RESET REQUESTS ───────────────────────
// The user asks for a password change; the admin approves it in the
// Admin Dashboard; then the user sets the new password here.
const resetRequests = require("../services/reset-request.service");

// POST /api/auth/reset-request: { username } (username only)
router.post(["/reset-request", "/forgot-password"], async (req, res) => {
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  if (!username) return res.status(400).json({ error: "Username is required" });
  try {
    const result = await resetRequests.createRequest(String(username).trim());
    // Same response whether or not the account exists (no enumeration)
    const generic = {
      message: "Request submitted. Ask your farm support contact to approve it, then come back here to set a new password."
    };
    if (result && result.existing) {
      return res.json({
        ...generic,
        message: result.status === "approved"
          ? "Your request is already approved. You can set a new password now."
          : "A request is already waiting for approval."
      });
    }
    if (result && result.created) {
      require("../services/audit.service").record(
        "RESET_REQUESTED", result.user.username, result.user.username,
        "Password change requested from login screen"
      );
    }
    res.json(generic);
  } catch (err) {
    console.error("[Auth] reset-request error:", err.message);
    res.status(500).json({ error: "Failed to submit request" });
  }
});

// GET /api/auth/reset-request/status?username=...
router.get("/reset-request/status", async (req, res) => {
  const username = typeof req.query.username === "string" ? req.query.username.trim() : "";
  if (!username) return res.status(400).json({ error: "username is required" });
  try {
    const s = await resetRequests.statusFor(String(username).trim());
    res.json(s);
  } catch (err) {
    console.error("[Auth] reset-request status error:", err.message);
    res.status(500).json({ error: "Failed to check status" });
  }
});

// POST /api/auth/reset-request/complete: { username, new_password }
router.post(["/reset-request/complete", "/reset-password"], async (req, res) => {
  const { new_password } = req.body;
  const username = typeof req.body.username === "string" ? req.body.username.trim() : "";
  if (!username || !new_password) {
    return res.status(400).json({ error: "username and new_password are required" });
  }
  if (new_password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  try {
    const completedUsername = await resetRequests.complete(String(username).trim(), new_password);
    require("../services/audit.service").record(
      "PASSWORD_RESET", completedUsername, completedUsername, "Password set after admin-approved reset request"
    );
    res.json({ message: "Password updated: you can now log in" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
