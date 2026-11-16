/* Toolsaku AI Stream Moment Finder. Sends only the YouTube link to our API (/api/stream-moments); the server reads the
   stream's public chat replay, captions and "Most replayed" data and Gemini ranks the moments. No video is downloaded. Uses window.Toolora. */
(function () {
  "use strict";
  const T = window.Toolora;
  if (!T) return;
  const { byId, ic, esc } = T;
  const ROOT = document.body.dataset.root || "";
  const css = document.createElement("style");
  css.textContent = `.x-smf [hidden]{display:none!important}
.x-smf form{display:grid;gap:14px}.x-smf .x-smrow{display:flex;flex-wrap:wrap;gap:12px;align-items:end}.x-smf .x-smrow label{flex:1 1 140px}
.x-smf .x-smprog{display:flex;align-items:center;gap:10px;margin-top:14px;font-size:14px}.x-smf .x-smprog i{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--blue,#2563ff);animation:xsmspin 1s linear infinite;flex:none}
@keyframes xsmspin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.x-smf .x-smprog i{animation:none}}
.x-smhead{display:flex;gap:14px;align-items:center;margin:22px 0 6px}.x-smhead img{width:120px;height:68px;object-fit:cover;border-radius:10px;flex:none}
.x-smhead b{display:block;color:var(--navy)}.x-smhead span,.x-smsig{font-size:13px;color:var(--muted)}
.x-smsig{margin:6px 0 14px}.x-smsig em{font-style:normal;display:inline-block;padding:2px 8px;border-radius:999px;margin:2px 4px 2px 0;background:var(--soft)}
.x-smsig em.is-off{opacity:.5;text-decoration:line-through}
.x-smout{scroll-margin-top:96px}.x-smlist{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:12px}
.x-smc{border:1px solid var(--line);border-radius:16px;padding:14px;background:var(--card,#fff)}
.x-smc header{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}.x-smr{font-weight:800;color:var(--navy);min-width:34px}
.x-smt{font-variant-numeric:tabular-nums;font-weight:650}.x-sms{margin-left:auto;font-size:13px;font-weight:700;padding:2px 10px;border-radius:999px;background:var(--soft)}
.x-smc h3{margin:8px 0 4px;font-size:17px;color:var(--navy)}.x-smc p{margin:4px 0;font-size:14px}.x-smc .x-smw{color:var(--muted);font-size:13px}
.x-smc .x-actions{margin-top:10px}.x-smc .x-btn{min-height:40px;padding:0 14px;font-size:14px}
.x-smtips{margin-top:22px;padding:14px 16px;border-radius:16px;background:var(--soft)}.x-smtips h3{margin:0 0 8px;font-size:16px;color:var(--navy)}.x-smtips ol{margin:0;padding-left:20px;font-size:14px}.x-smtips li{margin:4px 0}`;
  document.head.appendChild(css);

  const fb = (t) => { const a = document.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } finally { a.remove(); } };
  const copy = (t) => navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(t).catch(() => fb(t)) : Promise.resolve(fb(t));
  const flash = (b, t) => copy(t).then(() => { const o = b.innerHTML; b.textContent = "Copied!"; setTimeout(() => (b.innerHTML = o), 1500); });
  const csvCell = (s) => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
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
  const STEPS = ["Reading the stream page…", "Reading captions and the Most replayed graph…", "Sampling the live chat replay…", "AI is ranking the best moments…", "Almost there, checking clips don't overlap…"];
  const TIPS = `<section class="x-smtips" aria-label="Turn a moment into a Short">
    <h3>Turn a moment into a Short</h3>
    <ol>
      <li>Tap <b>Open at this time</b> to jump straight to the moment on YouTube.</li>
      <li>Save just that part: use YouTube's <b>Clip</b> button under the stream (up to 60 seconds), or screen-record that part on your phone. You never need to download the whole stream.</li>
      <li>Open Toolsaku's <a href="${ROOT}long-video-to-shorts/">Long Video to Shorts clipper</a> to make it 9:16 with a facecam + gameplay split and auto captions, then paste the hook as your caption.</li>
      <li>Credit the streamer in the caption and get their permission before posting their content.</li>
    </ol></section>`;

  function render(m) {
    m.innerHTML = `<div class="x-ws x-smf"><form class="x-ctrls" novalidate>
        <label>YouTube live stream or VOD link<input type="text" name="u" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://www.youtube.com/live/… or youtube.com/watch?v=…"></label>
        <div class="x-smrow"><label>How many moments<select name="n"><option value="25">25</option><option value="50" selected>50</option><option value="75">75</option><option value="100">100</option></select></label>
        <button type="submit" class="x-btn x-primary">${ic("search", 20)} Find best moments</button></div></form>
      <p class="x-smprog" aria-live="polite" hidden><i aria-hidden="true"></i><span></span></p>
      <p class="x-err" role="alert" hidden></p><p class="x-hint x-smwarn" hidden></p>
      <div class="x-smout"></div>${TIPS}</div>`;
    const f = m.querySelector("form"), btn = f.querySelector("button"), prog = m.querySelector(".x-smprog"), ptxt = prog.querySelector("span");
    const err = m.querySelector(".x-err"), warn = m.querySelector(".x-smwarn"), out = m.querySelector(".x-smout");
    let busy = false, timer = null;
    const stop = () => { clearInterval(timer); prog.hidden = true; busy = false; btn.classList.remove("is-busy"); btn.disabled = false; };
    const fail = (t) => { err.textContent = t; err.hidden = false; };
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (busy) return;
      err.hidden = true; warn.hidden = true; out.innerHTML = "";
      const raw = f.elements.u.value, id = ytId(raw), count = +f.elements.n.value || 50;
      if (!id) return fail("That doesn't look like a YouTube link. Paste a link like youtube.com/watch?v=…, youtube.com/live/… or youtu.be/….");
      busy = true; btn.classList.add("is-busy"); btn.disabled = true; prog.hidden = false;
      let i = 0, t0 = Date.now(); ptxt.textContent = STEPS[0];
      timer = setInterval(() => { const s = Math.round((Date.now() - t0) / 1000); i = Math.min(STEPS.length - 1, Math.floor(s / 9)); ptxt.textContent = `${STEPS[i]} (${s}s · long streams take up to 2 minutes)`; }, 1000);
      try {
        const r = await fetch(ROOT + "api/stream-moments", { method: "POST", headers: { "Content-Type": "application/json", "x-toolsaku": "1" }, body: JSON.stringify({ url: raw.trim(), count }) });
        let j = null; try { j = await r.json(); } catch (x) {}
        if (!r.ok || !j) {
          const d = j && typeof j.detail === "string" ? j.detail : "";
          if (r.status === 404 && !d) throw new Error("The moment finder isn't available on this copy of the site. Use it on toolsak.online.");
          if (r.status === 502 || r.status === 504) throw new Error(d || "The server took too long. Try again in a minute.");
          throw new Error(d || `Something went wrong (error ${r.status}). Try again in a minute.`);
        }
        show(j, count);
      } catch (x) {
        fail(x && x.message && !/Failed to fetch|NetworkError|Load failed/i.test(x.message) ? x.message : "Couldn't reach Toolsaku's server. Check your internet connection and try again.");
      } finally { stop(); }
    });

    function show(j, asked) {
      const v = j.video || {}, s = j.signals_used || {}, d = j.signal_detail || {}, ms = j.moments || [];
      if (j.warning) { warn.textContent = j.warning; warn.hidden = false; }
      const sig = [["chat", `Chat replay${s.chat && d.chat_messages_sampled ? ` (${d.chat_messages_sampled.toLocaleString()} messages sampled)` : ""}`], ["captions", `Captions${d.caption_language ? " (" + d.caption_language + ")" : ""}`], ["heatmap", "Most replayed"]]
        .map(([k, l]) => `<em class="${s[k] ? "" : "is-off"}">${esc(l)}</em>`).join("");
      const csv = () => ["rank,start,end,start_sec,end_sec,score,title,hook,why,link"].concat(ms.map((m) => [m.rank, m.start, m.end, m.start_sec, m.end_sec, m.score, m.title, m.hook, m.why, m.url].map(csvCell).join(","))).join("\n");
      const stamps = () => ms.map((m) => `${m.start} ${m.title}`).join("\n");
      out.innerHTML = `<div class="x-smhead"><img src="${esc(v.thumbnail || "")}" alt="" loading="lazy" width="120" height="68"><div><b>${esc(v.title || "")}</b><span>${esc(v.channel || "")}</span></div></div>
        <p class="x-smsig">Signals used: ${sig}</p>
        <p class="x-state">${ms.length} moment${ms.length === 1 ? "" : "s"} found${ms.length < asked ? ` (asked for ${asked}; this stream didn't have enough distinct signal for more)` : ""}, best first.</p>
        <div class="x-actions"><button type="button" class="x-btn" data-x="csv">Copy all as CSV</button><button type="button" class="x-btn" data-x="ts">Copy all as timestamps</button><button type="button" class="x-btn" data-x="dl">${ic("download", 18)} Download CSV</button></div>
        <ol class="x-smlist">${ms.map((m, k) => `<li class="x-smc"><header><span class="x-smr">#${m.rank}</span><span class="x-smt">${esc(m.start)} – ${esc(m.end)}</span><span class="x-sms" title="AI score out of 100">${m.score}/100</span></header>
          <h3>${esc(m.title)}</h3>${m.hook ? `<p><b>Hook:</b> ${esc(m.hook)}</p>` : ""}${m.why ? `<p class="x-smw">Why: ${esc(m.why)}</p>` : ""}
          <div class="x-actions"><a class="x-btn x-primary" href="${esc(m.url)}" target="_blank" rel="noopener">${ic("play", 18)} Open at this time</a>${m.hook ? `<button type="button" class="x-btn" data-hook="${k}">Copy hook</button>` : ""}</div></li>`).join("")}</ol>`;
      out.querySelector('[data-x="csv"]').addEventListener("click", (e) => flash(e.currentTarget, csv()));
      out.querySelector('[data-x="ts"]').addEventListener("click", (e) => flash(e.currentTarget, stamps()));
      out.querySelector('[data-x="dl"]').addEventListener("click", () => {
        const u = URL.createObjectURL(new Blob(["\ufeff" + csv()], { type: "text/csv;charset=utf-8" })), a = document.createElement("a");
        a.href = u; a.download = `stream-moments-${v.id || "youtube"}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 2000);
      });
      out.querySelectorAll("[data-hook]").forEach((b) => b.addEventListener("click", () => flash(b, ms[+b.dataset.hook].hook)));
      out.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    }
  }

  if (byId["stream-moment-finder"]) Object.assign(byId["stream-moment-finder"], { render, status: "live" });
  T.route();
})();
