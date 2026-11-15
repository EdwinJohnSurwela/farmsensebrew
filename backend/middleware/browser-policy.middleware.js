/**
 * FarmSense Brew — browser and OS minimums
 * Blocks browsers that no longer get security updates from their maker, or
 * that are too old to run the app and Grafana 13. Checked on every request,
 * so an old browser cannot even reach the login. Non-browser clients (the
 * ESP32 boxes, scripts) are not affected.
 *
 * Chrome no longer reports the real Android version in its user agent (it
 * always says "Android 10"), so the real one is asked for with a client hint.
 * Linux distributions are not visible to a website at all; there the browser
 * version is the check.
 */

const MIN = {
  chromium: 130, // Chrome, Edge, Opera, Samsung Internet; Android 7 stops at 119, Windows 7/8.1 at 109
  firefox: 128,  // ESR 115 was the last for Windows 7/8.1 and macOS 10.14
  // iOS 15 still gets Apple security fixes (15.8.x) and is the last for the iPhone 6S/7;
  // grafana-legacy.middleware.js makes Grafana 13 run there. iPads in desktop mode
  // report as Mac Safari, so Safari uses the same limit.
  safari: [15, 0],
  ios: [15, 0],
  android: 10,   // Chrome stopped updating on Android 8 and 9
  windows: 10
};

const below = (v, min) => v[0] < min[0] || (v[0] === min[0] && (v[1] || 0) < min[1]);

/** Returns null when allowed, or a short description of what is too old. */
function checkBrowser(ua, androidHint) {
  if (!ua || !ua.startsWith("Mozilla/")) return null;
  let m;
  if (/Trident\/|MSIE /.test(ua)) return "Internet Explorer";
  if ((m = /\bEdge\/(\d+)/.exec(ua))) return `Edge Legacy ${m[1]}`;
  if ((m = /\b(iPhone|iPad|iPod)\b.*? OS (\d+)_(\d+)/.exec(ua))) {
    const v = [Number(m[2]), Number(m[3])];
    return below(v, MIN.ios) ? `${m[1] === "iPad" ? "iPadOS" : "iOS"} ${v[0]}.${v[1]}` : null;
  }
  if ((m = /Windows NT (\d+)\.(\d+)/.exec(ua)) && Number(m[1]) < MIN.windows) {
    return { "6.1": "Windows 7", "6.2": "Windows 8", "6.3": "Windows 8.1" }[`${m[1]}.${m[2]}`] || "an old Windows";
  }
  if ((m = /Android (\d+)/.exec(ua))) {
    const hinted = Number(String(androidHint || "").replace(/"/g, "").split(".")[0]);
    const v = hinted > 0 ? hinted : Number(m[1]);
    if (v < MIN.android) return `Android ${v}`;
  }
  if ((m = /\bFirefox\/(\d+)/.exec(ua))) return Number(m[1]) < MIN.firefox ? `Firefox ${m[1]}` : null;
  if ((m = /\bChrome\/(\d+)/.exec(ua))) return Number(m[1]) < MIN.chromium ? `Chrome ${m[1]} (or a browser built on it)` : null;
  if ((m = /Version\/(\d+)\.(\d+).*\bSafari\//.exec(ua))) {
    const v = [Number(m[1]), Number(m[2])];
    return below(v, MIN.safari) ? `Safari ${v[0]}.${v[1]}` : null;
  }
  return null;
}

function blockedPage(what) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Browser not supported - FarmSense Brew</title>
<style>
body{margin:0;font-family:Arial,Helvetica,sans-serif;background:#f6f1e7;color:#1f2a1f}
main{max-width:560px;margin:40px auto;padding:24px 20px;background:#fff;border:1px solid #d9d2c3;border-radius:12px}
h1{font-size:22px;margin:0 0 12px;color:#1e4d2b}p{line-height:1.5;margin:0 0 12px}
ul{margin:0 0 12px;padding-left:20px;line-height:1.6}.tl{color:#4b5563;border-top:1px solid #eee;padding-top:12px}
</style></head><body><main>
<h1>This browser is not supported</h1>
<p>For your security, FarmSense Brew only opens on devices and browsers that still receive security updates. This device is using <b>${what}</b>.</p>
<p>Please use one of these:</p>
<ul>
<li>iPhone or iPad on iOS / iPadOS ${MIN.ios.join(".")} or newer</li>
<li>Android ${MIN.android} or newer with an updated Chrome</li>
<li>Chrome, Edge or Samsung Internet ${MIN.chromium} or newer</li>
<li>Firefox ${MIN.firefox} or newer</li>
<li>Safari ${MIN.safari.join(".")} or newer on a Mac</li>
<li>Windows ${MIN.windows} or newer</li>
</ul>
<p class="tl">Hindi po suportado ang browser o device na ito. Para sa inyong seguridad, gumamit po ng device at browser na may security updates pa, gaya ng nasa listahan sa itaas.</p>
</main></body></html>`;
}

function browserPolicy(req, res, next) {
  // Ask Chrome for the real Android version on page loads
  res.set("Accept-CH", "Sec-CH-UA-Platform-Version");
  res.set("Critical-CH", "Sec-CH-UA-Platform-Version");
  const what = checkBrowser(req.headers["user-agent"], req.headers["sec-ch-ua-platform-version"]);
  if (!what) return next();
  if (req.method === "GET" && req.accepts(["html", "json"]) === "html") {
    return res.status(403).type("html").send(blockedPage(what));
  }
  return res.status(403).json({
    error: "unsupported_browser",
    message: `This browser is not supported for security reasons (${what}). Please update the device or browser.`
  });
}

module.exports = { browserPolicy, checkBrowser, MIN };
