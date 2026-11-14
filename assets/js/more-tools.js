/* Toolsaku add-on tools: password generator, QR code, JSON formatter, unit converter,
   text case converter, Base64 / URL encoder, typing speed test.
   Uses window.Toolora from core.js. */
(function () {
  "use strict";

  /* ===== Pure helpers (also exported for tests) ===== */
  const SETS = { upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", lower: "abcdefghijklmnopqrstuvwxyz", digits: "0123456789", symbols: "!@#$%^&*()-_=+[]{};:,.?/" };
  const LOOK = "O0Il1";
  const rnd = (n) => { const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n; let v; do { crypto.getRandomValues(a); v = a[0]; } while (v >= lim); return v % n; }; // rejection sampling: unbiased
  function makePassword(len, opts) {
    const pools = Object.keys(SETS).filter((k) => opts[k]).map((k) => (opts.noLook ? [...SETS[k]].filter((c) => !LOOK.includes(c)).join("") : SETS[k])).filter((p) => p.length);
    if (!pools.length || len < 1) return "";
    const all = pools.join(""), out = pools.map((p) => p[rnd(p.length)]); // one from each chosen set
    while (out.length < len) out.push(all[rnd(all.length)]);
    out.length = len;
    for (let i = out.length - 1; i > 0; i--) { const j = rnd(i + 1); [out[i], out[j]] = [out[j], out[i]]; } // Fisher-Yates
    return out.join("");
  }
  const poolSize = (opts) => Object.keys(SETS).filter((k) => opts[k]).reduce((n, k) => n + (opts.noLook ? [...SETS[k]].filter((c) => !LOOK.includes(c)).length : SETS[k].length), 0);
  const entropy = (len, opts) => { const p = poolSize(opts); return p > 1 ? Math.round(len * Math.log2(p)) : 0; };
  const strength = (bits) => (bits < 40 ? "Weak" : bits < 60 ? "Fair" : bits < 90 ? "Strong" : "Very strong");

  /* JSON: parse with the error's line and column. errAt() finds the first bad offset when the browser's message has none. */
  function errAt(s) {
    let i = 0;
    const ws = () => { while (/[ \t\n\r]/.test(s[i] || "")) i++; }, fail = () => { throw i; };
    const lit = (w) => { if (s.startsWith(w, i)) i += w.length; else fail(); };
    const str = () => { i++; while (i < s.length && s[i] !== '"') { if (s[i] < " ") fail(); if (s[i] === "\\") { i++; if (s[i] === "u") { if (!/^[0-9a-fA-F]{4}$/.test(s.substr(i + 1, 4))) fail(); i += 4; } else if (!'"\\/bfnrt'.includes(s[i] || "x")) fail(); } i++; } if (s[i] !== '"') fail(); i++; };
    const val = () => {
      ws(); const c = s[i];
      if (c === "{") { i++; ws(); if (s[i] === "}") return i++; for (;;) { ws(); if (s[i] !== '"') fail(); str(); ws(); if (s[i] !== ":") fail(); i++; val(); ws(); if (s[i] === ",") { i++; continue; } if (s[i] === "}") return i++; fail(); } }
      if (c === "[") { i++; ws(); if (s[i] === "]") return i++; for (;;) { val(); ws(); if (s[i] === ",") { i++; continue; } if (s[i] === "]") return i++; fail(); } }
      if (c === '"') return str();
      if (c === "t") return lit("true"); if (c === "f") return lit("false"); if (c === "n") return lit("null");
      const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(s.slice(i)); if (!m) fail(); i += m[0].length;
    };
    try { val(); ws(); return i < s.length ? i : -1; } catch (p) { return p; }
  }
  function jsonCheck(src) {
    try { return { ok: true, value: JSON.parse(src) }; }
    catch (e) {
      const msg = String(e.message || e);
      let pos = (msg.match(/position (\d+)/) || [])[1];
      if (pos == null && !/line \d+/.test(msg)) { const p = errAt(src); if (p >= 0) pos = p; }
      let line = +(msg.match(/line (\d+)/) || [])[1] || 0, col = +(msg.match(/column (\d+)/) || [])[1] || 0;
      if (pos != null) { const before = src.slice(0, +pos); line = before.split("\n").length; col = +pos - before.lastIndexOf("\n"); }
      const where = line ? ` (line ${line}, column ${col || 1})` : "";
      return { ok: false, line: line || null, column: col || null, message: msg.replace(/( in JSON)? at position \d+.*$/s, "").replace(/, ".*" is not valid JSON$/s, "").replace(/^JSON\.parse:\s*/, "").replace(/\s*at line \d+ column \d+ of the JSON data/, "") + where };
    }
  }

  /* Units: everything but temperature is a factor to the base unit */
  const UNITS = {
    Length: { base: "m", u: { "Millimetre (mm)": 0.001, "Centimetre (cm)": 0.01, "Metre (m)": 1, "Kilometre (km)": 1000, "Inch (in)": 0.0254, "Foot (ft)": 0.3048, "Yard (yd)": 0.9144, "Mile (mi)": 1609.344, "Nautical mile": 1852 } },
    Weight: { u: { "Milligram (mg)": 1e-6, "Gram (g)": 0.001, "Kilogram (kg)": 1, "Tonne (t)": 1000, "Ounce (oz)": 0.028349523125, "Pound (lb)": 0.45359237, "Stone (st)": 6.35029318 } },
    Temperature: { u: { "Celsius (°C)": 1, "Fahrenheit (°F)": 1, "Kelvin (K)": 1 } },
    Area: { u: { "Square metre (m²)": 1, "Square centimetre (cm²)": 0.0001, "Square kilometre (km²)": 1e6, "Square foot (ft²)": 0.09290304, "Square yard (yd²)": 0.83612736, "Acre": 4046.8564224, "Hectare": 10000 } },
    Volume: { u: { "Millilitre (ml)": 0.001, "Litre (l)": 1, "Cubic metre (m³)": 1000, "Teaspoon (US)": 0.00492892159375, "Tablespoon (US)": 0.01478676478125, "Cup (US)": 0.2365882365, "Pint (US)": 0.473176473, "Gallon (US)": 3.785411784, "Gallon (UK)": 4.54609 } },
    Speed: { u: { "Metres per second (m/s)": 1, "Kilometres per hour (km/h)": 1 / 3.6, "Miles per hour (mph)": 0.44704, "Knot": 0.514444444444, "Foot per second (ft/s)": 0.3048 } },
    Time: { u: { "Millisecond (ms)": 0.001, "Second (s)": 1, "Minute (min)": 60, "Hour (h)": 3600, "Day": 86400, "Week": 604800, "Month (30 days)": 2592000, "Year (365 days)": 31536000 } },
    Data: { u: { "Bit (b)": 0.125, "Byte (B)": 1, "Kilobyte (KB, 1000)": 1e3, "Megabyte (MB, 1000)": 1e6, "Gigabyte (GB, 1000)": 1e9, "Terabyte (TB, 1000)": 1e12, "Kibibyte (KiB, 1024)": 1024, "Mebibyte (MiB, 1024)": 1048576, "Gibibyte (GiB, 1024)": 1073741824, "Tebibyte (TiB, 1024)": 1099511627776 } },
  };
  const toC = (v, u) => (u[0] === "F" ? (v - 32) / 1.8 : u[0] === "K" ? v - 273.15 : v);
  const fromC = (c, u) => (u[0] === "F" ? c * 1.8 + 32 : u[0] === "K" ? c + 273.15 : c);
  function convert(cat, from, to, v) {
    if (cat === "Temperature") return fromC(toC(v, from), to);
    const U = UNITS[cat].u;
    return (v * U[from]) / U[to];
  }

  /* Text cases */
  const words = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[\s_\-]+/).filter(Boolean);
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const CASES = {
    "UPPER CASE": (s) => s.toUpperCase(),
    "lower case": (s) => s.toLowerCase(),
    "Title Case": (s) => s.replace(/\S+/g, (w) => cap(w)),
    "Sentence case": (s) => s.toLowerCase().replace(/(^\s*\S|[.!?]\s+\S)/g, (m) => m.toUpperCase()),
    camelCase: (s) => words(s).map((w, i) => (i ? cap(w) : w.toLowerCase())).join(""),
    PascalCase: (s) => words(s).map(cap).join(""),
    snake_case: (s) => words(s).map((w) => w.toLowerCase()).join("_"),
    "kebab-case": (s) => words(s).map((w) => w.toLowerCase()).join("-"),
    aLtErNaTe: (s) => [...s].map((c, i) => (i % 2 ? c.toUpperCase() : c.toLowerCase())).join(""),
    iNVERSE: (s) => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(""),
  };

  /* Base64 with full UTF-8 */
  const b64encode = (s) => { const b = new TextEncoder().encode(s); let x = ""; b.forEach((n) => (x += String.fromCharCode(n))); return btoa(x); };
  const b64decode = (s) => { const bin = atob(s.replace(/\s+/g, "")); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return new TextDecoder("utf-8", { fatal: true }).decode(b); };
  const wpm = (chars, seconds) => (seconds > 0 ? chars / 5 / (seconds / 60) : 0);

  window.TooloraMore = { makePassword, entropy, strength, jsonCheck, convert, UNITS, CASES, b64encode, b64decode, wpm, SETS, LOOK };

  const T = window.Toolora;
  if (!T) return;
  const { byId, esc } = T;

  /* ===== Shared UI bits ===== */
  const css = document.createElement("style");
  css.textContent = `.x-mt [hidden]{display:none!important}
.x-mt{border-radius:22px;background:#fff;border:1px solid var(--line);box-shadow:var(--sh);padding:18px}
.x-mt label{display:grid;gap:6px;font-size:14px;font-weight:600;color:var(--navy)}
.x-mt input[type=text],.x-mt input[type=number],.x-mt select,.x-mt textarea{min-height:48px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#fff;color:var(--navy);font:inherit;width:100%;box-sizing:border-box}
.x-mt textarea{min-height:150px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px}
.x-mt input[type=range]{width:100%;min-height:44px;accent-color:var(--blue)}
.x-mt input[type=color]{width:100%;min-height:48px;padding:4px;border:1px solid var(--line);border-radius:12px;background:#fff}
.x-grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))}
.x-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:14px}
.x-chk{display:flex;align-items:center;gap:10px;min-height:44px;font-weight:600;color:var(--navy)}
.x-chk input{width:20px;height:20px;accent-color:var(--blue)}
.x-mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;overflow-wrap:anywhere}
.x-pw{padding:16px;border-radius:14px;background:var(--soft);font-size:clamp(18px,4.4vw,26px);font-weight:650;color:var(--navy);word-break:break-all;min-height:32px}
.x-meter{height:10px;border-radius:999px;background:var(--line);overflow:hidden;margin:12px 0 6px}
.x-meter i{display:block;height:100%;background:var(--blue);transition:width .2s}
.x-meter.s1 i{background:#D92D20;width:25%}.x-meter.s2 i{background:#F79009;width:50%}.x-meter.s3 i{background:#12B76A;width:75%}.x-meter.s4 i{background:#067647;width:100%}
.x-note{font-size:13px;color:var(--muted);margin:6px 0 0}
.x-ok{padding:10px 12px;border-radius:12px;background:#E7F7EE;color:#067647;font-weight:600;margin:12px 0 0}
.x-bad{padding:10px 12px;border-radius:12px;background:#FDECEC;color:#B42318;font-weight:600;margin:12px 0 0}
.x-qr{display:grid;place-items:center;padding:16px;border-radius:14px;background:var(--soft);margin-top:14px}
.x-qr img,.x-qr canvas{max-width:min(320px,80vw);height:auto;image-rendering:pixelated}
.x-sw{display:grid;gap:12px;grid-template-columns:1fr auto 1fr;align-items:end}
@media(max-width:560px){.x-sw{grid-template-columns:1fr}}
.x-big2{font-size:clamp(26px,7vw,40px);font-weight:750;color:var(--navy);overflow-wrap:anywhere}
.x-cases{display:grid;gap:10px;margin-top:16px}
.x-cases div{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:10px 12px;border:1px solid var(--line);border-radius:12px}
.x-cases p{margin:0;flex:1;min-width:180px;overflow-wrap:anywhere;color:var(--navy)}
.x-cases span{font-size:12px;font-weight:700;color:var(--muted);flex-basis:100%}
.x-type{padding:16px;border-radius:14px;background:var(--soft);font-size:19px;line-height:1.7;letter-spacing:.01em;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.x-type b{font-weight:400;color:#067647}.x-type u{text-decoration:none;background:#FDD;color:#B42318}
.x-type i{font-style:normal;border-left:2px solid var(--blue);margin-left:-1px}
.x-stats{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));margin-top:14px}
.x-stats div{padding:10px 12px;border-radius:12px;background:var(--soft)}
.x-stats b{display:block;font-size:24px;color:var(--navy)}.x-stats span{font-size:13px;color:var(--muted)}
.x-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px}
.x-tabs button{min-height:44px;padding:0 18px;border-radius:999px;border:1.5px solid var(--line);background:#fff;color:var(--navy);font:inherit;font-weight:600;cursor:pointer}
.x-tabs button[aria-selected=true]{background:var(--blue);border-color:var(--blue);color:#fff}`;
  document.head.appendChild(css);

  const q1 = (m, s) => m.querySelector(s);
  const btn = (k, t, pri) => `<button type="button" class="x-btn${pri ? " x-primary" : ""}" data-k="${k}">${t}</button>`;
  function copyText(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).catch(() => fb(t));
    return Promise.resolve(fb(t));
  }
  function fb(t) {
    const a = document.createElement("textarea");
    a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;opacity:0;top:0";
    document.body.appendChild(a); a.select();
    try { document.execCommand("copy"); } finally { a.remove(); }
  }
  const flash = (b, t = "Copied!") => { const o = b.textContent; b.textContent = t; setTimeout(() => (b.textContent = o), 1400); };
  const download = (href, name) => { const a = document.createElement("a"); a.href = href; a.download = name; a.click(); };
  const dlText = (text, name, type) => { const u = URL.createObjectURL(new Blob([text], { type })); download(u, name); setTimeout(() => URL.revokeObjectURL(u), 4000); };
  const seg = (name, list, on) => `<div class="x-seg" role="group" aria-label="${name}">${list.map((v) => `<button type="button" data-seg="${name}" data-v="${v}" aria-pressed="${v === on}">${esc(v)}</button>`).join("")}</div>`;
  function segWire(m, name, fn) {
    m.querySelectorAll(`[data-seg="${name}"]`).forEach((b) => b.addEventListener("click", () => {
      m.querySelectorAll(`[data-seg="${name}"]`).forEach((x) => x.setAttribute("aria-pressed", x === b));
      fn(b.dataset.v);
    }));
  }
  const segVal = (m, name) => q1(m, `[data-seg="${name}"][aria-pressed="true"]`).dataset.v;

  /* Lazy library loading, same style as pdf-tools.js */
  const pending = {};
  function loadScript(src, ok) {
    if (ok()) return Promise.resolve();
    return (pending[src] = pending[src] || new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = () => (ok() ? res() : rej(new Error("bad")));
      s.onerror = () => { s.remove(); rej(new Error("net")); };
      document.head.appendChild(s);
    }).catch((e) => { delete pending[src]; throw e; }));
  }

  /* ===== 1. Password generator ===== */
  function toolPassword(m) {
    const opt = [["upper", "Uppercase (A–Z)"], ["lower", "Lowercase (a–z)"], ["digits", "Numbers (0–9)"], ["symbols", "Symbols (!@#…)"], ["noLook", "Exclude look-alikes (O 0 I l 1)"]];
    m.innerHTML = `<div class="x-mt">
      <div class="x-pw x-mono" aria-live="polite"></div>
      <div class="x-meter"><i></i></div><p class="x-note x-str"></p>
      <div class="x-row">${btn("copy", "Copy", 1)}${btn("gen", "Regenerate")}</div>
      <label style="margin-top:16px">Length: <span class="x-len">16</span><input type="range" min="6" max="64" value="16" aria-label="Password length"></label>
      <div class="x-grid">${opt.map(([k, l]) => `<label class="x-chk"><input type="checkbox" data-o="${k}"${k === "noLook" ? "" : " checked"}> ${l}</label>`).join("")}</div>
      <p class="x-bad" hidden>Pick at least one character set.</p></div>`;
    const out = q1(m, ".x-pw"), rng = q1(m, "input[type=range]"), meter = q1(m, ".x-meter"), bad = q1(m, ".x-bad");
    const opts = () => Object.fromEntries([...m.querySelectorAll("[data-o]")].map((c) => [c.dataset.o, c.checked]));
    const gen = () => {
      const o = opts(), n = +rng.value, pw = makePassword(n, o), bits = entropy(n, o), s = strength(bits);
      q1(m, ".x-len").textContent = n;
      bad.hidden = !!pw; out.textContent = pw || "—";
      meter.className = "x-meter s" + (["Weak", "Fair", "Strong", "Very strong"].indexOf(s) + 1);
      q1(m, ".x-str").textContent = pw ? `${s} · about ${bits} bits of entropy` : "";
    };
    rng.addEventListener("input", gen);
    m.addEventListener("change", (e) => e.target.dataset.o && gen());
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]"); if (!b) return;
      if (b.dataset.k === "gen") gen();
      else if (out.textContent !== "—") copyText(out.textContent).then(() => flash(b));
    });
    gen();
  }

  /* ===== 2. QR code generator ===== */
  const QRLIB = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js";
  const QRMAX = { L: 2953, M: 2331, Q: 1663, H: 1273 }; // byte-mode capacity at version 40
  function toolQR(m) {
    m.innerHTML = `<div class="x-mt">
      <label>Text or URL<textarea style="min-height:90px" placeholder="https://example.com">https://example.com</textarea></label>
      <div class="x-grid" style="margin-top:12px">
        <label>Size: <span class="x-sz">400</span> px<input type="range" min="200" max="1000" step="50" value="400" aria-label="Size in pixels"></label>
        <label>Foreground<input type="color" data-c="fg" value="#0b1b3f"></label>
        <label>Background<input type="color" data-c="bg" value="#ffffff"></label>
      </div>
      <p class="x-note" style="margin-top:12px">Error correction</p>${seg("ec", ["L", "M", "Q", "H"], "M")}
      <p class="x-bad x-qerr" role="alert" hidden></p>
      <div class="x-qr" aria-live="polite"><p class="x-note">Loading the QR library…</p></div>
      <div class="x-row">${btn("png", "Download PNG", 1)}${btn("svg", "Download SVG")}</div></div>`;
    const ta = q1(m, "textarea"), rng = q1(m, "input[type=range]"), box = q1(m, ".x-qr"), err = q1(m, ".x-qerr");
    let qr = null, canvas = null;
    const col = (k) => q1(m, `[data-c="${k}"]`).value;
    const build = () => {
      if (!window.qrcode) return;
      const t = ta.value, ec = segVal(m, "ec"), bytes = new TextEncoder().encode(t).length;
      q1(m, ".x-sz").textContent = rng.value;
      err.hidden = true; qr = null;
      if (!t) { box.innerHTML = '<p class="x-note">Type some text to make a QR code.</p>'; return; }
      if (bytes > QRMAX[ec]) { err.hidden = false; err.textContent = `That's too long for a QR code: ${bytes} bytes, and the limit at level ${ec} is ${QRMAX[ec]}. Shorten it or choose a lower error-correction level.`; box.innerHTML = ""; return; }
      try { window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"]; qr = window.qrcode(0, ec); qr.addData(t, "Byte"); qr.make(); }
      catch (e) { err.hidden = false; err.textContent = "Couldn't make a QR code from that text. Try shortening it."; box.innerHTML = ""; return; }
      const n = qr.getModuleCount(), size = +rng.value, quiet = 4, cell = size / (n + quiet * 2);
      canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
      const x = canvas.getContext("2d");
      x.fillStyle = col("bg"); x.fillRect(0, 0, size, size); x.fillStyle = col("fg");
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) x.fillRect(Math.floor((c + quiet) * cell), Math.floor((r + quiet) * cell), Math.ceil(cell), Math.ceil(cell));
      canvas.setAttribute("role", "img"); canvas.setAttribute("aria-label", "QR code preview");
      box.replaceChildren(canvas);
      if (bytes > QRMAX[ec] * 0.6) { err.hidden = false; err.textContent = "This much text makes a dense code that some phones struggle to scan. Shorter text scans more reliably."; }
    };
    const svg = () => {
      const n = qr.getModuleCount(), q = 4, w = n + q * 2;
      let d = "";
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + q} ${r + q}h1v1h-1z`;
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${w}" width="${rng.value}" height="${rng.value}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${col("bg")}"/><path d="${d}" fill="${col("fg")}"/></svg>`;
    };
    ta.addEventListener("input", build); rng.addEventListener("input", build);
    m.addEventListener("input", (e) => e.target.dataset.c && build());
    segWire(m, "ec", build);
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]"); if (!b || !qr) return;
      if (b.dataset.k === "png") download(canvas.toDataURL("image/png"), "sugoitools-qr.png");
      else dlText(svg(), "sugoitools-qr.svg", "image/svg+xml");
    });
    loadScript(QRLIB, () => !!window.qrcode).then(build, () => {
      box.innerHTML = '<p class="x-bad" role="alert">The QR code library couldn\'t load. Check your connection and reload the page.</p>';
    });
  }

  /* ===== 3. JSON formatter ===== */
  function toolJSON(m) {
    m.innerHTML = `<div class="x-mt">
      <label>Your JSON<textarea spellcheck="false" placeholder='{"name":"Toolsaku","tools":7}' style="min-height:220px"></textarea></label>
      <p class="x-note" style="margin-top:12px">Indent</p>${seg("ind", ["2 spaces", "4 spaces", "Tab"], "2 spaces")}
      <div class="x-row">${btn("fmt", "Format", 1)}${btn("min", "Minify")}${btn("val", "Validate")}${btn("copy", "Copy")}${btn("dl", "Download .json")}</div>
      <p class="x-msg" role="status" hidden></p></div>`;
    const ta = q1(m, "textarea"), msg = q1(m, ".x-msg");
    const say = (ok, t) => { msg.hidden = false; msg.className = "x-msg " + (ok ? "x-ok" : "x-bad"); msg.textContent = t; };
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-k]"); if (!b) return;
      const k = b.dataset.k;
      if (k === "copy") return ta.value && copyText(ta.value).then(() => flash(b));
      if (k === "dl") return ta.value && dlText(ta.value, "sugoitools.json", "application/json");
      if (!ta.value.trim()) return say(false, "Paste some JSON first.");
      const r = jsonCheck(ta.value);
      if (!r.ok) {
        say(false, "Invalid JSON: " + r.message);
        if (r.line) { const lines = ta.value.split("\n"), at = lines.slice(0, r.line - 1).join("\n").length + (r.line > 1 ? 1 : 0) + (r.column - 1); ta.focus(); ta.setSelectionRange(at, at + 1); }
        return;
      }
      const ind = { "2 spaces": 2, "4 spaces": 4, Tab: "\t" }[segVal(m, "ind")];
      if (k === "fmt") { ta.value = JSON.stringify(r.value, null, ind); say(true, "Formatted. Your JSON is valid."); }
      else if (k === "min") { ta.value = JSON.stringify(r.value); say(true, `Minified to ${ta.value.length.toLocaleString()} characters.`); }
      else say(true, "Valid JSON.");
    });
  }

  /* ===== 4. Unit converter ===== */
  function toolUnits(m) {
    const cats = Object.keys(UNITS);
    m.innerHTML = `<div class="x-mt">${seg("cat", cats, "Length")}
      <label>Value<input type="number" inputmode="decimal" value="1" step="any"></label>
      <div class="x-sw" style="margin-top:12px"><label>From<select data-u="from"></select></label>${btn("swap", "⇄ Swap")}<label>To<select data-u="to"></select></label></div>
      <div style="margin-top:16px;padding:16px;border-radius:14px;background:var(--soft)" aria-live="polite"><div class="x-big2"></div><p class="x-note x-eq"></p></div></div>`;
    const val = q1(m, "input"), from = q1(m, '[data-u="from"]'), to = q1(m, '[data-u="to"]');
    const nice = (n) => (Math.abs(n) >= 1e15 || (n && Math.abs(n) < 1e-6) ? n.toExponential(6) : (+n.toPrecision(10)).toLocaleString("en-US", { maximumFractionDigits: 10 }));
    const fill = (cat) => {
      const names = Object.keys(UNITS[cat].u), o = names.map((n) => `<option>${esc(n)}</option>`).join("");
      from.innerHTML = to.innerHTML = o; from.selectedIndex = 0; to.selectedIndex = Math.min(1, names.length - 1);
      if (cat === "Length") { from.value = "Mile (mi)"; to.value = "Kilometre (km)"; }
      if (cat === "Data") { from.value = "Gibibyte (GiB, 1024)"; to.value = "Mebibyte (MiB, 1024)"; }
      calc();
    };
    const calc = () => {
      const v = parseFloat(val.value), cat = segVal(m, "cat");
      if (!isFinite(v)) { q1(m, ".x-big2").textContent = "—"; q1(m, ".x-eq").textContent = "Enter a number."; return; }
      const r = convert(cat, from.value, to.value, v);
      q1(m, ".x-big2").textContent = nice(r) + " " + to.value.replace(/^.*\(([^,)]+).*\)$/, "$1");
      q1(m, ".x-eq").textContent = `${nice(v)} ${from.value} = ${nice(r)} ${to.value}`;
    };
    segWire(m, "cat", fill);
    val.addEventListener("input", calc); from.addEventListener("change", calc); to.addEventListener("change", calc);
    q1(m, '[data-k="swap"]').addEventListener("click", () => { [from.value, to.value] = [to.value, from.value]; calc(); });
    fill("Length");
  }

  /* ===== 5. Text case converter ===== */
  function toolCase(m) {
    m.innerHTML = `<div class="x-mt"><label>Your text<textarea style="font-family:inherit;font-size:16px" placeholder="Type or paste text…">hello world-example</textarea></label>
      <p class="x-note x-cc" aria-live="polite"></p><div class="x-cases"></div></div>`;
    const ta = q1(m, "textarea"), box = q1(m, ".x-cases"), names = Object.keys(CASES);
    box.innerHTML = names.map((n, i) => `<div><span>${esc(n)}</span><p class="x-mono" data-i="${i}"></p>${btn("c" + i, "Copy")}</div>`).join("");
    const upd = () => {
      const t = ta.value, c = [...t].length, w = (t.match(/\S+/g) || []).length;
      q1(m, ".x-cc").textContent = `${c.toLocaleString()} character${c === 1 ? "" : "s"} · ${w.toLocaleString()} word${w === 1 ? "" : "s"}`;
      names.forEach((n, i) => (q1(box, `[data-i="${i}"]`).textContent = CASES[n](t)));
    };
    ta.addEventListener("input", upd);
    box.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) { const t = b.previousElementSibling.textContent; if (t) copyText(t).then(() => flash(b)); } });
    upd();
  }

  /* ===== 6. Base64 / URL encoder ===== */
  function toolB64(m, tab) {
    const MAXF = 5 * 1024 * 1024;
    m.innerHTML = `<div class="x-mt">
      <div class="x-tabs" role="tablist"><button type="button" role="tab" data-tab="b64">Base64</button><button type="button" role="tab" data-tab="url">URL encode</button></div>
      <label><span class="x-inl">Input</span><textarea spellcheck="false"></textarea></label>
      <div class="x-row">${btn("enc", "Encode", 1)}${btn("dec", "Decode")}${btn("swap", "Use output as input")}</div>
      <div class="x-fwrap"><label style="margin-top:14px">Or turn a file into a Base64 data URL (max 5 MB)<input type="file"></label></div>
      <p class="x-bad x-berr" role="alert" hidden></p>
      <label style="margin-top:14px">Output<textarea readonly spellcheck="false"></textarea></label>
      <div class="x-row">${btn("copy", "Copy output")}<span class="x-note x-bsz"></span></div></div>`;
    const [inp, out] = m.querySelectorAll("textarea"), err = q1(m, ".x-berr"), file = q1(m, "input[type=file]");
    let mode = tab === "url" ? "url" : "b64";
    const setTab = (t) => {
      mode = t;
      m.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
      q1(m, ".x-fwrap").hidden = t !== "b64";
      inp.placeholder = t === "b64" ? "Text to encode, or Base64 to decode" : "https://example.com/?q=a b&lang=हिन्दी";
      err.hidden = true; out.value = ""; q1(m, ".x-bsz").textContent = "";
    };
    const fail = (t) => { err.hidden = false; err.textContent = t; out.value = ""; };
    m.addEventListener("click", (e) => {
      const tb = e.target.closest("[data-tab]");
      if (tb) { setTab(tb.dataset.tab); history.replaceState(null, "", tb.dataset.tab === "url" ? "#url" : location.pathname + location.search); return; }
      const b = e.target.closest("[data-k]"); if (!b) return;
      const k = b.dataset.k;
      if (k === "copy") return out.value && copyText(out.value).then(() => flash(b));
      if (k === "swap") { inp.value = out.value; out.value = ""; return; }
      err.hidden = true;
      try {
        if (mode === "b64") out.value = k === "enc" ? b64encode(inp.value) : b64decode(inp.value);
        else out.value = k === "enc" ? encodeURIComponent(inp.value) : decodeURIComponent(inp.value.replace(/\+/g, " "));
        q1(m, ".x-bsz").textContent = `${out.value.length.toLocaleString()} characters`;
      } catch (x) {
        fail(mode === "b64" ? (k === "dec" ? "That isn't valid Base64, or it doesn't decode to UTF-8 text." : "Couldn't encode that text.") : "That text has a broken % sequence (like %E0%A4 cut short), so it can't be decoded.");
      }
    });
    file.addEventListener("change", () => {
      const f = file.files[0]; if (!f) return;
      err.hidden = true;
      if (f.size > MAXF) { file.value = ""; return fail(`“${f.name}” is ${T.fmtSize(f.size)}. The limit is 5 MB.`); }
      const r = new FileReader();
      r.onload = () => { out.value = r.result; q1(m, ".x-bsz").textContent = `${f.name} · ${out.value.length.toLocaleString()} characters`; };
      r.onerror = () => fail("Couldn't read that file.");
      r.readAsDataURL(f);
    });
    setTab(mode);
  }

  /* ===== 7. Typing speed test ===== */
  const PARAS = [
    "The morning train was quiet, so I opened my notebook and began to plan the week. A short list always helps me start, because small tasks build the kind of momentum that carries into the bigger jobs later in the day.",
    "Our neighbour keeps a tidy garden full of tomatoes, mint and bright orange marigolds. Every evening she waters each row by hand and tells anyone who walks past which plants are thirsty and which are simply being dramatic.",
    "Learning to cook rice well takes patience more than skill. Rinse the grains until the water runs clear, measure the water with care, and resist the urge to lift the lid while it steams on a low flame.",
    "The old library on the corner has creaky floors and tall windows that catch the afternoon light. People come for the books, but many stay for the calm, the soft hum of pages turning and the smell of paper.",
    "A good bicycle ride begins with a quick check of the tyres and brakes. After that, pick a route with gentle hills, carry some water, and remember that the best views often appear just after the hardest climb.",
    "When the power went out during the storm, the family gathered around a single candle and played cards. Nobody missed their phones for once, and the laughter lasted long after the lights flickered back on.",
    "Writing clear emails is a quiet superpower. Put the main point in the first line, keep each paragraph short, and end with the one thing you need from the reader so they know exactly what to do next.",
    "The market opens before sunrise, when traders stack crates of mangoes, onions and fresh coriander. By nine it is loud and crowded, and by noon the best stalls have sold out and the sweepers are already at work.",
  ];
  function toolTyping(m) {
    m.innerHTML = `<div class="x-mt">${seg("dur", ["30 s", "60 s", "120 s"], "60 s")}
      <div class="x-stats" aria-live="off"><div><b class="x-t">60</b><span>Seconds left</span></div><div><b class="x-w">0</b><span>WPM</span></div><div><b class="x-a">100%</b><span>Accuracy</span></div></div>
      <div class="x-type" style="margin-top:14px" aria-hidden="true"></div>
      <label style="margin-top:14px">Type the text above here (the timer starts on your first key)<textarea style="font-family:inherit;font-size:17px;min-height:110px" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"></textarea></label>
      <div class="x-res" role="status" hidden></div>
      <div class="x-row">${btn("restart", "Restart", 1)}${btn("new", "New text")}</div></div>`;
    const ta = q1(m, "textarea"), view = q1(m, ".x-type"), res = q1(m, ".x-res");
    let text = "", start = 0, id = 0, done = false, last = -1;
    const secs = () => parseInt(segVal(m, "dur"), 10);
    const pick = () => { let i; do i = Math.floor(Math.random() * PARAS.length); while (i === last && PARAS.length > 1); last = i; text = PARAS[i]; };
    const score = () => {
      const v = ta.value.slice(0, text.length); let ok = 0;
      for (let i = 0; i < v.length; i++) if (v[i] === text[i]) ok++;
      return { typed: v.length, ok, errors: v.length - ok };
    };
    const paint = () => {
      const v = ta.value; let h = "";
      for (let i = 0; i < text.length; i++) {
        const c = esc(text[i]);
        h += i < v.length ? (v[i] === text[i] ? `<b>${c}</b>` : `<u>${c === " " ? "&middot;" : c}</u>`) : i === v.length ? `<i>${c}</i>` : c;
      }
      view.innerHTML = h;
      const s = score(), el = start ? Math.min(secs(), (Date.now() - start) / 1000) : 0;
      q1(m, ".x-t").textContent = start ? Math.max(0, Math.ceil(secs() - el)) : secs();
      q1(m, ".x-w").textContent = Math.round(wpm(s.ok, el));
      q1(m, ".x-a").textContent = (s.typed ? Math.round((s.ok / s.typed) * 100) : 100) + "%";
    };
    const finish = () => {
      clearInterval(id); id = 0; done = true; ta.readOnly = true;
      const s = score(), el = Math.min(secs(), (Date.now() - start) / 1000) || secs();
      paint();
      res.hidden = false; res.className = "x-res x-ok";
      res.textContent = `Result: ${Math.round(wpm(s.ok, el))} WPM · ${s.typed ? Math.round((s.ok / s.typed) * 100) : 0}% accuracy · ${s.errors} error${s.errors === 1 ? "" : "s"} in ${Math.round(el)} seconds.`;
    };
    const tick = () => { if (!m.isConnected) { clearInterval(id); id = 0; return; } paint(); if ((Date.now() - start) / 1000 >= secs()) finish(); };
    const reset = (fresh) => { clearInterval(id); id = 0; start = 0; done = false; if (fresh || !text) pick(); ta.value = ""; ta.readOnly = false; res.hidden = true; paint(); };
    ta.addEventListener("input", () => {
      if (done) return;
      if (!start && ta.value) { start = Date.now(); id = setInterval(tick, 250); }
      if (ta.value.length > text.length) ta.value = ta.value.slice(0, text.length);
      paint();
      if (ta.value.length >= text.length) finish();
    });
    segWire(m, "dur", () => reset(false));
    m.addEventListener("click", (e) => { const b = e.target.closest("[data-k]"); if (b) { reset(b.dataset.k === "new"); ta.focus(); } });
    reset(true);
  }

  /* ===== Registry info ===== */
  const PRIV = "It runs entirely in your browser, with nothing sent anywhere or saved.";
  const defs = {
    "password-generator": { render: toolPassword, info: { steps: ["Drag the slider to pick a length from 6 to 64 characters.", "Choose which character sets to include, and whether to skip look-alikes.", "Check the strength meter.", "Press Copy, or Regenerate for a new one."],
      about: `The Password Generator builds passwords from your browser's cryptographic random generator, picking each character without bias and making sure every set you choose appears at least once. The strength meter estimates entropy in bits from the length and the size of the character pool. ${PRIV}`,
      faq: [["How long should a password be?", "16 characters with all four sets is very strong for most accounts. Use 20 or more for a password manager's master password."], ["Is it truly random?", "Yes. It uses crypto.getRandomValues, the same source browsers use for encryption, with rejection sampling so no character is favoured."], ["Why exclude look-alikes?", "Characters like O and 0 or I, l and 1 are easy to mix up when you read or type a password by hand."]] } },
    "qr-code-generator": { render: toolQR, info: { steps: ["Type or paste text or a link.", "Pick a size, colours and an error-correction level.", "Check the live preview.", "Download it as PNG or SVG."],
      about: `The QR Code Generator turns text or a URL into a scannable code that updates as you type. Higher error correction keeps a code readable when it is printed small or partly covered, at the cost of a denser pattern. SVG files stay sharp at any print size. ${PRIV}`,
      faq: [["Which error-correction level should I use?", "M suits most uses. Choose Q or H if the code will be printed small, outdoors, or with a logo over it."], ["Do the codes expire?", "No. The code holds your text directly, so it works for as long as the link or text inside it does."], ["Why won't my code scan?", "Keep strong contrast with a dark foreground on a light background, and shorten long text."]] } },
    "json-formatter": { render: toolJSON, info: { steps: ["Paste your JSON into the box.", "Choose 2 spaces, 4 spaces or a tab.", "Press Format, Minify or Validate.", "Copy the result or download it as a .json file."],
      about: `The JSON Formatter tidies messy JSON into readable, indented text, or squeezes it onto one line to save space. If something is wrong, it tells you what and where, with the line and column, and selects the spot in the box. ${PRIV}`,
      faq: [["Is my JSON sent anywhere?", "No. It is parsed by your own browser, so it is safe for API keys and private data."], ["Why is my JSON invalid?", "The usual causes are trailing commas, single quotes instead of double quotes, and keys without quotes."], ["Does formatting change my data?", "No. Only whitespace changes; keys, values and order stay the same."]] } },
    "unit-converter": { render: toolUnits, info: { steps: ["Pick a category, such as Length or Data.", "Enter a value.", "Choose the units to convert from and to.", "Read the result as you type, or tap Swap."],
      about: `The Unit Converter covers length, weight, temperature, area, volume, speed, time and data, using exact international definitions such as 1 mile = 1.609344 km. Temperature uses its formulas rather than a single factor, and data sizes come in both decimal (1000) and binary (1024) units. ${PRIV}`,
      faq: [["What's the difference between MB and MiB?", "A megabyte (MB) is 1,000,000 bytes; a mebibyte (MiB) is 1,048,576 bytes. Drive makers use MB; many operating systems use MiB."], ["How is temperature converted?", "°F = °C × 1.8 + 32, and K = °C + 273.15."], ["Which gallon does it use?", "Both: the US gallon (3.785 l) and the UK gallon (4.546 l) are listed separately."]] } },
    "text-case-converter": { render: toolCase, info: { steps: ["Type or paste your text.", "See it in every case at once.", "Copy the one you need."],
      about: `The Text Case Converter rewrites text as UPPER, lower, Title or Sentence case, the camelCase, PascalCase, snake_case and kebab-case styles programmers use, and playful aLtErNaTe and iNVERSE. Every version updates as you type, with a live character count. ${PRIV}`,
      faq: [["What is camelCase?", "Words joined with no spaces, each capitalised except the first, like helloWorldExample. PascalCase capitalises the first too."], ["Does Title Case skip small words?", "No. It capitalises every word, which is the simplest style and works for most headings."], ["Does it handle hyphens and underscores?", "Yes. For the code styles, spaces, hyphens and underscores all count as word breaks."]] } },
    "base64-encoder-decoder": { render: (m) => toolB64(m, location.hash === "#url" ? "url" : "b64"), info: { steps: ["Choose the Base64 or URL encode tab.", "Type or paste your text, or pick a file for a Base64 data URL.", "Press Encode or Decode.", "Copy the output."],
      about: `The Base64 & URL Encoder converts text to and from Base64 with full UTF-8 support, so Hindi, emoji and accented letters survive the round trip. It also turns files up to 5 MB into data URLs, and percent-encodes or decodes text for use in links. ${PRIV}`,
      faq: [["Is Base64 encryption?", "No. Base64 only changes how data is written; anyone can decode it. Don't use it to hide secrets."], ["Why does decoding fail?", "The text may not be Base64, may be cut short, or may decode to binary data rather than text."], ["When do I need URL encoding?", "When a value in a link holds spaces, &, ? or non-English letters, so the link isn't broken."]] } },
    "typing-speed-test": { render: toolTyping, info: { steps: ["Choose 30, 60 or 120 seconds.", "Start typing the paragraph in the box; the timer starts on your first key.", "Watch correct letters turn green and mistakes turn red.", "Read your WPM, accuracy and errors, then Restart."],
      about: `The Typing Speed Test measures how fast and accurately you type an everyday English paragraph. Speed is counted the standard way, where every five correct characters make one word, divided by the minutes elapsed. It works with phone and tablet keyboards as well as physical ones. ${PRIV}`,
      faq: [["How is WPM calculated?", "Correct characters ÷ 5 ÷ minutes. So 250 correct characters in one minute is 50 WPM."], ["What is a good typing speed?", "Around 40 WPM is typical. 60 or more is fast, and accuracy above 95% matters more than raw speed."], ["Does backspace count?", "You can fix mistakes; only the characters left in the box are scored."]] } },
  };
  Object.entries(defs).forEach(([id, d]) => { if (byId[id]) Object.assign(byId[id], d, { status: "live" }); });
  /* Alias route: #/url-encoder-decoder opens the Base64 tool on its URL tab */
  if (byId["base64-encoder-decoder"] && !byId["url-encoder-decoder"]) byId["url-encoder-decoder"] = Object.assign(Object.create(byId["base64-encoder-decoder"]), { name: "URL Encoder / Decoder", description: "Percent-encode or decode text for use in links." });
  T.route();
})();
