/* Toolora PDF tools: Merge PDF, Split PDF, PDF to Images, PDF Page Organizer, Compress PDF. Uses window.Toolora from index.html. */
(function () {
  "use strict";
  /* Page ranges like "1-3,5", "7-" or "-2" → 0-based page indexes in the order given, without repeats. */
  function parseRanges(s, n) {
    const parts = String(s || "").replace(/[–—]/g, "-").replace(/\s+/g, "").split(",").filter(Boolean), out = [], seen = new Set();
    if (!parts.length) throw new Error("Enter the pages to extract, for example 1-3,5.");
    for (const p of parts) {
      const m = /^(\d+)?(?:(-)(\d+)?)?$/.exec(p);
      if (!m || (!m[1] && !m[3])) throw new Error(`“${p}” isn't a valid page or range. Use numbers like 1-3,5.`);
      const a = m[1] ? +m[1] : 1, b = m[2] ? (m[3] ? +m[3] : n) : a;
      if (a < 1 || b < 1 || a > n || b > n) throw new Error(`“${p}” is outside this PDF, which has ${n} page${n > 1 ? "s" : ""}.`);
      if (a > b) throw new Error(`“${p}” runs backwards. Write it as ${b}-${a}.`);
      for (let i = a; i <= b; i++) if (!seen.has(i)) { seen.add(i); out.push(i - 1); }
    }
    return out;
  }
  const T = window.Toolora;
  if (!T) return;
  T.parseRanges = parseRanges;
  const { byId, ic, esc, fmtSize, toB64 } = T;
  const MAXB = 50 * 1024 * 1024, CDN = "https://cdn.jsdelivr.net/npm/";
  const LIB = CDN + "pdf-lib@1.17.1/dist/pdf-lib.min.js", PDFJS = CDN + "pdfjs-dist@3.11.174/build/pdf.min.js", WORKER = CDN + "pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const PW = "This PDF is password-protected.";
  const ENGINE_ERR = "The PDF engine couldn't load. Check your internet connection or turn off any content blocker, then add your file again.";

  const css = document.createElement("style");
  css.textContent = `.x-ws [hidden]{display:none!important}
.x-pic{width:56px;height:56px;border-radius:8px;display:grid;place-items:center;flex:none;background:var(--soft);color:var(--blue)}
.x-pout{margin-top:24px}.x-pout h3{margin:0 0 12px;font-size:18px;color:var(--navy)}
.x-pout .x-thumbs li{flex-wrap:nowrap}
.x-igrid{list-style:none;margin:0;padding:0;display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr))}
.x-igrid li{display:grid;gap:8px;align-content:start;padding:8px;border-radius:12px;background:#fff;border:1px solid var(--line)}
.x-igrid img{width:100%;aspect-ratio:3/4;object-fit:contain;border-radius:8px;background:var(--soft)}
.x-igrid span{font-size:13px;color:var(--muted)}.x-igrid b{display:block;font-size:14px;color:var(--navy)}
.x-igrid .x-btn,.x-pout .x-thumbs .x-btn{justify-content:center}
.x-thumbs.x-og{grid-template-columns:repeat(auto-fill,minmax(196px,1fr))}
.x-og li{display:grid;gap:6px;justify-items:center;padding:8px}
.x-og .x-pg{width:100%;aspect-ratio:1;display:grid;place-items:center;overflow:hidden;border-radius:8px;background:var(--soft)}
.x-prev .x-og .x-pg img{width:100%;height:100%;object-fit:contain;border-radius:0;transition:transform .2s}
.x-og span{font-size:13px;color:var(--muted)}.x-og .x-tb{margin:0}
.x-cnote{font-size:14px;padding:10px 12px;border-radius:12px;background:var(--soft)}`;
  document.head.appendChild(css);

  /* ===== Lazy library loading ===== */
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
  const loadLib = () => loadScript(LIB, () => !!window.PDFLib);
  const loadJs = () => loadScript(PDFJS, () => !!window.pdfjsLib).then(() => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER; });
  const isPw = (e) => !!e && (e.name === "PasswordException" || /encrypt|password/i.test(e.message || ""));
  const openErr = (name, e) => `“${name}”: ` + (isPw(e) ? PW : "couldn't be opened. It may be damaged or not a real PDF.");
  async function jsOpen(bytes) {
    const open = (opt) => window.pdfjsLib.getDocument({ data: bytes.slice(0), ...opt }).promise;
    try { return await open({}); } catch (e) {
      if (isPw(e) || /InvalidPDF|MissingPDF/.test(e.name || "")) throw e;
      await loadScript(WORKER, () => !!window.pdfjsWorker).catch(() => {}); // run pdf.js on the main thread
      return open({ disableWorker: true });
    }
  }
  function checkPdf(f) {
    if (!(f.type === "application/pdf" || /\.pdf$/i.test(f.name))) return `“${f.name}” isn't a PDF. Please choose a PDF file.`;
    if (f.size > MAXB) return `“${f.name}” is ${fmtSize(f.size)}. The limit is 50 MB.`;
    if (!f.size) return `“${f.name}” is empty. Please choose another PDF.`;
    return "";
  }
  const baseName = (n) => n.replace(/\.pdf$/i, "").replace(/[^\w.-]+/g, "-").slice(0, 60) || "document";
  const pl = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /* ===== Shared PDF workspace, matching the image tools' layout ===== */
  function shell(m, o) {
    m.innerHTML = `<div class="x-ws">
      <label class="x-drop" tabindex="0"><input type="file"${o.multi ? " multiple" : ""} accept="application/pdf,.pdf" class="x-sr" tabindex="-1" aria-label="Choose ${o.multi ? "PDF files" : "a PDF"}">
        <span class="x-ic">${ic("upload", 28)}</span><strong>Drop ${o.multi ? "PDFs" : "a PDF"} here or <u>tap to choose</u></strong>
        <span class="x-note">PDF only · <b>max 50 MB${o.multi ? " each" : ""}</b></span><span class="x-note">Processed on your device — nothing is uploaded.</span></label>
      <p class="x-state x-eng" aria-live="polite"></p><p class="x-err" role="alert" hidden></p>
      <div class="x-edit" hidden>
        <p class="x-src"><b class="x-fname"></b><span class="x-orig"></span></p>
        <div class="x-grid"><div class="x-ctrls">${o.controls || ""}${o.multi ? '<button type="button" class="x-btn x-add">+ Add more PDFs</button>' : ""}
          <button type="button" class="x-btn x-primary x-go">${ic(o.icon, 20)} ${o.go}</button></div>
          <div><div class="x-prev x-plist"><ol class="x-thumbs" aria-label="${o.multi ? "Files in order" : "Your PDF"}"></ol><div class="x-spin" hidden role="status" aria-label="Processing"></div></div>
            <p class="x-state x-prog" aria-live="polite"></p><p class="x-info" aria-live="polite"></p>
            <div class="x-actions"><a class="x-btn x-primary x-dl is-busy">${ic("download", 20)} <span>Download</span></a><a class="x-btn x-dl2" hidden>Backup download</a><button type="button" class="x-btn x-reset">Reset</button></div>
            <p class="x-hint">${o.hint || "If the download doesn't start, tap Backup download, or long-press it and choose to save the file."}</p></div></div>
        <div class="x-pout" hidden></div></div></div>`;
    const q = (s) => m.querySelector(s), input = q("input[type=file]"), drop = q(".x-drop"), err = q(".x-err"), eng = q(".x-eng"), edit = q(".x-edit"),
      spin = q(".x-spin"), prog = q(".x-prog"), info = q(".x-info"), dl = q(".x-dl"), dl2 = q(".x-dl2"), go = q(".x-go"), addB = q(".x-add"), out = q(".x-pout");
    let urls = [], many = false, engP = null, onFiles = null, onGo = null, onReset = null, working = false;
    const W = { q, list: q(".x-thumbs"), out };
    W.fail = (msg) => { err.textContent = msg; err.hidden = false; };
    W.prog = (t) => (prog.textContent = t || "");
    W.show = (on) => { edit.hidden = !on; drop.hidden = !!on; };
    W.url = (blob) => { const u = URL.createObjectURL(blob); urls.push(u); return u; };
    W.clear = () => {
      urls.forEach((u) => URL.revokeObjectURL(u)); urls = []; many = false;
      dl.removeAttribute("href"); dl.removeAttribute("download"); dl.classList.add("is-busy"); dl.querySelector("span").textContent = "Download";
      dl2.removeAttribute("href"); dl2.hidden = true; info.textContent = ""; out.innerHTML = ""; out.hidden = true;
    };
    W.single = (bytes, name, text) => {
      dl.href = W.url(new Blob([bytes], { type: "application/pdf" })); dl.download = dl2.download = name; dl.classList.remove("is-busy");
      dl2.href = "data:application/pdf;base64," + toB64(bytes); dl2.hidden = false; info.textContent = text;
    };
    W.many = (files, title, text, grid) => {
      out.innerHTML = `<h3>${esc(title)}</h3><ol class="${grid ? "x-igrid" : "x-thumbs"}">${files.map((f) => {
        const u = W.url(f.blob), a = `<a class="x-btn" href="${u}" download="${esc(f.name)}">${ic("download", 18)} Download</a>`;
        return grid ? `<li><img src="${u}" alt="Page ${f.page} preview" loading="lazy"><span><b>${esc(f.name)}</b>${esc(f.label)}</span>${a}</li>`
          : `<li><span class="x-pic">${ic("file", 26)}</span><span class="x-tn"><b>${esc(f.name)}</b>${esc(f.label)}</span>${a}</li>`;
      }).join("")}</ol>`;
      out.hidden = false; many = true; dl.href = "#"; dl.classList.remove("is-busy"); dl.querySelector("span").textContent = "Download all"; info.textContent = text;
    };
    const busy = (on) => { working = on; spin.hidden = !on; [go, addB].forEach((b) => b && (b.classList.toggle("is-busy", on), (b.disabled = on))); };
    const ready = () => {
      if (!engP) { eng.textContent = "Loading PDF engine…"; engP = o.engine().finally(() => (eng.textContent = "")).catch((e) => { engP = null; throw e; }); }
      return engP;
    };
    async function add(files) {
      if (working || !files || !files.length) return;
      err.hidden = true;
      try { await ready(); } catch (e) { input.value = ""; return W.fail(ENGINE_ERR); }
      busy(true);
      let bad = [];
      try { bad = (await onFiles([...files])) || []; } catch (e) { bad = [(e && e.message) || "Something went wrong reading that file."]; }
      finally { busy(false); W.prog(); input.value = ""; if (bad.length) W.fail(bad.join(" ")); }
    }
    async function run() {
      if (working) return;
      err.hidden = true; W.clear(); busy(true);
      try { await onGo(); } catch (e) { W.clear(); W.fail(isPw(e) ? PW : (e && e.message) || "Something went wrong. Try a smaller PDF."); }
      finally { busy(false); W.prog(); }
    }
    async function downloadAll() {
      for (const a of out.querySelectorAll("a[download]")) { a.click(); await wait(500); }
    }
    W.on = (f, g, r) => { onFiles = f; onGo = g; onReset = r; };
    input.addEventListener("change", () => add(input.files));
    drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    [["dragenter", 1], ["dragover", 1], ["dragleave", 0], ["drop", 0]].forEach(([ev, on]) => m.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.toggle("is-over", !!on); }));
    m.addEventListener("drop", (e) => add(e.dataTransfer.files));
    if (addB) addB.addEventListener("click", () => input.click());
    go.addEventListener("click", run);
    dl.addEventListener("click", (e) => { if (many) { e.preventDefault(); downloadAll(); } else if (!dl.getAttribute("href")) e.preventDefault(); });
    m.querySelectorAll(".x-ctrls select, .x-ctrls input").forEach((s) => s.addEventListener(s.tagName === "SELECT" ? "change" : "input", W.clear));
    q(".x-reset").addEventListener("click", () => { if (working) return; W.clear(); onReset && onReset(); input.value = ""; err.hidden = true; W.show(false); drop.focus(); });
    ready().catch(() => W.fail(ENGINE_ERR));
    return W;
  }
  const fileRow = (name, text, btns) => `<li><span class="x-pic">${ic("file", 26)}</span><span class="x-tn"><b>${esc(name)}</b>${text}</span>${btns ? `<span class="x-tb">${btns}</span>` : ""}</li>`;
  async function readOne(W, files, open) {
    const f = files[0], msg = checkPdf(f);
    if (msg) return { bad: [msg] };
    W.prog(`Reading ${f.name}…`);
    try { const bytes = new Uint8Array(await f.arrayBuffer()); return { doc: await open(bytes), file: { name: f.name, size: f.size, bytes } }; }
    catch (e) { return { bad: [openErr(f.name, e)] }; }
  }

  /* ===== Merge PDF ===== */
  function toolMerge(m) {
    let items = [];
    const W = shell(m, { multi: 1, icon: "merge", go: "Merge PDFs", engine: loadLib });
    function draw() {
      W.clear(); W.show(items.length);
      if (!items.length) return;
      W.q(".x-fname").textContent = pl(items.length, "PDF");
      W.q(".x-orig").textContent = ` · ${pl(items.reduce((a, b) => a + b.pages, 0), "page")} · ${fmtSize(items.reduce((a, b) => a + b.size, 0))} in total`;
      W.list.innerHTML = items.map((it, i) => fileRow(it.name, `${pl(it.pages, "page")} · ${fmtSize(it.size)}`,
        `<button type="button" class="x-ib" data-act="up" data-i="${i}" aria-label="Move ${esc(it.name)} up"${i ? "" : " disabled"}>↑</button><button type="button" class="x-ib" data-act="down" data-i="${i}" aria-label="Move ${esc(it.name)} down"${i < items.length - 1 ? "" : " disabled"}>↓</button><button type="button" class="x-ib" data-act="rm" data-i="${i}" aria-label="Remove ${esc(it.name)}">×</button>`)).join("");
    }
    W.on(async (files) => {
      const bad = [];
      for (const f of files) {
        const r = await readOne(W, [f], (b) => window.PDFLib.PDFDocument.load(b));
        if (r.bad) bad.push(...r.bad); else items.push({ ...r.file, pages: r.doc.getPageCount() });
      }
      draw();
      return bad;
    }, async () => {
      if (items.length < 2) throw new Error("Add at least two PDFs to merge.");
      const P = window.PDFLib.PDFDocument, out = await P.create();
      for (let i = 0; i < items.length; i++) {
        W.prog(`Merging file ${i + 1} of ${items.length}…`); await wait(20);
        const src = await P.load(items[i].bytes);
        (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
      }
      W.prog("Saving merged.pdf…"); await wait(20);
      const bytes = await out.save();
      W.single(bytes, "merged.pdf", `merged.pdf ready: ${pl(out.getPageCount(), "page")} · ${fmtSize(bytes.length)}`);
    }, () => (items = []));
    W.list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const i = +b.dataset.i, j = b.dataset.act === "up" ? i - 1 : i + 1;
      if (b.dataset.act === "rm") items.splice(i, 1); else [items[i], items[j]] = [items[j], items[i]];
      draw();
      const nb = W.list.querySelector(`[data-act="${b.dataset.act}"][data-i="${b.dataset.act === "rm" ? Math.min(i, items.length - 1) : j}"]`);
      if (nb && !nb.disabled) nb.focus();
    });
  }

  /* ===== Split PDF ===== */
  function toolSplit(m) {
    let it = null;
    const W = shell(m, { icon: "split", go: "Split PDF", engine: loadLib, controls: `
      <label>Split mode<select name="mode"><option value="range">Extract pages</option><option value="each">Every page separately</option><option value="chunk">Chunks of N pages</option></select></label>
      <label data-for="range">Pages to extract<input type="text" name="range" placeholder="e.g. 1-3,5" autocomplete="off"></label>
      <label data-for="chunk" hidden>Pages per file<input type="number" name="n" min="1" value="2" inputmode="numeric"></label>` });
    const val = (n) => W.q(`[name="${n}"]`).value;
    W.q("[name=mode]").addEventListener("change", () => m.querySelectorAll("[data-for]").forEach((l) => (l.hidden = l.dataset.for !== val("mode"))));
    W.on(async (files) => {
      const r = await readOne(W, files, (b) => window.PDFLib.PDFDocument.load(b));
      if (r.bad) return r.bad;
      it = { ...r.file, pages: r.doc.getPageCount() };
      W.clear(); W.show(true);
      W.q(".x-fname").textContent = it.name; W.q(".x-orig").textContent = ` · ${pl(it.pages, "page")} · ${fmtSize(it.size)}`;
      W.list.innerHTML = fileRow(it.name, `${pl(it.pages, "page")} · ${fmtSize(it.size)}`);
      return files.length > 1 ? ["Split works on one PDF at a time, so only the first file was used."] : [];
    }, async () => {
      const n = it.pages, mode = val("mode"), all = [...Array(n).keys()], base = baseName(it.name);
      let groups;
      if (mode === "range") groups = [parseRanges(val("range"), n)];
      else if (mode === "each") groups = all.map((i) => [i]);
      else {
        const k = parseInt(val("n"), 10);
        if (!(k >= 1)) throw new Error("Enter how many pages each file should have, such as 2.");
        groups = [];
        for (let i = 0; i < n; i += k) groups.push(all.slice(i, i + k));
      }
      const P = window.PDFLib.PDFDocument, src = await P.load(it.bytes), files = [];
      for (let g = 0; g < groups.length; g++) {
        W.prog(`Creating file ${g + 1} of ${groups.length}…`); if (g % 5 === 0) await wait(10);
        const out = await P.create();
        (await out.copyPages(src, groups[g])).forEach((p) => out.addPage(p));
        const bytes = await out.save(), pp = groups[g], first = pp[0] + 1, last = pp[pp.length - 1] + 1;
        const name = mode === "range" ? `${base}-pages.pdf` : mode === "each" ? `${base}-page-${first}.pdf` : `${base}-part-${g + 1}.pdf`;
        files.push({ name, bytes, label: `${pp.length === 1 ? "Page " + first : `Pages ${first}–${last}`} · ${fmtSize(bytes.length)}` });
      }
      if (files.length === 1) W.single(files[0].bytes, files[0].name, `${files[0].name} ready: ${pl(groups[0].length, "page")} · ${fmtSize(files[0].bytes.length)}`);
      else W.many(files.map((f) => ({ ...f, blob: new Blob([f.bytes], { type: "application/pdf" }) })), "Your files", `${pl(files.length, "PDF")} ready. Download each below, or all at once.`);
    }, () => (it = null));
  }

  /* ===== PDF to Images ===== */
  function toolImages(m) {
    let doc = null, it = null;
    const W = shell(m, { icon: "image", go: "Convert to images", engine: loadJs, hint: "If a download doesn't start, long-press the page image and save it. Download all saves the pages one after another; your browser may ask to allow multiple downloads.",
      controls: `<label>Format<select name="fmt"><option value="jpg">JPG (smaller files)</option><option value="png">PNG (sharpest)</option></select></label>
        <label>Quality<select name="sc"><option value="1.5">Normal (1.5×)</option><option value="2.5">High (2.5×)</option></select></label>` });
    const drop = () => { if (doc) doc.destroy(); doc = null; };
    W.on(async (files) => {
      const r = await readOne(W, files, jsOpen);
      if (r.bad) return r.bad;
      drop(); doc = r.doc; it = r.file;
      W.clear(); W.show(true);
      W.q(".x-fname").textContent = it.name; W.q(".x-orig").textContent = ` · ${pl(doc.numPages, "page")} · ${fmtSize(it.size)}`;
      W.list.innerHTML = fileRow(it.name, `${pl(doc.numPages, "page")} · ${fmtSize(it.size)}`);
      return files.length > 1 ? ["PDF to Images works on one PDF at a time, so only the first file was used."] : [];
    }, async () => {
      const png = W.q("[name=fmt]").value === "png", type = png ? "image/png" : "image/jpeg", ext = png ? "png" : "jpg", out = [], n = doc.numPages;
      for (let i = 1; i <= n; i++) {
        W.prog(`Rendering page ${i} of ${n}…`);
        const page = await doc.getPage(i);
        let vp = page.getViewport({ scale: +W.q("[name=sc]").value });
        if (vp.width * vp.height > 25e6) vp = page.getViewport({ scale: vp.scale * Math.sqrt(25e6 / (vp.width * vp.height)) });
        const c = document.createElement("canvas"), x = c.getContext("2d");
        c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
        if (!x) throw new Error("Your browser couldn't create an image canvas.");
        x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
        await page.render({ canvasContext: x, viewport: vp }).promise;
        const blob = await new Promise((r) => c.toBlob(r, type, 0.92));
        if (!blob) throw new Error(`Your browser couldn't save page ${i} as ${ext.toUpperCase()}. Try Normal quality.`);
        out.push({ page: i, name: `page-${i}.${ext}`, blob, label: `${c.width} × ${c.height} px · ${fmtSize(blob.size)}` });
        c.width = c.height = 0; page.cleanup();
      }
      W.many(out, "Your images", `${pl(n, "image")} ready · ${fmtSize(out.reduce((a, b) => a + b.blob.size, 0))} in total`, true);
    }, () => { drop(); it = null; });
  }

  const both = () => Promise.all([loadLib(), loadJs()]);
  const jpgBytes = (url) => { const s = atob(url.slice(url.indexOf(",") + 1)), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
  async function paint(page, scale, max) {
    let vp = page.getViewport({ scale });
    if (vp.width * vp.height > max) vp = page.getViewport({ scale: scale * Math.sqrt(max / (vp.width * vp.height)) });
    const c = document.createElement("canvas"), x = c.getContext("2d");
    if (!x) throw new Error("Your browser couldn't create an image canvas.");
    c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
    x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: x, viewport: vp }).promise;
    return c;
  }

  /* ===== PDF Page Organizer ===== */
  function toolOrganize(m) {
    let doc = null, it = null, pages = [];
    const W = shell(m, { icon: "layers", go: "Save PDF", engine: both });
    W.list.classList.add("x-og"); W.list.setAttribute("aria-label", "Pages in order");
    const drop = () => { if (doc) doc.destroy(); doc = null; };
    function draw() {
      W.clear();
      W.q(".x-orig").textContent = ` · ${pl(pages.length, "page")} of ${it.total} · ${fmtSize(it.size)}`;
      W.list.innerHTML = pages.map((p, i) => `<li><span class="x-pg"><img src="${p.img}" alt="Page ${p.src + 1}" style="transform:rotate(${p.rot}deg)"></span><span>Page ${p.src + 1}${p.rot ? ` · rotated ${p.rot}°` : ""}</span><span class="x-tb">
        <button type="button" class="x-ib" data-act="l" data-i="${i}" aria-label="Move page ${p.src + 1} left"${i ? "" : " disabled"}>←</button><button type="button" class="x-ib" data-act="r" data-i="${i}" aria-label="Move page ${p.src + 1} right"${i < pages.length - 1 ? "" : " disabled"}>→</button><button type="button" class="x-ib" data-act="rot" data-i="${i}" aria-label="Rotate page ${p.src + 1} 90°">↻</button><button type="button" class="x-ib" data-act="rm" data-i="${i}" aria-label="Delete page ${p.src + 1}"${pages.length > 1 ? "" : " disabled"}>×</button></span></li>`).join("");
    }
    W.on(async (files) => {
      const r = await readOne(W, files, jsOpen);
      if (r.bad) return r.bad;
      drop(); doc = r.doc; it = { ...r.file, total: doc.numPages }; pages = [];
      for (let i = 1; i <= doc.numPages; i++) {
        W.prog(`Loading page ${i} of ${doc.numPages}…`);
        const pg = await doc.getPage(i), v1 = pg.getViewport({ scale: 1 }), c = await paint(pg, 180 / Math.max(v1.width, v1.height, 1), 4e5);
        pages.push({ src: i - 1, rot: 0, img: c.toDataURL("image/jpeg", 0.7) }); c.width = c.height = 0; pg.cleanup();
      }
      W.show(true); W.q(".x-fname").textContent = it.name; draw();
      return files.length > 1 ? ["The organizer works on one PDF at a time, so only the first file was used."] : [];
    }, async () => {
      const { PDFDocument, degrees } = window.PDFLib;
      W.prog("Saving organized.pdf…"); await wait(20);
      const src = await PDFDocument.load(it.bytes), out = await PDFDocument.create();
      (await out.copyPages(src, pages.map((p) => p.src))).forEach((p, i) => {
        p.setRotation(degrees((((p.getRotation().angle + pages[i].rot) % 360) + 360) % 360)); out.addPage(p);
      });
      const bytes = await out.save();
      W.single(bytes, "organized.pdf", `organized.pdf ready: ${pl(pages.length, "page")} · ${fmtSize(bytes.length)}`);
    }, () => { drop(); it = null; pages = []; });
    W.list.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b || b.disabled) return;
      const a = b.dataset.act, i = +b.dataset.i, j = a === "l" ? i - 1 : a === "r" ? i + 1 : i;
      if (a === "rot") pages[i].rot = (pages[i].rot + 90) % 360;
      else if (a === "rm") { if (pages.length > 1) pages.splice(i, 1); }
      else [pages[i], pages[j]] = [pages[j], pages[i]];
      draw();
      const nb = W.list.querySelector(`[data-act="${a}"][data-i="${Math.min(j, pages.length - 1)}"]`);
      if (nb && !nb.disabled) nb.focus();
    });
  }

  /* ===== Compress PDF ===== */
  function toolCompress(m) {
    let doc = null, it = null;
    const LV = { low: [150, 0.8], medium: [110, 0.65], strong: [80, 0.5] };
    const W = shell(m, { icon: "compress", go: "Compress PDF", engine: both, controls: `
      <label>Compression level<select name="lv"><option value="low">Low · 150 DPI, best quality</option><option value="medium" selected>Medium · 110 DPI</option><option value="strong">Strong · 80 DPI, smallest file</option></select></label>
      <p class="x-cnote">Compression turns pages into images, so text won't be selectable afterwards. Best for scanned documents.</p>` });
    const drop = () => { if (doc) doc.destroy(); doc = null; };
    W.on(async (files) => {
      const r = await readOne(W, files, jsOpen);
      if (r.bad) return r.bad;
      drop(); doc = r.doc; it = r.file;
      W.clear(); W.show(true);
      W.q(".x-fname").textContent = it.name; W.q(".x-orig").textContent = ` · ${pl(doc.numPages, "page")} · ${fmtSize(it.size)}`;
      W.list.innerHTML = fileRow(it.name, `${pl(doc.numPages, "page")} · ${fmtSize(it.size)}`);
      return files.length > 1 ? ["Compress PDF works on one PDF at a time, so only the first file was used."] : [];
    }, async () => {
      const [dpi, q] = LV[W.q("[name=lv]").value], n = doc.numPages, out = await window.PDFLib.PDFDocument.create();
      for (let i = 1; i <= n; i++) {
        W.prog(`Compressing page ${i} of ${n}`); await wait(10);
        const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1 }), c = await paint(pg, dpi / 72, 25e6);
        const url = c.toDataURL("image/jpeg", q); c.width = c.height = 0; pg.cleanup();
        if (!/^data:image\/jpeg/.test(url)) throw new Error(`Your browser couldn't compress page ${i}.`);
        const img = await out.embedJpg(jpgBytes(url));
        out.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
      }
      W.prog("Saving…"); await wait(20);
      const bytes = await out.save(), before = it.size, after = bytes.length;
      if (after >= before) W.single(it.bytes, it.name, `Compressing made this PDF larger (${fmtSize(before)} → ${fmtSize(after)}), so it's likely already optimized. Download your original instead.`);
      else W.single(bytes, `${baseName(it.name)}-compressed.pdf`, `${fmtSize(before)} → ${fmtSize(after)} · ${Math.round((1 - after / before) * 100)}% smaller`);
    }, () => { drop(); it = null; });
  }

  /* ===== Registry ===== */
  const PRIV = "Your PDF is processed in your browser and is never uploaded.";
  const defs = {
    "merge-pdf": { render: toolMerge, description: "Combine several PDFs into one file, in the order you choose.",
      info: { steps: ["Add two or more PDF files, up to 50 MB each.", "Use the arrows to put them in order, or × to remove one.", "Tap Merge PDFs.", "Download merged.pdf."],
        about: `Merge PDF joins several documents into a single file, keeping every page exactly as it was: text stays selectable and links keep working. It's handy for combining scanned pages, invoices or chapters before sending them as one attachment. ${PRIV}`,
        faq: [["Is there a limit on files?", "Each PDF can be up to 50 MB. There's no fixed number of files, but very large merges depend on your device's memory."], ["Can I merge password-protected PDFs?", "No. Remove the password in your PDF reader first, then add the file again."], ["Will the quality change?", "No. Pages are copied as they are, without re-compressing images or text."]] } },
    "split-pdf": { render: toolSplit, description: "Extract pages, or split a PDF into single pages or chunks.",
      info: { steps: ["Add one PDF, up to 50 MB.", "Choose Extract pages, Every page separately, or Chunks of N pages.", "For Extract pages, type the pages, such as 1-3,5.", "Tap Split PDF and download your files."],
        about: `Split PDF pulls out just the pages you need, or breaks a long document into single pages or equal parts. Pages are copied without any loss of quality. ${PRIV}`,
        faq: [["How do I write page ranges?", "Separate pages and ranges with commas: 1-3,5 gives pages 1, 2, 3 and 5. 7- means page 7 to the end."], ["What if the last chunk is short?", "With Chunks of N pages, the final file holds whatever pages are left, so a 10-page PDF in chunks of 3 gives files of 3, 3, 3 and 1 pages."], ["Why doesn't Download all save every file?", "Some browsers ask before saving several files at once. Allow it, or tap each file's own Download button."]] } },
    "pdf-to-images": { render: toolImages, description: "Turn every page of a PDF into a JPG or PNG image.",
      info: { steps: ["Add one PDF, up to 50 MB.", "Choose JPG or PNG, and Normal or High quality.", "Tap Convert to images.", "Download single pages, or tap Download all."],
        about: `PDF to Images renders each page as a picture you can post, share or drop into a slide. JPG keeps files small; PNG is sharpest for text and diagrams. High quality renders at 2.5 times the page size for crisp zooming. ${PRIV}`,
        faq: [["Which format should I choose?", "JPG for photos and smaller files, PNG for documents with text, charts or line art."], ["How big are the images?", "Normal renders an A4 page at about 1240 × 1754 pixels; High at about 2070 × 2920."], ["My PDF has many pages. Is that OK?", "Yes, pages are rendered one at a time. Long documents at High quality take longer and use more memory, so use Normal on older phones."]] } },
    "organize-pdf": { render: toolOrganize, added: 11, description: "Reorder, rotate and delete the pages of a PDF.",
      info: { steps: ["Add one PDF, up to 50 MB.", "Use ← and → to move pages, ↻ to rotate one 90°, or × to delete it.", "Tap Save PDF.", "Download organized.pdf."],
        about: `PDF Page Organizer shows every page as a thumbnail so you can fix the order, turn sideways scans upright and drop pages you don't need. Pages are copied, not re-rendered, so text stays selectable and quality is unchanged. ${PRIV}`,
        faq: [["Can I delete every page?", "No. A PDF needs at least one page, so the last page can't be deleted."], ["Does rotating lower the quality?", "No. Rotation is saved as a page setting, so the content isn't redrawn."], ["Can I undo a change?", "Rotate a page four times to return it to its start, or tap Reset and add the PDF again to start over."]] } },
    "compress-pdf": { render: toolCompress, added: 12, description: "Make a PDF smaller by turning its pages into compressed images.",
      info: { steps: ["Add one PDF, up to 50 MB.", "Choose Low, Medium or Strong compression.", "Tap Compress PDF and watch each page being compressed.", "Check the size saved, then download."],
        about: `Compress PDF redraws each page as a JPEG image at a lower resolution: Low at 150 DPI, Medium at 110 DPI and Strong at 80 DPI. That shrinks heavy scanned documents a lot, but text won't be selectable afterwards, so it's best for scans. ${PRIV}`,
        faq: [["Which level should I choose?", "Low for documents you'll print, Medium for email, Strong for the smallest file when quality matters less."], ["Why did my file get bigger?", "PDFs made of plain text are already tiny, and images of their pages can be larger. When that happens SugoiTools tells you and offers your original file."], ["Will links and text still work?", "No. Each page becomes an image, so text, links and form fields are flattened."]] } },
  };
  /* The organizer lives at #/organize-pdf; the old id still resolves to it. */
  if (byId["pdf-page-organizer"]) { byId["organize-pdf"] = byId["pdf-page-organizer"]; byId["organize-pdf"].id = "organize-pdf"; }
  Object.assign(defs["merge-pdf"], { added: 8 }); Object.assign(defs["split-pdf"], { added: 9 }); Object.assign(defs["pdf-to-images"], { added: 10 });
  Object.entries(defs).forEach(([id, d]) => { if (byId[id]) Object.assign(byId[id], d, { status: "live" }); });
  T.route();
})();
