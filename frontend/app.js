/**
 * FarmSense Brew — Homepage Application Logic
 * File: frontend/app.js
 *
 * Handles: Particle canvas, login modal, JWT auth via backend API,
 * role-based redirect to the correct Grafana dashboard.
 *
 * Backend: POST /api/auth/login → { token, user: { username, role, full_name } }
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────
// Same-origin relative URLs only — keeps session cookies aligned with the address bar
// (avoid mixing localhost vs 127.0.0.1, which use separate cookie jars).
const API_BASE = "";

// Grafana dashboards — served through the /grafana reverse proxy (auth + X-WEBAUTH-USER).
// After login, users are sent to their role-specific Grafana dashboard.
// If Grafana is unavailable, they fall back to the built-in Chart.js dashboard.
const GRAFANA_PREFIX = "/grafana";
const DASHBOARD_MAP = {
  agronomist:  "/d/farmsense-agro-001/farmsense-brew-agronomist-dashboard",
  farm_owner:  "/d/farmsense-owner-001/farmsense-brew-farm-owner-dashboard",
  field_staff: "/d/farmsense-staff-001/farmsense-brew-field-staff-dashboard"
};
const BUILTIN_DASHBOARD = "/dashboard.html";

// ─── PARTICLE CANVAS ──────────────────────────────────────────────────────────
(function initParticles() {
  const canvas = document.getElementById("particle-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let particles = [];
  let animId;

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createParticles() {
    particles = [];
    const count = Math.floor((canvas.width * canvas.height) / 18000);
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.8 + 0.4,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.4 + 0.1
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(74, 222, 128, ${p.opacity})`;
      ctx.fill();

      p.x += p.dx;
      p.y += p.dy;

      if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
    });

    // Draw connections between nearby particles
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(74, 222, 128, ${0.06 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }

    animId = requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener("resize", () => {
    resize();
    createParticles();
  });
})();

// ─── LOGIN MODAL ──────────────────────────────────────────────────────────────
function showLogin() {
  const overlay = document.getElementById("login-overlay");
  overlay.classList.add("active");
  setTimeout(() => document.getElementById("username").focus(), 300);
}

function hideLogin(event) {
  if (event && event.target !== event.currentTarget) return;
  const overlay = document.getElementById("login-overlay");
  overlay.classList.remove("active");
  clearError();
}

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const overlay = document.getElementById("login-overlay");
    if (overlay.classList.contains("active")) {
      overlay.classList.remove("active");
      clearError();
    }
  }
});

// ─── PASSWORD TOGGLE ──────────────────────────────────────────────────────────
function togglePassword() {
  const input = document.getElementById("password");
  const icon = document.getElementById("eye-icon");
  if (input.type === "password") {
    input.type = "text";
    icon.innerHTML = '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
  } else {
    input.type = "password";
    icon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
  }
}

// ─── DEMO ACCOUNT FILL ───────────────────────────────────────────────────────
function fillDemo(username, password) {
  document.getElementById("username").value = username;
  document.getElementById("password").value = password;
  clearError();
  // Visual feedback
  document.getElementById("username").style.borderColor = "var(--g4)";
  document.getElementById("password").style.borderColor = "var(--g4)";
  setTimeout(() => {
    document.getElementById("username").style.borderColor = "";
    document.getElementById("password").style.borderColor = "";
  }, 600);
}

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
function showError(message) {
  const el = document.getElementById("login-error");
  el.textContent = message;
  el.style.display = "block";
}

function clearError() {
  const el = document.getElementById("login-error");
  el.textContent = "";
  el.style.display = "none";
}

// ─── LOGIN HANDLER ────────────────────────────────────────────────────────────
async function handleLogin(event) {
  event.preventDefault();
  clearError();

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const submitBtn = document.getElementById("submit-btn");
  const submitText = document.getElementById("submit-text");
  const submitLoader = document.getElementById("submit-loader");

  if (!username || !password) {
    showError("Please enter both username and password.");
    return;
  }

  // Show loading state
  submitBtn.disabled = true;
  submitText.style.display = "none";
  submitLoader.style.display = "inline-block";

  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Login failed");
    }

    // Store JWT token
    localStorage.setItem("farmsense_token", data.token);
    localStorage.setItem("farmsense_user", JSON.stringify(data.user));

    // Show redirect screen
    showRedirect(data.user);

  } catch (err) {
    if (err.name === "TypeError" && err.message.includes("fetch")) {
      showError("Cannot reach the API. Start the backend server to sign in and open dashboards.");
    } else {
      showError(err.message || "Login failed. Please check your credentials.");
    }
  } finally {
    submitBtn.disabled = false;
    submitText.style.display = "inline";
    submitLoader.style.display = "none";
  }
}

// ─── REDIRECT SCREEN ─────────────────────────────────────────────────────────
// After login (or auto-session), redirect straight to Grafana OSS dashboard.
// SSO is handled by the auth proxy (X-WEBAUTH-USER) — no second login needed.
// If Grafana is down, the Express 502 page links to the built-in fallback.
function showRedirect(user, quick) {
  document.getElementById("login-overlay").classList.remove("active");

  const roleLabels = {
    agronomist:  "🔬 Agronomist",
    farm_owner:  "🏡 Farm Owner",
    field_staff: "👷 Field Staff"
  };

  document.getElementById("redirect-title").textContent =
    quick ? `Welcome back, ${user.full_name}!` : `Welcome, ${user.full_name}!`;
  document.getElementById("redirect-message").textContent =
    `Redirecting to ${roleLabels[user.role] || user.role} Dashboard...`;

  const overlay = document.getElementById("redirect-overlay");
  overlay.style.display = "flex";

  // Build Grafana target URL
  const pending = sessionStorage.getItem("pending_grafana_path");
  sessionStorage.removeItem("pending_grafana_path");
  const dashPath = DASHBOARD_MAP[user.role];
  const grafanaTarget = pending && pending.startsWith("/grafana")
    ? pending
    : (dashPath ? GRAFANA_PREFIX + dashPath : GRAFANA_PREFIX + "/");

  // Redirect — shorter delay for returning users
  const delay = quick ? 1500 : 2500;
  setTimeout(() => { window.location.href = grafanaTarget; }, delay);
}

// ─── DEEP LINK / GRAFANA LOGIN REDIRECT ─────────────────────────────────────
(function bootstrapFromPortalQuery() {
  const params = new URLSearchParams(window.location.search);
  const afterLogin = params.get("afterLogin");
  const loginRequired = params.get("login") === "required";
  if (afterLogin && afterLogin.startsWith("/grafana")) {
    sessionStorage.setItem("pending_grafana_path", afterLogin);
  }
  if (loginRequired || (afterLogin && afterLogin.startsWith("/grafana"))) {
    showLogin();
    if (window.history.replaceState) {
      window.history.replaceState({}, "", window.location.pathname || "/");
    }
  }
})();

// ─── AUTO-LOGIN CHECK ─────────────────────────────────────────────────────────
// If a valid session exists, skip the portal and go straight to Grafana.
// Includes loop guard to prevent redirect loops when Grafana rejects auth.
(function checkExistingSession() {
  const token = localStorage.getItem("farmsense_token");
  const userRaw = localStorage.getItem("farmsense_user");
  if (!token || !userRaw) return;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new Error("expired");
    const userData = JSON.parse(userRaw);
    console.log("[FarmSense] Existing session for:", userData.username);

    const params = new URLSearchParams(window.location.search);

    // Don't auto-redirect if:
    // - URL has login/afterLogin params (deep-link flow)
    // - URL has ?from=grafana (came from failed Grafana redirect — would loop)
    if (params.has("login") || params.has("afterLogin") || params.has("from")) {
      console.log("[FarmSense] Skipping auto-redirect (query param guard)");
      return;
    }

    // Loop guard: if we redirected within the last 15 seconds, don't redirect again
    const lastRedirect = sessionStorage.getItem("farmsense_last_redirect");
    if (lastRedirect && Date.now() - parseInt(lastRedirect) < 15000) {
      console.log("[FarmSense] Skipping auto-redirect (cooldown)");
      return;
    }

    // Auto-redirect to Grafana
    sessionStorage.setItem("farmsense_last_redirect", Date.now().toString());
    showRedirect(userData, true);
  } catch {
    localStorage.removeItem("farmsense_token");
    localStorage.removeItem("farmsense_user");
  }
})();
