/* Toolsaku AI Caption Generator panel. Shared by the creator tools and Long Video to Shorts.
   Sends only the text the user types to our API (/api/ai-captions), which asks Gemini for titles, captions,
   descriptions and hashtags in Hinglish or English. No files are ever sent. Falls back to template ideas
   (with a warning) when the AI is unavailable. */
(function () {
  "use strict";
  const tool = document.body.dataset.tool || "";
  const mountAfter = document.getElementById("x-tool");
  if (!mountAfter) return;
  const ROOT = document.body.dataset.root || "";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* Per-tool defaults: which outputs are ticked and which platform is picked. */
  const PRESETS = {
    "instagram-caption-generator": { kinds: ["captions", "hashtags"], platform: "instagram" },
    "youtube-title-generator": { kinds: ["titles"], platform: "youtube" },
    "video-description-templates": { kinds: ["descriptions", "hashtags"], platform: "youtube" },
    "hashtag-suggestions": { kinds: ["hashtags"], platform: "instagram" },
    "long-to-shorts": { kinds: ["titles", "captions", "hashtags"], platform: "shorts" },
  };
  const P = PRESETS[tool] || { kinds: ["titles", "captions", "descriptions", "hashtags"], platform: "youtube" };
  const KINDS = [["titles", "Titles"], ["captions", "Captions"], ["descriptions", "Descriptions"], ["hashtags", "Hashtags"]];
  const PLATFORMS = [["youtube", "YouTube video"], ["shorts", "Shorts / Reels"], ["instagram", "Instagram post"]];
  const TONES = ["Fun", "Professional", "Inspiring", "Casual"];

  const css = document.createElement("style");
  css.textContent = `.x-aic{margin-top:18px}.x-aic [hidden]{display:none!important}
.x-aic h2{display:flex;align-items:center;gap:8px;margin:0 0 4px;font-size:20px;color:var(--navy)}
.x-aic h2 small{font-size:12px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--soft)}
.x-aic .x-aicp{margin:0 0 14px;font-size:14px;color:var(--muted)}
.x-aic form{display:grid;gap:12px}.x-aic label{display:block;font-size:14px}
.x-aic input[type=text],.x-aic textarea,.x-aic select{width:100%;min-height:48px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);font:inherit;box-sizing:border-box;background:var(--card,#fff);color:inherit;margin-top:4px}
.x-aic textarea{min-height:72px;resize:vertical}
.x-aic .x-aicg{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}
.x-aic fieldset{border:0;margin:0;padding:0}.x-aic legend{font-size:14px;margin-bottom:4px;padding:0}
.x-aic .x-aick{display:flex;flex-wrap:wrap;gap:6px 16px}.x-aic .x-aick label{display:flex;align-items:center;gap:8px;min-height:44px}
.x-aic .x-aicprog{display:flex;align-items:center;gap:10px;font-size:14px;margin:12px 0 0}
.x-aic .x-aicprog i{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--blue,#2563ff);animation:xaicspin 1s linear infinite;flex:none}
@keyframes xaicspin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.x-aic .x-aicprog i{animation:none}}
.x-aic .x-aicw{color:#9a5b00;font-weight:600}
.x-aic h3{margin:18px 0 8px;font-size:16px;color:var(--navy);display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.x-aic ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.x-aic li{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;border:1px solid var(--line)}
.x-aic li p{flex:1;min-width:0;margin:0;white-space:pre-wrap;overflow-wrap:anywhere}
.x-aic li span{display:block;font-size:12px;color:var(--muted)}
.x-aic .x-aictags{padding:12px;border-radius:12px;background:var(--soft);overflow-wrap:anywhere;margin:0}
.x-aic .x-btn{min-height:40px}`;
  document.head.appendChild(css);

  const box = document.createElement("section");
  box.className = "x-ws x-aic";
  box.setAttribute("aria-labelledby", "x-aic-h");
  box.innerHTML = `<h2 id="x-aic-h">✨ AI Caption Generator <small>Beta</small></h2>
    <p class="x-aicp">Get titles, captions, descriptions and hashtags written by AI, in Hinglish or English. Only the text you type here is sent to Toolsaku's server for the AI. No files are uploaded and nothing is saved.</p>
    <form novalidate>
      <label>What is your video or post about?<input type="text" name="topic" maxlength="200" autocomplete="off" placeholder="e.g. GTA RP police chase gone wrong"></label>
      <label>Extra details (optional)<textarea name="details" maxlength="500" placeholder="e.g. funny moments, streamer name, game, city"></textarea></label>
      <div class="x-aicg">
        <label>Language<select name="lang"><option value="hinglish">Hinglish</option><option value="english">English</option></select></label>
        <label>Tone<select name="tone">${TONES.map((t) => `<option>${t}</option>`).join("")}</select></label>
        <label>For<select name="platform">${PLATFORMS.map(([v, n]) => `<option value="${v}"${v === P.platform ? " selected" : ""}>${n}</option>`).join("")}</select></label>
      </div>
      <fieldset><legend>Write</legend><div class="x-aick">${KINDS.map(([v, n]) => `<label><input type="checkbox" name="kinds" value="${v}"${P.kinds.includes(v) ? " checked" : ""}> ${n}</label>`).join("")}</div></fieldset>
      <div class="x-row x-actions"><button type="submit" class="x-btn x-primary">✨ Generate with AI</button></div>
    </form>
    <p class="x-aicprog" aria-live="polite" hidden><i aria-hidden="true"></i><span>AI is writing…</span></p>
    <p class="x-err" role="alert" hidden></p>
    <div class="x-aicout" aria-live="polite"></div>`;
  mountAfter.insertAdjacentElement("afterend", box);

  const f = box.querySelector("form"), btn = f.querySelector("button[type=submit]"), prog = box.querySelector(".x-aicprog"),
    err = box.querySelector(".x-err"), out = box.querySelector(".x-aicout");

  const fb = (t) => { const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;opacity:0;top:0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } finally { a.remove(); } };
  const copy = (t) => navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(t).catch(() => fb(t)) : Promise.resolve(fb(t));
  out.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-c]");
    if (!b) return;
    copy(b.dataset.c).then(() => { const o = b.textContent; b.textContent = "Copied!"; setTimeout(() => (b.textContent = o), 1500); });
  });

  const item = (t, sub) => `<li><p>${esc(t)}${sub ? `<span>${sub}</span>` : ""}</p><button type="button" class="x-btn" data-c="${esc(t)}">Copy</button></li>`;
  function show(j) {
    let h = "";
    if (j.warning) h += `<p class="x-hint x-aicw">${esc(j.warning)}</p>`;
    if (j.titles && j.titles.length) h += `<h3>Titles</h3><ul>${j.titles.map((t) => item(t, `${[...t].length} characters${[...t].length > 60 ? " · may be cut off in search" : ""}`)).join("")}</ul>`;
    if (j.captions && j.captions.length) h += `<h3>Captions</h3><ul>${j.captions.map((t) => item(t)).join("")}</ul>`;
    if (j.descriptions && j.descriptions.length) h += `<h3>Descriptions</h3><ul>${j.descriptions.map((t) => item(t)).join("")}</ul>`;
    if (j.hashtags && j.hashtags.length) {
      const all = j.hashtags.join(" ");
      h += `<h3>Hashtags · ${j.hashtags.length} <button type="button" class="x-btn" data-c="${esc(all)}">Copy all</button></h3><p class="x-aictags">${esc(all)}</p>`;
    }
    out.innerHTML = h || `<p class="x-hint">No ideas came back. Try adding a few more words about your content.</p>`;
  }

  let busy = false;
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    const topic = f.topic.value.trim();
    const kinds = [...f.querySelectorAll("input[name=kinds]:checked")].map((x) => x.value);
    err.hidden = true;
    if (topic.length < 3) { err.textContent = "Type what your video or post is about (at least 3 characters)."; err.hidden = false; f.topic.focus(); return; }
    if (!kinds.length) { err.textContent = "Tick at least one thing to write."; err.hidden = false; return; }
    busy = true; btn.disabled = true; prog.hidden = false; out.innerHTML = "";
    try {
      const r = await fetch(ROOT + "api/ai-captions", { method: "POST", headers: { "Content-Type": "application/json", "x-toolsaku": "1" },
        body: JSON.stringify({ topic, details: f.details.value.trim(), lang: f.lang.value, tone: f.tone.value, platform: f.platform.value, kinds }) });
      let j = null;
      try { j = await r.json(); } catch (x) { /* not JSON */ }
      if (!r.ok) throw new Error((j && typeof j.detail === "string" && j.detail) || "Something went wrong (" + r.status + "). Try again in a minute.");
      show(j || {});
    } catch (x) {
      err.textContent = x && x.message && !/Failed to fetch|NetworkError|Load failed/i.test(x.message) ? x.message : "Couldn't reach Toolsaku's server. Check your internet connection and try again.";
      err.hidden = false;
    } finally {
      busy = false; btn.disabled = false; prog.hidden = true;
    }
  });
})();
