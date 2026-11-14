/* SugoiTools creator tools: Instagram Caption Generator, YouTube Title Generator, Hashtag Suggestions. Uses window.Toolora from core.js. */
(function () {
  "use strict";
  const T = window.Toolora;
  if (!T) return;
  const { byId, esc } = T;
  const css = document.createElement("style");
  css.textContent = `.x-cw [hidden]{display:none!important}
.x-cw input[type=text],.x-cw select{width:100%;min-height:48px;padding:0 12px;border-radius:12px;border:1px solid var(--line);font:inherit;box-sizing:border-box;background:#fff}
.x-cf{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:0 0 12px}.x-cf label{display:block;font-size:14px;margin:0 0 4px}
.x-ck{display:flex;flex-wrap:wrap;gap:16px;margin:0 0 12px}.x-ck label{display:flex;align-items:center;gap:8px;min-height:44px}
.x-row{display:flex;flex-wrap:wrap;gap:8px}
.x-fx{list-style:none;margin:16px 0 0;padding:0;display:grid;gap:8px}
.x-fx li{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;border:1px solid var(--line)}
.x-fx div{flex:1;min-width:0}.x-fx p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere}.x-fx span{display:block;font-size:13px;color:var(--muted)}
.x-fx span.x-amb{color:#9a5b00;font-weight:600}
.x-hg{margin:16px 0 0;padding:12px;border-radius:12px;background:var(--soft)}.x-hg h3{margin:0 0 8px;font-size:16px;color:var(--navy)}
.x-hg p{margin:0 0 8px;overflow-wrap:anywhere}.x-note{font-size:13px;color:var(--muted);margin:12px 0 0}`;
  document.head.appendChild(css);

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
  const copied = (b, t) => copy(t).then(() => { const o = b.textContent; b.textContent = "Copied!"; setTimeout(() => (b.textContent = o), 1500); });
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const words = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const cap = (s) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const TONES = ["Fun", "Professional", "Inspiring", "Casual"];

  /* Shared form: topic + tone, extra controls, Generate / Generate more, results list. */
  function form(m, o) {
    m.innerHTML = `<div class="x-cw"><div class="x-cf"><div><label for="x-tp">${o.label}</label><input type="text" id="x-tp" placeholder="${o.ph}" maxlength="80"></div>
      ${o.tone ? `<div><label for="x-tn">Tone</label><select id="x-tn">${TONES.map((t) => `<option>${t}</option>`).join("")}</select></div>` : ""}</div>
      ${o.extra || ""}<div class="x-row"><button type="button" class="x-btn x-primary x-go">Generate</button><button type="button" class="x-btn x-more" hidden>Generate more</button></div>
      <div class="x-out" aria-live="polite"></div></div>`;
    const inp = m.querySelector("#x-tp"), tn = m.querySelector("#x-tn"), out = m.querySelector(".x-out"), more = m.querySelector(".x-more");
    const run = () => {
      const topic = inp.value.trim();
      if (!topic) { out.innerHTML = `<p class="x-note">Type a topic first.</p>`; inp.focus(); return; }
      out.innerHTML = o.gen(topic, tn ? tn.value : "", m);
      more.hidden = false;
    };
    m.querySelector(".x-go").addEventListener("click", run);
    more.addEventListener("click", run);
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
    out.addEventListener("click", (e) => { const b = e.target.closest("button[data-c]"); if (b) copied(b, b.dataset.c); });
  }
  const item = (text, sub) => `<li><div><p>${esc(text)}</p>${sub || ""}</div><button type="button" class="x-btn" data-c="${esc(text)}">Copy</button></li>`;
  const tagify = (s) => "#" + words(s).join("");

  /* 1. Instagram captions */
  const EMO = { Fun: ["😂", "🎉", "🤪", "🙌", "✨"], Professional: ["📈", "✅", "💼", "📌", "🔍"], Inspiring: ["🌟", "💫", "🌱", "🔥", "🙏"], Casual: ["😊", "👋", "☕", "🤙", "💛"] };
  const CAP = [
    "Current mood: {topic}", "{Topic} kind of day", "Life is better with {topic}", "Just me and my {topic}", "Can't stop thinking about {topic}",
    "Here's your sign to try {topic}", "{Topic}, but make it aesthetic", "Plot twist: {topic} was the answer all along", "Weekend plans? {Topic}. Obviously.",
    "Not all who wander are lost — some are just into {topic}", "A little {topic} goes a long way", "Dear {topic}, thanks for everything",
    "Proof that {topic} makes everything better", "Saving this {topic} moment forever", "If you need me, I'll be busy with {topic}",
    "Small steps, big {topic} goals", "{Topic} is my love language", "Today's lesson brought to you by {topic}", "3 words: {topic}, {topic}, {topic}",
    "Making memories, one {topic} at a time", "Me vs. {topic}: guess who won", "Keep calm and enjoy {topic}", "Behind every great day is a bit of {topic}",
    "{Topic} check ✔", "Everything I didn't know I needed: {topic}", "Doing more of what I love — {topic}", "The secret ingredient? {Topic}.",
    "Raise your hand if you're obsessed with {topic}", "Collect moments, not things. Today: {topic}", "New post, same love for {topic}",
  ];
  const CTA = { Fun: ["Tag a friend who needs this! 👇", "Double tap if you agree 😄"], Professional: ["Save this for later and share with your team.", "What's your take? Let me know below."],
    Inspiring: ["Share this with someone who needs it today.", "Tell me your goal in the comments 💬"], Casual: ["What do you think? Drop a comment 👇", "Save it for later 📌"] };
  function genCap(topic, tone, m) {
    const ws = words(topic), Topic = cap(topic), e = EMO[tone];
    const cta = m.querySelector("#x-cta").checked, hs = m.querySelector("#x-hs").checked;
    const tags = [...new Set([tagify(topic), ...ws.map((w) => "#" + w), tagify(topic) + "life", tagify(topic) + "lover", "#instagood"])].slice(0, 6).join(" ");
    const list = shuffle(CAP).slice(0, 10).map((t) => {
      let s = t.replace(/\{topic\}/g, topic).replace(/\{Topic\}/g, Topic) + " " + pick(e);
      if (cta) s += "\n" + pick(CTA[tone]);
      if (hs) s += "\n\n" + tags;
      return item(s);
    });
    return `<ul class="x-fx">${list.join("")}</ul>`;
  }
  function toolCap(m) {
    form(m, { label: "Topic or keyword", ph: "e.g. beach sunset", tone: true, gen: genCap,
      extra: `<div class="x-ck"><label><input type="checkbox" id="x-cta" checked> Add a call to action</label><label><input type="checkbox" id="x-hs" checked> Add hashtags</label></div>` });
  }

  /* 2. YouTube titles */
  const YT = {
    any: ["How to {T} (Step by Step)", "7 {T} Mistakes You're Probably Making", "I Tried {T} for 30 Days — Here's What Happened", "{T} Explained in 5 Minutes",
      "The Ultimate {T} Guide for Beginners", "{T}: Everything You Need to Know", "Why Nobody Talks About This {T} Trick", "{T} vs. Reality",
      "10 {T} Tips I Wish I Knew Sooner", "Stop Doing {T} Wrong", "The Truth About {T}", "{T} for Absolute Beginners",
      "Is {T} Worth It in 2025?", "I Asked Experts About {T}", "{T} in 60 Seconds", "Watch This Before You Start {T}",
      "Beginner to Pro: {T}", "5 {T} Hacks That Actually Work", "My Honest {T} Review", "The Easiest Way to Start {T}",
      "{T}: What They Don't Tell You", "Doing {T} Every Day for a Week", "Rating Every {T} Tip on the Internet", "3 Simple Rules for {T}",
      "{T} Changed My Life (Not Clickbait)", "Common {T} Myths, Debunked", "What I Learned From a Year of {T}", "{T} on a Budget",
      "The Only {T} Video You Need", "Don't Start {T} Until You Watch This"],
    Fun: ["{T} Gone Wrong 😂", "I Let My Friends Choose My {T}"], Professional: ["A Practical Framework for {T}", "{T}: A Data-Driven Breakdown"],
    Inspiring: ["How {T} Can Change Your Life", "Your {T} Journey Starts Today"], Casual: ["Let's Talk About {T}", "Chill {T} Vlog"],
  };
  function genYT(topic, tone) {
    const Tt = cap(topic);
    const list = shuffle([...YT.any, ...YT[tone]]).slice(0, 10).map((p) => {
      const s = p.replace(/\{T\}/g, Tt), n = [...s].length, over = n > 60;
      return item(s, `<span class="${over ? "x-amb" : ""}">${n} characters${over ? " · may be cut off in search (over 60)" : ""}</span>`);
    });
    return `<ul class="x-fx">${list.join("")}</ul>`;
  }

  /* 3. Hashtags */
  const DICT = {
    fitness: [["fitness", "gym", "workout", "fit", "exercise", "training", "yoga", "run"], "fitness gym workout fitnessmotivation fitfam health training", "homeworkout legday gymlife strengthtraining fitnessjourney personaltrainer"],
    food: [["food", "recipe", "cook", "baking", "cake", "dinner", "eat", "chef", "coffee"], "food foodie instafood yummy delicious foodphotography", "homecooking foodblogger recipeoftheday foodstagram eeeeeats homemade"],
    travel: [["travel", "trip", "beach", "mountain", "holiday", "vacation", "tour", "hike"], "travel travelgram wanderlust explore adventure", "travelphotography instatravel travelblogger traveltheworld beautifuldestinations"],
    tech: [["tech", "coding", "code", "ai", "gadget", "phone", "software", "app", "programming"], "tech technology innovation gadgets ai", "coding programming developer techtips techreview startuplife"],
    study: [["study", "exam", "student", "school", "college", "learn", "notes"], "study student studygram education learning", "studymotivation studytips examprep studywithme notes"],
    fashion: [["fashion", "outfit", "style", "ootd", "dress", "makeup", "beauty"], "fashion style ootd outfit instafashion", "outfitoftheday streetstyle fashionblogger styleinspo whatiwore"],
    gaming: [["game", "gaming", "gamer", "esports", "stream", "pc", "console"], "gaming gamer games videogames", "gamingcommunity twitch pcgaming gamingsetup esports"],
    photography: [["photo", "photography", "camera", "portrait", "sunset", "nature"], "photography photooftheday photo picoftheday", "naturephotography portraitphotography landscape goldenhour shotoniphone"],
    business: [["business", "marketing", "startup", "brand", "sales", "money", "entrepreneur"], "business entrepreneur marketing success", "smallbusiness digitalmarketing startup branding entrepreneurlife"],
    motivation: [["motivation", "goal", "mindset", "success", "inspire", "life", "quote"], "motivation inspiration mindset goals", "motivationalquotes selfgrowth positivevibes dailymotivation selflove"],
    art: [["art", "draw", "drawing", "paint", "painting", "sketch", "design", "craft"], "art artist artwork drawing", "digitalart illustration sketchbook artistsoninstagram painting"],
    india: [["india", "indian", "delhi", "mumbai", "bangalore", "desi", "kerala", "diwali"], "india incredibleindia indian desi", "indianfood mumbai delhi indiantravel indiagram"],
  };
  function tags(kw) {
    const ws = words(kw), j = ws.join(""), n = (a) => [...new Set(a.filter((t) => t.length > 1))];
    const cats = Object.values(DICT).filter(([k]) => ws.some((w) => k.some((x) => w === x || w === x + "s")));
    const broad = n([j, ...cats.flatMap((c) => c[1].split(" ")), ...(cats.length ? [] : ["instagood", "photooftheday", "explore", "trending", "viral"])]);
    const niche = n([...cats.flatMap((c) => c[2].split(" ")), j + "community", j + "tips", j + "inspiration"]);
    const vars = n([...ws, ...ws.map((w) => w + "s"), j + "life", j + "lover", j + "daily", "my" + j, j + "gram", "insta" + j, j + "time"]);
    const seen = new Set(), out = [];
    [["Broad", broad, 10], ["Niche", niche, 10], ["Variants", vars, 10]].forEach(([g, a, max]) => {
      const t = a.filter((x) => !seen.has(x)).slice(0, max);
      t.forEach((x) => seen.add(x)); out.push([g, t.map((x) => "#" + x)]);
    });
    return out;
  }
  function genHash(kw) {
    const g = tags(kw), all = g.flatMap((x) => x[1]).slice(0, 30);
    return `<div class="x-row" style="margin-top:16px;align-items:center"><strong>${all.length} hashtags</strong><button type="button" class="x-btn" data-c="${esc(all.join(" "))}">Copy all</button></div>` +
      g.filter((x) => x[1].length).map(([n, t]) => `<div class="x-hg"><h3>${n} · ${t.length}</h3><p>${esc(t.join(" "))}</p><button type="button" class="x-btn" data-c="${esc(t.join(" "))}">Copy ${n.toLowerCase()}</button></div>`).join("") +
      `<p class="x-note">Instagram allows up to 30 hashtags per post.</p>`;
  }

  const LOCAL = ["Do I need an account?", "No. It's free with no sign-up, and nothing you type leaves your browser."];
  const TPL = ["Where do the ideas come from?", "Ideas come from proven templates on your device, so they're instant and private."];
  const defs = {
    "instagram-caption-generator": { render: toolCap, added: 21, description: "Caption ideas for any topic, in four tones, with optional call to action and hashtags.",
      info: { steps: ["Type your post's topic or keyword.", "Pick a tone: Fun, Professional, Inspiring or Casual.", "Choose whether to add a call to action and hashtags, then tap Generate.", "Tap Copy on a caption you like, or Generate more for new ones."],
        about: "Instagram Caption Generator mixes about 30 caption templates with your topic, emoji to match your tone, and optional call-to-action and hashtag lines.",
        faq: [TPL, ["Can I edit the captions?", "Yes. Copy one, paste it into Instagram and change any words you like."], LOCAL] } },
    "youtube-title-generator": { render: (m) => form(m, { label: "Video topic or keyword", ph: "e.g. home workouts", tone: true, gen: genYT }), added: 22,
      description: "Clickable YouTube title ideas with a character count for each.",
      info: { steps: ["Type your video's topic or keyword.", "Pick a tone.", "Tap Generate for 10 titles, or Generate more to reshuffle.", "Tap Copy on the one you like."],
        about: "YouTube Title Generator fills about 30 proven title patterns with your topic and counts the characters, flagging titles over 60 that may be cut off in search.",
        faq: [TPL, ["Why flag titles over 60 characters?", "YouTube allows 100, but search results and phones often cut titles after about 60."], LOCAL] } },
    "hashtag-suggestions": { render: (m) => form(m, { label: "Keyword", ph: "e.g. travel photography", tone: false, gen: genHash }), added: 23,
      description: "Up to 30 hashtags for your keyword, grouped into broad, niche and variants.",
      info: { steps: ["Type a keyword or two.", "Tap Generate.", "Copy all the tags, or just one group.", "Paste them into your post or first comment."],
        about: "Hashtag Suggestions builds tags from your keyword plus a small set of categories such as fitness, food, travel, tech and India, grouped as broad, niche and variants.",
        faq: [TPL, ["How many hashtags should I use?", "Instagram allows up to 30. A mix of broad and niche tags usually works better than only popular ones."], LOCAL] } },
  };
  if (T.cats && T.cats.creator) T.cats.creator.desc = "Captions, titles, hashtags, descriptions and bios — free, in your browser.";
  Object.entries(defs).forEach(([id, d]) => { if (byId[id]) Object.assign(byId[id], d, { status: "live" }); });
  T.route();
})();
