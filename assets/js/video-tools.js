/* Toolsaku video tools: Video Trimmer, Video Compressor. Mediabunny (MPL-2.0) loads only when a video tool opens. Uses window.Toolora from core.js. */
(function () {
  "use strict";
  const T = window.Toolora;
  if (!T) return;
  const { byId, ic, esc, fmtSize } = T;
  /* Mediabunny ships its browser bundle as an ES module (.mjs). jsDelivr serves the .cjs build as application/node with nosniff, so it can't run as a classic script. */
  const MAXB = 500 * 1024 * 1024, LOAD_MS = 25000, LIBS = [
    "https://cdn.jsdelivr.net/npm/mediabunny@1.65.2/dist/bundles/mediabunny.min.mjs",
    "https://unpkg.com/mediabunny@1.65.2/dist/bundles/mediabunny.min.mjs"];
  const NO_CODEC = "Your browser can't process video. Use the latest Chrome, Edge or Safari 17+.";
  const ENGINE_ERR = "The video engine couldn't load. Check your internet connection or turn off any content blocker, then open the tool again.";
  const PROC_ERR = "Something went wrong while processing this video. Try a shorter or smaller video, or another format.";
  const why = (e) => !e ? "unknown error" : typeof e === "string" ? e : `${e.name && e.name !== "Error" ? e.name + ": " : ""}${e.message || String(e)}`;
  const uerr = (msg, detail) => Object.assign(new Error(msg), { user: true, detail });
  const css = document.createElement("style");
  css.textContent = `.x-ws [hidden]{display:none!important}
.x-prev video{display:block;width:100%;max-height:60vh;border-radius:12px;background:#000}
.x-vbar{display:flex;align-items:center;gap:12px;margin-top:12px}.x-vbar progress{flex:1;height:10px;accent-color:var(--blue)}.x-vbar b{min-width:44px;text-align:right;color:var(--navy)}
.x-ctrls input[type=range]{width:100%;accent-color:var(--blue)}
.x-cnote{font-size:14px;padding:10px 12px;border-radius:12px;background:var(--soft);margin:0}
.x-pout{margin-top:24px}.x-pout h3{margin:0 0 12px;font-size:18px;color:var(--navy)}
.x-errd{display:block;margin-top:6px;font-size:12px;font-weight:400;opacity:.85;word-break:break-word}`;
  document.head.appendChild(css);

  /* Dynamic import() lives in a Function body so a browser without it fails at run time (caught below) instead of failing to parse this whole file. */
  let dynImport;
  try { dynImport = new Function("u", "return import(u)"); } catch (e) { dynImport = e; }
  // When a content policy blocks Function(), fall back to an inline module script that hands the namespace back.
  const viaTag = (url) => new Promise((res, rej) => {
    const key = "__tooloraMB" + Date.now(), s = document.createElement("script"), done = () => { try { delete window[key]; } catch (e) { window[key] = undefined; } s.remove(); };
    window[key] = (M) => { done(); res(M); };
    s.type = "module";
    s.onerror = () => { done(); rej(new Error("module script failed to load " + url)); };
    s.textContent = `import * as M from ${JSON.stringify(url)};window[${JSON.stringify(key)}](M);`;
    document.head.appendChild(s);
  });
  const importMod = (url) => typeof dynImport === "function" ? dynImport(url)
    : dynImport && dynImport.name === "EvalError" ? viaTag(url)
    : Promise.reject(new Error("this browser doesn't support import() (" + why(dynImport) + ")"));
  let libP = null, tries = 0;
  const loadLib = () => window.Mediabunny ? Promise.resolve(window.Mediabunny) : (libP = libP || new Promise((res, rej) => {
    // Browsers cache a failed module fetch for the page's lifetime, so retries use a fresh URL.
    const n = ++tries, bust = n > 1 ? "?r=" + n : "";
    const timer = setTimeout(() => rej(new Error(`timed out after ${LOAD_MS / 1000} s`)), LOAD_MS);
    (async () => {
      const errs = [];
      for (const url of LIBS) {
        try {
          const M = await importMod(url + bust);
          if (!M || typeof M.Input !== "function" || typeof M.Conversion !== "function") throw new Error("module loaded without the expected exports");
          return M;
        } catch (e) { errs.push(`${url.split("/")[2]}: ${why(e)}`); }
      }
      throw new Error(errs.join(" · "));
    })().then((M) => { window.Mediabunny = M; clearTimeout(timer); res(M); }, (e) => { clearTimeout(timer); rej(e); });
  }).catch((e) => { libP = null; throw e; }));

  const baseName = (n) => n.replace(/\.[^.]+$/, "").replace(/[^\w.-]+/g, "-").slice(0, 60) || "video";
  const fmtT = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`; };
  function checkVid(f) {
    if (!/\.(mp4|m4v|mov|webm|mkv)$/i.test(f.name) && !/^video\/(mp4|quicktime|webm|x-matroska)/.test(f.type))
      return `“${f.name}” isn't a supported video. Please choose an MP4, MOV, WEBM or MKV file.`;
    if (f.size > MAXB) return `“${f.name}” is ${fmtSize(f.size)}. The limit is 500 MB.`;
    if (!f.size) return `“${f.name}” is empty. Please choose another video.`;
    return "";
  }
  async function probe(file) {
    const M = window.Mediabunny, input = new M.Input({ source: new M.BlobSource(file), formats: M.ALL_FORMATS });
    try {
      const vt = await input.getPrimaryVideoTrack();
      if (!vt) throw uerr("No video track found in this file.");
      const meta = { dur: await input.computeDuration(), w: await vt.getDisplayWidth(), h: await vt.getDisplayHeight() };
      if (!(meta.dur > 0)) throw uerr("This video has no length to work with.");
      if (!(meta.w > 0 && meta.h > 0)) throw uerr("This video's picture size couldn't be read.");
      return meta;
    } finally { if (input.dispose) input.dispose(); }
  }

  /* ===== Shared video workspace, matching the PDF and image tools' layout ===== */
  function shell(m, o) {
    m.innerHTML = `<div class="x-ws">
      <label class="x-drop" tabindex="0"><input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.m4v,.mov,.webm,.mkv" class="x-sr" tabindex="-1" aria-label="Choose a video">
        <span class="x-ic">${ic("upload", 28)}</span><strong>Drop a video here or <u>tap to choose</u></strong>
        <span class="x-note">MP4, MOV, WEBM or MKV · <b>max 500 MB</b></span><span class="x-note">Processed on your device — nothing is uploaded.</span></label>
      <p class="x-state x-eng" aria-live="polite"></p><p class="x-err" role="alert" hidden></p>
      <div class="x-edit" hidden>
        <p class="x-src"><b class="x-fname"></b><span class="x-orig"></span></p>
        <div class="x-grid"><div class="x-ctrls">${o.controls}
          <button type="button" class="x-btn x-primary x-go">${ic(o.icon, 20)} ${o.label}</button><button type="button" class="x-btn x-cancel" hidden>Cancel</button></div>
          <div><div class="x-prev"><video class="x-vid" controls playsinline preload="metadata"></video></div>
            <div class="x-vbar" hidden><progress max="100" value="0" aria-label="Progress"></progress><b class="x-pct" aria-live="polite">0%</b></div>
            <p class="x-state x-prog" aria-live="polite"></p><p class="x-info" aria-live="polite"></p>
            <div class="x-actions"><a class="x-btn x-primary x-dl is-busy">${ic("download", 20)} <span>Download</span></a><button type="button" class="x-btn x-reset">Reset</button></div>
            <p class="x-hint">If the download doesn't start, long-press Download and choose to save the file.</p></div></div>
        <div class="x-pout" hidden></div></div></div>`;
    const q = (s) => m.querySelector(s), input = q("input[type=file]"), drop = q(".x-drop"), err = q(".x-err"), eng = q(".x-eng"), edit = q(".x-edit"),
      prog = q(".x-prog"), info = q(".x-info"), dl = q(".x-dl"), go = q(".x-go"), cancel = q(".x-cancel"), bar = q(".x-vbar"), out = q(".x-pout"), vid = q(".x-vid");
    let urls = [], srcUrl = "", working = false, conv = null, stop = false;
    const W = { q, out, vid, file: null, meta: null };
    W.fail = (msg, detail) => {
      err.textContent = msg;
      if (detail) { const d = document.createElement("small"); d.className = "x-errd"; d.textContent = detail; err.appendChild(d); }
      err.hidden = false;
    };
    W.prog = (t) => (prog.textContent = t || "");
    W.url = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
    W.pct = (p) => { const v = Math.round(Math.min(1, Math.max(0, p)) * 100); q("progress").value = v; q(".x-pct").textContent = v + "%"; };
    W.clear = () => {
      urls.forEach((u) => URL.revokeObjectURL(u)); urls = [];
      dl.removeAttribute("href"); dl.removeAttribute("download"); dl.classList.add("is-busy");
      info.textContent = ""; out.innerHTML = ""; out.hidden = true; bar.hidden = true;
    };
    W.done = (blob, name, text) => { dl.href = W.url(blob); dl.download = name; dl.classList.remove("is-busy"); info.textContent = text; };
    W.convert = async ({ format, mime = "video/mp4", ...opts } = {}) => {
      const M = window.Mediabunny, audioOnly = !!(opts.video && opts.video.discard);
      const mkFormat = typeof format === "function" ? format : () => format || new M.Mp4OutputFormat();
      const attempt = async (o) => {
        const output = new M.Output({ format: mkFormat(), target: new M.BufferTarget() });
        const src = new M.Input({ source: new M.BlobSource(W.file), formats: M.ALL_FORMATS });
        try { return { c: await M.Conversion.init({ input: src, output, ...o }), output, src }; }
        catch (e) { if (src.dispose) src.dispose(); throw e; }
      };
      let r = await attempt(opts);
      const reasons = (c) => c.discardedTracks.filter((d) => d.reason !== "discarded_by_user");
      // A conversion stays "valid" with only its audio left, which would save a sound-only file as the video.
      const lostVideo = (c) => !audioOnly && reasons(c).some((d) => d.track && d.track.type === "video");
      const bad = (c) => !c.isValid || lostVideo(c);
      // "prefer-hardware" can rule out every encoder on devices without one; retry and let the browser pick.
      if (bad(r.c) && opts.video && opts.video.hardwareAcceleration && reasons(r.c).some((d) => d.reason === "no_encodable_target_codec")) {
        if (r.src.dispose) r.src.dispose();
        const { hardwareAcceleration, ...video } = opts.video;
        r = await attempt({ ...opts, video });
      }
      const { c, output, src } = r;
      try {
        if (bad(c)) {
          const list = reasons(c), detail = [...new Set(list.map((d) => `${(d.track && d.track.type) || "media"} track: ${String(d.reason).replace(/_/g, " ")}`))].join("; ");
          if (!list.length) throw uerr(audioOnly ? "This video has no sound to extract." : "This file has no video or audio that can be saved in this format.");
          throw uerr("This video can't be converted in your browser. Try another format, or the latest Chrome.", "Conversion invalid: " + detail);
        }
        if (stop) throw new M.ConversionCanceledError();
        conv = c; c.onProgress = W.pct;
        await c.execute();
        W.pct(1);
        if (!output.target.buffer || !output.target.buffer.byteLength) throw new Error("the output file is empty");
        return new Blob([output.target.buffer], { type: mime });
      } finally { conv = null; if (src.dispose) src.dispose(); }
    };
    const busy = (on) => { working = on; go.hidden = on; cancel.hidden = !on; cancel.disabled = false; bar.hidden = !on && bar.hidden; };
    const ready = () => {
      eng.textContent = window.Mediabunny ? "" : "Loading video engine…";
      return loadLib().finally(() => (eng.textContent = ""));
    };
    function resetAll() {
      W.clear(); W.file = W.meta = null; vid.removeAttribute("src"); vid.load();
      if (srcUrl) URL.revokeObjectURL(srcUrl); srcUrl = ""; input.value = ""; err.hidden = true; edit.hidden = true; drop.hidden = false;
    }
    async function add(files) {
      if (working || !files || !files.length) return;
      err.hidden = true;
      const f = files[0], msg = checkVid(f);
      input.value = "";
      if (msg) return W.fail(msg);
      if (typeof VideoEncoder === "undefined") return W.fail(NO_CODEC, "VideoEncoder (WebCodecs) is not available in this browser.");
      working = true;
      try { await ready(); } catch (e) { working = false; return W.fail(ENGINE_ERR, "Engine failed to load: " + why(e)); }
      eng.textContent = `Reading ${f.name}…`;
      try {
        const meta = await probe(f);
        resetAll(); W.file = f; W.meta = meta;
        srcUrl = URL.createObjectURL(f); vid.src = srcUrl;
        q(".x-fname").textContent = f.name;
        q(".x-orig").textContent = ` · ${fmtSize(f.size)} · ${meta.w} × ${meta.h} · ${fmtT(meta.dur)}`;
        edit.hidden = false; drop.hidden = true;
        o.loaded(W);
        if (files.length > 1) W.fail("This tool works on one video at a time, so only the first file was used.");
      } catch (e) {
        if (e && e.user) W.fail(e.message, e.detail);
        else W.fail(`“${f.name}” couldn't be read. It may be damaged, or in a format your browser can't decode.`, "Read failed: " + why(e));
      } finally { working = false; eng.textContent = ""; }
    }
    async function run() {
      if (working || !W.file) return;
      err.hidden = true; W.clear(); stop = false; W.pct(0); bar.hidden = false; busy(true);
      try { await o.go(W); }
      catch (e) {
        W.clear();
        if (stop || (window.Mediabunny && e instanceof window.Mediabunny.ConversionCanceledError)) W.prog("Cancelled.");
        else if (e && e.user) W.fail(e.message, e.detail);
        else W.fail(PROC_ERR, "Processing failed: " + why(e));
      } finally { busy(false); if (!stop) W.prog(); }
    }
    input.addEventListener("change", () => add(input.files));
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    [["dragenter", 1], ["dragover", 1], ["dragleave", 0], ["drop", 0]].forEach(([ev, on]) => m.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.toggle("is-over", !!on); }));
    m.addEventListener("drop", (e) => add(e.dataTransfer.files));
    go.addEventListener("click", run);
    cancel.addEventListener("click", async () => {
      stop = true; cancel.disabled = true; W.prog("Cancelling…");
      if (conv) try { await conv.cancel(); } catch (e) { /* cancelled quietly */ }
    });
    dl.addEventListener("click", (e) => { if (!dl.getAttribute("href")) e.preventDefault(); });
    m.querySelectorAll(".x-ctrls select, .x-ctrls input").forEach((s) => s.addEventListener(s.tagName === "SELECT" ? "change" : "input", () => { if (!working) W.clear(); }));
    q(".x-reset").addEventListener("click", () => { if (working) return; resetAll(); W.prog(); drop.focus(); });
    if (typeof VideoEncoder === "undefined") { drop.hidden = true; W.fail(NO_CODEC, "VideoEncoder (WebCodecs) is not available in this browser."); }
    else ready().catch((e) => W.fail(ENGINE_ERR, "Engine failed to load: " + why(e)));
    return W;
  }

  /* ===== Video Trimmer ===== */
  function toolTrim(m) {
    const row = (k, w) => `<label>${w} (seconds)<input type="number" name="${k}" min="0" step="0.1" value="0" inputmode="decimal"></label>
      <input type="range" name="${k}r" min="0" step="0.1" value="0" aria-label="${w} position">
      <button type="button" class="x-btn" data-set="${k}">Set ${w.toLowerCase()} to current time</button>`;
    const W = shell(m, { icon: "trim", label: "Trim video", controls: `<p class="x-cnote">Duration <b class="x-dur">–</b> · Clip <b class="x-len">–</b></p>${row("s", "Start")}${row("e", "End")}`,
      loaded(W) {
        const d = +W.meta.dur.toFixed(1);
        m.querySelectorAll(".x-ctrls input").forEach((i) => (i.max = d));
        W.q(".x-dur").textContent = fmtT(W.meta.dur);
        set("s", 0); set("e", d);
      },
      async go(W) {
        const s = +v("s"), e = +v("e"), dur = W.meta.dur + 0.05;
        if (!(s >= 0) || !(e > s)) throw uerr("The start must be before the end.");
        if (e > dur) throw uerr(`The end can't be past the video's length, ${fmtT(W.meta.dur)}.`);
        const end = Math.min(e, W.meta.dur);
        if (!(end - s >= 0.1)) throw uerr("The clip is too short. Make it at least 0.1 seconds long.");
        W.prog("Trimming…");
        const blob = await W.convert({ trim: { start: s, end } });
        W.prog();
        W.done(blob, `${baseName(W.file.name)}-trimmed.mp4`, `Clip ready: ${fmtT(end - s)} · ${fmtSize(blob.size)}`);
      } });
    const v = (k) => W.q(`[name="${k}"]`).value;
    function len() { const s = +v("s"), e = +v("e"); W.q(".x-len").textContent = e > s ? fmtT(e - s) : "start must be before end"; }
    function set(k, x) { x = Math.round(Math.max(0, x) * 10) / 10; W.q(`[name="${k}"]`).value = x; W.q(`[name="${k}r"]`).value = x; len(); }
    ["s", "e"].forEach((k) => {
      W.q(`[name="${k}"]`).addEventListener("input", (e) => { W.q(`[name="${k}r"]`).value = e.target.value; len(); });
      W.q(`[name="${k}r"]`).addEventListener("input", (e) => { set(k, +e.target.value); if (W.vid.readyState) W.vid.currentTime = +e.target.value; });
      W.q(`[data-set="${k}"]`).addEventListener("click", () => { set(k, W.vid.currentTime); W.clear(); });
    });
  }

  /* ===== Video Compressor ===== */
  function toolCompress(m) {
    const W = shell(m, { icon: "compress", label: "Compress video", controls: `
      <label>Compression level<select name="lv"><option value="light">Light · best quality</option><option value="medium" selected>Medium · up to 720p</option><option value="strong">Strong · up to 480p, smallest file</option></select></label>
      <p class="x-cnote">The result is an MP4 file. Stronger levels lower the resolution and bitrate.</p>`,
      loaded() {},
      async go(W) {
        const M = window.Mediabunny, { w, h } = W.meta, lv = W.q("[name=lv]").value, hw = "prefer-hardware";
        // 720p and 480p mean the short side, so portrait videos are capped by width.
        const cap = (p) => (Math.min(w, h) > p ? (w >= h ? { height: p } : { width: p }) : {});
        const video = lv === "light" ? { quality: new M.Quality("high") }
          : lv === "medium" ? { ...cap(720), quality: new M.Quality("medium") }
          : { ...cap(480), quality: new M.Quality("low") };
        video.hardwareAcceleration = hw;
        W.prog("Compressing…");
        const blob = await W.convert({ video, audio: { quality: new M.Quality(lv === "light" ? "medium" : "low") } });
        W.prog();
        const before = W.file.size, after = blob.size;
        if (after >= before) return W.done(W.file, W.file.name, `This video is already well compressed (${fmtSize(before)} → ${fmtSize(after)}), so download your original instead.`);
        W.done(blob, `${baseName(W.file.name)}-compressed.mp4`, `${fmtSize(before)} → ${fmtSize(after)} · ${Math.round((1 - after / before) * 100)}% smaller`);
        W.out.innerHTML = `<h3>Compressed preview</h3><div class="x-prev"><video controls playsinline preload="metadata" src="${W.url(blob)}"></video></div>`;
        W.out.hidden = false;
      } });
  }

  /* ===== Shared bits for the tools below ===== */
  const ev = (x) => Math.max(2, Math.round(x / 2) * 2), HW = "prefer-hardware";
  const css2 = document.createElement("style");
  css2.textContent = `.x-chip:disabled{opacity:.4;cursor:not-allowed;background:#fff;border-color:var(--line)}
.x-cropv{overflow:hidden;touch-action:pan-y}.x-cbox{position:absolute;box-sizing:border-box;border:2px solid #fff;box-shadow:0 0 0 9999px rgba(0,0,0,.55);touch-action:none;cursor:move;outline:none}
.x-cbox:focus-visible{border-color:var(--blue)}.x-cbox i{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;cursor:nwse-resize}
.x-cbox i::after{content:"";position:absolute;inset:13px;background:#fff;border:2px solid var(--blue);border-radius:50%}
.x-cbox [data-c=ne],.x-cbox [data-c=sw]{cursor:nesw-resize}
.x-seek{display:grid;gap:4px;margin-top:10px;font-size:14px;font-weight:600}.x-seek input{width:100%;accent-color:var(--blue)}
.x-ytf{max-width:560px}.x-yt{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));margin-top:20px}
.x-ytc{margin:0;padding:12px;border:1px solid var(--line);border-radius:16px;background:#fff}.x-ytc img{display:block;width:100%;height:auto;border-radius:10px}
.x-ytc figcaption{margin-top:10px;font-size:14px;color:var(--navy)}`;
  document.head.appendChild(css2);
  const outVid = (W, blob, tag = "video") => { W.out.innerHTML = `<h3>Result preview</h3><div class="x-prev"><${tag} controls playsinline preload="metadata" src="${W.url(blob)}"></${tag}></div>`; W.out.hidden = false; };
  const onChips = (W, fn) => W.q(".x-chips").addEventListener("click", (e) => {
    const b = e.target.closest(".x-chip"); if (!b || b.disabled) return;
    W.q(".x-chips").querySelectorAll(".x-chip").forEach((c) => c.classList.toggle("is-on", c === b)); W.clear(); fn(b);
  });

  /* ===== Video Resizer ===== */
  function toolResize(m) {
    const P = [1080, 720, 480, 360];
    let pick = "";
    const W = shell(m, { icon: "resize", label: "Resize video", controls: `<p class="x-cnote">Original resolution <b class="x-ow">–</b></p>
      <p class="x-lbl">New size</p><div class="x-chips">${P.map((h) => `<button type="button" class="x-chip" data-p="${h}">${h}p<small></small></button>`).join("")}
        <button type="button" class="x-chip" data-p="sq">Square 1:1<small>1080 × 1080</small></button><button type="button" class="x-chip" data-p="vt">Vertical 9:16<small>1080 × 1920</small></button>
        <button type="button" class="x-chip" data-p="cu">Custom<small>Your own size</small></button></div>
      <div class="x-cust" hidden><div class="x-row"><label>Width (px)<input type="number" name="w" min="16" max="7680" inputmode="numeric"></label><label>Height (px)<input type="number" name="h" min="16" max="7680" inputmode="numeric"></label></div>
        <label class="x-check"><input type="checkbox" name="lock" checked> Keep aspect ratio</label></div>
      <label class="x-fit" hidden>Fit the picture<select name="fit"><option value="contain">Contain · whole picture, black bars</option><option value="cover">Cover · fill the frame, crop the edges</option></select></label>`,
      loaded(W) {
        const { w, h } = W.meta;
        W.q(".x-ow").textContent = `${w} × ${h}`;
        W.q("[name=w]").value = w; W.q("[name=h]").value = h;
        const sh = Math.min(w, h);
        P.forEach((p) => { const b = W.q(`[data-p="${p}"]`), d = dims(p); b.disabled = p > sh; b.querySelector("small").textContent = p > sh ? "Larger than original" : `${d.width} × ${d.height}`; });
        const first = P.find((p) => p < sh);
        W.q(`[data-p="${first || "cu"}"]`).click();
      },
      async go(W) {
        const t = target();
        if (!t) throw uerr("Enter a width and height between 16 and 7680 pixels.");
        W.prog("Resizing…");
        const blob = await W.convert({ video: { ...t, hardwareAcceleration: HW } });
        W.prog();
        W.done(blob, `${baseName(W.file.name)}-resized.mp4`, `Resized to ${t.width} × ${t.height} · ${fmtSize(blob.size)}`);
        outVid(W, blob);
      } });
    const val = (n) => W.q(`[name=${n}]`), fit = () => val("fit").value;
    // A "720p" preset sets the short side, so portrait videos stay portrait at the same quality step.
    function dims(p) { const { w, h } = W.meta; return w >= h ? { width: ev((p * w) / h), height: p } : { width: p, height: ev((p * h) / w) }; }
    function target() {
      if (/^\d+$/.test(pick)) return { ...dims(+pick), fit: "fill" };
      if (pick === "sq") return { width: 1080, height: 1080, fit: fit() };
      if (pick === "vt") return { width: 1080, height: 1920, fit: fit() };
      const cw = +val("w").value, ch = +val("h").value;
      if (!(cw >= 16 && ch >= 16 && cw <= 7680 && ch <= 7680)) return null;
      return { width: ev(cw), height: ev(ch), fit: val("lock").checked ? "fill" : fit() };
    }
    const sync = () => { W.q(".x-cust").hidden = pick !== "cu"; W.q(".x-fit").hidden = !(pick === "sq" || pick === "vt" || (pick === "cu" && !val("lock").checked)); };
    onChips(W, (b) => { pick = b.dataset.p; sync(); });
    ["w", "h", "lock"].forEach((n) => val(n).addEventListener("input", () => {
      const { w, h } = W.meta || {}, lw = val("w"), lh = val("h");
      if (val("lock").checked && w) { if (n === "h") lw.value = Math.round((lh.value * w) / h) || ""; else lh.value = Math.round((lw.value * h) / w) || ""; }
      sync();
    }));
  }

  /* ===== Video Cropper ===== */
  function toolCrop(m) {
    const AR = [["Free", 0], ["1:1", 1], ["9:16", 9 / 16], ["16:9", 16 / 9], ["4:5", 4 / 5]];
    let R = null, ar = 0, drag = null;
    const W = shell(m, { icon: "crop", label: "Crop video", controls: `<p class="x-lbl">Aspect ratio</p>
      <div class="x-chips">${AR.map(([n, v]) => `<button type="button" class="x-chip" data-ar="${v}">${n}</button>`).join("")}</div>
      <p class="x-cnote x-cpx" aria-live="polite">–</p>
      <p class="x-hint">Drag inside the box to move it, or drag a corner to resize. Use the slider under the video to pick a frame.</p>`,
      loaded(W) { seek.max = W.meta.dur.toFixed(1); seek.value = 0; W.q("[data-ar='0']").click(); },
      async go(W) {
        const c = crop();
        W.prog("Cropping…");
        const blob = await W.convert({ video: { crop: c, hardwareAcceleration: HW } });
        W.prog();
        W.done(blob, `${baseName(W.file.name)}-cropped.mp4`, `Cropped to ${c.width} × ${c.height} · ${fmtSize(blob.size)}`);
        outVid(W, blob);
      } });
    const vid = W.vid, prev = vid.parentNode;
    vid.controls = false; vid.preload = "auto"; prev.classList.add("x-cropv");
    prev.insertAdjacentHTML("beforeend", `<div class="x-cbox" tabindex="0" role="group" aria-label="Crop box. Drag to move, drag a corner to resize, or use the arrow keys." hidden>${["nw", "ne", "sw", "se"].map((c) => `<i data-c="${c}"></i>`).join("")}</div>`);
    prev.insertAdjacentHTML("afterend", `<label class="x-seek">Preview frame<input type="range" min="0" step="0.1" value="0"></label>`);
    const box = prev.querySelector(".x-cbox"), seek = prev.nextElementSibling.querySelector("input");
    seek.addEventListener("input", () => { if (vid.readyState) vid.currentTime = +seek.value; });
    vid.addEventListener("loadeddata", () => { if (!vid.currentTime) vid.currentTime = 0.01; place(); });
    function crop() {
      const { w: mw, h: mh } = W.meta, left = Math.floor(R.x / 2) * 2, top = Math.floor(R.y / 2) * 2;
      return { left, top, width: Math.max(2, Math.min(Math.floor(R.w / 2) * 2, Math.floor((mw - left) / 2) * 2)), height: Math.max(2, Math.min(Math.floor(R.h / 2) * 2, Math.floor((mh - top) / 2) * 2)) };
    }
    function scale() {
      const vr = vid.getBoundingClientRect(), pr = prev.getBoundingClientRect(), { w, h } = W.meta, s = Math.min(vr.width / w, vr.height / h);
      return { s, ox: vr.left - pr.left - prev.clientLeft + (vr.width - w * s) / 2, oy: vr.top - pr.top - prev.clientTop + (vr.height - h * s) / 2 };
    }
    function place() {
      if (!R || !W.meta) return;
      const { s, ox, oy } = scale(), c = crop();
      Object.assign(box.style, { left: ox + R.x * s + "px", top: oy + R.y * s + "px", width: R.w * s + "px", height: R.h * s + "px" });
      box.hidden = !(s > 0);
      W.q(".x-cpx").textContent = `Crop ${c.width} × ${c.height} px, from ${c.left}, ${c.top} px`;
    }
    function reset() {
      const { w, h } = W.meta;
      let cw = ar ? w : w * 0.8, ch = ar ? w / ar : h * 0.8;
      if (ar && ch > h) { ch = h; cw = h * ar; }
      R = { x: (w - cw) / 2, y: (h - ch) / 2, w: cw, h: ch }; place();
    }
    onChips(W, (b) => { ar = +b.dataset.ar; reset(); });
    const ro = new ResizeObserver(place); ro.observe(prev); ro.observe(vid);
    vid.addEventListener("loadedmetadata", place);
    box.addEventListener("pointerdown", (e) => {
      if (!R) return;
      e.preventDefault(); box.setPointerCapture(e.pointerId); box.focus();
      drag = { c: e.target.dataset.c, x: e.clientX, y: e.clientY, r: { ...R }, s: scale().s };
    });
    box.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const { w: mw, h: mh } = W.meta, r0 = drag.r, dx = (e.clientX - drag.x) / drag.s, dy = (e.clientY - drag.y) / drag.s, c = drag.c;
      if (!c) { R.x = Math.min(Math.max(0, r0.x + dx), mw - r0.w); R.y = Math.min(Math.max(0, r0.y + dy), mh - r0.h); }
      else {
        const sx = c[1] === "e" ? 1 : -1, sy = c[0] === "s" ? 1 : -1, ax = sx > 0 ? r0.x : r0.x + r0.w, ay = sy > 0 ? r0.y : r0.y + r0.h;
        const maxW = sx > 0 ? mw - ax : ax, maxH = sy > 0 ? mh - ay : ay, min = Math.max(16, Math.min(mw, mh) * 0.05);
        let w = Math.max(min, (sx > 0 ? r0.w + dx : r0.w - dx)), h = Math.max(min, (sy > 0 ? r0.h + dy : r0.h - dy));
        if (ar) { if (w / h > ar) h = w / ar; else w = h * ar; w = Math.min(w, maxW, maxH * ar); h = w / ar; }
        else { w = Math.min(w, maxW); h = Math.min(h, maxH); }
        R = { x: sx > 0 ? ax : ax - w, y: sy > 0 ? ay : ay - h, w, h };
      }
      place();
    });
    const up = () => { if (drag) { drag = null; W.clear(); } };
    box.addEventListener("pointerup", up); box.addEventListener("pointercancel", up);
    box.addEventListener("keydown", (e) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || !R) return;
      e.preventDefault();
      const { w: mw, h: mh } = W.meta, st = Math.max(2, Math.round(Math.min(mw, mh) / 50));
      R.x = Math.min(Math.max(0, R.x + d[0] * st), mw - R.w); R.y = Math.min(Math.max(0, R.y + d[1] * st), mh - R.h);
      W.clear(); place();
    });
  }

  /* ===== Video Converter ===== */
  function toolConvert(m) {
    let mp3 = false;
    const W = shell(m, { icon: "convert", label: "Convert", controls: `<label>Convert to<select name="to"><option value="mp4">MP4 · plays everywhere</option><option value="webm">WebM · for websites</option><option value="mov">MOV · Apple QuickTime</option><option value="audio">Extract audio · M4A (AAC)</option></select></label>
      <p class="x-cnote">When the new format can hold the original video and sound, they're copied without re-encoding, so converting is often very fast.</p>`,
      async loaded(W) {
        const M = window.Mediabunny;
        try { mp3 = !!(M.Mp3OutputFormat && M.canEncodeAudio && (await M.canEncodeAudio("mp3"))); } catch (e) { mp3 = false; }
        W.q("[value=audio]").textContent = mp3 ? "Extract audio · MP3" : "Extract audio · M4A (AAC)";
      },
      async go(W) {
        const M = window.Mediabunny, to = W.q("[name=to]").value;
        const F = { mp4: [M.Mp4OutputFormat, "video/mp4", "mp4"], webm: [M.WebMOutputFormat, "video/webm", "webm"], mov: [M.MovOutputFormat, "video/quicktime", "mov"],
          audio: mp3 ? [M.Mp3OutputFormat, "audio/mpeg", "mp3"] : [M.Mp4OutputFormat, "audio/mp4", "m4a"] }[to];
        W.prog(to === "audio" ? "Extracting audio…" : "Converting…");
        if (typeof F[0] !== "function") throw uerr("This format isn't available in your browser.", `Missing export for ${to}`);
        const blob = await W.convert({ format: () => new F[0](), mime: F[1], ...(to === "audio" ? { video: { discard: true } } : {}) });
        W.prog();
        W.done(blob, `${baseName(W.file.name)}.${F[2]}`, `${F[2].toUpperCase()} ready · ${fmtSize(blob.size)}`);
        outVid(W, blob, to === "audio" ? "audio" : "video");
      } });
  }

  /* ===== YouTube Thumbnail Downloader ===== */
  function ytId(s) {
    s = String(s || "").trim();
    if (/^[\w-]{11}$/.test(s)) return s;
    let u;
    try { u = new URL(/^https?:\/\//i.test(s) ? s : "https://" + s); } catch (e) { return ""; }
    const h = u.hostname.toLowerCase().replace(/^(www|m|music)\./, "");
    let id = "";
    if (h === "youtu.be") id = u.pathname.split("/")[1];
    else if (h === "youtube.com" || h === "youtube-nocookie.com") id = u.searchParams.get("v") || (u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/?#]+)/) || [])[1];
    return /^[\w-]{11}$/.test(id || "") ? id : "";
  }
  function toolYT(m) {
    const S = [["maxresdefault", 1280, 720, "Max resolution"], ["sddefault", 640, 480, "Standard"], ["hqdefault", 480, 360, "High quality"], ["mqdefault", 320, 180, "Medium"]];
    m.innerHTML = `<div class="x-ws"><form class="x-ctrls x-ytf" novalidate><label>YouTube link or video ID<input type="text" name="u" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://www.youtube.com/watch?v=…"></label>
      <button type="submit" class="x-btn x-primary">${ic("play", 20)} Get thumbnails</button></form>
      <p class="x-err" role="alert" hidden></p><p class="x-state" aria-live="polite"></p><div class="x-yt"></div></div>`;
    const f = m.querySelector("form"), err = m.querySelector(".x-err"), st = m.querySelector(".x-state"), out = m.querySelector(".x-yt");
    let urls = [], gen = 0;
    const fail = (t) => { err.textContent = t; err.hidden = false; };
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; err.hidden = true; out.innerHTML = ""; st.textContent = "";
      const id = ytId(f.elements.u.value), g = ++gen;
      if (!id) return fail("That doesn't look like a YouTube link. Paste a link like youtube.com/watch?v=… or youtu.be/…, or an 11-character video ID.");
      out.innerHTML = S.map(([k, w, h, n]) => { const u = `https://img.youtube.com/vi/${id}/${k}.jpg`;
        return `<figure class="x-ytc" hidden><img src="${u}" alt="${n} thumbnail, ${w} × ${h}" data-k="${k}"><figcaption><b>${n}</b> · ${w} × ${h}</figcaption>
          <div class="x-actions"><a class="x-btn x-primary x-ytd" hidden>${ic("download", 20)} Download</a><a class="x-btn" href="${u}" target="_blank" rel="noopener">Open full size</a></div>
          <p class="x-hint">Long-press (phone) or right-click (computer) to save.</p></figure>`; }).join("");
      st.textContent = "Loading thumbnails…";
      let left = S.length, shown = 0;
      const end = () => { if (g !== gen || --left) return; st.textContent = ""; if (!shown) fail("No thumbnails were found for this video. Check the link and try again."); };
      out.querySelectorAll("img").forEach((img) => {
        const fig = img.closest("figure"), a = fig.querySelector(".x-ytd");
        img.addEventListener("load", () => {
          if (g === gen && img.naturalWidth > 120) {
            fig.hidden = false; shown++;
            fetch(img.src, { mode: "cors" }).then((r) => (r.ok ? r.blob() : Promise.reject())).then((b) => {
              if (g !== gen) return;
              const x = URL.createObjectURL(b); urls.push(x); a.href = x; a.download = `youtube-${id}-${img.dataset.k}.jpg`; a.hidden = false;
            }).catch(() => {});
          }
          end();
        }, { once: true });
        img.addEventListener("error", end, { once: true });
      });
    });
  }

  /* ===== Registry ===== */
  const PRIV = "Your video is processed in your browser and is never uploaded.";
  const defs = {
    "video-trimmer": { render: toolTrim, added: 13, description: "Cut the start and end off a video, right in your browser.",
      info: { steps: ["Add one video: MP4, MOV, WEBM or MKV, up to 500 MB.", "Play the preview and tap Set start and Set end at the right moments, or type the seconds or drag the sliders.", "Check the clip length, then tap Trim video.", "Download your -trimmed.mp4 file."],
        about: `Video Trimmer keeps just the part of a clip you want and saves it as an MP4. It's handy for cutting dead air from a recording or shortening a clip before sharing it. ${PRIV}`,
        faq: [["Does trimming lower the quality?", "Trimming re-encodes the clip so it can start at any moment, not just on a keyframe. Quality stays close to the original."], ["How long does it take?", "Toolsaku uses your device's hardware video encoder, so trimming is usually faster than real time."], ["Which browsers work?", "The latest Chrome, Edge and Safari. Older browsers without in-browser video encoding show a notice instead."]] } },
    "video-compressor": { render: toolCompress, added: 14, description: "Make a video file smaller, right in your browser.",
      info: { steps: ["Add one video: MP4, MOV, WEBM or MKV, up to 500 MB.", "Choose Light, Medium or Strong compression.", "Tap Compress video and watch the progress.", "Compare the sizes and preview, then download."],
        about: `Video Compressor re-encodes your video as an MP4 at a lower bitrate. Light keeps the resolution, Medium caps it at 720p and Strong at 480p, keeping the shape of the picture. ${PRIV}`,
        faq: [["Which level should I choose?", "Light for the best quality, Medium for messaging and email, Strong for the smallest file."], ["Why didn't my file get smaller?", "Some videos are already well compressed. When the result isn't smaller, Toolsaku tells you and offers your original file."], ["How long does it take?", "It uses your device's hardware encoder, so it's usually faster than real time. Long or 4K videos take longer, and you can cancel at any point."]] } },
    "video-resizer": { render: toolResize, added: 15, description: "Change a video's resolution or reshape it for Reels, Shorts and TikTok.",
      info: { steps: ["Add one video: MP4, MOV, WEBM or MKV, up to 500 MB.", "Check the original resolution, then pick 1080p, 720p, 480p, 360p, Square, Vertical or a custom size.", "For Square, Vertical or a custom shape, choose Contain (black bars) or Cover (crop to fill).", "Tap Resize video, then download your -resized.mp4 file."],
        about: `Video Resizer re-encodes your video at a new size as an MP4. The 1080p to 360p presets set the short side, keep the shape of the picture and are greyed out when they'd be larger than your original. Square 1:1 and Vertical 9:16 make clips ready for social feeds. ${PRIV}`,
        faq: [["Why are some sizes greyed out?", "Making a video larger than its original resolution doesn't add detail, so those presets are turned off."], ["Contain or Cover?", "Contain shows the whole picture with black bars. Cover fills the frame and trims the edges."], ["How long does it take?", "Toolsaku uses your device's hardware encoder, so it's usually faster than real time."]] } },
    "video-cropper": { render: toolCrop, added: 16, description: "Crop the frame of a video to any shape, right in your browser.",
      info: { steps: ["Add one video: MP4, MOV, WEBM or MKV, up to 500 MB.", "Pick Free, 1:1, 9:16, 16:9 or 4:5.", "Drag the box to move it and drag a corner to resize it. The crop size in pixels shows as you go.", "Tap Crop video, then download your -cropped.mp4 file."],
        about: `Video Cropper cuts away the edges of the picture and keeps the area inside the box, at full resolution. It works with a mouse or a finger. ${PRIV}`,
        faq: [["Does cropping lower the quality?", "The kept area stays at its original resolution. The video is re-encoded, so quality stays close to the original."], ["Why do the numbers change by 2?", "Video encoders need even sizes, so the crop is rounded to even pixel values."], ["Can I crop for Instagram or TikTok?", "Yes. Use 1:1 or 4:5 for feed posts and 9:16 for Reels, Stories and TikTok."]] } },
    "video-converter": { render: toolConvert, added: 17, description: "Convert videos to MP4, WebM or MOV, or pull out the audio.",
      info: { steps: ["Add one video: MP4, MOV, WEBM or MKV, up to 500 MB.", "Choose MP4, WebM, MOV or Extract audio.", "Tap Convert and watch the progress.", "Preview the result, then download it."],
        about: `Video Converter changes the container format of your video. When the new format supports the original video and sound, they're copied straight across, which is fast and lossless; otherwise they're re-encoded. Extract audio saves just the sound, as MP3 when your browser can encode it and as M4A (AAC) otherwise. ${PRIV}`,
        faq: [["Which format should I choose?", "MP4 plays almost everywhere. WebM suits websites. MOV is for Apple and editing apps."], ["Why was my audio saved as M4A, not MP3?", "Most browsers can't encode MP3 yet, so Toolsaku saves AAC audio in an M4A file, which plays on phones and computers alike."], ["Why did conversion fail?", "Some codecs can't be decoded or encoded in your browser. Toolsaku lists the reason so you can try another format."]] } },
    "youtube-thumbnail-downloader": { render: toolYT, added: 18, description: "Get the thumbnail images of any YouTube video in every size.",
      info: { steps: ["Copy the link of a YouTube video, Short or live stream.", "Paste it in the box, or type the 11-character video ID.", "Tap Get thumbnails to see every available size.", "Tap Download, or open the full size and long-press or right-click to save."],
        about: "YouTube Thumbnail Downloader shows the thumbnail images YouTube publishes for a video: up to 1280 × 720, plus 640 × 480, 480 × 360 and 320 × 180. Sizes the video doesn't have are hidden. It works with watch, youtu.be, Shorts, embed and live links. Nothing is uploaded, and no sign-up is needed.",
        faq: [["Why is the max resolution missing?", "YouTube only makes a 1280 × 720 thumbnail for some videos, mostly HD uploads. Toolsaku hides sizes that don't exist."], ["Why doesn't Download appear?", "Some browsers block direct downloads of the image. Tap Open full size, then long-press (phone) or right-click (computer) to save it."], ["Can I use the thumbnail?", "Thumbnails belong to the video's creator. Use them for reference, or ask for permission before reusing them."]] } },
  };
  if (T.cats && T.cats.video) T.cats.video.desc = "Resize, crop, trim, compress and convert videos, and save YouTube thumbnails — free, in your browser.";
  Object.entries(defs).forEach(([id, d]) => { if (byId[id]) Object.assign(byId[id], d, { status: "live" }); });
  T.route();
})();
