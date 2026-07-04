/**
 * FarmSense Brew — JWT Authentication Middleware
 * File: backend/middleware/auth.middleware.js
 */

const jwt = require("jsonwebtoken");
const { COOKIE_NAME } = require("./grafana-auth.middleware");

/**
 * Middleware: Verify JWT token from Authorization header.
 * Attaches decoded user info (id, username, role) to req.user.
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

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user; // { id, username, role }
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
