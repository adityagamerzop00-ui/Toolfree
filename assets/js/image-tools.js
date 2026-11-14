/* Toolsaku image tools: shared image workspace plus Resizer, Compressor, Converter, Rotate & Flip, Cropper, Photo Editor and Images to PDF. Needs core.js. */
      /* ===== Shared image workspace ===== */
      const TYPES = ["image/jpeg", "image/png", "image/webp"], MAXB = 20 * 1024 * 1024, EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
      function canvasOf(w, h, white) {
        if (w * h > 50e6) throw new Error("That's too many pixels for your browser to handle. Try smaller dimensions.");
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d");
        if (!x) throw new Error("Your browser couldn't create an image canvas.");
        if (white) { x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); }
        x.imageSmoothingQuality = "high";
        return [c, x];
      }
      function checkFile(file) {
        const byName = /\.(jpe?g|png|webp)$/i.test(file.name);
        if (!TYPES.includes(file.type) && !(byName && !file.type)) return `“${file.name}” isn't a supported image. Please choose a JPG, PNG or WEBP file.`;
        if (file.size > MAXB) return `“${file.name}” is ${fmtSize(file.size)}. The limit is 20 MB — please choose a smaller image.`;
        if (!file.size) return `“${file.name}” is empty. Please choose another image.`;
        return "";
      }
      function workspace(mount, cfg) {
        mount.innerHTML = `<div class="x-ws">
          <label class="x-drop" tabindex="0"><input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" class="x-sr" tabindex="-1" aria-label="${T_("ws.choose")}">
            <span class="x-ic">${ic("upload", 28)}</span><strong>${T_("ws.drop")} <u>${T_("ws.tap")}</u></strong>
            <span class="x-note">${FMT.replace(/, up to 20 MB$/, "")} · <b>${T_("ws.max")}</b></span><span class="x-note">${T_("ws.local")}</span></label>
          <p class="x-err" role="alert" hidden></p>
          <div class="x-edit" hidden>
            <p class="x-src">${T_("ws.orig")} <b class="x-fname"></b><span class="x-orig"></span></p>
            ${cfg.top || ""}<div class="x-grid"><div class="x-ctrls">${cfg.controls}</div>
              <div><div class="x-prev"><img alt="${T_("ws.preview")}"><div class="x-spin" hidden role="status" aria-label="${T_("ws.busy")}"></div></div>
                <p class="x-info" aria-live="polite"></p><p class="x-extra"></p>
                <div class="x-actions"><a class="x-btn x-primary x-dl" download>${ic("download", 20)} ${T_("ws.dl")}</a><button type="button" class="x-btn x-reset">${T_("ws.reset")}</button></div>
                <p class="x-hint">${T_("ws.hint")}</p></div></div></div></div>`;
        const q = (s) => mount.querySelector(s);
        const input = q("input[type=file]"), drop = q(".x-drop"), err = q(".x-err"), edit = q(".x-edit"), ctrls = q(".x-ctrls"),
          img = q(".x-prev img"), spin = q(".x-spin"), info = q(".x-info"), extra = q(".x-extra"), dl = q(".x-dl");
        const ws = { S: null, q: (s) => ctrls.querySelector(s), val: (n) => ctrls.querySelector(`[name="${n}"]`), run };
        const fail = (m) => { err.textContent = m; err.hidden = false; };
        function load(file) {
          err.hidden = true;
          if (!file) return;
          const bad = checkFile(file);
          if (bad) return fail(bad);
          const r = new FileReader();
          r.onerror = () => fail(T_("ws.read"));
          r.onload = () => {
            const im = new Image();
            im.onerror = () => fail("This image couldn't be opened. It may be damaged or in a format your browser can't read.");
            im.onload = () => {
              const type = TYPES.includes(file.type) ? file.type : /png$/i.test(file.name) ? "image/png" : /webp$/i.test(file.name) ? "image/webp" : "image/jpeg";
              ws.S = { img: im, w: im.naturalWidth, h: im.naturalHeight, type, ext: EXT[type], size: file.size, url: r.result, name: file.name.replace(/\.[^.]+$/, "") || "image" };
              ctrls.innerHTML = cfg.controls;
              q(".x-fname").textContent = file.name;
              q(".x-orig").textContent = `${ws.S.w} × ${ws.S.h} px · ${fmtSize(file.size)}`;
              drop.hidden = true; edit.hidden = false;
              if (cfg.init) cfg.init(ws);
              if (!cfg.manual) run(true);
            };
            im.src = r.result;
          };
          r.readAsDataURL(file);
        }
        let timer;
        function run(now) { clearTimeout(timer); timer = setTimeout(go, now === true ? 0 : 150); }
        function go() {
          if (!ws.S) return;
          spin.hidden = false; dl.classList.add("is-busy"); err.hidden = true;
          setTimeout(() => {
            try {
              const r = cfg.process(ws.S, ws);
              const url = r.canvas.toDataURL(r.mime, r.q);
              if (!url || url.length < 30) throw new Error("The image is too large for your browser to process. Try smaller dimensions.");
              const got = url.slice(5, url.indexOf(";")), want = EXT[r.mime].toUpperCase();
              let note = "";
              if (got !== r.mime) {
                if (r.strict) throw new Error(`Your browser can't create ${want} files. Please choose another format.`);
                note = `Your browser can't create ${want} files, so this was saved as ${(EXT[got] || "png").toUpperCase()}.`;
              }
              const ext = EXT[got] || "png", size = dataSize(url);
              img.src = url; dl.href = url; dl.download = `${ws.S.name}-${cfg.suffix}.${ext}`;
              info.textContent = `Result: ${r.canvas.width} × ${r.canvas.height} px · ${fmtSize(size)} · ${ext.toUpperCase()}`;
              const x = cfg.after ? cfg.after(ws.S, size) : null;
              extra.className = "x-extra" + (x && x.warn ? " is-warn" : "");
              extra.innerHTML = [note, x && x.html].filter(Boolean).join(" ");
              extra.querySelectorAll("a[data-orig]").forEach((a) => { a.href = ws.S.url; a.download = `${ws.S.name}.${ws.S.ext}`; });
              ws.result = { url, size, ext };
            } catch (e) {
              fail((e && e.message) || T_("ws.err"));
              img.removeAttribute("src"); dl.removeAttribute("href"); info.textContent = ""; extra.innerHTML = ""; ws.result = null;
            } finally {
              spin.hidden = true; dl.classList.remove("is-busy");
            }
          }, 30);
        }
        input.addEventListener("change", () => load(input.files[0]));
        drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
        ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("is-over"); }));
        ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("is-over"); }));
        drop.addEventListener("drop", (e) => load(e.dataTransfer.files[0]));
        dl.addEventListener("click", (e) => { if (!dl.getAttribute("href")) e.preventDefault(); });
        ctrls.addEventListener("input", (e) => {
          const o = ctrls.querySelector(`[data-out="${e.target.name}"]`);
          if (o) o.textContent = e.target.value;
          if (cfg.onInput) cfg.onInput(e.target, ws);
          run();
        });
        ctrls.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (b && cfg.onAct && cfg.onAct(b.dataset.act, b, ws) !== false) run(); });
        q(".x-reset").addEventListener("click", () => {
          clearTimeout(timer); ws.S = ws.result = null; input.value = ""; ctrls.innerHTML = cfg.controls;
          img.removeAttribute("src"); dl.removeAttribute("href"); info.textContent = ""; extra.innerHTML = "";
          err.hidden = true; edit.hidden = true; drop.hidden = false; drop.focus();
        });
        ws.load = load;
        mount.ws = ws;
        return ws;
      }
      const lbl = (text, name, val) => `<span>${text}: <b data-out="${name}">${val}</b></span>`;
      const clearOn = (ws) => { const o = ws.q(".x-chip.is-on"); if (o) o.classList.remove("is-on"); };

      /* ===== Tools ===== */
      function toolResizer(m) {
        const P = [["Instagram Post", 1080, 1080], ["Instagram Story", 1080, 1920], ["YouTube Thumbnail", 1280, 720], ["Facebook Cover", 820, 312], ["Passport", 413, 531], ["HD", 1920, 1080]];
        return workspace(m, {
          suffix: "resized",
          controls: `<div class="x-row"><label>Width (px)<input type="number" name="w" min="1" max="10000" inputmode="numeric"></label><label>Height (px)<input type="number" name="h" min="1" max="10000" inputmode="numeric"></label></div>
            <label class="x-check"><input type="checkbox" name="lock" checked> Keep aspect ratio</label>
            <p class="x-lbl">Quick scale</p><div class="x-chips">${[25, 50, 75].map((p) => `<button type="button" class="x-chip" data-act="pct" data-v="${p}">${p}%</button>`).join("")}</div>
            <p class="x-lbl">Presets</p><div class="x-chips">${P.map(([n, w, h]) => `<button type="button" class="x-chip" data-act="preset" data-w="${w}" data-h="${h}">${n}<small>${w} × ${h}</small></button>`).join("")}</div>
            <label>When the shape changes<select name="fit"><option value="crop">Crop to fill (no stretching)</option><option value="stretch">Stretch to fit</option></select></label>`,
          init(ws) { ws.val("w").value = ws.S.w; ws.val("h").value = ws.S.h; },
          onInput(el, ws) {
            const S = ws.S, w = ws.val("w"), h = ws.val("h"), lock = ws.val("lock").checked;
            if (lock && (el.name === "w" || el.name === "lock") && +w.value > 0) h.value = Math.max(1, Math.round((w.value * S.h) / S.w));
            else if (lock && el.name === "h" && +h.value > 0) w.value = Math.max(1, Math.round((h.value * S.w) / S.h));
            if (el.name !== "fit") clearOn(ws);
          },
          onAct(a, b, ws) {
            const S = ws.S; clearOn(ws); b.classList.add("is-on");
            if (a === "pct") { ws.val("lock").checked = true; ws.val("w").value = Math.max(1, Math.round((S.w * b.dataset.v) / 100)); ws.val("h").value = Math.max(1, Math.round((S.h * b.dataset.v) / 100)); }
            else { ws.val("lock").checked = false; ws.val("w").value = b.dataset.w; ws.val("h").value = b.dataset.h; }
          },
          process(S, ws) {
            const w = Math.round(+ws.val("w").value), h = Math.round(+ws.val("h").value);
            if (!(w >= 1 && h >= 1)) throw new Error("Please enter a width and height of at least 1 pixel.");
            if (w > 10000 || h > 10000) throw new Error("Width and height can be at most 10,000 pixels.");
            const png = S.type === "image/png", [c, x] = canvasOf(w, h, !png);
            let sx = 0, sy = 0, sw = S.w, sh = S.h;
            if (ws.val("fit").value === "crop") { const r = w / h; if (sw / sh > r) { sw = sh * r; sx = (S.w - sw) / 2; } else { sh = sw / r; sy = (S.h - sh) / 2; } }
            x.drawImage(S.img, sx, sy, sw, sh, 0, 0, w, h);
            return { canvas: c, mime: png ? "image/png" : "image/jpeg", q: 0.92 };
          },
        });
      }
      function toolCompressor(m) {
        return workspace(m, {
          suffix: "compressed",
          controls: `<label>${lbl("Quality", "q", 70)}<input type="range" name="q" min="10" max="100" value="70"></label>
            <label>Max width (optional, px)<input type="number" name="mw" min="1" max="10000" inputmode="numeric" placeholder="Keep original width"></label>
            <label>Output format<select name="f"><option value="image/jpeg">JPEG</option><option value="image/webp">WEBP (smaller)</option></select></label>`,
          process(S, ws) {
            const mw = Math.round(+ws.val("mw").value), f = ws.val("f").value;
            let w = S.w, h = S.h;
            if (mw > 0 && mw < w) { h = Math.max(1, Math.round((h * mw) / w)); w = mw; }
            const [c, x] = canvasOf(w, h, f === "image/jpeg");
            x.drawImage(S.img, 0, 0, w, h);
            return { canvas: c, mime: f, q: ws.val("q").value / 100 };
          },
          after(S, size) {
            const pct = Math.round((Math.abs(S.size - size) / S.size) * 100);
            return size <= S.size
              ? { html: `Before <b>${fmtSize(S.size)}</b> → After <b>${fmtSize(size)}</b> · <span class="x-good">${pct}% saved</span>` }
              : { warn: 1, html: `The compressed file (${fmtSize(size)}) is ${pct}% larger than your original (${fmtSize(S.size)}). Try a lower quality or a max width, or <a data-orig>download the original</a>.` };
          },
        });
      }
      function toolConverter(m) {
        const showQ = (ws) => { ws.q(".x-qw").hidden = ws.val("f").value === "image/png"; };
        return workspace(m, {
          suffix: "converted",
          controls: `<label>Convert to<select name="f"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WEBP</option></select></label>
            <label class="x-qw">${lbl("Quality", "q", 90)}<input type="range" name="q" min="10" max="100" value="90"></label>
            <p class="x-hint">JPG has no transparency, so transparent areas become white.</p>`,
          init(ws) { ws.val("f").value = ws.S.type === "image/jpeg" ? "image/png" : "image/jpeg"; showQ(ws); },
          onInput(el, ws) { showQ(ws); },
          process(S, ws) {
            const f = ws.val("f").value, [c, x] = canvasOf(S.w, S.h, f === "image/jpeg");
            x.drawImage(S.img, 0, 0);
            return { canvas: c, mime: f, q: ws.val("q").value / 100, strict: true };
          },
        });
      }
      function toolRotate(m) {
        const state = (ws) => { const S = ws.S; ws.q(".x-state").textContent = `Rotation ${S.rot}°${S.fh ? " · flipped horizontally" : ""}${S.fv ? " · flipped vertically" : ""}`; };
        return workspace(m, {
          suffix: "rotated",
          controls: `<div class="x-chips">
              <button type="button" class="x-chip" data-act="rl">${ic("rotate", 18)} Rotate left 90°</button>
              <button type="button" class="x-chip" data-act="rr"><span style="display:inline-block;transform:scaleX(-1)">${ic("rotate", 18)}</span> Rotate right 90°</button>
              <button type="button" class="x-chip" data-act="fh">${ic("flip", 18)} Flip horizontal</button>
              <button type="button" class="x-chip" data-act="fv"><span style="display:inline-block;transform:rotate(90deg)">${ic("flip", 18)}</span> Flip vertical</button></div>
            <p class="x-state" aria-live="polite"></p>`,
          init(ws) { Object.assign(ws.S, { rot: 0, fh: false, fv: false }); state(ws); },
          onAct(a, b, ws) {
            const S = ws.S;
            if (a === "rl") S.rot = (S.rot + 270) % 360; else if (a === "rr") S.rot = (S.rot + 90) % 360;
            else if (a === "fh") S.fh = !S.fh; else if (a === "fv") S.fv = !S.fv;
            state(ws);
          },
          process(S) {
            const side = S.rot % 180 !== 0, w = side ? S.h : S.w, h = side ? S.w : S.h;
            const [c, x] = canvasOf(w, h, S.type === "image/jpeg");
            x.translate(w / 2, h / 2); x.scale(S.fh ? -1 : 1, S.fv ? -1 : 1); x.rotate((S.rot * Math.PI) / 180);
            x.drawImage(S.img, -S.w / 2, -S.h / 2);
            return { canvas: c, mime: S.type, q: 0.92 };
          },
        });
      }

      /* ===== Pure helpers (tested) ===== */
      const cropMove = (R, x, y, W, H) => ({ ...R, x: Math.min(Math.max(0, x), W - R.w), y: Math.min(Math.max(0, y), H - R.h) });
      function cropResize(d, x, y, ar, W, H) {
        const mw = d.sx > 0 ? W - d.ax : d.ax, mh = d.sy > 0 ? H - d.ay : d.ay, min = Math.min(16, mw, mh);
        let w = Math.min(Math.max(min, (x - d.ax) * d.sx), mw), h = Math.min(Math.max(min, (y - d.ay) * d.sy), mh);
        if (ar) { if (w / h > ar) w = h * ar; else h = w / ar; }
        return { x: d.sx > 0 ? d.ax : d.ax - w, y: d.sy > 0 ? d.ay : d.ay - h, w, h };
      }
      function cropFit(ar, W, H) {
        let w = W, h = H;
        if (ar) { h = W / ar; if (h > H) { h = H; w = H * ar; } }
        w *= 0.8; h *= 0.8;
        return { x: (W - w) / 2, y: (H - h) / 2, w, h };
      }
      function fxMatrix(ops) {
        let M = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0];
        for (const [n, v] of ops) {
          let A, o = 0, s = n === "saturate" ? v : 1 - v;
          if (n === "brightness" || n === "contrast") { A = [v, 0, 0, 0, v, 0, 0, 0, v]; if (n === "contrast") o = (0.5 - 0.5 * v) * 255; }
          else if (n === "sepia") A = [.393 + .607 * s, .769 - .769 * s, .189 - .189 * s, .349 - .349 * s, .686 + .314 * s, .168 - .168 * s, .272 - .272 * s, .534 - .534 * s, .131 + .869 * s];
          else A = [.213 + .787 * s, .715 - .715 * s, .072 - .072 * s, .213 - .213 * s, .715 + .285 * s, .072 - .072 * s, .213 - .213 * s, .715 - .715 * s, .072 + .928 * s];
          const N = [];
          for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { let t = j === 3 ? o : 0; for (let k = 0; k < 3; k++) t += A[i * 3 + k] * M[k * 4 + j]; N.push(t); }
          M = N;
        }
        return M;
      }
      function applyMatrix(p, M) {
        for (let i = 0; i < p.length; i += 4) {
          const r = p[i], g = p[i + 1], b = p[i + 2];
          p[i] = M[0] * r + M[1] * g + M[2] * b + M[3]; p[i + 1] = M[4] * r + M[5] * g + M[6] * b + M[7]; p[i + 2] = M[8] * r + M[9] * g + M[10] * b + M[11];
        }
      }
      function frameBox(w, h, bw, fr) {
        const m = Math.min(w, h);
        let l = bw, t = bw, b = bw;
        if (fr === "polaroid") { l = t = Math.max(bw, Math.round(m * 0.05)); b = l + Math.round(m * 0.2); }
        return { l, t, W: w + 2 * l, H: h + t + b, rad: fr === "round" ? Math.round(m * 0.06) : 0 };
      }
      const PAGE = { a4: [595.28, 841.89], letter: [612, 792] };
      function pdfLayout(w, h, ps, or, mg) {
        let pw, ph;
        if (ps === "fit") { const k = Math.min(0.75, 14000 / Math.max(w, h)); pw = w * k + 2 * mg; ph = h * k + 2 * mg; }
        else { [pw, ph] = PAGE[ps]; if (or === "landscape" || (or === "auto" && w > h)) [pw, ph] = [ph, pw]; }
        const s = Math.min((pw - 2 * mg) / w, (ph - 2 * mg) / h), dw = w * s, dh = h * s;
        return { pw, ph, dw, dh, x: (pw - dw) / 2, y: (ph - dh) / 2 };
      }
      function buildPdf(pages) {
        const enc = (s) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255), f = (v) => +v.toFixed(2), parts = [], offs = [];
        let len = 0;
        const put = (p) => { const b = typeof p === "string" ? enc(p) : p; parts.push(b); len += b.length; };
        const obj = (n, body, stream) => { offs[n] = len; put(`${n} 0 obj\n${body}\n`); if (stream) { put("stream\n"); put(stream); put("\nendstream\n"); } put("endobj\n"); };
        put("%PDF-1.4\n"); put(new Uint8Array([37, 226, 227, 207, 211, 10]));
        obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
        obj(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] /Count ${pages.length} >>`);
        pages.forEach((p, i) => {
          const o = 3 + i * 3, cs = `q ${f(p.dw)} 0 0 ${f(p.dh)} ${f(p.x)} ${f(p.y)} cm /Im0 Do Q`;
          obj(o, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(p.pw)} ${f(p.ph)}] /Resources << /XObject << /Im0 ${o + 1} 0 R >> /ProcSet [/PDF /ImageC] >> /Contents ${o + 2} 0 R >>`);
          obj(o + 1, `<< /Type /XObject /Subtype /Image /Width ${p.iw} /Height ${p.ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>`, p.jpg);
          obj(o + 2, `<< /Length ${cs.length} >>`, enc(cs));
        });
        const xref = len, size = offs.length;
        put(`xref\n0 ${size}\n0000000000 65535 f \n${offs.slice(1).map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
        const out = new Uint8Array(len);
        let at = 0;
        parts.forEach((b) => { out.set(b, at); at += b.length; });
        return out;
      }
      const fromB64 = (u) => { const s = atob(u.slice(u.indexOf(",") + 1)), b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
      /* ===== end pure ===== */

      function toolCropper(m) {
        const AR = [["Free", 0], ["Square", 1, "1:1"], ["Portrait", 4 / 5, "4:5"], ["Portrait", 3 / 4, "3:4"], ["Landscape", 16 / 9, "16:9"], ["Landscape", 4 / 3, "4:3"]];
        let R = null, ar = 0, drag = null;
        const ws = workspace(m, {
          suffix: "cropped", manual: true,
          top: `<div class="x-crop"><canvas tabindex="0" role="img" aria-label="Crop area. Drag to move, drag a corner to resize, or use the arrow keys."></canvas></div>`,
          controls: `<p class="x-lbl">Aspect ratio</p><div class="x-chips">${AR.map(([n, v, l], i) => `<button type="button" class="x-chip${i ? "" : " is-on"}" data-act="ar" data-v="${v}">${n}${l ? `<small>${l}</small>` : ""}</button>`).join("")}</div>
            <p class="x-state x-csize" aria-live="polite"></p>
            <button type="button" class="x-btn x-primary" data-act="crop">${ic("crop", 20)} Crop</button>
            <p class="x-hint">Drag inside the box to move it, or drag a corner to resize.</p>`,
          init(ws) { ar = 0; R = cropFit(0, ws.S.w, ws.S.h); draw(); m.querySelector(".x-info").textContent = "Tap Crop to see the result here."; },
          onAct(a, b, ws) {
            if (a === "crop") return;
            clearOn(ws); b.classList.add("is-on"); ar = +b.dataset.v;
            if (ar) R = cropFit(ar, ws.S.w, ws.S.h);
            draw(); return false;
          },
          process(S) {
            const x0 = Math.round(R.x), y0 = Math.round(R.y), w = Math.max(1, Math.min(S.w - x0, Math.round(R.w))), h = Math.max(1, Math.min(S.h - y0, Math.round(R.h)));
            const [c, x] = canvasOf(w, h, S.type === "image/jpeg");
            x.drawImage(S.img, x0, y0, w, h, 0, 0, w, h);
            return { canvas: c, mime: S.type, q: 0.92 };
          },
        });
        const cv = m.querySelector(".x-crop canvas"), cx = cv.getContext("2d");
        function draw() {
          const S = ws.S;
          if (!S || !R || !cv.isConnected) return;
          const box = cv.parentNode, k = Math.min((box.clientWidth - 24 || 600) / S.w, Math.max(240, innerHeight * 0.6) / S.h, 1), d = devicePixelRatio || 1;
          const w = Math.max(1, Math.round(S.w * k)), h = Math.max(1, Math.round(S.h * k));
          if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); cv.style.width = w + "px"; cv.style.height = h + "px"; }
          cx.setTransform(d * k, 0, 0, d * k, 0, 0);
          cx.clearRect(0, 0, S.w, S.h); cx.drawImage(S.img, 0, 0);
          cx.fillStyle = "rgba(11,27,63,.55)"; cx.beginPath(); cx.rect(0, 0, S.w, S.h); cx.rect(R.x, R.y, R.w, R.h); cx.fill("evenodd");
          cx.lineWidth = 2 / k; cx.strokeStyle = "#fff"; cx.strokeRect(R.x, R.y, R.w, R.h);
          const hs = 14 / k;
          cx.fillStyle = "#fff"; cx.strokeStyle = "#2563FF";
          [[R.x, R.y], [R.x + R.w, R.y], [R.x, R.y + R.h], [R.x + R.w, R.y + R.h]].forEach(([a, b]) => { cx.fillRect(a - hs / 2, b - hs / 2, hs, hs); cx.strokeRect(a - hs / 2, b - hs / 2, hs, hs); });
          m.querySelector(".x-csize").textContent = `Crop size: ${Math.round(R.w)} × ${Math.round(R.h)} px`;
        }
        const pt = (e) => { const b = cv.getBoundingClientRect(); return [((e.clientX - b.left) / b.width) * ws.S.w, ((e.clientY - b.top) / b.height) * ws.S.h]; };
        cv.addEventListener("pointerdown", (e) => {
          if (!ws.S || !R) return;
          const [x, y] = pt(e), tol = (24 * ws.S.w) / cv.getBoundingClientRect().width;
          const cs = [[R.x, R.y], [R.x + R.w, R.y], [R.x, R.y + R.h], [R.x + R.w, R.y + R.h]];
          const i = cs.findIndex(([a, b]) => Math.abs(a - x) < tol && Math.abs(b - y) < tol);
          if (i >= 0) drag = { ax: cs[3 - i][0], ay: cs[3 - i][1], sx: i % 2 ? 1 : -1, sy: i > 1 ? 1 : -1 };
          else if (x > R.x && x < R.x + R.w && y > R.y && y < R.y + R.h) drag = { mx: x - R.x, my: y - R.y };
          else return;
          cv.setPointerCapture(e.pointerId); e.preventDefault();
        });
        cv.addEventListener("pointermove", (e) => {
          if (!drag) return;
          const [x, y] = pt(e), S = ws.S;
          R = "mx" in drag ? cropMove(R, x - drag.mx, y - drag.my, S.w, S.h) : cropResize(drag, x, y, ar, S.w, S.h);
          draw();
        });
        ["pointerup", "pointercancel"].forEach((ev) => cv.addEventListener(ev, () => (drag = null)));
        cv.addEventListener("keydown", (e) => {
          const v = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
          if (!v || !R) return;
          e.preventDefault();
          const st = Math.max(1, Math.round(ws.S.w / (e.shiftKey ? 20 : 100)));
          R = cropMove(R, R.x + v[0] * st, R.y + v[1] * st, ws.S.w, ws.S.h); draw();
        });
        addEventListener("resize", draw);
        return ws;
      }

      function toolEditor(m) {
        const FX = { none: ["None", []], grayscale: ["Grayscale", [["grayscale", 1]]], sepia: ["Sepia", [["sepia", 1]]],
          vintage: ["Vintage", [["sepia", 0.45], ["contrast", 0.9], ["brightness", 1.05], ["saturate", 0.85]], "rgba(255,190,110,.18)"],
          warm: ["Warm", [["sepia", 0.15], ["saturate", 1.15]], "rgba(255,140,40,.2)"], cool: ["Cool", [["saturate", 0.9]], "rgba(40,120,255,.2)"],
          vivid: ["Vivid", [["saturate", 1.6], ["contrast", 1.15]]] };
        const POS = [["br", "Bottom right"], ["bl", "Bottom left"], ["tr", "Top right"], ["tl", "Top left"], ["c", "Center"]];
        let FOK;
        const filterOK = () => {
          if (FOK === undefined) try { const [, x] = canvasOf(1, 1); x.filter = "grayscale(1)"; x.fillStyle = "#f00"; x.fillRect(0, 0, 1, 1); const p = x.getImageData(0, 0, 1, 1).data; FOK = p[0] === p[1]; } catch (e) { FOK = false; }
          return FOK;
        };
        const range = (t, n, min, max, v) => `<label>${lbl(t, n, v)}<input type="range" name="${n}" min="${min}" max="${max}" value="${v}"></label>`;
        return workspace(m, {
          suffix: "edited",
          controls: `${range("Brightness (%)", "b", 0, 200, 100)}${range("Contrast (%)", "c", 0, 200, 100)}${range("Saturation (%)", "s", 0, 200, 100)}
            <p class="x-lbl">Filter</p><div class="x-chips">${Object.entries(FX).map(([k, v]) => `<button type="button" class="x-chip${k === "none" ? " is-on" : ""}" data-act="fx" data-v="${k}">${v[0]}</button>`).join("")}</div>
            <p class="x-lbl">Border</p>${range("Width (px)", "bw", 0, 60, 0)}
            <div class="x-row"><label>Colour<input type="color" name="bc" value="#ffffff"></label><label>Frame<select name="fr"><option value="solid">Solid</option><option value="round">Rounded</option><option value="polaroid">Polaroid</option></select></label></div>
            <p class="x-lbl">Watermark</p><label>Text<input type="text" name="wt" maxlength="60" placeholder="e.g. © Your name"></label>
            <div class="x-row">${range("Size (%)", "wz", 2, 20, 6)}${range("Opacity (%)", "wo", 10, 100, 60)}</div>
            <div class="x-row"><label>Colour<input type="color" name="wc" value="#ffffff"></label><label>Position<select name="wp">${POS.map(([v, t]) => `<option value="${v}">${t}</option>`).join("")}</select></label></div>
            <label>Save as<select name="f"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>`,
          init(ws) { ws.S.fx = "none"; ws.val("f").value = ws.S.type === "image/png" ? "image/png" : "image/jpeg"; },
          onAct(a, b, ws) { clearOn(ws); b.classList.add("is-on"); ws.S.fx = b.dataset.v; },
          process(S, ws) {
            const v = (n) => ws.val(n).value, png = v("f") === "image/png", P = FX[S.fx];
            const ops = [["brightness", v("b") / 100], ["contrast", v("c") / 100], ["saturate", v("s") / 100], ...P[1]];
            const [f, fx] = canvasOf(S.w, S.h);
            if (filterOK()) { fx.filter = ops.map(([n, x]) => `${n}(${x})`).join(" "); fx.drawImage(S.img, 0, 0); fx.filter = "none"; }
            else {
              fx.drawImage(S.img, 0, 0);
              if (ops.some(([n, x]) => (n === "grayscale" || n === "sepia" ? x : x !== 1))) { const d = fx.getImageData(0, 0, S.w, S.h); applyMatrix(d.data, fxMatrix(ops)); fx.putImageData(d, 0, 0); }
            }
            if (P[2]) {
              fx.globalCompositeOperation = "overlay"; fx.fillStyle = P[2]; fx.fillRect(0, 0, S.w, S.h);
              fx.globalCompositeOperation = "destination-in"; fx.drawImage(S.img, 0, 0); fx.globalCompositeOperation = "source-over";
            }
            const bw = +v("bw"), fr = v("fr"), B = frameBox(S.w, S.h, bw, fr), [c, x] = canvasOf(B.W, B.H, !png);
            const rr = (a, b, w, h, r) => { r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
            x.fillStyle = v("bc");
            if (B.rad) {
              if (bw) { rr(0, 0, B.W, B.H, B.rad + B.l); x.fill(); }
              x.save(); rr(B.l, B.t, S.w, S.h, B.rad); x.clip(); x.drawImage(f, B.l, B.t); x.restore();
            } else {
              if (bw || fr === "polaroid") x.fillRect(0, 0, B.W, B.H);
              x.drawImage(f, B.l, B.t);
            }
            f.width = f.height = 0;
            const wt = v("wt").trim();
            if (wt) {
              const px = Math.max(8, Math.round((Math.min(S.w, S.h) * v("wz")) / 100)), pad = Math.round(px * 0.6), p = v("wp"), C = p === "c", Rt = p[1] === "r", Bt = p[0] === "b";
              x.font = `600 ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
              x.globalAlpha = v("wo") / 100; x.fillStyle = v("wc"); x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = px * 0.15;
              x.textAlign = C ? "center" : Rt ? "right" : "left"; x.textBaseline = C ? "middle" : Bt ? "bottom" : "top";
              x.fillText(wt, C ? B.l + S.w / 2 : Rt ? B.l + S.w - pad : B.l + pad, C ? B.t + S.h / 2 : Bt ? B.t + S.h - pad : B.t + pad, S.w - 2 * pad);
              x.globalAlpha = 1; x.shadowBlur = 0;
            }
            return { canvas: c, mime: v("f"), q: 0.92, strict: true };
          },
        });
      }

      function toolPdf(m) {
        m.innerHTML = `<div class="x-ws">
          <label class="x-drop" tabindex="0"><input type="file" multiple accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" class="x-sr" tabindex="-1" aria-label="Choose images">
            <span class="x-ic">${ic("upload", 28)}</span><strong>Drop images here or <u>tap to choose</u></strong>
            <span class="x-note">JPG, PNG or WEBP · <b>up to 20 images, max 20 MB each</b></span><span class="x-note">Processed on your device — nothing is uploaded.</span></label>
          <p class="x-err" role="alert" hidden></p>
          <div class="x-edit" hidden>
            <p class="x-src"><b class="x-fname"></b><span class="x-orig"></span></p>
            <div class="x-grid"><div class="x-ctrls">
              <label>Page size<select name="ps"><option value="a4">A4</option><option value="letter">Letter</option><option value="fit">Fit to image</option></select></label>
              <label>Orientation<select name="or"><option value="portrait">Portrait</option><option value="landscape">Landscape</option><option value="auto" selected>Auto</option></select></label>
              <label>Margin<select name="mg"><option value="0">None</option><option value="18" selected>Small</option><option value="36">Medium</option></select></label>
              <button type="button" class="x-btn x-add">+ Add more images</button>
              <button type="button" class="x-btn x-primary x-make">${ic("file", 20)} Create PDF</button></div>
              <div><div class="x-prev x-plist"><ol class="x-thumbs" aria-label="Pages in order"></ol><div class="x-spin" hidden role="status" aria-label="Processing"></div></div>
                <p class="x-state" aria-live="polite"></p><p class="x-info" aria-live="polite"></p>
                <div class="x-actions"><a class="x-btn x-primary x-dl is-busy" download="toolsaku.pdf">${ic("download", 20)} Download PDF</a><a class="x-btn x-dl2" download="toolsaku.pdf" hidden>Backup download</a><button type="button" class="x-btn x-reset">Reset</button></div>
                <p class="x-hint">If the download doesn't start, tap Backup download, or long-press it and choose to save the file.</p></div></div></div></div>`;
        const q = (s) => m.querySelector(s), input = q("input[type=file]"), drop = q(".x-drop"), err = q(".x-err"), edit = q(".x-edit"), list = q(".x-thumbs"),
          spin = q(".x-spin"), prog = q(".x-state"), info = q(".x-info"), dl = q(".x-dl"), dl2 = q(".x-dl2"), make = q(".x-make"), addB = q(".x-add");
        let items = [], url = "";
        const fail = (msg) => { err.textContent = msg; err.hidden = false; };
        const busy = (on) => { spin.hidden = !on; make.classList.toggle("is-busy", on); addB.classList.toggle("is-busy", on); };
        function clearOut() {
          if (url) URL.revokeObjectURL(url);
          url = ""; dl.removeAttribute("href"); dl2.removeAttribute("href"); dl.classList.add("is-busy"); dl2.hidden = true; info.textContent = "";
        }
        function render() {
          clearOut();
          if (!items.length) { edit.hidden = true; drop.hidden = false; return; }
          drop.hidden = true; edit.hidden = false; addB.disabled = items.length >= 20;
          q(".x-fname").textContent = `${items.length} image${items.length > 1 ? "s" : ""}`;
          q(".x-orig").textContent = `${fmtSize(items.reduce((a, b) => a + b.size, 0))} in total · up to 20`;
          list.innerHTML = items.map((it, i) => `<li><img src="${it.url}" alt=""><span class="x-tn"><b>${esc(it.name)}</b>Page ${i + 1} · ${it.w} × ${it.h} px · ${fmtSize(it.size)}</span>
            <span class="x-tb"><button type="button" class="x-ib" data-act="up" data-i="${i}" aria-label="Move ${esc(it.name)} up"${i ? "" : " disabled"}>↑</button><button type="button" class="x-ib" data-act="down" data-i="${i}" aria-label="Move ${esc(it.name)} down"${i < items.length - 1 ? "" : " disabled"}>↓</button><button type="button" class="x-ib" data-act="rm" data-i="${i}" aria-label="Remove ${esc(it.name)}">×</button></span></li>`).join("");
        }
        const readImg = (file) => new Promise((ok, no) => {
          const r = new FileReader();
          r.onerror = () => no();
          r.onload = () => { const im = new Image(); im.onerror = () => no(); im.onload = () => ok({ img: im, url: r.result, name: file.name, size: file.size, w: im.naturalWidth, h: im.naturalHeight }); im.src = r.result; };
          r.readAsDataURL(file);
        });
        async function add(files) {
          err.hidden = true;
          let fl = [...files];
          const bad = [], room = 20 - items.length;
          if (fl.length > room) { bad.push(`A PDF can hold up to 20 images, so ${fl.length - room} ${fl.length - room > 1 ? "were" : "was"} skipped.`); fl = fl.slice(0, Math.max(0, room)); }
          busy(true);
          try {
            for (const f of fl) {
              const msg = checkFile(f);
              if (msg) { bad.push(msg); continue; }
              try { items.push(await readImg(f)); } catch (e) { bad.push(`“${f.name}” couldn't be opened. It may be damaged.`); }
            }
          } finally { busy(false); render(); input.value = ""; if (bad.length) fail(bad.join(" ")); }
        }
        async function build() {
          if (!items.length) return fail("Add at least one image first.");
          err.hidden = true; clearOut(); busy(true);
          try {
            const sel = (n) => q(`[name="${n}"]`).value, pages = [];
            for (let i = 0; i < items.length; i++) {
              prog.textContent = `Processing image ${i + 1} of ${items.length}`;
              await new Promise((r) => setTimeout(r, 30));
              const it = items[i], k = Math.min(1, 4000 / Math.max(it.w, it.h)), w = Math.max(1, Math.round(it.w * k)), h = Math.max(1, Math.round(it.h * k));
              const [c, x] = canvasOf(w, h, true);
              x.drawImage(it.img, 0, 0, w, h);
              const u = c.toDataURL("image/jpeg", 0.85);
              c.width = c.height = 0;
              if (!u.startsWith("data:image/jpeg")) throw new Error(`Your browser couldn't turn “${it.name}” into a JPEG for the PDF.`);
              pages.push({ jpg: fromB64(u), iw: w, ih: h, ...pdfLayout(it.w, it.h, sel("ps"), sel("or"), +sel("mg")) });
            }
            prog.textContent = "Writing PDF…";
            await new Promise((r) => setTimeout(r, 30));
            const bytes = buildPdf(pages);
            url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
            dl.href = url; dl2.href = "data:application/pdf;base64," + toB64(bytes); dl2.hidden = false; dl.classList.remove("is-busy");
            info.textContent = `PDF ready: ${pages.length} page${pages.length > 1 ? "s" : ""} · ${fmtSize(bytes.length)}`;
          } catch (e) {
            clearOut(); fail((e && e.message) || "Something went wrong while making the PDF. Try fewer or smaller images.");
          } finally { busy(false); prog.textContent = ""; }
        }
        input.addEventListener("change", () => add(input.files));
        drop.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
        [["dragenter", 1], ["dragover", 1], ["dragleave", 0], ["drop", 0]].forEach(([ev, on]) => m.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.toggle("is-over", !!on); }));
        m.addEventListener("drop", (e) => add(e.dataTransfer.files));
        addB.addEventListener("click", () => input.click());
        make.addEventListener("click", build);
        m.querySelectorAll("select").forEach((s) => s.addEventListener("change", clearOut));
        [dl, dl2].forEach((a) => a.addEventListener("click", (e) => { if (!a.getAttribute("href")) e.preventDefault(); }));
        list.addEventListener("click", (e) => {
          const b = e.target.closest("[data-act]");
          if (!b) return;
          const i = +b.dataset.i, j = b.dataset.act === "up" ? i - 1 : i + 1;
          if (b.dataset.act === "rm") items.splice(i, 1); else [items[i], items[j]] = [items[j], items[i]];
          render();
          const nb = list.querySelector(`[data-act="${b.dataset.act}"][data-i="${b.dataset.act === "rm" ? Math.min(i, items.length - 1) : j}"]`);
          if (nb && !nb.disabled) nb.focus();
        });
        q(".x-reset").addEventListener("click", () => { items = []; input.value = ""; err.hidden = true; render(); drop.focus(); });
      }

      route();
