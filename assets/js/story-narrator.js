/* Toolsaku Movie Story Narrator. Turns a movie or series clip into a narrated Short:
   Gemini (the viewer's own free key, called straight from this browser) listens to the clip and looks at a few
   snapshots, writes a first-person story recap with a strong hook and cliffhangers, then a Gemini voice reads it.
   The Short (9:16, captions, hook title, colour look, movie sound ducked under the voice) is rendered on this device.
   The video file is never uploaded to Toolsaku; only a small low-quality audio copy and a few snapshots go to Google. */
(function () {
  "use strict";
  const TL = window.Toolora;
  const mount = document.getElementById("x-tool");
  if (!TL || !mount) return;
  const { ic, esc } = TL;
  const HI = (document.documentElement.lang || "").toLowerCase().startsWith("hi");

  /* ---------- strings (EN, HI) ---------- */
  const S = {
    keyH: ["Your free Gemini key", "आपकी मुफ़्त Gemini key"],
    keyP: ["The AI runs on your own free key from Google AI Studio. It is kept only in this browser and sent only to Google.",
      "AI आपकी अपनी मुफ़्त Google AI Studio key से चलता है। key सिर्फ़ इसी ब्राउज़र में रहती है और सिर्फ़ Google को भेजी जाती है।"],
    keyGet: ["Get a free key", "मुफ़्त key लें"], keySave: ["Save key", "key सेव करें"], keyOk: ["Key saved in this browser.", "key इस ब्राउज़र में सेव है।"],
    keyChange: ["Change key", "key बदलें"], keyPh: ["Paste your key (starts with AIza)", "अपनी key पेस्ट करें (AIza से शुरू)"],
    f1: ["1. Pick the clip", "1. क्लिप चुनें"], file: ["Movie or series clip (MP4, MOV, WEBM)", "मूवी या सीरीज़ क्लिप (MP4, MOV, WEBM)"],
    start: ["Start at (seconds)", "कहाँ से शुरू (सेकंड)"], len: ["Short length", "Short की लंबाई"],
    name: ["Movie or series name (optional)", "मूवी या सीरीज़ का नाम (वैकल्पिक)"], namePh: ["e.g. The Conjuring", "जैसे The Conjuring"],
    lang: ["Narration language", "आवाज़ की भाषा"], voice: ["Voice", "आवाज़"], look: ["Look", "लुक"], fit: ["Frame", "फ़्रेम"],
    mov: ["Movie sound under the voice", "आवाज़ के नीचे मूवी की आवाज़"],
    f2: ["2. Story script", "2. कहानी की स्क्रिप्ट"], write: ["Write story with AI", "AI से कहानी लिखें"],
    hook: ["Hook title (first 3 seconds)", "हुक टाइटल (पहले 3 सेकंड)"],
    lines: ["Narration, one line per row (edit freely)", "नैरेशन, हर लाइन अलग (जैसे चाहें बदलें)"],
    post: ["Post title and hashtags", "पोस्ट टाइटल और हैशटैग"], copy: ["Copy", "कॉपी"], copied: ["Copied!", "कॉपी हो गया!"],
    f3: ["3. Voice and video", "3. आवाज़ और वीडियो"], mkVoice: ["Make voice", "आवाज़ बनाएँ"], mkVideo: ["Make Short", "Short बनाएँ"],
    dl: ["Download Short", "Short डाउनलोड करें"], again: ["Make again", "फिर से बनाएँ"],
    stop: ["Stop", "रोकें"],
    readA: ["Reading the clip's sound…", "क्लिप की आवाज़ पढ़ रहे हैं…"], readF: ["Taking snapshots…", "स्नैपशॉट ले रहे हैं…"],
    aiW: ["AI is watching the clip and writing the story…", "AI क्लिप देखकर कहानी लिख रहा है…"],
    ttsW: ["AI voice is reading part {i} of {n}…", "AI आवाज़ भाग {i} / {n} पढ़ रही है…"],
    voiceOk: ["Voice ready: {s} s. Listen, then make the Short.", "आवाज़ तैयार: {s} सेकंड। सुनें, फिर Short बनाएँ।"],
    rend: ["Making your Short… {p}% (keep this tab open)", "आपका Short बन रहा है… {p}% (यह टैब खुला रखें)"],
    done: ["Done. Your Short is ready.", "हो गया। आपका Short तैयार है।"],
    noKey: ["Save your free Gemini key first.", "पहले अपनी मुफ़्त Gemini key सेव करें।"],
    noFile: ["Pick a video clip first.", "पहले एक वीडियो क्लिप चुनें।"],
    noLines: ["Write the story first, or type your own lines.", "पहले कहानी लिखें, या अपनी लाइनें टाइप करें।"],
    noVoice: ["Make the voice first.", "पहले आवाज़ बनाएँ।"],
    noAudio: ["Couldn't read this clip's sound, so the AI will write from snapshots only.", "इस क्लिप की आवाज़ नहीं पढ़ पाए, इसलिए AI सिर्फ़ स्नैपशॉट से लिखेगा।"],
    busy: ["AI is busy. Trying again in {s} s…", "AI व्यस्त है। {s} सेकंड में फिर कोशिश…"],
    day: ["Your key's free limit for today is used up. Try again tomorrow.", "आपकी key की आज की मुफ़्त सीमा खत्म हो गई। कल फिर कोशिश करें।"],
    bad: ["That key didn't work. Copy it again from AI Studio and paste it.", "यह key नहीं चली। AI Studio से दोबारा कॉपी करके पेस्ट करें।"],
    net: ["Couldn't reach Google. Check your internet.", "Google तक नहीं पहुँच पाए। इंटरनेट चेक करें।"],
    fail: ["The AI couldn't do this right now. Try again in a minute.", "AI अभी यह नहीं कर पाया। एक मिनट बाद फिर कोशिश करें।"],
    noRec: ["This browser can't record video. Use the latest Chrome or Edge.", "यह ब्राउज़र वीडियो रिकॉर्ड नहीं कर सकता। नया Chrome या Edge इस्तेमाल करें।"],
    playErr: ["This browser couldn't play the clip. Try an MP4 file.", "यह ब्राउज़र क्लिप नहीं चला पाया। MP4 फ़ाइल आज़माएँ।"],
    mode: ["Mode", "मोड"], m1: ["One clip", "एक क्लिप"], m2: ["Full movie in parts", "पूरी मूवी, भागों में"],
    fileM: ["Movie or long video (MP4, MOV, WEBM)", "मूवी या लंबा वीडियो (MP4, MOV, WEBM)"], lenM: ["Part length", "हर भाग की लंबाई"],
    partOf: ["Part {i} of {n}", "भाग {i} / {n}"], partAt: ["{a} to {b}", "{a} से {b}"], goPart: ["Go to part", "भाग पर जाएँ"],
    narr: ["Narrate part {i}", "भाग {i} नैरेट करें"], nextP: ["Next part", "अगला भाग"],
    lastP: ["That was the last part. The whole movie is narrated.", "यह आख़िरी भाग था। पूरी मूवी नैरेट हो गई।"],
    sofar: ["Story so far is carried into this part.", "पिछले भागों की कहानी इस भाग में आगे बढ़ेगी।"],
    mHint: ["Pick a part length. The movie is split into parts on this device, then each part is narrated one by one and the story carries on from part to part.",
      "हर भाग की लंबाई चुनें। मूवी इसी डिवाइस पर भागों में बँटती है, फिर हर भाग एक-एक करके नैरेट होता है और कहानी अगले भाग में आगे चलती है।"],
    listen: ["Listening to this part… {p}%", "इस भाग की आवाज़ सुन रहे हैं… {p}%"],
    doneP: ["Part {i} is ready. Download it, then tap Next part.", "भाग {i} तैयार है। इसे डाउनलोड करें, फिर अगला भाग टैप करें।"],
    note: ["Tip: tell the story in your own words and credit the movie. Raw movie clips can get copyright claims.",
      "टिप: कहानी अपने शब्दों में बताएँ और मूवी का नाम दें। सिर्फ़ मूवी क्लिप पर कॉपीराइट क्लेम आ सकता है।"],
  };
  const t = (k, v) => { let s = (S[k] || [k, k])[HI ? 1 : 0]; if (v) Object.keys(v).forEach((x) => (s = s.replace("{" + x + "}", v[x]))); return s; };
  const opt = (pairs, sel) => pairs.map(([v, en, hi]) => `<option value="${v}"${v === sel ? " selected" : ""}>${esc(HI ? hi : en)}</option>`).join("");

  const LANGS = [["hi", "Hindi (देवनागरी)", "हिंदी (देवनागरी)"], ["hinglish", "Hinglish (Roman Hindi)", "हिंग्लिश (रोमन हिंदी)"], ["en", "English", "अंग्रेज़ी"]];
  const VOICES = [["Charon", "Male, deep storyteller", "पुरुष, गहरी कहानी वाली आवाज़"], ["Fenrir", "Male, excited", "पुरुष, जोशीली"],
    ["Algenib", "Male, gravelly", "पुरुष, भारी"], ["Kore", "Female, firm", "महिला, दमदार"], ["Leda", "Female, young", "महिला, युवा"]];
  const LOOKS = [["teal", "Dark Teal", "डार्क टील"], ["orange", "Teal and Orange", "टील और ऑरेंज"], ["horror", "Horror", "हॉरर"], ["none", "Original", "ओरिजिनल"]];
  const FITS = [["fill", "Fill screen (crop sides)", "पूरी स्क्रीन (किनारे कटेंगे)"], ["blur", "Full frame on blurred background", "पूरा फ़्रेम, धुंधला बैकग्राउंड"]];
  const LENS = [["45", "45 s", "45 सेकंड"], ["60", "60 s", "60 सेकंड"], ["90", "90 s", "90 सेकंड"], ["120", "2 min", "2 मिनट"], ["170", "3 min", "3 मिनट"]];
  const fmt = (x) => { x = Math.max(0, Math.round(x)); const h = Math.floor(x / 3600), m = Math.floor((x % 3600) / 60), sec = String(x % 60).padStart(2, "0"); return h ? h + ":" + String(m).padStart(2, "0") + ":" + sec : m + ":" + sec; };
  const MOVS = [["0.2", "Low (20%)", "कम (20%)"], ["0.35", "Medium (35%)", "मध्यम (35%)"], ["0", "Off", "बंद"]];

  /* ---------- Gemini with the viewer's key (shared with Long Video to Shorts) ---------- */
  const GK = { K: "lts-gkey", gap: 6500, next: 0, url: "https://generativelanguage.googleapis.com/v1beta/models/",
    text: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"], tts: ["gemini-3.8-flash-lite-tts", "gemini-3.8-flash-tts", "gemini-3.1-flash-tts-preview"] };
  const GH = "x" + "-goog-api-key";
  const keyGet = () => { try { return localStorage.getItem(GK.K) || ""; } catch (e) { return ""; } };
  const keySet = (k) => { try { k ? localStorage.setItem(GK.K, k) : localStorage.removeItem(GK.K); } catch (e) {} };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let CANCEL = false;
  function gErr(st, j) {
    const e = (j && j.error) || {}, msg = String(e.message || ""); let daily = false, wait = 0;
    (e.details || []).forEach((d) => { (d.violations || []).forEach((v) => { if (/PerDay/i.test(String(v.quotaId || ""))) daily = true; }); if (d.retryDelay) wait = Math.ceil(parseFloat(d.retryDelay) || 0) * 1000; });
    if (st === 429 && (daily || /per ?day/i.test(msg))) return { stop: t("day") };
    if (st === 429 || st >= 500) return { wait: wait || 20000 };
    if ((st === 400 && /api key/i.test(msg)) || st === 401 || st === 403) return { stop: t("bad") };
    if (st === 404) return { next: true };
    return { stop: msg ? t("fail") + " (" + msg.slice(0, 120) + ")" : t("fail") };
  }
  async function gemini(models, body, onWait, ms) {
    let mi = 0, waits = 0;
    for (;;) {
      if (CANCEL) throw new Error("cancel");
      const now = Date.now(), at = Math.max(now, GK.next); GK.next = at + GK.gap; if (at > now) await sleep(at - now);
      const ac = new AbortController(), to = setTimeout(() => ac.abort(), ms || 120000);
      let r, j;
      try {
        r = await fetch(GK.url + models[mi] + ":generateContent", { method: "POST", headers: { "Content-Type": "application/json", [GH]: keyGet() }, body, signal: ac.signal });
        j = await r.json().catch(() => null);
      } catch (e) { clearTimeout(to); if (CANCEL) throw new Error("cancel"); throw new Error(t("net")); }
      clearTimeout(to);
      if (r.ok) return j;
      const er = gErr(r.status, j);
      if (er.next && mi < models.length - 1) { mi++; continue; }
      if (er.wait && waits < 3) { waits++; if (onWait) onWait(Math.round(er.wait / 1000)); GK.next = Date.now() + er.wait; continue; }
      throw new Error(er.stop || t("fail"));
    }
  }

  /* ---------- reading the clip: low-quality mono sound + snapshots ---------- */
  function wavBytes(f32, rate) {
    const n = f32.length, b = new ArrayBuffer(44 + n * 2), v = new DataView(b);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, f32[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    return new Uint8Array(b);
  }
  function b64(u8) { let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  async function clipAudio(file, start, len) {
    if (file.size > 400 * 1024 * 1024) return null; // too big to decode safely on a phone
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    const ac = new AC();
    try {
      const buf = await ac.decodeAudioData(await file.arrayBuffer());
      const rate = 16000, s0 = Math.floor(start * buf.sampleRate), s1 = Math.min(buf.length, Math.floor((start + len) * buf.sampleRate));
      if (s1 - s0 < buf.sampleRate) return null;
      const off = new OfflineAudioContext(1, Math.ceil(((s1 - s0) / buf.sampleRate) * rate), rate);
      const part = off.createBuffer(buf.numberOfChannels, s1 - s0, buf.sampleRate);
      for (let c = 0; c < buf.numberOfChannels; c++) part.copyToChannel(buf.getChannelData(c).subarray(s0, s1), c);
      const src = off.createBufferSource(); src.buffer = part; src.connect(off.destination); src.start();
      const out = await off.startRendering();
      return b64(wavBytes(out.getChannelData(0), rate));
    } catch (e) { return null; } finally { try { ac.close(); } catch (e) {} }
  }
  // Full movie mode: never read the whole file. Play just this part (muted to the speakers, 2x speed) and
  // record its sound through Web Audio, then shrink it to 16 kHz mono.
  async function liveAudio(url, start, len, onProg) {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC || !window.OfflineAudioContext) return null;
    const v = document.createElement("video"); v.playsInline = true; v.preload = "auto"; v.src = url;
    const ac = new AC(), SPEED = 2; let sp = null;
    try {
      await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error("x")); setTimeout(res, 8000); });
      await seek(v, start);
      const src = ac.createMediaElementSource(v), sink = ac.createGain(); sink.gain.value = 0;
      sp = ac.createScriptProcessor(4096, 2, 1); const bits = []; let on = false, got = 0;
      sp.onaudioprocess = (e) => { if (!on) return; const ib = e.inputBuffer, n = ib.length, m = new Float32Array(n), ch = ib.numberOfChannels;
        for (let c = 0; c < ch; c++) { const d = ib.getChannelData(c); for (let i = 0; i < n; i++) m[i] += d[i] / ch; } bits.push(m); got += n; };
      src.connect(sp); sp.connect(sink); sink.connect(ac.destination);
      await ac.resume(); v.playbackRate = SPEED; await v.play(); on = true;
      const end = start + len, limit = Date.now() + (len / SPEED) * 1000 + 30000;
      while (!v.ended && v.currentTime < end && Date.now() < limit) {
        if (CANCEL) throw new Error("cancel");
        if (onProg) onProg(Math.min(99, Math.round(((v.currentTime - start) / len) * 100))); await sleep(250);
      }
      on = false; v.pause();
      if (got < ac.sampleRate) return null;
      const all = new Float32Array(got); let o = 0; bits.forEach((b) => { all.set(b, o); o += b.length; });
      let e = 0; for (let i = 0; i < all.length; i += 16) e += all[i] * all[i]; if (e / (all.length / 16) < 1e-7) return null; // silent: the browser gave no sound
      const rate = 16000, off = new OfflineAudioContext(1, Math.ceil((got / ac.sampleRate) * rate), rate), b = off.createBuffer(1, got, ac.sampleRate);
      b.copyToChannel(all, 0); const s = off.createBufferSource(); s.buffer = b; s.connect(off.destination); s.start();
      return b64(wavBytes((await off.startRendering()).getChannelData(0), rate));
    } catch (e) { if (e && e.message === "cancel") throw e; return null; }
    finally { try { v.pause(); } catch (e) {} if (sp) sp.onaudioprocess = null; v.removeAttribute("src"); v.load(); try { ac.close(); } catch (e) {} }
  }
  function seek(v, s) { return new Promise((res) => { const d = () => { v.removeEventListener("seeked", d); res(); }; v.addEventListener("seeked", d); v.currentTime = Math.max(0, s); setTimeout(d, 4000); }); }
  async function snapshots(url, start, len, n) {
    const v = document.createElement("video"); v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error(t("playErr"))); setTimeout(res, 8000); });
    const W = 448, H = Math.round(W * (v.videoHeight || 9) / (v.videoWidth || 16)), c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d"), out = [];
    for (let i = 0; i < n; i++) {
      const at = start + (len * (i + 0.5)) / n; await seek(v, at);
      g.drawImage(v, 0, 0, W, H); out.push({ at: at - start, data: c.toDataURL("image/jpeg", 0.7).split(",")[1] });
    }
    v.removeAttribute("src"); v.load();
    return out;
  }

  /* ---------- the story script ---------- */
  const SCHEMA = { type: "OBJECT", properties: { hook_title: { type: "STRING" }, lines: { type: "ARRAY", items: { type: "STRING" } },
    post_title: { type: "STRING" }, hashtags: { type: "ARRAY", items: { type: "STRING" } } }, required: ["hook_title", "lines", "post_title", "hashtags"] };
  const SCHEMA_M = JSON.parse(JSON.stringify(SCHEMA)); SCHEMA_M.properties.story_so_far = { type: "STRING" }; SCHEMA_M.required.push("story_so_far");
  function partPrompt(q) {
    const P = q.part; if (!P) return "";
    return "\nFULL MOVIE MODE: this clip is part " + P.i + " of " + P.n + " of one movie, from " + fmt(P.a) + " to " + fmt(P.b) + " of the movie." +
      (q.sped ? " The clip sound is played at 2x speed, so voices sound fast." : "") + "\n" +
      (P.sofar ? "Story so far, from the earlier parts (keep the same narrator, characters and names, and do not retell it):\n" + P.sofar + "\n" +
        "Continue the story from there. Line 1 is still a hook, but it pulls viewers into this part (it may refer back in a few words).\n"
        : (P.i === 1 ? "This is the first part: introduce the main characters clearly.\n" : "")) +
      (P.i >= P.n ? "This is the LAST part: end with the ending of the story, not a tease for more.\n" : "End on a cliffhanger that makes people want part " + (P.i + 1) + ".\n") +
      "Also return story_so_far: 2 to 4 short English sentences summing up the whole story up to the end of this part (earlier parts plus this one), naming or describing the main characters, so the next part can continue it.\n";
  }
  function storyPrompt(q) {
    const L = q.lang === "hi" ? "Hindi in Devanagari script, simple everyday spoken Hindi (the way Indian story narrators speak, common English words allowed)"
      : q.lang === "hinglish" ? "Hinglish: Hindi written in Roman letters mixed with simple English, never Devanagari" : "simple spoken English";
    const words = Math.round(q.len * (q.lang === "en" ? 2.5 : 2.3));
    return "You write viral 'movie story recap' narration for YouTube Shorts and Instagram Reels, like the top Hindi recap channels.\n\n" +
      "You get the sound of a " + Math.round(q.len) + "-second movie or series clip (if available) and " + q.frames + " snapshots in time order." +
      " Movie or series name typed by the creator: " + (q.title || "not given") + ".\n\n" +
      "Write a narration that retells what happens in this clip as a gripping story, in the creator's own words. Do NOT translate or copy the dialogue.\n" +
      "Rules:\n" +
      "1. Narrate in FIRST PERSON as if the narrator lived it, or as a close storyteller ('Ek ladki thi jo...'), whichever fits the scene best.\n" +
      "2. Line 1 is the hook: a strange, specific, shocking detail about a person, with no setup and no greeting. Example style: 'I knew an 80-year-old grandmother who dressed up every day to attract young boys.' / 'Before opening any coffin, I always tasted a little soil first.'\n" +
      "3. Every 10 to 15 seconds add a cliffhanger line that starts like 'But...' / 'Lekin...' / 'Par tabhi...' and teases what comes next.\n" +
      "4. Short spoken lines of 6 to 14 words each, one idea per line, no pauses, fast pace. About " + words + " words in total so it fills about " + Math.round(q.len) + " seconds when read fast.\n" +
      "5. End on a twist or a question that makes people want part 2.\n" +
      "6. No hashtags, emojis, stage directions, brackets or speaker names inside lines. Don't invent real actor names.\n" +
      "7. Write all lines, the hook title and the post title in " + L + ".\n\n" +
      "Return JSON:\n- hook_title: on-screen hook for the first 3 seconds, at most 45 characters.\n- lines: the narration lines in order.\n" +
      "- post_title: a catchy Shorts title, at most 70 characters.\n- hashtags: 5 to 8 hashtags without the # sign.\n" + partPrompt(q);
  }
  async function writeStory(q, audio, frames, onWait) {
    const parts = [{ text: storyPrompt(Object.assign({}, q, { frames: frames.length })) }];
    if (audio) parts.push({ text: "Clip sound:" }, { inline_data: { mime_type: "audio/wav", data: audio } });
    frames.forEach((f) => parts.push({ text: "Snapshot at " + f.at.toFixed(1) + " s:" }, { inline_data: { mime_type: "image/jpeg", data: f.data } }));
    const body = JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json", responseSchema: q.part ? SCHEMA_M : SCHEMA, temperature: 0.9, maxOutputTokens: 4096 } });
    const j = await gemini(GK.text, body, onWait, 150000);
    try {
      const o = JSON.parse(j.candidates[0].content.parts.map((p) => p.text || "").join(""));
      return { hook: String(o.hook_title || "").trim(), lines: (o.lines || []).map((s) => String(s).replace(/[#*_\[\]()]/g, "").trim()).filter(Boolean),
        title: String(o.post_title || "").trim(), sum: String(o.story_so_far || "").trim(), tags: (o.hashtags || []).map((h) => "#" + String(h).replace(/^#+/, "").replace(/\s+/g, "")).filter((h) => h.length > 1) };
    } catch (e) { throw new Error(t("fail")); }
  }

  /* ---------- the voice ---------- */
  function pcmToWav(u8, rate) { // raw 16-bit LE mono PCM -> WAV
    const n = u8.length, b = new Uint8Array(44 + n), v = new DataView(b.buffer);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
    w(0, "RIFF"); v.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n, true); b.set(u8, 44);
    return b;
  }
  function chunks(lines, max) { const out = []; let cur = []; let n = 0; lines.forEach((l) => { if (cur.length && n + l.length > max) { out.push(cur); cur = []; n = 0; } cur.push(l); n += l.length + 1; }); if (cur.length) out.push(cur); return out; }
  // Where each line starts inside one spoken chunk: guess by length, then snap to the quietest spot nearby.
  function lineTimes(buf, lines) {
    const d = buf.getChannelData(0), sr = buf.sampleRate, win = Math.round(sr * 0.04), dur = buf.duration;
    const energy = (tt) => { const a = Math.max(0, Math.round(tt * sr) - win), b = Math.min(d.length, a + 2 * win); let s = 0; for (let i = a; i < b; i += 4) s += d[i] * d[i]; return s; };
    let lead = 0; while (lead < dur - 0.2 && energy(lead) < 1e-4) lead += 0.02; // skip silence at the start
    const tot = lines.reduce((a, l) => a + l.length, 0) || 1, out = []; let acc = 0;
    lines.forEach((l, i) => {
      let at = lead + (dur - lead) * (acc / tot);
      if (i > 0) { let best = at, be = Infinity; for (let x = at - 0.6; x <= at + 0.6; x += 0.03) { if (x <= out[i - 1] + 0.3 || x >= dur) continue; const e = energy(x); if (e < be) { be = e; best = x; } } at = best; }
      out.push(i === 0 ? lead : at); acc += l.length;
    });
    return out;
  }
  async function makeVoice(lines, voice, onStep, onWait) {
    const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(), parts = chunks(lines, 700), bufs = [], timing = [];
    try {
      for (let i = 0; i < parts.length; i++) {
        onStep(i + 1, parts.length);
        const body = JSON.stringify({ contents: [{ role: "user", parts: [{ text: parts[i].join("\n") }] }],
          generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } } } });
        const j = await gemini(GK.tts, body, onWait, 180000);
        const p = (((j.candidates || [])[0] || {}).content || {}).parts || [], a = p.find((x) => x.inlineData || x.inline_data);
        if (!a) throw new Error(t("fail"));
        const id = a.inlineData || a.inline_data, mt = String(id.mimeType || id.mime_type || ""), raw = Uint8Array.from(atob(id.data), (c) => c.charCodeAt(0));
        const isWav = /wav/i.test(mt) || (raw[0] === 82 && raw[1] === 73 && raw[2] === 70 && raw[3] === 70);
        const rate = +((mt.match(/rate=(\d+)/) || [])[1] || 24000);
        const buf = await ac.decodeAudioData((isWav ? raw : pcmToWav(raw, rate)).buffer);
        bufs.push(buf); timing.push(lineTimes(buf, parts[i]));
      }
      // join the chunks with a short breath between them
      const sr = bufs[0].sampleRate, gap = Math.round(sr * 0.15), total = bufs.reduce((a, b) => a + b.length + gap, 0);
      const out = ac.createBuffer(1, total, sr), od = out.getChannelData(0), starts = []; let pos = 0;
      bufs.forEach((b, i) => { od.set(b.getChannelData(0), pos); timing[i].forEach((x) => starts.push(pos / sr + x)); pos += b.length + gap; });
      return { buf: out, starts, lines: [].concat(...parts) };
    } finally { try { ac.close(); } catch (e) {} }
  }

  /* ---------- rendering the Short on this device ---------- */
  // Colour looks use blend fills only (a canvas filter is too slow per frame on phones).
  const LOOK = {
    teal: { fills: [["soft-light", "rgba(0,105,125,0.65)"]], v: 0.6 },
    orange: { fills: [["soft-light", "rgba(255,140,60,0.45)"]], top: "rgba(0,110,130,0.45)", v: 0.5 },
    horror: { fills: [["color", "rgba(60,95,80,0.45)"]], v: 0.8 },
    none: { fills: [], v: 0 },
  };
  function pickMime() {
    const L = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    return window.MediaRecorder ? L.find((m) => MediaRecorder.isTypeSupported(m)) || "" : "";
  }
  function wrap(g, text, max) {
    const words = text.split(/\s+/), out = []; let cur = "";
    words.forEach((w) => { const x = cur ? cur + " " + w : w; if (g.measureText(x).width > max && cur) { out.push(cur); cur = w; } else cur = x; });
    if (cur) out.push(cur); return out;
  }
  function capChunks(lines, starts, end) { // 3-word caption pieces with their own times
    const out = [];
    lines.forEach((l, i) => {
      const a = starts[i], b = i + 1 < starts.length ? starts[i + 1] : end, w = l.split(/\s+/).filter(Boolean), n = Math.max(1, Math.ceil(w.length / 3));
      const per = w.map((x) => x.length + 1), tot = per.reduce((s, x) => s + x, 0) || 1; let acc = 0;
      for (let k = 0; k < n; k++) {
        const piece = w.slice(k * 3, k * 3 + 3), len = per.slice(k * 3, k * 3 + 3).reduce((s, x) => s + x, 0);
        out.push({ s: a + (b - a) * (acc / tot), e: a + (b - a) * ((acc + len) / tot), text: piece.join(" ") }); acc += len;
      }
    });
    return out;
  }
  async function render(o, onProg) {
    const mime = pickMime(); if (!mime) throw new Error(t("noRec"));
    const W = 1080, H = 1920, FONT = '"Noto Sans Devanagari","Nirmala UI","Mangal",system-ui,sans-serif';
    const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d");
    const bg = document.createElement("canvas"); bg.width = 54; bg.height = 96; const bgg = bg.getContext("2d");
    const v = document.createElement("video"); v.playsInline = true; v.preload = "auto"; v.src = o.url; v.crossOrigin = "anonymous";
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error(t("playErr"))); setTimeout(res, 8000); });
    const AC = window.AudioContext || window.webkitAudioContext, ac = new AC(); await ac.resume();
    const dest = ac.createMediaStreamDestination(), vs = ac.createMediaElementSource(v), vg = ac.createGain(); vs.connect(vg).connect(dest);
    const ns = ac.createBufferSource(); ns.buffer = o.voice.buf; const ng = ac.createGain(); ng.gain.value = 1; ns.connect(ng).connect(dest);
    const total = o.voice.buf.duration + 0.6, caps = capChunks(o.voice.lines, o.voice.starts, o.voice.buf.duration), lk = LOOK[o.look] || LOOK.none;
    let topGrad = null; if (lk.top) { topGrad = g.createLinearGradient(0, 0, 0, H); topGrad.addColorStop(0, lk.top); topGrad.addColorStop(1, "rgba(0,0,0,0)"); }
    let vig = null; if (lk.v) { vig = document.createElement("canvas"); vig.width = W; vig.height = H; const vg2 = vig.getContext("2d"), rg = vg2.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72); rg.addColorStop(0, "rgba(0,0,0,0)"); rg.addColorStop(1, "rgba(0,0,0," + lk.v + ")"); vg2.fillStyle = rg; vg2.fillRect(0, 0, W, H); }
    const stream = c.captureStream(30); dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8000000, audioBitsPerSecond: 160000 }), parts = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) parts.push(e.data); };
    let wake = null; try { wake = await navigator.wakeLock.request("screen"); } catch (e) {}
    await seek(v, o.start); v.volume = 1;
    function draw(now) {
      const vw = v.videoWidth || 16, vh = v.videoHeight || 9;
      g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
      if (o.fit === "blur") {
        bgg.drawImage(v, 0, 0, 54, 96); g.drawImage(bg, 0, 0, W, H); g.fillStyle = "rgba(0,0,0,0.45)"; g.fillRect(0, 0, W, H);
        const fh = W * vh / vw; g.drawImage(v, 0, (H - fh) / 2, W, fh);
      } else {
        const sc = Math.max(W / vw, H / vh), dw = vw * sc, dh = vh * sc; g.drawImage(v, (W - dw) / 2, (H - dh) / 2, dw, dh);
      }
      if (lk.fills.length) { g.save(); lk.fills.forEach(([op, col]) => { g.globalCompositeOperation = op; g.fillStyle = col; g.fillRect(0, 0, W, H); });
        if (topGrad) { g.globalCompositeOperation = "soft-light"; g.fillStyle = topGrad; g.fillRect(0, 0, W, H); } g.restore(); }
      if (vig) g.drawImage(vig, 0, 0);
      if (o.hook && now < 3.2) { // hook title
        g.font = "800 66px " + FONT; const ls = wrap(g, o.hook, W - 160), lh = 84, bh = ls.length * lh + 44, y0 = 250;
        g.fillStyle = "rgba(255,255,255,0.96)"; g.beginPath(); (g.roundRect ? g.roundRect(60, y0, W - 120, bh, 26) : g.rect(60, y0, W - 120, bh)); g.fill();
        g.fillStyle = "#111"; g.textAlign = "center"; g.textBaseline = "middle"; ls.forEach((l, i) => g.fillText(l, W / 2, y0 + 22 + lh / 2 + i * lh));
      }
      const cp = caps.find((x) => now >= x.s && now < x.e);
      if (cp) {
        g.font = "900 84px " + FONT; g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
        const ls = wrap(g, cp.text, W - 140), lh = 104, y0 = 1330 - ((ls.length - 1) * lh) / 2;
        ls.forEach((l, i) => { g.lineWidth = 16; g.strokeStyle = "#000"; g.strokeText(l, W / 2, y0 + i * lh); g.fillStyle = i === 0 ? "#FFE14D" : "#fff"; g.fillText(l, W / 2, y0 + i * lh); });
      }
    }
    return await new Promise((resolve, reject) => {
      let t0 = 0, raf = 0, done = false;
      const end = o.start + o.len;
      function finish(err) {
        if (done) return; done = true; cancelAnimationFrame(raf);
        try { v.pause(); } catch (e) {} try { ns.stop(); } catch (e) {}
        if (wake) wake.release().catch(() => {});
        if (rec.state !== "inactive") rec.stop(); else resolve(null);
        rec.onstop = () => { try { ac.close(); } catch (e) {} err ? reject(err) : resolve(new Blob(parts, { type: mime.split(";")[0] })); };
      }
      function tick() {
        if (CANCEL) return finish(new Error("cancel"));
        const now = ac.currentTime - t0;
        if (v.currentTime >= end - 0.05 || v.ended) { v.currentTime = o.start; v.play().catch(() => {}); } // loop the clip under a longer story
        draw(now); onProg(Math.min(99, Math.round((now / total) * 100)));
        if (now >= total) return finish();
        raf = requestAnimationFrame(tick);
      }
      // movie sound: ducked under the voice, back up for the last half second
      const base = +o.movie;
      v.play().then(() => {
        rec.start(1000); t0 = ac.currentTime + 0.05; ns.start(t0);
        vg.gain.setValueAtTime(base, t0);
        vg.gain.setTargetAtTime(Math.min(1, base * 2.5), t0 + o.voice.buf.duration, 0.2);
        tick();
      }, () => finish(new Error(t("playErr"))));
    });
  }

  /* ---------- UI ---------- */
  const css = document.createElement("style");
  css.textContent = `.x-sn [hidden]{display:none!important}.x-sn h2{font-size:18px;margin:18px 0 10px;color:var(--navy)}.x-sn h2:first-child{margin-top:0}
.x-sn .x-sng{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.x-sn input[type=text],.x-sn input[type=number],.x-sn input[type=password],.x-sn textarea,.x-sn select{width:100%;min-height:46px;padding:10px 12px;border-radius:12px;border:1.5px solid var(--line);font:inherit;box-sizing:border-box;background:var(--card,#fff);color:inherit}
.x-sn textarea{min-height:200px;resize:vertical;line-height:1.5}.x-sn input[type=file]{width:100%;min-width:0;max-width:100%;box-sizing:border-box}.x-sn label{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;font-size:14px;font-weight:600;min-width:0}
.x-sn .x-snrow{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:12px}.x-sn .x-snkey{padding:14px;border-radius:16px;background:var(--soft);margin-bottom:6px}
.x-sn .x-snkey p{margin:0 0 10px;font-size:14px}.x-sn video,.x-sn audio{width:100%;max-height:360px;border-radius:14px;background:#000;margin-top:10px}
.x-sn .x-snout video{max-height:520px;aspect-ratio:9/16;object-fit:contain}
.x-sn .x-snprog{display:flex;align-items:center;gap:10px;font-size:14px;margin:12px 0 0}.x-sn .x-snprog i{width:18px;height:18px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--blue,#2563ff);animation:xsnspin 1s linear infinite;flex:none}
@keyframes xsnspin{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.x-sn .x-snprog i{animation:none}}
.x-sn .x-snmode{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:4px;border-radius:14px;background:var(--soft);margin-bottom:12px}
.x-sn .x-snmode button{min-height:42px;border:0;border-radius:11px;background:transparent;font:inherit;font-weight:600;font-size:14px;color:inherit;cursor:pointer;padding:6px 8px;line-height:1.25}
.x-sn .x-snmode button[aria-checked=true]{background:var(--cta,#2563ff);color:#fff;box-shadow:0 1px 3px rgba(0,0,0,.2)}.x-sn .x-snmode button:disabled{opacity:.6;cursor:default}
.x-sn .x-snparts{margin-top:12px;padding:14px;border-radius:16px;border:1.5px solid var(--line)}.x-sn .x-snparts b{font-size:17px;color:var(--navy)}
.x-sn .x-snparts .x-snat{font-size:14px;color:var(--muted);margin-left:8px;white-space:nowrap}.x-sn .x-snparts p{margin:8px 0 0;font-size:13px;color:var(--muted)}
.x-sn .x-snparts label{margin-top:10px}
.x-sn .x-btn{min-height:46px}.x-sn .x-snnote{font-size:13px;color:var(--muted);margin-top:14px}`;
  document.head.appendChild(css);

  mount.innerHTML = `<div class="x-ws x-sn">
    <div class="x-snkey"><h2>${esc(t("keyH"))}</h2><p>${esc(t("keyP"))}</p>
      <div data-k="no"><div class="x-snrow"><input type="password" data-k="in" autocomplete="off" spellcheck="false" placeholder="${esc(t("keyPh"))}" aria-label="${esc(t("keyH"))}">
        <button type="button" class="x-btn x-primary" data-k="save">${esc(t("keySave"))}</button>
        <a class="x-btn" href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">${esc(t("keyGet"))}</a></div></div>
      <div class="x-snrow" data-k="yes" hidden><span>${esc(t("keyOk"))}</span><button type="button" class="x-btn" data-k="chg">${esc(t("keyChange"))}</button></div></div>
    <h2>${esc(t("f1"))}</h2>
    <div class="x-snmode" role="radiogroup" aria-label="${esc(t("mode"))}"><button type="button" role="radio" aria-checked="true" data-k="m1">${esc(t("m1"))}</button><button type="button" role="radio" aria-checked="false" data-k="m2">${esc(t("m2"))}</button></div>
    <label><span data-k="fileL">${esc(t("file"))}</span><input type="file" data-k="file" accept="video/mp4,video/quicktime,video/webm,video/x-matroska,.mp4,.mov,.webm,.mkv"></label>
    <video data-k="prev" controls playsinline hidden></video>
    <div class="x-sng" style="margin-top:12px">
      <label data-k="startL">${esc(t("start"))}<input type="number" data-k="start" min="0" step="1" value="0" inputmode="numeric"></label>
      <label><span data-k="lenL">${esc(t("len"))}</span><select data-k="len">${opt(LENS, "60")}</select></label>
      <label>${esc(t("lang"))}<select data-k="lang">${opt(LANGS, "hi")}</select></label>
      <label>${esc(t("voice"))}<select data-k="voice">${opt(VOICES, "Charon")}</select></label>
      <label>${esc(t("look"))}<select data-k="look">${opt(LOOKS, "teal")}</select></label>
      <label>${esc(t("fit"))}<select data-k="fit">${opt(FITS, "fill")}</select></label>
      <label>${esc(t("mov"))}<select data-k="movie">${opt(MOVS, "0.2")}</select></label>
    </div>
    <label style="margin-top:12px">${esc(t("name"))}<input type="text" data-k="title" maxlength="80" placeholder="${esc(t("namePh"))}"></label>
    <div class="x-snparts" data-k="parts" hidden><div><b data-k="pof"></b><span class="x-snat" data-k="pat"></span></div>
      <p data-k="phint">${esc(t("mHint"))}</p>
      <label>${esc(t("goPart"))}<select data-k="pick"></select></label>
      <div class="x-snrow"><button type="button" class="x-btn x-primary" data-k="narr"></button></div></div>
    <h2>${esc(t("f2"))}</h2>
    <div class="x-snrow"><button type="button" class="x-btn x-primary" data-k="write">${ic("edit", 20)} ${esc(t("write"))}</button></div>
    <label style="margin-top:12px">${esc(t("hook"))}<input type="text" data-k="hook" maxlength="60"></label>
    <label style="margin-top:12px">${esc(t("lines"))}<textarea data-k="lines" spellcheck="false"></textarea></label>
    <label style="margin-top:12px">${esc(t("post"))}<textarea data-k="post" style="min-height:72px"></textarea></label>
    <div class="x-snrow"><button type="button" class="x-btn" data-k="copy">${esc(t("copy"))}</button></div>
    <h2>${esc(t("f3"))}</h2>
    <div class="x-snrow"><button type="button" class="x-btn x-primary" data-k="tts">${ic("play", 20)} ${esc(t("mkVoice"))}</button>
      <button type="button" class="x-btn x-primary" data-k="make">${ic("video", 20)} ${esc(t("mkVideo"))}</button>
      <button type="button" class="x-btn" data-k="stop" hidden>${esc(t("stop"))}</button></div>
    <audio data-k="aud" controls hidden></audio>
    <p class="x-snprog" aria-live="polite" hidden><i aria-hidden="true"></i><span></span></p>
    <p class="x-err" role="alert" hidden></p>
    <div class="x-snout" hidden><video data-k="out" controls playsinline></video>
      <div class="x-snrow"><a class="x-btn x-primary" data-k="dl" download>${ic("download", 20)} ${esc(t("dl"))}</a>
      <button type="button" class="x-btn x-primary" data-k="next" hidden>${esc(t("nextP"))}</button></div></div>
    <p class="x-snnote">${esc(t("note"))}</p></div>`;

  const $ = (k) => mount.querySelector(`[data-k="${k}"]`);
  const prog = mount.querySelector(".x-snprog"), ptxt = prog.querySelector("span"), err = mount.querySelector(".x-err"), outBox = mount.querySelector(".x-snout");
  const st = { file: null, url: "", dur: 0, voice: null, outUrl: "", audUrl: "", busy: false, movie: false, pi: 0, sums: [] };
  const say = (m) => { prog.hidden = !m; ptxt.textContent = m || ""; };
  const oops = (m) => { err.hidden = !m; err.textContent = m || ""; };
  function keyUI() { const k = !!keyGet(); $("no").hidden = k; $("yes").hidden = !k; }
  keyUI();
  $("save").onclick = () => { const k = $("in").value.trim(); if (k) { keySet(k); $("in").value = ""; keyUI(); oops(""); } };
  $("chg").onclick = () => { keySet(""); keyUI(); $("in").focus(); };
  $("file").onchange = () => {
    const f = $("file").files[0]; if (!f) return;
    if (st.url) URL.revokeObjectURL(st.url);
    st.file = f; st.url = URL.createObjectURL(f); st.voice = null; $("aud").hidden = true; outBox.hidden = true;
    const p = $("prev"); p.src = st.url; p.hidden = false; p.onloadedmetadata = () => { st.dur = isFinite(p.duration) ? p.duration : 0; $("start").max = Math.max(0, Math.floor(st.dur - 5)); partsUI(); };
    st.pi = 0; st.sums = []; $("hook").value = ""; $("lines").value = ""; $("post").value = ""; partsUI();
    oops("");
  };
  $("prev").addEventListener("pause", () => { const p = $("prev"); if (!st.movie && p.currentTime > 0 && !st.busy) $("start").value = Math.floor(p.currentTime); });
  /* ---------- Full movie mode: the movie is split into parts by time; each part is seeked to, never cut out of the file ---------- */
  function partList() {
    const L = +$("len").value, d = st.dur; if (!d) return [];
    let n = Math.max(1, Math.ceil(d / L)); if (n > 1 && d - (n - 1) * L < 15) n--; // a tiny tail joins the last part
    const out = []; for (let i = 0; i < n; i++) out.push({ a: i * L, b: i === n - 1 ? d : (i + 1) * L }); return out;
  }
  function partsUI() {
    const P = partList(), on = st.movie; $("parts").hidden = !on || !P.length; $("startL").hidden = on;
    $("fileL").textContent = t(on ? "fileM" : "file"); $("lenL").textContent = t(on ? "lenM" : "len");
    $("m1").setAttribute("aria-checked", String(!on)); $("m2").setAttribute("aria-checked", String(on));
    $("next").hidden = !on || st.pi >= P.length - 1 || outBox.hidden;
    if (!on || !P.length) return;
    st.pi = Math.min(st.pi, P.length - 1); const p = P[st.pi]; st.pa = p.a;
    $("pof").textContent = t("partOf", { i: st.pi + 1, n: P.length }); $("pat").textContent = t("partAt", { a: fmt(p.a), b: fmt(p.b) });
    $("narr").innerHTML = ic("edit", 20) + " " + esc(t("narr", { i: st.pi + 1 }));
    const sel = $("pick"); if (sel.options.length !== P.length || sel.dataset.len !== $("len").value) {
      sel.dataset.len = $("len").value;
      sel.innerHTML = P.map((x, i) => `<option value="${i}">${esc(t("partOf", { i: i + 1, n: P.length }) + " (" + fmt(x.a) + ")")}</option>`).join("");
    }
    sel.value = String(st.pi);
    $("phint").textContent = sofar(p.a) ? t("sofar") : t("mHint");
  }
  function sofar(at) { // the newest story summary from a part that ends at or before this one starts
    const s = st.sums.filter((x) => x.b <= at + 1).sort((x, y) => y.b - x.b)[0]; return s ? s.text.slice(0, 900) : "";
  }
  function setMode(on) { if (st.busy) return; st.movie = on; partsUI(); }
  $("m1").onclick = () => setMode(false); $("m2").onclick = () => setMode(true);
  function goPart(i) {
    st.pi = i; st.voice = null; $("aud").hidden = true; outBox.hidden = true;
    $("hook").value = ""; $("lines").value = ""; $("post").value = ""; oops(""); say("");
    const p = partList()[i]; if (p) { $("prev").pause(); $("prev").currentTime = p.a; }
    partsUI();
  }
  $("pick").onchange = () => goPart(+$("pick").value);
  $("len").addEventListener("change", () => { if (!st.movie) return; st.voice = null; const at = st.pa || 0; st.pi = Math.max(0, Math.floor(at / +$("len").value)); partsUI(); });
  ["lines", "voice"].forEach((k) => $(k).addEventListener("input", () => { st.voice = null; }));
  $("voice").addEventListener("change", () => { st.voice = null; });
  function range() {
    if (st.movie) { const P = partList(), p = P[st.pi]; if (p) return { start: p.a, len: Math.max(5, p.b - p.a), part: { i: st.pi + 1, n: P.length, a: p.a, b: p.b } }; }
    const len = +$("len").value, s = Math.max(0, +$("start").value || 0), d = st.dur || len;
    const start = Math.min(s, Math.max(0, d - 5)); return { start, len: Math.max(5, Math.min(len, d - start)) };
  }
  const lines = () => $("lines").value.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  function busy(on) { st.busy = on; ["write", "tts", "make", "narr", "next", "pick"].concat(st.movie ? ["len", "file", "m1", "m2"] : []).forEach((k) => ($(k).disabled = on)); $("stop").hidden = !on; if (!on) CANCEL = false; }
  $("stop").onclick = () => { CANCEL = true; };
  const waitMsg = (s) => say(t("busy", { s }));
  const fail = (e) => { say(""); if (e && e.message !== "cancel") oops(e.message || t("fail")); };

  async function doWrite() {
    const r = range(), P = r.part;
    let audio;
    if (P) { say(t("listen", { p: 0 })); audio = await liveAudio(st.url, r.start, r.len, (p) => say(t("listen", { p }))); }
    else { say(t("readA")); audio = await clipAudio(st.file, r.start, r.len); }
    say(t("readF")); const frames = await snapshots(st.url, r.start, r.len, audio ? 8 : 12);
    if (!audio) oops(t("noAudio"));
    say(t("aiW"));
    const q = { title: $("title").value.trim(), lang: $("lang").value, len: r.len };
    if (P) { q.part = Object.assign({ sofar: sofar(P.a) }, P); q.sped = !!audio; }
    const s = await writeStory(q, audio, frames, waitMsg);
    let title = s.title; if (P && P.n > 1) title = title.replace(/\s*[|:-]?\s*(part|पार्ट|भाग)\s*\d+\s*$/i, "") + " | " + ($("lang").value === "hi" ? "पार्ट " : "Part ") + P.i;
    $("hook").value = s.hook; $("lines").value = s.lines.join("\n"); $("post").value = (title + "\n\n" + s.tags.join(" ")).trim();
    if (P) { st.sums = st.sums.filter((x) => x.a !== P.a); st.sums.push({ a: P.a, b: P.b, text: s.sum || s.lines.join(" ").slice(0, 600) }); }
    st.voice = null; say("");
  }
  $("write").onclick = async () => {
    oops(""); if (!keyGet()) return oops(t("noKey")); if (!st.file) return oops(t("noFile"));
    busy(true);
    try { await doWrite(); } catch (e) { fail(e); } finally { busy(false); }
  };
  $("copy").onclick = () => {
    const b = $("copy"), v = $("post").value; const done = () => { b.textContent = t("copied"); setTimeout(() => (b.textContent = t("copy")), 1500); };
    (navigator.clipboard && window.isSecureContext ? navigator.clipboard.writeText(v) : Promise.reject()).then(done, () => { $("post").select(); try { document.execCommand("copy"); done(); } catch (e) {} });
  };
  async function ensureVoice() {
    if (st.voice) return st.voice;
    const ls = lines(); if (!ls.length) throw new Error(t("noLines")); if (!keyGet()) throw new Error(t("noKey"));
    st.voice = await makeVoice(ls, $("voice").value, (i, n) => say(t("ttsW", { i, n })), waitMsg);
    const wav = wavBytes(st.voice.buf.getChannelData(0), st.voice.buf.sampleRate);
    if (st.audUrl) URL.revokeObjectURL(st.audUrl); st.audUrl = URL.createObjectURL(new Blob([wav], { type: "audio/wav" }));
    $("aud").src = st.audUrl; $("aud").hidden = false;
    return st.voice;
  }
  $("tts").onclick = async () => {
    oops(""); busy(true);
    try { const v = await ensureVoice(); say(t("voiceOk", { s: v.buf.duration.toFixed(1) })); } catch (e) { fail(e); } finally { busy(false); }
  };
  async function doMake() {
      const voice = await ensureVoice(), r = range();
      $("aud").pause(); $("prev").pause();
      say(t("rend", { p: 0 }));
      const blob = await render({ url: st.url, start: r.start, len: r.len, voice, hook: $("hook").value.trim(), look: $("look").value, fit: $("fit").value, movie: $("movie").value },
        (p) => say(t("rend", { p })));
      if (!blob) throw new Error(t("fail"));
      if (st.outUrl) URL.revokeObjectURL(st.outUrl); st.outUrl = URL.createObjectURL(blob);
      $("out").src = st.outUrl; const ext = /mp4/.test(blob.type) ? "mp4" : "webm";
      $("dl").href = st.outUrl; $("dl").download = "story-short-" + (r.part ? "part-" + String(r.part.i).padStart(2, "0") + "-" : "") + Date.now() + "." + ext;
      outBox.hidden = false;
      if (r.part) { say(r.part.i >= r.part.n ? t("lastP") : t("doneP", { i: r.part.i })); partsUI(); } else say(t("done"));
      outBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  $("make").onclick = async () => {
    oops(""); if (!st.file) return oops(t("noFile"));
    busy(true);
    try { await doMake(); } catch (e) { fail(e); } finally { busy(false); }
  };
  async function narrate() { // one tap: write the story, make the voice, make the Short
    oops(""); if (!keyGet()) return oops(t("noKey")); if (!st.file) return oops(t("noFile"));
    busy(true);
    try { await doWrite(); await doMake(); } catch (e) { fail(e); } finally { busy(false); partsUI(); }
  }
  $("narr").onclick = narrate;
  $("next").onclick = () => { const P = partList(); if (st.busy || st.pi >= P.length - 1) return; goPart(st.pi + 1); $("parts").scrollIntoView({ behavior: "smooth", block: "start" }); narrate(); };
})();
