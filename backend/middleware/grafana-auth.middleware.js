/**
 * FarmSense Brew — Grafana auth proxy gate
 * Validates JWT (Bearer or HttpOnly cookie) before proxying to Grafana.
 */

const jwt = require("jsonwebtoken");

const COOKIE_NAME = "farmsense_token";

function tokenFromAuthorization(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return null;
}

function tokenFromCookies(req) {
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }
  return null;
}

function tokenFromCookieHeader(req) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const p = part.trim();
    const eq = p.indexOf("=");
    if (eq === -1) continue;
    const name = p.slice(0, eq);
    const val = p.slice(eq + 1);
    if (name === COOKIE_NAME) {
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}

function extractToken(req) {
  return tokenFromAuthorization(req) || tokenFromCookies(req);
}

function verifyGrafanaUser(req) {
  const token = extractToken(req);
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/** Used for HTTP upgrade (WebSocket): no cookie-parser on req.cookies */
function verifyGrafanaUserFromUpgradeReq(req) {
  const token = tokenFromAuthorization(req) || tokenFromCookieHeader(req);
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Browser path only — prevents open redirects. Allows Grafana dashboard URLs under /grafana.
 */
function toSafeGrafanaBrowserPath(redirectTo) {
  if (typeof redirectTo !== "string" || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "";
  }
  if (redirectTo.startsWith("/grafana/")) return redirectTo;
  if (redirectTo.startsWith("/d/")) return "/grafana" + redirectTo;
  return "";
}

function requireGrafanaAuth(req, res, next) {
  const user = verifyGrafanaUser(req);
  if (!user) {
    const pathOnly = req.originalUrl.split("?")[0];
    const afterLogin = pathOnly.startsWith("/grafana") ? pathOnly : "/grafana/";
    const qs = new URLSearchParams({ login: "required", afterLogin });
    return res.redirect(302, "/?" + qs.toString());
  }
  req.grafanaUser = user;
  next();
}

module.exports = {
  COOKIE_NAME,
  extractToken,
  requireGrafanaAuth,
  verifyGrafanaUserFromUpgradeReq,
  toSafeGrafanaBrowserPath
};
