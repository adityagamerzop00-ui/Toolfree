/* Toolora UI effects: synthesized sounds, ripple, pop, card stagger. */
(function () {
  "use strict";
  var ctx = null, on = true, lastErr = 0;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var SEL = "button, .btn, a.x-card, a.tool-card, .tool-card a, [role=button]";

  function ac() {
    if (!ctx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { ctx = new C(); } catch (e) { return null; }
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  function tone(f1, f2, start, dur, vol, type) {
    var c = ac();
    if (!c || !on) return;
    var t = c.currentTime + start, o = c.createOscillator(), g = c.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }
  var FX = {
    tap: function () { tone(600, 300, 0, 0.06, 0.08); },
    success: function () { tone(660, 660, 0, 0.09, 0.09); tone(990, 990, 0.09, 0.09, 0.08); },
    error: function () {
      var n = Date.now();
      if (n - lastErr < 400) return;
      lastErr = n;
      tone(200, 190, 0, 0.12, 0.06, "square");
    }
  };
  FX.tone = tone;
  window.ToolFX = FX;

  function pop(el) {
    if (reduce || !el || !el.classList) return;
    el.classList.remove("x-fx-pop");
    void el.offsetWidth;
    el.classList.add("x-fx-pop");
  }
  FX.pop = pop;

  function ripple(el, e) {
    if (reduce) return;
    var cs = getComputedStyle(el);
    if (cs.position === "static") el.style.position = "relative";
    if (cs.overflow === "visible") el.style.overflow = "hidden";
    var r = el.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
    var x = (e.clientX || r.left + r.width / 2) - r.left, y = (e.clientY || r.top + r.height / 2) - r.top;
    var sp = document.createElement("span");
    sp.className = "x-fx-ripple";
    sp.setAttribute("aria-hidden", "true");
    sp.style.cssText = "width:" + s + "px;height:" + s + "px;left:" + (x - s / 2) + "px;top:" + (y - s / 2) + "px";
    el.appendChild(sp);
    setTimeout(function () { sp.remove(); }, 480);
  }

  document.addEventListener("pointerdown", function (e) {
    var el = e.target.closest && e.target.closest(SEL);
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return;
    ac();
    ripple(el, e);
  }, true);

  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest(SEL + ", a[download]");
    if (!el || el.disabled) return;
    if (el.id === "x-fx-mute") return;
    if (el.matches("a[download]")) { FX.success(); pop(el); return; }
    FX.tap();
  }, true);

  // Downloads triggered from script via a detached <a download>.click()
  var aClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.hasAttribute("download") && !this.isConnected) FX.success();
    return aClick.apply(this, arguments);
  };

  // Mute toggle
  var mute = document.createElement("button");
  mute.type = "button";
  mute.id = "x-fx-mute";
  mute.className = "x-fx-mute";
  mute.setAttribute("aria-label", "Sound on/off");
  function paint() {
    mute.textContent = on ? "🔊" : "🔇";
    mute.setAttribute("aria-pressed", on ? "true" : "false");
    mute.title = on ? "Sound on" : "Sound off";
  }
  mute.addEventListener("click", function () {
    on = !on; paint();
    if (on) FX.tap();
  });
  paint();
  document.body.appendChild(mute);

  // Observers: Copied!, errors, new cards
  function isErr(el) {
    return !!el && el.nodeType === 1 && (el.getAttribute("role") === "alert" || (typeof el.className === "string" && /error|x-err/i.test(el.className)));
  }
  function visible(el) {
    return !el.hidden && el.offsetParent !== null && (el.textContent || "").trim() !== "";
  }
  function checkErr(el) {
    var v = visible(el);
    if (v && !el._fxShown) { FX.error(); }
    el._fxShown = v;
  }
  function checkCopied(el) {
    if (el && el.nodeType === 1 && (el.textContent || "").trim() === "Copied!" && !el._fxCopied) {
      el._fxCopied = true; FX.success(); pop(el);
      setTimeout(function () { el._fxCopied = false; }, 600);
    }
  }

  var io = !reduce && "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add("x-fx-in");
      io.unobserve(en.target);
    });
  }, { threshold: 0.05 }) : null;
  function stagger(root) {
    if (!io || !root.querySelectorAll) return;
    var list = root.querySelectorAll(".x-card:not(.x-fx-seen), .tool-card:not(.x-fx-seen)");
    Array.prototype.forEach.call(list, function (c, i) {
      c.classList.add("x-fx-seen", "x-fx-up");
      c.style.animationDelay = Math.min(i, 20) * 40 + "ms";
      io.observe(c);
    });
  }

  var main = document.getElementById("x-view") || document.querySelector("main") || document.body;
  var pend = false;
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      var t = m.target.nodeType === 3 ? m.target.parentElement : m.target;
      if (m.type === "childList") {
        checkCopied(t);
        m.addedNodes.forEach(function (n) {
          if (n.nodeType !== 1) return;
          if (isErr(n)) checkErr(n);
          if (n.querySelectorAll) Array.prototype.forEach.call(n.querySelectorAll("[role=alert],[class*=error],.x-err"), function (x) { x._fxShown = visible(x); });
        });
        if (!pend) { pend = true; requestAnimationFrame(function () { pend = false; stagger(main); }); }
      } else if (m.type === "characterData") {
        checkCopied(t);
      }
      if (t && isErr(t)) checkErr(t);
    });
  }).observe(main, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["hidden", "class", "style"] });
  stagger(main);
})();
