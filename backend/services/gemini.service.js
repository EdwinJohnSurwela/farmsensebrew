/**
 * FarmSense Brew — Gemini API Service
 * File: backend/services/gemini.service.js
 *
 * Handles all communication with the Google Gemini API.
 * Called by Node-RED (via Python) and the backend recommendation route.
 */

const https = require("https");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// gemini-flash-lite-latest is the alias Google keeps pointed at its lightest,
// cheapest model: fewest tokens, lowest quota use, fastest reply. Pinned names
// like gemini-2.5-flash-lite 404 for newly created keys, so the alias is the
// robust default. Override per deployment with GEMINI_MODEL in .env.
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

function hasApiKey() {
  return !!GEMINI_API_KEY && GEMINI_API_KEY.trim().length > 10;
}

// No internet at the farm must never slow the app down. Each call gives up
// after GEMINI_TIMEOUT_MS; after any failure (no connection, quota used up,
// bad reply) Gemini is skipped for GEMINI_RETRY_AFTER_MS and the rule-based
// text is used straight away, so the panel never waits on a dead connection.
const GEMINI_TIMEOUT_MS = parseInt(process.env.GEMINI_TIMEOUT_MS, 10) || 8000;
const GEMINI_RETRY_AFTER_MS = parseInt(process.env.GEMINI_RETRY_AFTER_MS, 10) || 5 * 60 * 1000;
let pausedUntil = 0;
let lastError = "";

/** True when Gemini should be tried now: a key is set and it is not resting after a failure. */
function available() {
  return hasApiKey() && Date.now() >= pausedUntil;
}

/** What the recommendations panel can say about Gemini. */
function status() {
  return {
    model: GEMINI_MODEL,
    key: hasApiKey(),
    resting_seconds: Math.max(0, Math.round((pausedUntil - Date.now()) / 1000)),
    last_error: lastError,
  };
}

/**
 * Generate a 3-part plain-language recommendation from Gemini.
 * @param {Object} sensorData - { node_id, temperature, humidity, soil_pct, risk_level }
 * @returns {Object} { what, why, what_to_do, full_response, risk_level }
 */
async function generateRecommendation(sensorData) {
  const { node_id, temperature, humidity, soil_pct, risk_level } = sensorData;

  const prompt = `You are an expert agricultural advisor for a Philippine coffee farm.
Based on the following sensor readings from an IoT monitoring system, provide a concise
3-part recommendation for the farm owner. Use plain, simple language (Taglish is okay).

Format your response EXACTLY as:
WHAT: [one sentence: what is the current environmental condition]
WHY: [one sentence: why this is a risk to the coffee plants]
WHAT TO DO: [one or two specific, actionable steps the farmer can take today]

Sensor Reading from ${node_id}:
- Temperature: ${temperature}°C
- Humidity: ${humidity}%
- Soil Moisture: ${soil_pct}%
- Coffee Leaf Rust Risk: ${risk_level}

Keep your total response under 120 words. Be specific to Philippine coffee farming conditions.
Never use em dashes; use commas, colons or full stops instead.`;

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,       // Lower = more consistent, factual responses
      maxOutputTokens: 200
    }
  });

  const fullResponse = await callGeminiAPI(requestBody);

  // Parse the 3-part response
  const parsed = parseRecommendation(fullResponse);
  parsed.risk_level = risk_level;
  parsed.full_response = fullResponse;

  return parsed;
}

function callGeminiAPI(body) {
  return callGeminiOnce(body).then(
    (text) => { lastError = ""; return text; },
    (err) => {
      pausedUntil = Date.now() + GEMINI_RETRY_AFTER_MS;
      lastError = err.message;
      throw err;
    });
}

function callGeminiOnce(body) {
  return new Promise((resolve, reject) => {
    const req = https.request(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body)
      }
    }, (res) => {
      let data = "";
      res.on("data", chunk => data += chunk);
      res.on("end", () => {
        if (res.statusCode !== 200) {
          let msg = "";
          try { msg = JSON.parse(data)?.error?.message || ""; } catch (_) { /* not JSON */ }
          return reject(new Error(`Gemini HTTP ${res.statusCode}${msg ? ": " + msg.slice(0, 160) : ""}`));
        }
        try {
          const json = JSON.parse(data);
          const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) reject(new Error("No text in Gemini response"));
          else resolve(text);
        } catch (e) {
          reject(new Error("Failed to parse Gemini response: " + e.message));
        }
      });
    });
    req.setTimeout(GEMINI_TIMEOUT_MS, () => req.destroy(new Error(`no reply from Gemini within ${GEMINI_TIMEOUT_MS / 1000} s`)));
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function parseRecommendation(text) {
  const whatMatch      = text.match(/WHAT:\s*(.+)/i);
  const whyMatch       = text.match(/WHY:\s*(.+)/i);
  const whatToDoMatch  = text.match(/WHAT TO DO:\s*(.+)/si);

  return {
    what:        whatMatch      ? whatMatch[1].trim()      : text,
    why:         whyMatch       ? whyMatch[1].trim()       : "",
    what_to_do:  whatToDoMatch  ? whatToDoMatch[1].trim()  : ""
  };
}

/**
 * LLM-driven environmental alert layer.
 * Takes the latest reading of every node and produces one descriptive
 * monitoring alert per node in a single Gemini call.
 * Returns [{ node_id, risk_level, headline, what, why, action }].
 */
// How the text should sound in each language the panel offers.
const LANG_NOTE = {
  tl: `
Write every text field in casual, everyday spoken Tagalog, the way farm workers talk to each
other: short sentences and common words. Do NOT use deep or formal Filipino (no words like
inspeksyunin, saklaw, pagbabantay, halumigmig). Keep words people already say in English in
English: Coffee Leaf Rust, humidity, node, drip line.`,
  taglish: `
Write every text field in Taglish: the natural everyday mix of Tagalog and English spoken in the
Philippines, e.g. "I-check ang ilalim ng leaves kung may yellow-orange spots." Keep it casual and
short. Keep Coffee Leaf Rust, humidity and node in English.`,
};

async function generateEnvironmentalAlerts(readings, lang = "en", guidance = []) {
  // Gemini only REWORDS the system's own advice. The rules decide what to do;
  // the model makes it read naturally in the chosen language. A light model
  // left to write its own advice invented treatments and dropped "do not water".
  const summary = readings.map(r => {
    const g = guidance.find(x => x.node_id === r.node_id) || {};
    return `${r.node_id}: ${Number(r.temperature).toFixed(1)}°C, humidity ${Number(r.humidity).toFixed(0)}%, ` +
      `soil ${Number(r.soil_pct).toFixed(0)}%, CLR risk ${r.clr_risk || "MINIMAL"}\n` +
      `  advice to reword: headline "${g.headline || ""}"; why "${g.why || ""}"; action "${g.action || ""}"`;
  }).join("\n");

  const prompt = `You write the alert text of an IoT monitoring system on a Philippine coffee farm
(Batangas) for the farm staff. For EACH node below, rewrite the given advice so it reads
naturally and is specific to that node's numbers.${LANG_NOTE[lang] || ""}

Rules you must follow:
- Keep exactly the same instructions as the given advice. Do not add new steps, products or
  treatments, and do not make an action stronger or weaker (if it says "consider", keep
  "consider"; never say to spray now).
- If the advice says not to water, the action must still say not to water.
- Never mention fungicides, pesticides or any chemical spray: the farm is organic.
- Numbers must be the ones given. Do not invent targets.

Respond with ONLY a JSON array, no markdown fences, one object per node:
[{"node_id":"NODE_01","headline":"<max 10 words>","what":"<1 sentence: current condition, with the numbers>","why":"<1 sentence>","action":"<1-2 sentences>"}]

Nodes:
${summary}

Keep each field short. Never use em dashes; use commas, colons or full stops instead.`;

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1500 }
  });

  const raw = await callGeminiAPI(requestBody);
  // Strip accidental markdown fences before parsing
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const items = JSON.parse(cleaned);
  return items.map(item => {
    const src = readings.find(r => r.node_id === item.node_id) || {};
    return { risk_level: src.clr_risk || "MINIMAL", ...item };
  });
}

module.exports = { generateRecommendation, generateEnvironmentalAlerts, hasApiKey, available, status, GEMINI_MODEL };
