/* SugoiTools calculators: age, percentage, SIP, loan EMI, BMI, GST, scientific. Uses window.Toolora from core.js. */
(function () {
  "use strict";
  const fmt = (n, d = 0) => Number(n).toLocaleString("en-IN", { maximumFractionDigits: d });
  const inr = (n) => (n < 0 ? "−₹" : "₹") + fmt(Math.abs(Math.round(n)));
  const inr2 = (n) => "₹" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  /* Pure maths, kept apart from the UI */
  const sipFV = (P, r, y) => { const i = r / 1200, n = Math.round(y * 12); return i ? (P * (Math.pow(1 + i, n) - 1) / i) * (1 + i) : P * n; };
  const emi = (P, r, n) => { const i = r / 1200; if (!i) return P / n; const f = Math.pow(1 + i, n); return (P * i * f) / (f - 1); };
  const bmi = (kg, cm) => kg / Math.pow(cm / 100, 2);
  const bmiCat = (b) => (b < 18.5 ? "Underweight" : b < 25 ? "Normal weight" : b < 30 ? "Overweight" : "Obese");

  /* Scientific: tokenizer + shunting-yard + RPN evaluation */
  const NAMES = ["sqrt", "sin", "cos", "tan", "log", "ln", "pi", "e"];
  const BIN = { "+": 1, "-": 1, "*": 2, "/": 2, neg: 3, "^": 4 };
  const BAD = "Check your expression";
  function tok(src) {
    const s = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-").replace(/√/g, "sqrt").replace(/π/g, "pi").toLowerCase().replace(/\s+/g, "");
    const out = [];
    let i = 0;
    while (i < s.length) {
      const rest = s.slice(i), m = /^(\d+\.?\d*|\.\d+)/.exec(rest);
      if (m) { out.push(+m[0]); i += m[0].length; continue; }
      const nm = NAMES.find((n) => rest.startsWith(n));
      if (nm) { out.push(nm === "pi" ? Math.PI : nm === "e" ? Math.E : { f: nm }); i += nm.length; continue; }
      if ("+-*/^%()".includes(s[i])) { out.push(s[i]); i++; continue; }
      throw new Error(BAD);
    }
    return out;
  }
  function rpn(tokens) {
    const out = [], ops = [];
    let prev = "o";
    const pr = (o) => (typeof o === "object" ? 5 : BIN[o]);
    const bin = (op) => {
      while (ops.length && ops[ops.length - 1] !== "(" && (pr(ops[ops.length - 1]) > BIN[op] || (pr(ops[ops.length - 1]) === BIN[op] && op !== "^"))) out.push(ops.pop());
      ops.push(op); prev = "o";
    };
    for (const t of tokens) {
      if (typeof t === "number") { if (prev === "v") bin("*"); out.push(t); prev = "v"; }
      else if (typeof t === "object" || t === "(") { if (prev === "v") bin("*"); ops.push(t); prev = "o"; }
      else if (t === ")") {
        if (prev !== "v") throw new Error(BAD);
        while (ops.length && ops[ops.length - 1] !== "(") out.push(ops.pop());
        if (!ops.length) throw new Error(BAD);
        ops.pop();
        if (typeof ops[ops.length - 1] === "object") out.push(ops.pop());
      } else if (t === "%") { if (prev !== "v") throw new Error(BAD); out.push("%"); }
      else if (prev !== "v") { if (t === "-") ops.push("neg"); else if (t !== "+") throw new Error(BAD); }
      else bin(t);
    }
    if (prev !== "v") throw new Error(BAD);
    while (ops.length) { const o = ops.pop(); if (o !== "(") out.push(o); }
    return out;
  }
  function ev(src, deg) {
    const st = [], toR = (x) => (deg ? (x * Math.PI) / 180 : x), cl = (x) => (Math.abs(x) < 1e-12 ? 0 : x);
    for (const t of rpn(tok(src))) {
      if (typeof t === "number") { st.push(t); continue; }
      if (t === "%" || t === "neg" || typeof t === "object") {
        if (!st.length) throw new Error(BAD);
        const x = st.pop(), f = t.f;
        let r;
        if (t === "%") r = x / 100;
        else if (t === "neg") r = -x;
        else if (f === "sin") r = cl(Math.sin(toR(x)));
        else if (f === "cos") r = cl(Math.cos(toR(x)));
        else if (f === "tan") { if (deg && Math.abs(x % 180) === 90) throw new Error("tan is undefined here"); r = Math.tan(toR(x)); }
        else if (f === "log") r = Math.log10(x);
        else if (f === "ln") r = Math.log(x);
        else r = Math.sqrt(x);
        st.push(r); continue;
      }
      if (st.length < 2) throw new Error(BAD);
      const b = st.pop(), a = st.pop();
      if (t === "/" && b === 0) throw new Error("Can't divide by zero");
      st.push(t === "+" ? a + b : t === "-" ? a - b : t === "*" ? a * b : t === "/" ? a / b : Math.pow(a, b));
    }
    if (st.length !== 1 || !isFinite(st[0])) throw new Error(BAD);
    return +st[0].toPrecision(12);
  }
  window.TooloraCalc = { ev, sipFV, emi, bmi };

  const T = window.Toolora;
  if (!T) return;
  const { byId } = T;
  const css = document.createElement("style");
  css.textContent = `.x-calc [hidden]{display:none!important}
.x-cg{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));margin:0 0 16px}
.x-cf{display:flex;flex-direction:column;gap:6px;font-size:14px;font-weight:600;color:var(--navy)}
.x-cf input,.x-sci input{min-height:48px;padding:0 12px;border-radius:12px;border:1px solid var(--line);font:inherit;font-weight:500;background:#fff;color:var(--navy);box-sizing:border-box;width:100%}
.x-seg{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}
.x-seg button{min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid var(--line);background:#fff;color:var(--navy);font:inherit;font-weight:600;cursor:pointer}
.x-seg button[aria-pressed=true]{background:var(--blue);border-color:var(--blue);color:#fff}
.x-cr{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));margin:0 0 12px}
.x-cr div{padding:12px 14px;border-radius:12px;background:var(--soft)}.x-cr b{display:block;font-size:22px;color:var(--navy);overflow-wrap:anywhere}.x-cr span{font-size:13px;color:var(--muted)}
.x-cr .x-cbig{background:var(--navy)}.x-cr .x-cbig b,.x-cr .x-cbig span{color:#fff}
.x-cerr{padding:12px 14px;border-radius:12px;background:#FDECEC;color:#B42318!important;margin:0 0 12px}
.x-bar{display:flex;height:14px;border-radius:999px;overflow:hidden;background:var(--soft);margin:4px 0 8px}.x-bar i{background:var(--navy)}.x-bar i+i{background:var(--blue)}
.x-key{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--muted)}.x-key span::before{content:"";display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;background:var(--navy)}.x-key span+span::before{background:var(--blue)}
.x-cn{font-size:13px}
.x-calc details{margin-top:8px}.x-calc summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:600;color:var(--blue)}
.x-tw{overflow-x:auto}.x-tw table{width:100%;border-collapse:collapse;font-size:14px}.x-tw th,.x-tw td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}.x-tw th:first-child,.x-tw td:first-child{text-align:left}
.x-sci{max-width:420px}.x-sci input{min-height:56px;font-size:22px;text-align:right}
.x-sres{min-height:40px;margin:6px 4px 12px;text-align:right;font-size:26px;font-weight:700;color:var(--navy);overflow-wrap:anywhere}.x-sres.is-err{font-size:15px;font-weight:600;color:#B42318}
.x-pad{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.x-pad button{min-height:48px;border-radius:12px;border:1px solid var(--line);background:#fff;color:var(--navy);font:inherit;font-weight:600;cursor:pointer}
.x-pad .x-fn{background:var(--soft)}.x-pad .x-eq{grid-column:1/-1;background:var(--blue);border-color:var(--blue);color:#fff}`;
  document.head.appendChild(css);

  const F = (id, label, val, x = "") => `<label class="x-cf"><span>${label}</span><input id="${id}" type="number" inputmode="decimal" value="${val}" ${x}></label>`;
  const seg = (name, opts, cur, label) => `<div class="x-seg" role="group" aria-label="${label}">${opts.map(([v, t]) => `<button type="button" data-seg="${name}" data-v="${v}" aria-pressed="${v === cur}">${t}</button>`).join("")}</div>`;
  const tiles = (a) => `<div class="x-cr">${a.map(([v, l, big]) => `<div${big ? ' class="x-cbig"' : ""}><b>${v}</b><span>${l}</span></div>`).join("")}</div>`;
  const err = (m) => `<p class="x-cerr" role="alert">${m}</p>`;
  /* Mount a calculator: html above a live output; upd(q, num, sv) returns the output html. */
  function mk(m, html, upd) {
    m.innerHTML = `<div class="x-calc">${html}<div class="x-cout" aria-live="polite"></div></div>`;
    const q = (s) => m.querySelector(s), o = q(".x-cout");
    const num = (id) => parseFloat(q("#" + id).value);
    const sv = (n) => q(`[data-seg="${n}"][aria-pressed="true"]`).dataset.v;
    const run = () => (o.innerHTML = upd(q, num, sv));
    m.addEventListener("input", run);
    m.addEventListener("click", (e) => {
      const b = e.target.closest("[data-seg]");
      if (!b) return;
      m.querySelectorAll(`[data-seg="${b.dataset.seg}"]`).forEach((x) => x.setAttribute("aria-pressed", x === b));
      run();
    });
    run();
  }

  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const pd = (s) => { const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ""); return p ? new Date(+p[1], p[2] - 1, +p[3]) : null; };
  const dd = (a, b) => Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 864e5);

  function toolAge(m) {
    mk(m, `<div class="x-cg"><label class="x-cf"><span>Date of birth</span><input id="ca-dob" type="date"></label><label class="x-cf"><span>Age as of</span><input id="ca-as" type="date" value="${iso(new Date())}"></label></div>`, (q) => {
      const b = pd(q("#ca-dob").value), a = pd(q("#ca-as").value);
      if (!b || !a) return `<p>Enter your date of birth to see your age.</p>`;
      if (b > a) return err("Date of birth is after the 'as of' date.");
      let y = a.getFullYear() - b.getFullYear(), mo = a.getMonth() - b.getMonth(), d = a.getDate() - b.getDate();
      if (d < 0) { mo--; d += new Date(a.getFullYear(), a.getMonth(), 0).getDate(); }
      if (mo < 0) { y--; mo += 12; }
      const tot = dd(b, a);
      let nb = new Date(a.getFullYear(), b.getMonth(), b.getDate());
      if (nb < a) nb = new Date(a.getFullYear() + 1, b.getMonth(), b.getDate());
      const left = dd(a, nb);
      return tiles([[`${y} y ${mo} m ${d} d`, "Age", 1], [fmt(tot), "Total days"], [`${fmt(Math.floor(tot / 7))} wk ${tot % 7} d`, "Total weeks"],
        [left ? `${fmt(left)} days` : "Today 🎉", `Next birthday (turning ${nb.getFullYear() - b.getFullYear()})`], [b.toLocaleDateString("en-IN", { weekday: "long" }), "Day you were born"]]);
    });
  }

  function toolPct(m) {
    const L = { of: ["Percentage (X%)", "Of number (Y)"], is: ["Value (X)", "Of total (Y)"], ch: ["From (X)", "To (Y)"] };
    mk(m, seg("pm", [["of", "X% of Y"], ["is", "X is what % of Y"], ["ch", "% change X → Y"]], "of", "Mode") + `<div class="x-cg">${F("cp-x", "Percentage (X%)", 20)}${F("cp-y", "Of number (Y)", 500)}</div>`, (q, n, sv) => {
      const md = sv("pm"), x = n("cp-x"), y = n("cp-y");
      q("#cp-x").previousElementSibling.textContent = L[md][0];
      q("#cp-y").previousElementSibling.textContent = L[md][1];
      if (isNaN(x) || isNaN(y)) return `<p>Enter both numbers.</p>`;
      if (md === "of") return tiles([[fmt((x * y) / 100, 4), `${fmt(x, 4)}% of ${fmt(y, 4)}`, 1]]);
      if (md === "is") return y ? tiles([[fmt((x / y) * 100, 4) + "%", `${fmt(x, 4)} is this share of ${fmt(y, 4)}`, 1]]) : err("Y can't be zero.");
      if (!x) return err("The starting value X can't be zero.");
      const c = ((y - x) / Math.abs(x)) * 100;
      return tiles([[(c > 0 ? "+" : "") + fmt(c, 4) + "%", c > 0 ? "Increase" : c < 0 ? "Decrease" : "No change", 1], [fmt(y - x, 4), "Difference"]]);
    });
  }

  function toolSip(m) {
    mk(m, `<div class="x-cg">${F("cs-p", "Monthly investment (₹)", 5000, 'min="0"')}${F("cs-r", "Expected annual return (%)", 12, 'min="0" step="0.1"')}${F("cs-y", "Time period (years)", 10, 'min="1"')}</div>`, (q, n) => {
      const P = n("cs-p"), r = n("cs-r"), y = n("cs-y");
      if (!(P > 0) || !(r >= 0) || !(y > 0)) return `<p>Enter an amount, return and period above zero.</p>`;
      const fv = sipFV(P, r, y), inv = P * Math.round(y * 12), g = fv - inv, w = (inv / fv) * 100;
      return tiles([[inr(fv), "Estimated total value", 1], [inr(inv), "Amount invested"], [inr(g), "Estimated returns"]]) +
        `<div class="x-bar" role="img" aria-label="Invested ${w.toFixed(0)}%, returns ${(100 - w).toFixed(0)}%"><i style="width:${w}%"></i><i style="width:${100 - w}%"></i></div><p class="x-key"><span>Invested</span><span>Returns</span></p><p class="x-cn">Estimates only; returns are not guaranteed.</p>`;
    });
  }

  function toolLoan(m) {
    mk(m, `<div class="x-cg">${F("cl-p", "Loan amount (₹)", 1000000, 'min="0"')}${F("cl-r", "Interest rate (% a year)", 8.5, 'min="0" step="0.05"')}${F("cl-t", "Tenure", 20, 'min="1"')}</div>` +
      seg("lt", [["y", "Years"], ["m", "Months"]], "y", "Tenure unit") +
      `<details hidden><summary>Year-by-year repayment</summary><div class="x-tw"><table><thead><tr><th>Year</th><th>Principal</th><th>Interest</th><th>Balance</th></tr></thead><tbody></tbody></table></div></details>`, (q, n, sv) => {
      const P = n("cl-p"), r = n("cl-r"), t = n("cl-t"), N = Math.round(sv("lt") === "y" ? t * 12 : t), det = q("details");
      if (!(P > 0) || !(r >= 0) || !(N >= 1)) { det.hidden = true; return `<p>Enter a loan amount, rate and tenure above zero.</p>`; }
      const e = emi(P, r, N), i = r / 1200, rows = [];
      let bal = P, pp = 0, ip = 0;
      for (let k = 1; k <= N; k++) {
        const it = bal * i, pr = Math.min(e - it, bal);
        bal -= pr; pp += pr; ip += it;
        if (k % 12 === 0 || k === N) { rows.push(`<tr><td>${Math.ceil(k / 12)}</td><td>${inr(pp)}</td><td>${inr(ip)}</td><td>${inr(Math.max(bal, 0))}</td></tr>`); pp = ip = 0; }
      }
      det.hidden = false; q("tbody").innerHTML = rows.join("");
      return tiles([[inr(e), "Monthly EMI", 1], [inr(e * N - P), "Total interest"], [inr(e * N), "Total payment"]]);
    });
  }

  function toolBmi(m) {
    mk(m, seg("bu", [["m", "Metric (cm, kg)"], ["i", "Imperial (ft, in, lb)"]], "m", "Units") +
      `<div class="x-cg" data-u="m">${F("cb-cm", "Height (cm)", 170, 'min="0"')}${F("cb-kg", "Weight (kg)", 65, 'min="0"')}</div><div class="x-cg" data-u="i" hidden>${F("cb-ft", "Height (ft)", 5, 'min="0"')}${F("cb-in", "Height (in)", 7, 'min="0"')}${F("cb-lb", "Weight (lb)", 143, 'min="0"')}</div>`, (q, n, sv) => {
      const u = sv("bu");
      q('[data-u="m"]').hidden = u !== "m"; q('[data-u="i"]').hidden = u !== "i";
      const cm = u === "m" ? n("cb-cm") : ((n("cb-ft") || 0) * 12 + (n("cb-in") || 0)) * 2.54, kg = u === "m" ? n("cb-kg") : n("cb-lb") * 0.45359237;
      if (!(cm > 0) || !(kg > 0)) return `<p>Enter your height and weight.</p>`;
      const b = bmi(kg, cm);
      return tiles([[b.toFixed(1), "BMI", 1], [bmiCat(b), "WHO category"], [`${(18.5 * Math.pow(cm / 100, 2)).toFixed(1)}–${(24.9 * Math.pow(cm / 100, 2)).toFixed(1)} kg`, "Normal range for your height"]]) +
        `<p class="x-cn">Not medical advice. BMI doesn't account for muscle, age or body shape.</p>`;
    });
  }

  function toolGst(m) {
    mk(m, seg("gm", [["add", "Add GST"], ["rem", "Remove GST"]], "add", "Mode") + seg("gr", [["5", "5%"], ["12", "12%"], ["18", "18%"], ["28", "28%"], ["c", "Custom"]], "18", "GST rate") +
      `<div class="x-cg">${F("cg-a", "Amount (₹)", 1000, 'min="0"')}<span hidden>${F("cg-c", "Custom rate (%)", 3, 'min="0" step="0.01"')}</span></div>`, (q, n, sv) => {
      const md = sv("gm"), rc = sv("gr"), a = n("cg-a"), r = rc === "c" ? n("cg-c") : +rc;
      q("#cg-c").closest("label").parentNode.hidden = rc !== "c";
      q("#cg-a").previousElementSibling.textContent = md === "add" ? "Amount before GST (₹)" : "Amount including GST (₹)";
      if (!(a >= 0) || !(r >= 0)) return `<p>Enter an amount and a rate.</p>`;
      const net = md === "add" ? a : a / (1 + r / 100), g = md === "add" ? (a * r) / 100 : a - net;
      return tiles([[inr2(net), "Net amount"], [inr2(g), `GST at ${fmt(r, 2)}%`], [inr2(g / 2), `CGST ${fmt(r / 2, 2)}%`], [inr2(g / 2), `SGST ${fmt(r / 2, 2)}%`], [inr2(net + g), "Gross amount", 1]]);
    });
  }

  function toolSci(m) {
    const K = [["DEG", "x-fn", "mode"], ["(", "x-fn"], [")", "x-fn"], ["AC", "x-fn", "ac"], ["⌫", "x-fn", "bs"], ["sin", "x-fn", "sin("], ["cos", "x-fn", "cos("], ["tan", "x-fn", "tan("], ["log", "x-fn", "log("], ["ln", "x-fn", "ln("],
      ["√", "x-fn", "√("], ["^", "x-fn"], ["%", "x-fn"], ["π", "x-fn"], ["e", "x-fn"], ["7"], ["8"], ["9"], ["÷"], ["×"], ["4"], ["5"], ["6"], ["−"], ["+"], ["1"], ["2"], ["3"], ["0"], ["."], ["=", "x-eq", "eq"]];
    m.innerHTML = `<div class="x-sci"><input id="cx-e" type="text" inputmode="none" autocomplete="off" spellcheck="false" aria-label="Expression" placeholder="0"><div class="x-sres" aria-live="polite"></div>
      <div class="x-pad">${K.map(([t, c, v]) => `<button type="button" class="${c || ""}" data-k="${v || t}"${v === "mode" ? ' aria-label="Angle mode: degrees. Tap for radians"' : ""}>${t}</button>`).join("")}</div></div>`;
    const inp = m.querySelector("input"), res = m.querySelector(".x-sres");
    let deg = true;
    const show = (final) => {
      const s = inp.value.trim();
      res.classList.remove("is-err");
      if (!s) { res.textContent = ""; return; }
      try { const v = ev(s, deg); if (final) { inp.value = String(v); res.textContent = ""; } else res.textContent = "= " + v; }
      catch (e) { if (final) { res.textContent = e.message; res.classList.add("is-err"); } else res.textContent = ""; }
    };
    inp.addEventListener("input", () => show(false));
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === "=") { e.preventDefault(); show(true); }
      else if (e.key === "Escape") { inp.value = ""; show(false); }
    });
    m.querySelector(".x-pad").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      const k = b.dataset.k;
      if (k === "mode") { deg = !deg; b.textContent = deg ? "DEG" : "RAD"; b.setAttribute("aria-label", `Angle mode: ${deg ? "degrees. Tap for radians" : "radians. Tap for degrees"}`); show(false); return; }
      if (k === "eq") return show(true);
      if (k === "ac") inp.value = "";
      else if (k === "bs") inp.value = inp.value.replace(/(sin\(|cos\(|tan\(|log\(|ln\(|√\(|.)$/, "");
      else inp.value += k;
      show(false);
    });
  }

  const PRIV = "Everything is worked out in your browser as you type; nothing is sent anywhere or saved.";
  const defs = {
    "age-calculator": { render: toolAge, info: { steps: ["Pick your date of birth.", "Leave 'Age as of' on today, or choose another date.", "Read your age in years, months and days.", "See total days, weeks and your next birthday countdown."],
      about: `Age Calculator counts whole years, then months, then the days left over, the way age is usually stated on forms. It also shows the weekday you were born and how many days remain until your next birthday. ${PRIV}`,
      faq: [["How are leap-year birthdays handled?", "If you were born on 29 February, your birthday in other years is counted as 1 March."], ["Can I find my age on a past or future date?", "Yes. Change the 'Age as of' date to any day after your birth."], ["Why do months have different day counts?", "Leftover days are counted against the actual length of the previous month, so results match the calendar."]] } },
    "percentage-calculator": { render: toolPct, info: { steps: ["Choose a mode: X% of Y, X is what % of Y, or % change.", "Enter the two numbers.", "The answer updates as you type."],
      about: `Percentage Calculator handles the three questions people ask most: a share of a number, what share one number is of another, and how much a value rose or fell. ${PRIV}`,
      faq: [["How is percentage change worked out?", "(New − Old) ÷ Old × 100. A positive result is an increase, a negative one a decrease."], ["How do I find a discount price?", "Use X% of Y to get the discount, then subtract it from the price."], ["How do I turn marks into a percentage?", "Use 'X is what % of Y' with your marks as X and the total as Y."]] } },
    "sip-calculator": { render: toolSip, info: { steps: ["Enter your monthly SIP amount in ₹.", "Enter the annual return you expect.", "Enter how many years you'll invest.", "See invested amount, estimated returns and total value."],
      about: `SIP Calculator assumes you invest at the start of each month and returns compound monthly: FV = P × ((1 + i)ⁿ − 1) ÷ i × (1 + i), where i is the annual rate ÷ 12 and n is the number of months. Real fund returns vary year to year. ${PRIV}`,
      faq: [["Are these returns guaranteed?", "No. Mutual fund returns depend on markets; treat the result as an estimate only."], ["What return should I use?", "Pick a conservative figure. Past returns don't promise future ones."], ["Does it include tax or exit load?", "No. The result is before taxes, charges and exit loads."]] } },
    "loan-calculator": { render: toolLoan, info: { steps: ["Enter the loan amount in ₹.", "Enter the yearly interest rate.", "Enter the tenure and pick years or months.", "See your EMI and open the year-by-year table."],
      about: `Loan / EMI Calculator uses the standard reducing-balance formula EMI = P·r·(1 + r)ⁿ ÷ ((1 + r)ⁿ − 1), with r as the monthly rate. The yearly table splits each year's payments into principal and interest. ${PRIV}`,
      faq: [["Does it work for home, car and personal loans?", "Yes, for any loan with a fixed rate and equal monthly instalments."], ["What if the interest rate is 0%?", "The EMI is simply the loan amount divided by the number of months."], ["Why does my bank's EMI differ slightly?", "Banks may add processing fees, round differently or count days in their own way."]] } },
    "bmi-calculator": { render: toolBmi, info: { steps: ["Choose metric or imperial units.", "Enter your height and weight.", "Read your BMI and WHO category."],
      about: `BMI Calculator divides weight in kilograms by height in metres squared and places the result in the WHO adult bands: under 18.5 underweight, 18.5–24.9 normal, 25–29.9 overweight, 30 and over obese. ${PRIV}`,
      faq: [["Is BMI accurate for everyone?", "No. It ignores muscle mass, age, sex and build, so athletes and older adults can be misclassified."], ["Does it work for children?", "No. Children and teens need age- and sex-specific BMI charts."], ["Is this medical advice?", "No. Talk to a doctor about your weight and health."]] } },
    "gst-calculator": { render: toolGst, info: { steps: ["Choose Add GST or Remove GST.", "Tap a rate, or Custom to type your own.", "Enter the amount.", "Read net, GST, CGST, SGST and gross amounts."],
      about: `GST Calculator adds tax to a price, or takes it out of a GST-inclusive price using Net = Gross ÷ (1 + rate ÷ 100). For sales within a state, the GST splits equally into CGST and SGST. ${PRIV}`,
      faq: [["How do I remove GST from a price?", "Choose Remove GST and enter the inclusive price. ₹1,180 at 18% gives ₹1,000 net."], ["What about IGST?", "For sales between states, IGST equals the full GST amount shown."], ["Which rate applies to my item?", "Rates depend on the goods or service; check the current GST rate notified for it."]] } },
    "scientific-calculator": { render: toolSci, info: { steps: ["Tap the keys or type on your keyboard.", "Switch DEG or RAD for trig functions.", "Watch the live answer, then press = or Enter.", "Press AC or Escape to clear."],
      about: `Scientific Calculator follows the usual order of operations: brackets, powers, then × and ÷, then + and −. It supports sin, cos, tan, log, ln, square roots, powers, percent, π and e, and multiplies implicitly, so 2π means 2 × π. ${PRIV}`,
      faq: [["What does % do?", "It divides the number before it by 100, so 50% is 0.5."], ["Is log base 10?", "Yes. log is base 10 and ln is the natural log."], ["Why do I see an error?", "Check for a missing number, an unbalanced bracket or a division by zero."]] } },
  };
  Object.entries(defs).forEach(([id, d]) => { if (byId[id]) Object.assign(byId[id], d, { status: "live" }); });
  T.route();
})();
