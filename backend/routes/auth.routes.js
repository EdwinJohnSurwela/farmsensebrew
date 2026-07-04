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
const router   = express.Router();

const COOKIE_MAX_AGE_MS = 8 * 60 * 60 * 1000; // match JWT expiry

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

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  try {
    // Fetch user from MySQL
    const [rows] = await db.query(
      "SELECT id, username, password_hash, role, full_name FROM users WHERE username = ? AND is_active = 1",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];

    // Compare password against bcrypt hash
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update last login
    await db.query("UPDATE users SET last_login = NOW() WHERE id = ?", [user.id]);

    // Generate JWT (expires in 8 hours — a work day)
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "8h" }
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

// POST /api/auth/logout — clear session cookie (JWT in body is ignored)
router.post("/logout", (req, res) => {
  const { maxAge, ...clearOpts } = sessionCookieAttrs();
  res.clearCookie(COOKIE_NAME, clearOpts);
  res.json({ message: "Logged out" });
});

module.exports = router;
