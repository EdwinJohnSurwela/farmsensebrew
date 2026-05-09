/**
 * FarmSense Brew — Recommendation Routes
 * File: backend/routes/recommendation.routes.js
 *
 * GET  /api/recommendations/latest     → most recent recommendation (Farm Owner View)
 * GET  /api/recommendations/history    → all past recommendations
 * POST /api/recommendations/generate   → manually trigger Gemini for a node (testing)
 */

const express = require("express");
const db      = require("../services/db.service");
const gemini  = require("../services/gemini.service");
const router  = express.Router();

// GET /api/recommendations/latest
router.get("/latest", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.id, r.node_id, r.risk_level,
             r.what_happened, r.why_it_matters, r.what_to_do,
             r.generated_at
      FROM recommendations r
      ORDER BY r.generated_at DESC
      LIMIT 5
    `);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// GET /api/recommendations/history?days=7
router.get("/history", async (req, res) => {
  const days = parseInt(req.query.days) || 7;
  try {
    const [rows] = await db.query(
      `SELECT * FROM recommendations
       WHERE generated_at >= NOW() - INTERVAL ? DAY
       ORDER BY generated_at DESC`,
      [days]
    );
    res.json({ data: rows, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch recommendation history" });
  }
});

// POST /api/recommendations/generate — manual trigger for testing
router.post("/generate", async (req, res) => {
  const { node_id, temperature, humidity, soil_pct, risk_level } = req.body;

  if (!node_id || temperature == null || humidity == null || soil_pct == null) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const recommendation = await gemini.generateRecommendation({
      node_id, temperature, humidity, soil_pct,
      risk_level: risk_level || "MODERATE"
    });

    // Store in MySQL
    await db.query(
      `INSERT INTO recommendations (node_id, risk_level, what_happened, why_it_matters, what_to_do, full_response)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        node_id,
        recommendation.risk_level,
        recommendation.what,
        recommendation.why,
        recommendation.what_to_do,
        recommendation.full_response
      ]
    );

    res.json({ message: "Recommendation generated", recommendation });
  } catch (err) {
    console.error("[Gemini] Error:", err.message);
    res.status(500).json({ error: "Failed to generate recommendation" });
  }
});

module.exports = router;
