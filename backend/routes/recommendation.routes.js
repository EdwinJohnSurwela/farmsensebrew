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
const sensors = require("../services/sensor.service");
const router  = express.Router();

// Gemini answers are cached for 10 minutes per language (the free tier has a
// request quota). Rule-based text is cheap, so it is always built fresh and
// always matches the latest numbers on screen.
const geminiCache = {}; // lang -> { at, data }
const LIVE_CACHE_MS = 10 * 60 * 1000;
// Readings as people read them: 24.3°C, 78%, 61%.
const fmt = (r) => ({ t: Number(r.temperature).toFixed(1), h: Number(r.humidity).toFixed(0), s: Number(r.soil_pct).toFixed(0) });
const nodeName = (id) => `Node ${parseInt(String(id).replace(/\D/g, ""), 10) || id}`;

/** Rule-based text (English, everyday Tagalog or Taglish) so the panel works without a Gemini key. */
const RULE_TEXT = {
  en: {
    what: (r) => { const v = fmt(r); return `${nodeName(r.node_id)} reads ${v.t}°C, ${v.h}% humidity and ${v.s}% soil moisture.`; },
    CRITICAL: { headline: "Critical leaf rust risk: inspect now",
      why: "The leaves are likely wet and the temperature is in the range where Coffee Leaf Rust spores germinate fastest.",
      action: "Do not irrigate around this node. Inspect leaf undersides now for yellow-orange spots; pick off and bag infected leaves (do not leave them on the ground), prune for air flow, and tell the agronomist right away." },
    HIGH: { headline: "High leaf rust risk: inspect today",
      why: "The leaves may be damp and the humidity and temperature favor Coffee Leaf Rust spore germination.",
      action: "Do not irrigate around this node. Inspect leaf undersides for yellow-orange spots; if you find any, remove and bag those leaves, then report what you found." },
    MODERATE: { headline: "Conditions trending toward rust risk",
      why: "Humidity and temperature are approaching the range that favors Coffee Leaf Rust.",
      action: "Re-check around this node within 4 hours and improve air circulation; hold off on overhead watering." },
    LOW: { headline: "Watch: slight leaf rust risk",
      why: "Some conditions favor Coffee Leaf Rust, but the leaves are likely dry.",
      action: "Continue routine monitoring; no action needed yet." },
    MINIMAL: { headline: "Conditions normal",
      why: "Current readings are outside the risk window for Coffee Leaf Rust.",
      action: "Continue routine monitoring and standard care." },
  },
  // Everyday Tagalog, the way the farm staff talk: short sentences, no deep
  // words. Words people already say in English (humidity, node) stay.
  // No chemical sprays anywhere (17 Oct 2026): the farm is organic.
  tl: {
    what: (r) => { const v = fmt(r); return `Sa ${nodeName(r.node_id)}: ${v.t}°C, ${v.h}% humidity, at ${v.s}% ang basa ng lupa.`; },
    CRITICAL: { headline: "Delikado na: silipin agad ang mga dahon",
      why: "Malamang basa ang mga dahon at nasa init na pinakagusto ng kalawang. Dito pinakamabilis tumubo ang kalawang sa dahon ng kape.",
      action: "Wag diligan ang paligid ng node na 'to. Silipin agad ang ilalim ng mga dahon kung may dilaw o orange na batik. Pitasin at isupot ang mga dahong may batik (wag iwan sa lupa), bawasan ang sanga para humangin, tapos sabihan agad ang agronomist." },
    HIGH: { headline: "Mataas ang tsansa ng kalawang: silipin ngayon",
      why: "Baka basa-basa ang mga dahon, at gusto ng kalawang ang humidity at init ngayon. Dito mabilis kumalat ang kalawang sa dahon ng kape.",
      action: "Wag munang diligan ang paligid ng node na 'to. Silipin ang ilalim ng mga dahon kung may dilaw o orange na batik. Kung meron, pitasin at isupot ang mga dahong yun, tapos i-report." },
    MODERATE: { headline: "Papunta na sa lagay na gusto ng kalawang",
      why: "Malapit na ang humidity at init sa lagay na gusto ng kalawang.",
      action: "Balikan ang node na 'to pagkalipas ng 4 na oras at ayusin ang daloy ng hangin sa paligid. Wag munang magdilig mula sa taas." },
    LOW: { headline: "Bantayan lang: may kaunting tsansa ng kalawang",
      why: "May ilang lagay na gusto ng kalawang, pero mukhang tuyo pa ang mga dahon.",
      action: "Tuloy lang ang normal na bantay. Wala pang kailangang gawin." },
    MINIMAL: { headline: "Okay ang lagay",
      why: "Malayo pa ang mga reading ngayon sa lagay na gusto ng kalawang.",
      action: "Tuloy lang ang normal na bantay at alaga." },
  },
  // Taglish: the everyday mix of Tagalog and English.
  taglish: {
    what: (r) => { const v = fmt(r); return `${nodeName(r.node_id)}: ${v.t}°C, ${v.h}% humidity, ${v.s}% soil moisture.`; },
    CRITICAL: { headline: "Critical na ang risk ng leaf rust: i-check agad",
      why: "Malamang wet ang leaves at nasa temp na pinakagusto ng Coffee Leaf Rust, kaya pinakamabilis mag-germinate ang rust spores.",
      action: "Wag mag-water sa paligid ng node na 'to. I-check agad ang ilalim ng leaves kung may yellow-orange spots. Tanggalin at isupot ang leaves na may spots (wag iwan sa lupa), i-prune para humangin, tapos i-report agad sa agronomist." },
    HIGH: { headline: "High ang risk ng leaf rust: i-check today",
      why: "Baka damp ang leaves, at gusto ng Coffee Leaf Rust ang humidity at temp ngayon, kaya mabilis itong kumalat.",
      action: "Wag munang mag-water sa paligid ng node na 'to. I-check ang ilalim ng leaves kung may yellow-orange spots. Kung meron, tanggalin at isupot ang leaves na yun, tapos i-report agad." },
    MODERATE: { headline: "Papunta na sa rust-friendly na conditions",
      why: "Malapit na ang humidity at temp sa range na gusto ng Coffee Leaf Rust.",
      action: "Balikan ang node na 'to within 4 hours at i-improve ang air flow sa paligid. Wag munang mag-overhead watering." },
    LOW: { headline: "Watch lang: may konting risk ng leaf rust",
      why: "May ilang conditions na gusto ng Coffee Leaf Rust, pero mukhang dry pa ang leaves.",
      action: "Tuloy lang ang routine monitoring. Wala pang kailangang gawin." },
    MINIMAL: { headline: "Normal ang conditions",
      why: "Wala pa sa risk range ng Coffee Leaf Rust ang readings ngayon.",
      action: "Tuloy lang ang routine monitoring at normal na care." },
  },
};

function ruleBasedAlert(r, lang = "en") {
  const t = RULE_TEXT[lang] || RULE_TEXT.en;
  const level = t[r.clr_risk] ? r.clr_risk : "MINIMAL";
  return { node_id: r.node_id, risk_level: level, what: t.what(r), ...t[level] };
}

// GET /api/recommendations/live?lang=en|tl|taglish  one recommendation per online node
router.get("/live", async (req, res) => {
  try {
    const lang = ["tl", "taglish"].includes(req.query.lang) ? req.query.lang : "en";
    // Only nodes reporting now: an offline node's old reading is not a live condition.
    // A node whose air sensor is not reading has no risk level, so no advice;
    // the screens tell the staff to check that sensor instead.
    const readings = (await sensors.getLatestReadings({ onlineOnly: true }))
      .filter(r => r.temperature != null && r.humidity != null);
    if (readings.length === 0) {
      return res.json({ data: [], source: gemini.available() ? "gemini" : "rules", lang, cached: false });
    }
    // Gemini (the light Flash-Lite model) when a key is set and it answered last time;
    // otherwise, or if it fails or is too slow now, the rule-based text below.
    if (gemini.available()) {
      const online = new Set(readings.map(r => r.node_id));
      const c = geminiCache[lang];
      const covers = c && readings.every(r => c.data.some(d => d.node_id === r.node_id));
      if (covers && Date.now() - c.at < LIVE_CACHE_MS && req.query.refresh !== "1") {
        return res.json({ data: c.data.filter(d => online.has(d.node_id)), source: "gemini", lang, cached: true });
      }
      try {
        const guidance = readings.map(r => ruleBasedAlert(r, "en"));
        const answered = await gemini.generateEnvironmentalAlerts(readings, lang, guidance);
        // A node Gemini left out gets its rule-based advice, so none is ever missing.
        const data = readings.map(r => answered.find(d => d.node_id === r.node_id) || ruleBasedAlert(r, lang));
        geminiCache[lang] = { at: Date.now(), data };
        return res.json({ data, source: "gemini", lang, cached: false });
      } catch (err) {
        console.warn("[Recommendations] Gemini failed, using rule-based fallback:", err.message);
      }
    }
    res.json({ data: readings.map(r => ruleBasedAlert(r, lang)), source: "rules", lang, cached: false });
  } catch (err) {
    console.error("[Recommendations] live failed:", err.message);
    res.status(500).json({ error: "Failed to generate live alerts" });
  }
});

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
