/**
 * FarmSense Brew — Sensor box sign-on (device endpoint, no user login)
 * File: backend/routes/device.routes.js
 *
 * POST /api/devices/hello
 *   body:    { device_id, kind: "node"|"valve", node: 0-99 (0 = any), firmware }
 *   header:  X-Device-Token (after the first time)
 *   answer:  { node_id, node, token? } — see services/device.service.js
 */
const express = require("express");
const devices = require("../services/device.service");
const router = express.Router();

router.post("/hello", async (req, res) => {
  try {
    const { device_id, kind, node, firmware } = req.body || {};
    const r = await devices.hello({
      deviceId: device_id,
      kind,
      requestedNode: parseInt(node, 10) || 0,
      token: req.get("X-Device-Token"),
      ip: req.ip,
      firmware,
    });
    res.status(r.status).json(r.body);
  } catch (err) {
    console.error("[Devices] hello failed:", err.message);
    res.status(500).json({ error: "The Pi could not register the box" });
  }
});

/**
 * GET /api/devices/firmware — wireless updates
 *   headers: X-Device-Id, X-Device-Token (the box's key), X-Firmware (what it runs now)
 *   answer:  204 = nothing newer for this box
 *            200 = the new firmware .bin, with X-Firmware-Version and X-MD5
 *
 * The files live in data/firmware/ (the api-data volume on the Pi):
 *   node.bin  + node.json   for the sensor boxes
 *   valve.bin + valve.json  for the valve box
 *   <kind>.json = { "version": "...", "md5": "...", "only": ["582ABDD2F93C"] }
 * "only" is optional: when present, just those boards get it (update one box
 * first, check it, then remove "only" to release it to the rest).
 */
const fs = require("fs");
const path = require("path");
const FIRMWARE_DIR = process.env.FIRMWARE_DIR || path.join(__dirname, "..", "data", "firmware");

router.get("/firmware", async (req, res) => {
  try {
    const dev = await devices.authenticate(req.get("X-Device-Id"), req.get("X-Device-Token"));
    if (!dev) return res.status(401).json({ error: "Unknown box or wrong key" });
    const kind = dev.kind === "valve" ? "valve" : "node";
    const bin = path.join(FIRMWARE_DIR, `${kind}.bin`);
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(path.join(FIRMWARE_DIR, `${kind}.json`), "utf8"));
    } catch (_) {
      return res.status(204).end();                  // nothing published yet
    }
    const current = String(req.get("X-Firmware") || "");
    const allowed = !Array.isArray(manifest.only) || manifest.only.includes(dev.device_id);
    if (!manifest.version || manifest.version === current || !allowed || !fs.existsSync(bin)) {
      return res.status(204).end();
    }
    console.log(`[Devices] sending firmware "${manifest.version}" to ${devices.prettyId(dev.device_id)} (was "${current}")`);
    res.set("X-Firmware-Version", manifest.version);
    if (manifest.md5) res.set("X-MD5", manifest.md5);
    res.sendFile(bin, { headers: { "Content-Type": "application/octet-stream" } });
  } catch (err) {
    console.error("[Devices] firmware check failed:", err.message);
    res.status(500).json({ error: "The Pi could not check for firmware" });
  }
});

module.exports = router;
