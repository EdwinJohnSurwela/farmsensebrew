/**
 * FarmSense Brew — Grafana for older iPhones
 * Grafana 13's scripts use syntax Safari only learned in iOS 16.4, so on an
 * iPhone 6S (iOS 15 at most) the dashboard never starts. For those browsers
 * only, Grafana's scripts are rewritten to older syntax and its pages get the
 * missing JavaScript features added. Every other browser is left alone, and
 * anything that goes wrong here falls through to the normal proxy.
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { promisify } = require("util");

const gzip = promisify(zlib.gzip);

const POLYFILL_PATH = "/__legacy/polyfills.js";
const CACHE_DIR = process.env.GRAFANA_LEGACY_CACHE || path.join(__dirname, "..", "data", "grafana-legacy");

// Optional at runtime: without them Grafana is simply proxied as usual.
let esbuild = null;
let polyfillFile = null;
try {
  esbuild = require("esbuild");
  polyfillFile = require.resolve("core-js-bundle/minified.js");
} catch (err) {
  console.warn("[Grafana legacy] Not available:", err.message);
}

/** Safari or any iPhone/iPad browser older than iOS/Safari 16.4 */
function isOldSafari(userAgent) {
  const ua = userAgent || "";
  if (/Android|Chrome\//.test(ua)) return false;
  const m = /\b(?:iPhone|iPad).*? OS (\d+)_(\d+)/.exec(ua) || /Version\/(\d+)\.(\d+).* Safari\//.exec(ua);
  if (!m) return false;
  const major = Number(m[1]);
  return major < 16 || (major === 16 && Number(m[2]) < 4);
}

// One rewrite per script at a time, however many frames ask for it.
const inFlight = new Map();

/** Rewritten, gzipped script: from the disk cache, or made once and kept there. */
function legacyScript(url, source) {
  const key = crypto.createHash("sha1").update(url).digest("hex");
  const file = path.join(CACHE_DIR, key + ".js.gz");
  if (inFlight.has(key)) return inFlight.get(key);
  const job = (async () => {
    try {
      return await fs.promises.readFile(file);
    } catch { /* not rewritten yet */ }
    const { code } = await esbuild.transform(await source(), {
      target: "safari15",
      loader: "js",
      charset: "utf8",
      legalComments: "none",
      logLevel: "silent"
    });
    const zipped = await gzip(code);
    await fs.promises.mkdir(CACHE_DIR, { recursive: true });
    await fs.promises.writeFile(file, zipped);
    return zipped;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, job);
  return job;
}

function grafanaLegacy(grafanaTarget) {
  const fromGrafana = (req) => {
    const url = new URL("/grafana" + req.url, grafanaTarget);
    url.searchParams.delete("token");
    const headers = { "X-WEBAUTH-USER": req.grafanaUser.username };
    for (const name of ["accept", "accept-language", "cookie"]) {
      if (req.headers[name]) headers[name] = req.headers[name];
    }
    return fetch(url, { headers, redirect: "manual" });
  };

  return async function legacyMiddleware(req, res, next) {
    if (!esbuild || req.method !== "GET" || !isOldSafari(req.headers["user-agent"])) return next();
    try {
      if (req.path === POLYFILL_PATH) {
        return res.type("text/javascript").sendFile(polyfillFile);
      }

      if (/^\/public\/.+\.js$/.test(req.path)) {
        const zipped = await legacyScript(req.path, async () => {
          const r = await fromGrafana(req);
          if (!r.ok) throw new Error(`${req.path}: ${r.status}`);
          return r.text();
        });
        res.set({ "Content-Encoding": "gzip", "Cache-Control": "public, max-age=86400", "Vary": "User-Agent" });
        return res.type("text/javascript").send(zipped);
      }

      if ((req.headers.accept || "").includes("text/html")) {
        const r = await fromGrafana(req);
        if (r.status !== 200 || !(r.headers.get("content-type") || "").includes("text/html")) return next();
        const html = (await r.text())
          .replace(/ integrity="[^"]*"/g, "") // the rewritten scripts no longer match
          .replace(/<head[^>]*>/, (head) => `${head}<script src="/grafana${POLYFILL_PATH}"></script>`);
        const cookies = r.headers.getSetCookie();
        if (cookies.length) res.set("Set-Cookie", cookies);
        return res.type("text/html").send(html);
      }
    } catch (err) {
      console.error("[Grafana legacy]", err.message);
    }
    return next();
  };
}

module.exports = { grafanaLegacy, isOldSafari };
