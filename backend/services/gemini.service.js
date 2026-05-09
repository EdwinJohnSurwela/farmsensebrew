/**
 * FarmSense Brew — Gemini API Service
 * File: backend/services/gemini.service.js
 *
 * Handles all communication with the Google Gemini API.
 * Called by Node-RED (via Python) and the backend recommendation route.
 */

const https = require("https");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

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
WHAT: [one sentence — what is the current environmental condition]
WHY: [one sentence — why this is a risk to the coffee plants]
WHAT TO DO: [one or two specific, actionable steps the farmer can take today]

Sensor Reading from ${node_id}:
- Temperature: ${temperature}°C
- Humidity: ${humidity}%
- Soil Moisture: ${soil_pct}%
- Coffee Leaf Rust Risk: ${risk_level}

Keep your total response under 120 words. Be specific to Philippine coffee farming conditions.`;

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

module.exports = { generateRecommendation };
