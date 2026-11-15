/**
 * FarmSense Brew — ML Service Proxy Routes (FB-51)
 * Forwards to the FastAPI CLR-risk model (ML_SERVICE_URL) so apps only
 * ever talk to the main API.
 *
 * POST /api/ml/predict  — { temperature, humidity, soil_pct }
 * GET  /api/ml/metrics  — hold-out evaluation (P/R/F1, FB-57)
 * GET  /api/ml/health   — model service liveness
 */
const express = require("express");
const router = express.Router();

const ML_BASE = process.env.ML_SERVICE_URL || "http://127.0.0.1:5000";

async function forward(res, url, options) {
  try {
    const r = await fetch(url, options);
    const body = await r.json().catch(() => ({}));
    res.status(r.status).json(body);
  } catch {
    res.status(503).json({ error: "ML service unavailable", target: ML_BASE });
  }
}

router.post("/predict", (req, res) =>
  forward(res, `${ML_BASE}/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req.body),
  })
);

router.get("/metrics", (req, res) => forward(res, `${ML_BASE}/metrics`));
router.get("/health", (req, res) => forward(res, `${ML_BASE}/health`));

module.exports = router;
