/* SugoiTools utilities: Pomodoro timer, countdown timer, stopwatch. Uses window.Toolora from core.js and ToolFX from ui-fx.js. */
(function () {
  "use strict";
  /* Pure helpers, kept apart from the UI */
  const p2 = (n) => String(n).padStart(2, "0");
  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return (h ? h + ":" + p2(m) : p2(m)) + ":" + p2(s % 60); };
  const fmtSW = (ms) => { const c = Math.floor(Math.max(0, ms) / 10), h = Math.floor(c / 360000), m = Math.floor((c % 360000) / 6000); return (h ? h + ":" + p2(m) : p2(m)) + ":" + p2(Math.floor((c % 6000) / 100)) + "." + p2(c % 100); };
  const nextPhase = (phase, done, every = 4) => {
    if (phase !== "focus") return { phase: "focus", done };
    const d = done + 1;
    return { phase: d % every === 0 ? "long" : "short", done: d };
  };
  window.TooloraUtil = { fmtClock, fmtSW, nextPhase };

  const T = window.Toolora;
  if (!T) return;
  const { byId } = T;
  const tone = (...a) => window.ToolFX && window.ToolFX.tone(...a);
  const chime = (up) => { const f = up ? [660, 880, 1320] : [1320, 990, 660]; f.forEach((x, i) => tone(x, x, i * 0.18, 0.5, 0.14)); };
  const beep = () => [0, 0.2, 0.4].forEach((t) => tone(1000, 1000, t, 0.12, 0.16, "square"));
  const css = document.createElement("style");
  css.textContent = `.x-ut{display:grid;gap:18px;justify-items:center;text-align:center}
.x-ut .x-seg,.x-ut .x-cg{justify-content:center;width:100%;max-width:560px;margin:0}
.x-ring{position:relative;width:min(300px,78vw);aspect-ratio:1;display:grid;place-items:center}
.x-ring svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.x-ring circle{fill:none;stroke-width:12}.x-ring .x-trk{stroke:var(--line)}.x-ring .x-arc{stroke:var(--blue);stroke-linecap:round;transition:stroke-dashoffset .3s linear}
.x-ring.is-brk .x-arc{stroke:#12B76A}
.x-big{font-size:clamp(48px,14vw,84px);font-weight:750;color:var(--navy);font-variant-numeric:tabular-nums;letter-spacing:-.03em;line-height:1}
.x-ring .x-big{font-size:clamp(44px,13vw,64px)}
.x-ut .x-sub{margin:6px 0 0;font-weight:600}
.x-btns{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}.x-btns .x-btn{min-width:110px}.x-btns .x-btn:disabled{opacity:.45;cursor:default}
.x-alarm{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:center;padding:14px 18px;border-radius:14px;background:#FDECEC;color:#B42318;font-weight:700;width:100%;max-width:560px;box-sizing:border-box}
.x-ut .x-tw{width:100%;max-width:560px}.x-ut .x-tw td{font-variant-numeric:tabular-nums}
.x-ut .x-fast td{color:#067647;font-weight:650}.x-ut .x-slow td{color:#B42318;font-weight:650}`;
  document.head.appendChild(css);

  /* Run fn every ms while the tool is on screen; stop and clean up when the user leaves the route. */
  function life(m, fn, ms, onLeave) {
    let id = 0;
    const T0 = document.title;
    const L = {
      title: (s) => { L.mine = s ? s + " · SugoiTools" : T0; document.title = L.mine; },
      start: () => { if (!id) { id = setInterval(tick, ms); fn(); } },
      stop: () => { clearInterval(id); id = 0; },
      get on() { return !!id; },
    };
    const leave = () => {
      L.stop(); removeEventListener("hashchange", chk); document.removeEventListener("visibilitychange", vis);
      if (document.title === L.mine) document.title = T0;
      if (onLeave) onLeave();
    };
    const tick = () => (m.isConnected ? fn() : leave());
    const chk = () => { if (!m.isConnected) leave(); };
    const vis = () => { if (id && !document.hidden) tick(); };
    addEventListener("hashchange", chk);
    document.addEventListener("visibilitychange", vis);
    return L;
  }
  const btn = (k, t, pri) => `<button type="button" class="x-btn${pri ? " x-primary" : ""}" data-k="${k}">${t}</button>`;
  const num = (el, lo, hi) => Math.min(hi, Math.max(lo, Math.floor(+el.value) || 0));

  function toolPomo(m) {
    const NM = { focus: "Focus", short: "Short break", long: "Long break" }, C = 2 * Math.PI * 108;
    m.innerHTML = `<div class="x-calc x-ut">
      <div class="x-seg" role="group" aria-label="Phase">${Object.keys(NM).map((k) => `<button type="button" data-ph="${k}" aria-pressed="${k === "focus"}">${NM[k]}</button>`).join("")}</div>
      <div class="x-ring"><svg viewBox="0 0 240 240" aria-hidden="true"><circle class="x-trk" cx="120" cy="120" r="108"/><circle class="x-arc" cx="120" cy="120" r="108" stroke-dasharray="${C}" stroke-dashoffset="0"/></svg>
        <div><div class="x-big" role="timer" aria-live="off">25:00</div><p class="x-sub" aria-live="polite"></p></div></div>
      <div class="x-btns">${btn("go", "Start", 1)}${btn("reset", "Reset")}${btn("skip", "Skip")}</div>
      <div class="x-cg"><label class="x-cf"><span>Focus (min)</span><input id="up-focus" type="number" min="1" max="180" value="25" inputmode="numeric"></label>
        <label class="x-cf"><span>Short break (min)</span><input id="up-short" type="number" min="1" max="60" value="5" inputmode="numeric"></label>
        <label class="x-cf"><span>Long break (min)</span><input id="up-long" type="number" min="1" max="120" value="15" inputmode="numeric"></label></div>
      <label class="x-check" style="display:flex;gap:10px;align-items:center;min-height:44px;font-weight:600;color:var(--navy)"><input type="checkbox" id="up-auto" checked style="width:20px;height:20px;accent-color:var(--blue)"> Start the next phase automatically</label></div>`;
    const q = (s) => m.querySelector(s), big = q(".x-big"), sub = q(".x-sub"), arc = q(".x-arc"), ring = q(".x-ring"), go = q('[data-k="go"]');
    const full = (p) => num(q("#up-" + p), 1, 180) * 60000;
    let phase = "focus", done = 0, left = full("focus"), endAt = 0;
    const paint = () => {
      const run = L.on, ms = run ? endAt - Date.now() : left, t = fmtClock(ms);
      big.textContent = t;
      arc.style.strokeDashoffset = String(C * (1 - Math.min(1, Math.max(0, ms / full(phase)))));
      ring.classList.toggle("is-brk", phase !== "focus");
      sub.textContent = phase === "focus" ? `Session ${(done % 4) + 1} of 4 · ${done} done` : `${NM[phase]} · ${done} focus session${done === 1 ? "" : "s"} done`;
      m.querySelectorAll("[data-ph]").forEach((b) => b.setAttribute("aria-pressed", b.dataset.ph === phase));
      go.textContent = run ? "Pause" : left < full(phase) ? "Resume" : "Start";
      if (run) L.title(`${t} ${NM[phase]}`);
    };
    const advance = (at) => { const n = nextPhase(phase, done); phase = n.phase; done = n.done; left = full(phase); endAt = at + left; };
    const tick = () => {
      const now = Date.now();
      if (endAt - now > 0) return paint();
      chime(phase !== "focus");
      do advance(endAt); while (endAt <= now && q("#up-auto").checked); // catch up if the tab slept through phases
      if (!q("#up-auto").checked) { L.stop(); L.title(); }
      paint();
    };
    const L = life(m, tick, 250);
    const pause = () => { if (L.on) { left = Math.max(0, endAt - Date.now()); L.stop(); L.title(); } };
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-k],[data-ph]");
      if (!b) return;
      const k = b.dataset.k;
      if (b.dataset.ph) { pause(); phase = b.dataset.ph; left = full(phase); }
      else if (k === "go") { if (L.on) pause(); else { endAt = Date.now() + left; L.start(); } }
      else if (k === "reset") { pause(); phase = "focus"; done = 0; left = full(phase); }
      else if (k === "skip") { const r = L.on; L.stop(); advance(Date.now()); if (r) L.start(); else L.title(); }
      paint();
    });
    m.addEventListener("change", (e) => { if (e.target.type === "number" && !L.on) { e.target.value = num(e.target, 1, 180); left = full(phase); paint(); } });
    paint();
  }

  function toolTimer(m) {
    m.innerHTML = `<div class="x-calc x-ut">
      <div class="x-big" role="timer" aria-live="off">05:00</div>
      <div class="x-alarm" role="alert" hidden><span>⏰ Time's up!</span>${btn("stop", "Stop", 1)}</div>
      <div class="x-btns">${btn("go", "Start", 1)}${btn("reset", "Reset")}</div>
      <div class="x-chips" role="group" aria-label="Presets" style="justify-content:center">${[1, 5, 10, 15, 30].map((n) => `<button type="button" class="x-chip" data-min="${n}">${n} min</button>`).join("")}</div>
      <div class="x-cg">${[["h", "Hours", 0, 99], ["m", "Minutes", 5, 59], ["s", "Seconds", 0, 59]].map(([k, l, v, x]) => `<label class="x-cf"><span>${l}</span><input id="ut-${k}" type="number" min="0" max="${x}" value="${v}" inputmode="numeric"></label>`).join("")}</div></div>`;
    const q = (s) => m.querySelector(s), big = q(".x-big"), go = q('[data-k="go"]'), al = q(".x-alarm"), ins = ["h", "m", "s"].map((k) => q("#ut-" + k));
    const set = () => (num(ins[0], 0, 99) * 3600 + num(ins[1], 0, 59) * 60 + num(ins[2], 0, 59)) * 1000;
    let left = set(), endAt = 0, ring = 0;
    const silence = () => { clearInterval(ring); ring = 0; al.hidden = true; };
    const paint = () => {
      const ms = L.on ? endAt - Date.now() : left, t = fmtClock(ms);
      big.textContent = t;
      go.textContent = L.on ? "Pause" : left && left < set() ? "Resume" : "Start";
      go.disabled = !L.on && !left;
      ins.forEach((i) => (i.disabled = L.on || (left > 0 && left < set())));
      if (L.on) L.title(t);
    };
    const tick = () => {
      if (endAt - Date.now() > 0) return paint();
      L.stop(); left = 0; paint(); L.title("⏰ Time's up");
      al.hidden = false; beep(); ring = setInterval(() => (m.isConnected ? beep() : silence()), 1000);
    };
    const L = life(m, tick, 200, silence);
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-k],[data-min]");
      if (!b) return;
      const k = b.dataset.k;
      if (b.dataset.min) { silence(); L.stop(); ins[0].value = 0; ins[1].value = b.dataset.min; ins[2].value = 0; left = set(); L.title(); }
      else if (k === "go") { silence(); if (L.on) { left = Math.max(0, endAt - Date.now()); L.stop(); L.title(); } else if (left) { endAt = Date.now() + left; L.start(); } }
      else if (k === "reset" || k === "stop") { silence(); L.stop(); left = set(); L.title(); }
      paint();
    });
    m.addEventListener("input", (e) => { if (e.target.type === "number" && !L.on) { silence(); left = set(); paint(); } });
    m.addEventListener("change", (e) => { if (e.target.type === "number") { e.target.value = num(e.target, 0, +e.target.max); left = set(); paint(); } });
    paint();
  }

  function toolStopwatch(m) {
    m.innerHTML = `<div class="x-calc x-ut">
      <div class="x-big" role="timer" aria-live="off">00:00.00</div>
      <div class="x-btns">${btn("go", "Start", 1)}${btn("lap", "Lap")}${btn("reset", "Reset")}</div>
      <div class="x-tw" hidden><table><thead><tr><th scope="col">Lap</th><th scope="col">Lap time</th><th scope="col">Split</th></tr></thead><tbody></tbody></table></div></div>`;
    const q = (s) => m.querySelector(s), big = q(".x-big"), go = q('[data-k="go"]'), body = q("tbody");
    let acc = 0, t0 = 0, laps = [];
    const now = () => acc + (L.on ? performance.now() - t0 : 0);
    const paint = () => {
      big.textContent = fmtSW(now());
      go.textContent = L.on ? "Stop" : acc ? "Resume" : "Start";
      q('[data-k="lap"]').disabled = !L.on;
      q('[data-k="reset"]').disabled = L.on || !acc;
    };
    const table = () => {
      const ls = laps.map((x) => x.lap), lo = Math.min(...ls), hi = Math.max(...ls);
      q(".x-tw").hidden = !laps.length;
      body.innerHTML = laps.map((x, i) => `<tr${laps.length > 2 && x.lap === lo ? ' class="x-fast"' : laps.length > 2 && x.lap === hi ? ' class="x-slow"' : ""}><td>${i + 1}</td><td>${fmtSW(x.lap)}</td><td>${fmtSW(x.split)}</td></tr>`).reverse().join("");
    };
    const L = life(m, paint, 37);
    m.addEventListener("click", (e) => {
      const k = (e.target.closest("[data-k]") || {}).dataset;
      if (!k) return;
      if (k.k === "go") { if (L.on) { acc = now(); L.stop(); } else { t0 = performance.now(); L.start(); } }
      else if (k.k === "lap" && L.on) { const s = now(), prev = laps.length ? laps[laps.length - 1].split : 0; laps.push({ lap: s - prev, split: s }); table(); }
      else if (k.k === "reset" && !L.on) { acc = 0; laps = []; table(); }
      paint();
    });
    paint();
  }

  const PRIV = "It runs entirely in your browser, with nothing sent anywhere or saved.";
  const defs = {
    "pomodoro-timer": { render: toolPomo, info: { steps: ["Set the focus, short break and long break lengths, or keep 25, 5 and 15 minutes.", "Press Start and work until the chime.", "Take the short break; after every fourth focus session you get a long one.", "Use Pause, Skip or Reset whenever you need to."],
      about: `The Pomodoro Timer splits work into focused blocks with planned rests: a short break after each focus session and a longer one after every fourth. The ring empties as time runs out, the tab title shows the minutes left, and a soft chime marks each change of phase. Time is measured against the clock, so it stays right even when the tab is in the background. ${PRIV}`,
      faq: [["Why 25 minutes?", "It is long enough to get real work done and short enough to stay sharp. Change it if a different length suits you."], ["Does it keep running in another tab?", "Yes. Remaining time comes from the clock, not from counting ticks, so it stays accurate in background tabs."], ["Can I turn the chime off?", "Yes. Use the sound button at the corner of the page to mute all sounds."]] } },
    "timer-online": { render: toolTimer, info: { steps: ["Tap a preset or enter hours, minutes and seconds.", "Press Start.", "Pause or Reset at any time.", "When the alarm rings, press Stop."],
      about: `The Online Timer counts down from any time up to 99 hours in big, easy-to-read digits, and shows the time left in the tab title too. When it reaches zero, a beep repeats every second until you press Stop. ${PRIV}`,
      faq: [["Will the alarm sound if the tab is in the background?", "Yes, as long as the tab stays open and your device's sound is on."], ["Is it accurate?", "Yes. It works from the clock time when the timer ends, so slow or throttled tabs don't make it drift."], ["Why can't I hear anything?", "Check the page's sound button and your device volume; some browsers also need one tap on the page before playing sound."]] } },
    "stopwatch-online": { render: toolStopwatch, info: { steps: ["Press Start to begin timing.", "Press Lap to record a lap without stopping.", "Press Stop to pause, then Resume or Reset."],
      about: `The Online Stopwatch times to the hundredth of a second using your browser's high-resolution clock. Each lap shows its own time and the total split, with the fastest and slowest laps highlighted once you have three or more. ${PRIV}`,
      faq: [["What is the difference between lap and split?", "Lap time is how long that lap took; split is the total time from the start to the end of that lap."], ["Does it stay accurate in a background tab?", "Yes. Elapsed time comes from timestamps, so the display catches up the moment you return."], ["Are my laps saved?", "No. They clear when you reset or leave the page."]] } },
  };
  Object.entries(defs).forEach(([id, d]) => { if (byId[id]) Object.assign(byId[id], d, { status: "live" }); });
  T.route();
})();
