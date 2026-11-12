/* Toolora text tools: Word & Character Counter, Fancy Text Generator. Uses window.Toolora from index.html. */
(function () {
  "use strict";
  const T = window.Toolora;
  if (!T) return;
  const { byId, esc } = T;
  const css = document.createElement("style");
  css.textContent = `.x-ws [hidden]{display:none!important}
.x-ta{width:100%;min-height:180px;padding:12px;border-radius:12px;border:1px solid var(--line);font:inherit;resize:vertical;box-sizing:border-box}
.x-cnt{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));margin:16px 0}
.x-cnt div{padding:10px 12px;border-radius:12px;background:var(--soft)}.x-cnt b{display:block;font-size:22px;color:var(--navy)}.x-cnt span{font-size:13px;color:var(--muted)}
.x-lim{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;padding:0;list-style:none}
.x-lim li{padding:6px 12px;border-radius:999px;font-size:13px;color:#fff;background:#1a7f37}.x-lim li.x-over{background:#c62828}
.x-fx{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:8px}
.x-fx li{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;border:1px solid var(--line)}
.x-fx div{flex:1;min-width:0}.x-fx span{display:block;font-size:13px;color:var(--muted)}.x-fx p{margin:0;font-size:18px;overflow-wrap:anywhere}`;
  document.head.appendChild(css);

  const len = (s) => [...s].length;
  const dur = (w, wpm) => { const s = Math.round((w / wpm) * 60); return s < 60 ? `${s} sec` : `${Math.floor(s / 60)} min ${s % 60} sec`; };

  function toolCount(m) {
    const L = [["X post", 280], ["Instagram caption", 2200], ["YouTube title", 100], ["Meta description", 160]];
    m.innerHTML = `<div class="x-ws"><label for="x-wc">Your text</label><textarea id="x-wc" class="x-ta" placeholder="Type or paste your text here…"></textarea>
      <div class="x-cnt" aria-live="polite"></div><ul class="x-lim"></ul>
      <button type="button" class="x-btn">Clear</button></div>`;
    const ta = m.querySelector("textarea"), out = m.querySelector(".x-cnt"), lim = m.querySelector(".x-lim");
    const upd = () => {
      const t = ta.value, w = (t.match(/\S+/g) || []).length, c = len(t);
      const st = t.split(/[.!?]+(?=\s|$)/).filter((s) => /\w/.test(s)).length;
      const p = t.split(/\n\s*\n/).filter((s) => s.trim()).length;
      out.innerHTML = [[w, "Words"], [c, "Characters"], [len(t.replace(/\s/g, "")), "Characters without spaces"], [st, "Sentences"], [p, "Paragraphs"], [dur(w, 200), "Reading time"], [dur(w, 130), "Speaking time"]]
        .map(([v, n]) => `<div><b>${typeof v === "number" ? v.toLocaleString() : v}</b><span>${n}</span></div>`).join("");
      lim.innerHTML = L.map(([n, x]) => `<li class="${c > x ? "x-over" : ""}">${n}: ${c.toLocaleString()} / ${x.toLocaleString()}${c > x ? " · over" : ""}</li>`).join("");
    };
    ta.addEventListener("input", upd);
    m.querySelector("button").addEventListener("click", () => { ta.value = ""; upd(); ta.focus(); });
    upd();
  }

  /* Fancy styles: code-point offsets for A, a and 0, with the letters Unicode keeps elsewhere. */
  const off = (A, a, d, holes) => (ch) => {
    if (holes && holes[ch]) return holes[ch];
    const c = ch.charCodeAt(0);
    if (c >= 65 && c <= 90 && A) return String.fromCodePoint(A + c - 65);
    if (c >= 97 && c <= 122 && a) return String.fromCodePoint(a + c - 97);
    if (c >= 48 && c <= 57 && d) return String.fromCodePoint(d + c - 48);
    return ch;
  };
  const tbl = (from, to) => { const t = {}, f = [...from], o = [...to]; f.forEach((k, i) => (t[k] = o[i])); return (ch) => t[ch] || ch; };
  const each = (fn) => (s) => [...s].map(fn).join("");
  const S = [
    ["Bold", each(off(0x1d400, 0x1d41a, 0x1d7ce))],
    ["Italic", each(off(0x1d434, 0x1d44e, 0, { h: "ℎ" }))],
    ["Bold italic", each(off(0x1d468, 0x1d482))],
    ["Script", each(off(0x1d49c, 0x1d4b6, 0, { B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ", e: "ℯ", g: "ℊ", o: "ℴ" }))],
    ["Fraktur", each(off(0x1d504, 0x1d51e, 0, { C: "ℭ", H: "ℌ", I: "ℑ", R: "ℜ", Z: "ℨ" }))],
    ["Double-struck", each(off(0x1d538, 0x1d552, 0x1d7d8, { C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" }))],
    ["Monospace", each(off(0x1d670, 0x1d68a, 0x1d7f6))],
    ["Sans", each(off(0x1d5a0, 0x1d5ba, 0x1d7e2))],
    ["Sans bold", each(off(0x1d5d4, 0x1d5ee, 0x1d7ec))],
    ["Circled", each(off(0x24b6, 0x24d0, 0, { 0: "⓪", 1: "①", 2: "②", 3: "③", 4: "④", 5: "⑤", 6: "⑥", 7: "⑦", 8: "⑧", 9: "⑨" }))],
    ["Fullwidth", each((ch) => { const c = ch.charCodeAt(0); return ch === " " ? "\u3000" : c > 32 && c < 127 ? String.fromCharCode(c + 0xfee0) : ch; })],
    ["Small caps", each(tbl("abcdefghijklmnopqrstuvwxyz", "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ"))],
    ["Upside down", (s) => [...s].reverse().map(tbl("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,!?'\"()[]{}<>&_",
      "ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz∀ꓭƆꓷƎℲ⅁HIſꓘ⅂WNOԀQꓤS⊥∩ΛMX⅄Z0ƖᄅƐㄣϛ9ㄥ86˙'¡¿,„)(][}{><⅋‾")).join("")],
    ["Strikethrough", each((ch) => (ch === "\n" ? ch : ch + "\u0336"))],
    ["Underline", each((ch) => (ch === "\n" ? ch : ch + "\u0332"))],
  ];

  function copy(t) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(t).catch(() => fallback(t));
    return Promise.resolve(fallback(t));
  }
  function fallback(t) {
    const a = document.createElement("textarea");
    a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;opacity:0;top:0";
    document.body.appendChild(a); a.select();
    try { document.execCommand("copy"); } finally { a.remove(); }
  }

  function toolFancy(m) {
    m.innerHTML = `<div class="x-ws"><label for="x-fi">Your text</label><textarea id="x-fi" class="x-ta" style="min-height:96px" placeholder="Type something…">Toolora</textarea><ul class="x-fx"></ul></div>`;
    const ta = m.querySelector("textarea"), out = m.querySelector(".x-fx");
    const upd = () => {
      const t = ta.value || "Toolora";
      out.innerHTML = S.map(([n, f], i) => `<li><div><span>${n}</span><p>${esc(f(t))}</p></div><button type="button" class="x-btn" data-i="${i}">Copy</button></li>`).join("");
    };
    out.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-i]");
      if (!b) return;
      copy(S[+b.dataset.i][1](ta.value || "Toolora")).then(() => { b.textContent = "Copied!"; setTimeout(() => (b.textContent = "Copy"), 1500); });
    });
    ta.addEventListener("input", upd);
    upd();
  }

  const PRIV = "Your text stays in your browser and is never uploaded.";
  const defs = {
    "word-character-counter": { render: toolCount, added: 19, description: "Count words, characters, sentences and reading time as you type.",
      info: { steps: ["Type or paste your text in the box.", "Watch the counts update as you type.", "Check the green or red badges for X, Instagram, YouTube and meta description limits.", "Tap Clear to start again."],
        about: `Word & Character Counter shows words, characters with and without spaces, sentences, paragraphs, reading time at 200 words a minute and speaking time at 130. ${PRIV}`,
        faq: [["How are words counted?", "Any run of characters between spaces or line breaks counts as one word."], ["Do emoji count as one character?", "Yes. Each emoji or symbol counts once, though some platforms count certain emoji as two."], ["How is reading time worked out?", "Words divided by 200 per minute for reading and 130 per minute for speaking aloud."]] } },
    "fancy-text-generator": { render: toolFancy, added: 20, description: "Turn plain text into bold, script, bubble and other Unicode styles to copy.",
      info: { steps: ["Type your text in the box.", "Browse 15 styles as they update.", "Tap Copy next to the style you like.", "Paste it into your bio, post or message."],
        about: `Fancy Text Generator swaps your letters for look-alike Unicode characters, so the style survives copy and paste where fonts can't be changed. ${PRIV}`,
        faq: [["Will it work on Instagram, X and TikTok?", "Yes, in most places that accept text. A few apps or older devices may show boxes for some styles."], ["Why are some characters unchanged?", "Unicode has no styled version of every symbol or accented letter, so those stay as they are."], ["Is fancy text bad for accessibility?", "Screen readers may read it oddly, so keep it for short names and headings."]] } },
  };
  if (T.cats && T.cats.text) T.cats.text.desc = "Count words and characters and make fancy Unicode text — free, in your browser.";
  Object.entries(defs).forEach(([id, d]) => { if (byId[id]) Object.assign(byId[id], d, { status: "live" }); });
  T.route();
})();
