/**
 * FarmSense Brew — JWT Authentication Middleware
 * File: backend/middleware/auth.middleware.js
 */

const jwt = require("jsonwebtoken");
const { COOKIE_NAME } = require("./grafana-auth.middleware");

const sessions = require("../services/session.service");

/**
 * Middleware: Verify JWT token from Authorization header.
 * Attaches decoded user info (id, username, role) to req.user.
 * Also enforces single active session: a token whose sv claim no longer
 * matches users.session_version was displaced by a newer login.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  let token = authHeader && authHeader.split(" ")[1]; // "Bearer <token>"
  if (!token && req.cookies && req.cookies[COOKIE_NAME]) {
    token = req.cookies[COOKIE_NAME];
  }

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    try {
      const sv = await sessions.currentVersion(user.id);
      if ((user.sv ?? 0) !== sv) {
        return res.status(403).json({
          code: "SESSION_DISPLACED",
          error: "This session has ended: the account was signed out, or signed in on another device."
        });
      }
    } catch (_) {
      // DB hiccup — fall through rather than lock everyone out
    }
    sessions.touch(user.id); // this device is in use
    req.user = user; // { id, username, role, sv }
    next();
  });
}

/**
 * Middleware: Restrict route to agronomist role only.
 * Use AFTER authenticateToken.
 */
function requireAgronomist(req, res, next) {
  if (req.user.role !== "agronomist") {
    return res.status(403).json({ error: "Agronomist access required" });
  }
  next();
}

/**
 * Middleware: Allow both roles (agronomist and farm_owner).
 * Redundant but explicit — use for clarity in routes.
 */
function requireAnyRole(req, res, next) {
  const allowed = ["agronomist", "farm_owner", "field_staff"];
  if (!allowed.includes(req.user.role)) {
    return res.status(403).json({ error: "Unauthorized role" });
  }
  next();
}

module.exports = { authenticateToken, requireAgronomist, requireAnyRole };
