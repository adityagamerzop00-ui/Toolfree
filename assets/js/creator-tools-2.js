/* Toolsaku creator tools B: Video Description Templates, Bio Generator. Styles from creator-tools.js. */
(function () {
  "use strict";
  const T = window.Toolora;
  if (!T) return;
  const { byId, esc } = T;
  const css = document.createElement("style");
  css.textContent = `.x-cw textarea{width:100%;min-height:96px;padding:10px 12px;border-radius:12px;border:1px solid var(--line);font:inherit;box-sizing:border-box;background:#fff}
.x-cw textarea.x-big{min-height:320px}.x-cf .x-wide{grid-column:1/-1}.x-over{color:#c62828!important;font-weight:600}`;
  document.head.appendChild(css);

  const fb = (t) => { const a = document.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } finally { a.remove(); } };
  const copy = (t) => navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(t).catch(() => fb(t)) : Promise.resolve(fb(t));
  const copied = (b, t) => copy(t).then(() => { const o = b.textContent; b.textContent = "Copied!"; setTimeout(() => (b.textContent = o), 1500); });
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const lines = (s) => s.split("\n").map((x) => x.trim()).filter(Boolean);
  const f = (id, label, ph, ta, wide) => `<div${wide ? ' class="x-wide"' : ""}><label for="${id}">${label}</label>${ta
    ? `<textarea id="${id}" placeholder="${ph}"></textarea>` : `<input type="text" id="${id}" placeholder="${ph}" maxlength="120">`}</div>`;
  const sel = (id, label, opts) => `<div><label for="${id}">${label}</label><select id="${id}">${opts.map((o) => `<option>${o}</option>`).join("")}</select></div>`;

  /* 1. Video description */
  const VT = {
    Tutorial: { hook: "In this video: {title}, step by step.", learn: "What you'll learn:", end: "If this helped, subscribe for more {topic} tutorials." },
    Vlog: { hook: "{title}! Come along for a day of {topic}.", learn: "In today's vlog:", end: "Thanks for watching! Subscribe for the next one." },
    Review: { hook: "{title}: my honest take on {topic}.", learn: "What I cover:", end: "Questions about {topic}? Ask below and subscribe for more reviews." },
    Shorts: { hook: "{title} ⚡", learn: "", end: "Follow for more {topic} in under 60 seconds." },
  };
  function buildDesc(m) {
    const v = (id) => m.querySelector("#" + id).value.trim();
    const t = VT[v("vd-tp")], title = v("vd-ti") || "this video", topic = v("vd-to") || "this topic";
    const fill = (s) => s.replace(/\{title\}/g, title).replace(/\{topic\}/g, topic);
    const out = [fill(t.hook)];
    const pts = lines(v("vd-kp"));
    if (pts.length) out.push((t.learn || "Quick take:") + "\n" + pts.map((p) => "✅ " + p).join("\n"));
    const ts = lines(v("vd-ts"));
    if (ts.length && v("vd-tp") !== "Shorts") out.push("⏱️ Timestamps:\n" + ts.join("\n"));
    const ln = lines(v("vd-ln"));
    if (ln.length) out.push("🔗 Links:\n" + ln.join("\n"));
    const h = (s) => s.replace(/^@/, "");
    const soc = [v("vd-ig") && "Instagram: @" + h(v("vd-ig")), v("vd-x") && "X: @" + h(v("vd-x")), v("vd-web") && "Website: " + v("vd-web")].filter(Boolean);
    if (soc.length) out.push("📲 Follow me:\n" + soc.join("\n"));
    out.push(fill(t.end));
    const tags = v("vd-ht").split(/[\s,]+/).filter(Boolean).map((x) => "#" + x.replace(/^#+/, ""));
    if (tags.length) out.push(tags.join(" "));
    return out.join("\n\n");
  }
  function toolDesc(m) {
    m.innerHTML = `<div class="x-cw"><div class="x-cf">${sel("vd-tp", "Template", Object.keys(VT))}${f("vd-ti", "Video title", "e.g. How to edit videos on your phone")}
      ${f("vd-to", "Topic", "e.g. video editing")}${f("vd-kp", "Key points (one per line)", "Trim clips\nAdd music", true, true)}
      ${f("vd-ts", "Timestamps (one per line)", "0:00 Intro", true)}${f("vd-ln", "Links (one per line)", "https://…", true)}
      ${f("vd-ig", "Instagram", "@yourname")}${f("vd-x", "X", "@yourname")}${f("vd-web", "Website", "yourname.com")}${f("vd-ht", "Hashtags (optional)", "editing, tutorial")}</div>
      <label for="vd-out">Your description</label><textarea id="vd-out" class="x-big" readonly></textarea>
      <div class="x-row" style="align-items:center;margin-top:8px"><span class="x-note" id="vd-n" style="margin:0"></span><button type="button" class="x-btn x-primary" id="vd-cp">Copy</button></div></div>`;
    const o = m.querySelector("#vd-out"), n = m.querySelector("#vd-n");
    const upd = () => {
      o.value = buildDesc(m);
      const c = [...o.value].length;
      n.textContent = `${c.toLocaleString()} / 5,000 characters`;
      n.classList.toggle("x-over", c > 5000);
    };
    m.querySelector(".x-cf").addEventListener("input", upd);
    m.querySelector(".x-cf").addEventListener("change", upd);
    m.querySelector("#vd-cp").addEventListener("click", (e) => copied(e.target, o.value));
    upd();
  }

  /* 2. Bio generator */
  const LIMITS = { "Instagram (150)": 150, "X (160)": 160, "LinkedIn headline (220)": 220, "YouTube (1,000)": 1000 };
  const BIO = [
    "{What} | {i1} & {i2}", "{Name} · {what} · {i1} lover", "{What} sharing {i1}, {i2} and more", "Hi, I'm {name}. {What} who loves {i1}.",
    "{What} by day, {i1} fan by night", "Turning {i1} into stories · {what}", "{Name} — {what}. Talking {i1} & {i2}.", "Helping you with {i1} · {what}",
    "{What} · {i1} · {i2} · {i3}", "Making {i1} simple · {what}", "{Name} | {what} | Here for {i1}", "{What}. Curious about {i1}, obsessed with {i2}.",
    "Your daily dose of {i1} · {what}", "{What} on a mission: more {i1}", "{Name}: {what}, {i1} enthusiast", "Building with {i1} · {what} · DMs open",
    "{What} • {i1} • New posts weekly", "Exploring {i1} and {i2} · {what}", "{Name} here: {what}, {i1}, good vibes", "Less talk, more {i1} · {what}",
  ];
  const TONE = {
    Fun: { e: ["✨", "🎉", "😎", "🚀"], tail: ["Powered by coffee.", "Send memes.", ""] },
    Professional: { e: [], tail: ["Open to collabs.", "Let's connect.", ""] },
    Inspiring: { e: [], tail: ["Dream big, start small.", "Growing daily.", ""] },
    Casual: { e: ["👋", "☕", "🌿", "💛"], tail: ["Just vibing.", "Say hi!", ""] },
  };
  function genBio(m) {
    const v = (id) => m.querySelector("#" + id).value.trim();
    const name = v("bg-nm"), what = v("bg-wd"), ints = v("bg-in").split(",").map((x) => x.trim()).filter(Boolean);
    if (!what) return `<p class="x-note">Type what you do.</p>`;
    const tone = TONE[v("bg-tn")], lim = LIMITS[v("bg-pl")], I = ints.length ? ints : [what];
    const Cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
    const list = shuffle(BIO.filter((t) => name || !/\{name\}/i.test(t))).slice(0, 8).map((t) => {
      const ii = shuffle(I);
      let s = t.replace(/\{Name\}|\{name\}/g, name).replace(/\{What\}/g, Cap(what)).replace(/\{what\}/g, what)
        .replace(/\{i(\d)\}/g, (_, k) => ii[(k - 1) % ii.length]);
      if (tone.e.length) s = pick(tone.e) + " " + s + " " + pick(tone.e);
      const tl = pick(tone.tail);
      if (tl) s += (lim < 200 ? " · " : "\n") + tl;
      const c = [...s].length, over = c > lim;
      return `<li><div><p>${esc(s)}</p><span class="${over ? "x-over" : ""}">${c} / ${lim}${over ? " · too long" : ""}</span></div><button type="button" class="x-btn" data-c="${esc(s)}">Copy</button></li>`;
    });
    return `<ul class="x-fx">${list.join("")}</ul>`;
  }
  function toolBio(m) {
    m.innerHTML = `<div class="x-cw"><div class="x-cf">${f("bg-nm", "Name (optional)", "e.g. Priya")}${f("bg-wd", "What you do", "e.g. travel photographer")}
      ${f("bg-in", "Interests (comma separated)", "e.g. mountains, coffee, film")}${sel("bg-tn", "Tone", Object.keys(TONE))}${sel("bg-pl", "Platform", Object.keys(LIMITS))}</div>
      <div class="x-row"><button type="button" class="x-btn x-primary x-go">Generate</button><button type="button" class="x-btn x-more" hidden>Generate more</button></div>
      <div class="x-out" aria-live="polite"></div></div>`;
    const out = m.querySelector(".x-out"), more = m.querySelector(".x-more");
    const run = () => { out.innerHTML = genBio(m); more.hidden = !out.querySelector(".x-fx"); };
    m.querySelector(".x-go").addEventListener("click", run);
    more.addEventListener("click", run);
    m.querySelectorAll("input").forEach((i) => i.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); }));
    out.addEventListener("click", (e) => { const b = e.target.closest("button[data-c]"); if (b) copied(b, b.dataset.c); });
  }

  const LOCAL = ["Do I need an account?", "No. It's free with no sign-up, and nothing you type leaves your browser."];
  const TPL = ["Where do the ideas come from?", "Ideas come from proven templates on your device, so they're instant and private."];
  const defs = {
    "video-description-templates": { render: toolDesc, added: 24, description: "Full YouTube descriptions with timestamps, links and socials.",
      info: { steps: ["Pick a template.", "Fill in the fields you need; empty sections are skipped.", "Check the count against YouTube's 5,000 limit and tap Copy."],
        about: "Builds a description with a hook, what you'll learn, timestamps, links, follow links and hashtags.",
        faq: [TPL, ["Why no timestamps for Shorts?", "Shorts are too short for chapters."], LOCAL] } },
    "bio-generator": { render: toolBio, added: 25, description: "Eight short bios at a time for Instagram, X, LinkedIn or YouTube.",
      info: { steps: ["Type what you do and a few interests.", "Pick a tone and a platform, then tap Generate.", "Copy a bio, or Generate more; red means over the limit."],
        about: "Fills about 20 bio templates with your details, with emoji for Fun and Casual, and counts characters against the platform's limit.",
        faq: [TPL, ["What are the limits?", "Instagram 150, X 160, LinkedIn headline 220, YouTube 1,000 characters."], LOCAL] } },
  };
  Object.entries(defs).forEach(([id, d]) => { if (byId[id]) Object.assign(byId[id], d, { status: "live" }); });
  T.route();
})();
