#!/usr/bin/env python3
"""Generate the static Toolsaku site: one page per tool, the home page, info pages,
404.html, sitemap.xml, robots.txt and assets/js/routes.js.

Usage (from the repository root):  python3 tools/build.py

Content lives in tools/tools.json (one entry per tool: slug, SEO copy, steps, FAQ,
related tools) and tools/site.json (categories, icons, home copy, info pages).
Every link and asset path in the generated HTML is relative, so the same files work at a
domain root (Netlify, custom domain) and under a subpath (GitHub Pages /Toolfree/).
Only canonical / Open Graph / sitemap URLs are absolute, built from BASE_URL.
Standard library only; no dependencies.
"""
import html
import re
import json
import os
import hashlib

# ---- Settings -------------------------------------------------------------------------
BASE_URL = "https://toolsak.online"  # the live domain; change and re-run if it ever moves
LASTMOD = "2026-11-17"                         # <lastmod> written to sitemap.xml
LASTMOD_TEXT = "16 Nov 2026"                   # the same date as shown on guide pages
SITE_NAME = "Toolsaku"
# Subpaths the site may be served under (for 404.html, which can be shown at any depth).
# A request path starting with one of these resolves 404 assets from that prefix, otherwise "/".
SUBPATH_PREFIXES = ["/Toolfree/"]
VER = ""  # set in main(): cache-busting hash of the CSS/JS
# ---------------------------------------------------------------------------------------

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(HERE)
BASE = BASE_URL.rstrip("/") + "/"
TOOLS = json.load(open(os.path.join(HERE, "tools.json"), encoding="utf-8"))
SITE = json.load(open(os.path.join(HERE, "site.json"), encoding="utf-8"))
BY_ID = {t["id"]: t for t in TOOLS}
# Hindi copy for /hi/<slug>/ pages (tools/tools.hi.json, same order and ids as tools.json).
HI_TOOLS = {h["id"]: h for h in json.load(open(os.path.join(HERE, "tools.hi.json"), encoding="utf-8"))}
OG_DIR = os.path.join(ROOT_DIR, "assets", "og")  # share images from tools/og/make_og.py


def og_image(slug):
    """Absolute URL of the 1200x630 share image for a page (falls back to the home image)."""
    f = (slug or "home") + ".jpg"
    if not os.path.exists(os.path.join(OG_DIR, f)): f = "home.jpg"
    return BASE + "assets/og/" + f if os.path.exists(os.path.join(OG_DIR, f)) else ""


def hi_strings():
    """Hindi tool names/descriptions (i18n-tools.js) and chrome strings (i18n.js), read from the JS so they stay in one place."""
    src = open(os.path.join(ROOT_DIR, "assets/js/i18n-tools.js"), encoding="utf-8").read()
    blk = src[src.index('I18N.addStrings("hi"'):]
    blk = blk[:blk.index("});")]
    d = dict(re.findall(r'"([^"]+)": "((?:[^"\\]|\\.)*)"', blk))
    return d


HI = hi_strings()
# Short how-to pages for big searches (tools/guides.json), served at /guides/<slug>/.
GUIDES = json.load(open(os.path.join(HERE, "guides.json"), encoding="utf-8"))
HI_CAT = {"image": "इमेज", "pdf": "PDF", "video": "वीडियो", "calculators": "कैलकुलेटर", "utilities": "यूटिलिटी", "text": "टेक्स्ट", "creator": "क्रिएटर"}
PRIVACY_HI = {
    "file": "आपकी फ़ाइलें आपके डिवाइस पर ही प्रोसेस होती हैं और कभी अपलोड नहीं होतीं।",
    "file-cdn": "आपकी फ़ाइलें आपके डिवाइस पर ही प्रोसेस होती हैं और कभी अपलोड नहीं होतीं। टूल खुलने पर सिर्फ़ ओपन-सोर्स प्रोसेसिंग इंजन डाउनलोड होता है।",
    "text": "सब कुछ आपके ब्राउज़र में चलता है; आप जो लिखते हैं वह कहीं नहीं भेजा जाता और सेव नहीं होता।",
    "text-ai": "टेम्पलेट आइडिया आपके ब्राउज़र में बनते हैं। सिर्फ़ AI से बनाएँ दबाने पर आपका लिखा टेक्स्ट AI के लिए Toolsaku के सर्वर पर भेजा जाता है; कुछ सेव नहीं होता और कोई फ़ाइल अपलोड नहीं होती।",
    "calc": "सारा हिसाब आपके ब्राउज़र में होता है; कुछ भी कहीं नहीं भेजा जाता और सेव नहीं होता।",
    "clipper": "आपकी वीडियो फ़ाइल आपके डिवाइस पर ही कटती और बनती है, कभी अपलोड नहीं होती। नॉर्मल मोड पूरी तरह डिवाइस पर चलता है। AI मोड हर तेज़ आवाज़ वाले पल के कुछ छोटे स्नैपशॉट और बोले गए शब्द आपकी अपनी मुफ़्त key से सीधे Google Gemini को भेजता है, Toolsaku के सर्वर को कभी नहीं। AI पोस्ट किट और AI कैप्शन जनरेटर सिर्फ़ टेक्स्ट भेजते हैं।",
    "link": "सिर्फ़ आपका पेस्ट किया YouTube लिंक Toolsaku के सर्वर पर जाता है, जो स्ट्रीम का पब्लिक चैट रीप्ले, कैप्शन और Most replayed डेटा पढ़ता है। कोई फ़ाइल अपलोड नहीं होती और वीडियो कभी डाउनलोड नहीं होता।",
    "yt": "थंबनेल सीधे YouTube के पब्लिक इमेज सर्वर (img.youtube.com) से लोड होते हैं। Toolsaku कुछ भी सेव नहीं करता।",
}
CATS, ICONS, EN = SITE["cats"], SITE["icons"], SITE["en"]
e = lambda s: html.escape(str(s), quote=True)

# Which tool script(s) each tool needs, in load order (core, i18n and ui-fx load on every page).
AI_CAPTION_TOOLS = ("instagram-caption-generator", "youtube-title-generator", "video-description-templates", "hashtag-suggestions", "long-to-shorts")


def tool_scripts(t):
    s = _tool_scripts(t)
    return s + ["ai-captions.js"] if t["id"] in AI_CAPTION_TOOLS else s


def _tool_scripts(t):
    i, c = t["id"], t["category"]
    if t.get("embed") == "clipper": return ["clipper.js"]
    if i == "stream-moment-finder": return ["stream-moments.js"]
    if c == "image": return ["image-tools.js"]
    if c == "pdf": return ["pdf-tools.js"]
    if c == "video": return ["video-tools.js"]
    if c == "calculators": return ["calc-tools.js"]
    if i in ("pomodoro-timer", "timer-online", "stopwatch-online"): return ["util-tools.js"]
    if i in ("fancy-text-generator", "word-character-counter"): return ["text-tools.js"]
    if i in ("video-description-templates", "bio-generator"): return ["creator-tools.js", "creator-tools-2.js"]
    if c == "creator": return ["creator-tools.js"]
    return ["more-tools.js"]  # password, unit, base64, typing, qr, json, case converter

PRIVACY = {
    "file": "Your files are processed on your device and never uploaded.",
    "file-cdn": "Your files are processed on your device and never uploaded. Only the open-source processing engine is downloaded when the tool opens.",
    "text": "Everything runs in your browser; nothing you type is sent anywhere or saved.",
    "text-ai": "Template ideas are made in your browser. Only if you tap Generate with AI is the text you type sent to Toolsaku's server for the AI; nothing is saved and no files are uploaded.",
    "calc": "Everything is worked out in your browser; nothing is sent anywhere or saved.",
    "clipper": "Your video file is cut and rendered on your device and never uploaded. Normal mode is fully on-device. AI mode sends only a few small snapshots and the spoken words from each loud moment straight to Google's Gemini with your own free key, never to Toolsaku's server. The AI post kit and AI Caption Generator send only text.",
    "link": "Only the YouTube link you paste is sent to Toolsaku's server, which reads the stream's public chat replay, captions and Most replayed data. No files are uploaded and the video is never downloaded.",
    "yt": "Thumbnails load straight from YouTube's public image server (img.youtube.com). Toolsaku stores nothing.",
}


def asset_ver():
    """Short hash of every CSS/JS file, added as ?v= so browsers fetch new code after each build."""
    h = hashlib.sha1()
    for d in ("assets/css", "assets/js"):
        p = os.path.join(ROOT_DIR, d)
        for f in sorted(os.listdir(p)):
            if f != "routes.js":
                h.update(open(os.path.join(p, f), "rb").read())
    return h.hexdigest()[:8]


def ic(name, size=22):
    d = ICONS.get(name) or ICONS["image"]
    return (f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            f'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{d}"/></svg>')


def tile(cat, icon, size=22):
    return f'<span class="x-ic" data-c="{cat}">{ic(icon, size)}</span>'


def url(slug=""):
    return BASE + (slug + "/" if slug else "")


def card(t, root):
    return (f'<a class="x-card" href="{root}{t["slug"]}/" data-tool-card="{t["id"]}"><span class="x-live"><i aria-hidden="true"></i>{e(EN["live"])}</span>'
            f'{tile(t["category"], t["icon"])}<span class="x-cb"><strong>{e(t["name"])}</strong><span>{e(t["description"])}</span></span></a>')


def faq_html(items):
    return '<div class="x-faq">' + "".join(f"<details><summary>{e(q)}</summary><p>{e(a)}</p></details>" for q, a in items) + "</div>"


def jsonld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace("</", "<\\/") + "</script>"


def faq_ld(items):
    return {"@context": "https://schema.org", "@type": "FAQPage",
            "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in items]}


def head(title, desc, canonical, root, extra="", robots=None, base_script="", img="", lang="en", alts=None, html_attrs=""):
    home_link = root or "./"
    img = img or og_image("")
    alt_tags = "".join(f'\n    <link rel="alternate" hreflang="{h}" href="{e(u)}" />' for h, u in (alts or []))
    img_tags = (f'''
    <meta property="og:image" content="{e(img)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="{e(title)}" />
    <meta name="twitter:image" content="{e(img)}" />''' if img else "")
    return f"""<!doctype html>
<html lang="{lang}" data-theme="dark"{html_attrs}>
  <head>
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-589GRCVP"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){{dataLayer.push(arguments);}}
  gtag('js', new Date());
</script>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    {base_script}<title>{e(title)}</title>
    <meta name="description" content="{e(desc)}" />
    {f'<meta name="robots" content="{robots}" />' if robots else f'<link rel="canonical" href="{e(canonical)}" />'}{alt_tags}
    <meta name="theme-color" content="#0A0F1E" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="{"hi_IN" if lang == "hi" else "en_IN"}" />
    <meta property="og:site_name" content="{SITE_NAME}" />
    <meta property="og:title" content="{e(title)}" />
    <meta property="og:description" content="{e(desc)}" />
    {'' if robots else f'<meta property="og:url" content="{e(canonical)}" />'}
    <meta name="twitter:card" content="{"summary_large_image" if img else "summary"}" />
    <meta name="twitter:title" content="{e(title)}" />
    <meta name="twitter:description" content="{e(desc)}" />{img_tags}
    <link rel="icon" href="{root}favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="{root}assets/css/base.css?v={VER}" />
    <link rel="stylesheet" href="{root}assets/css/site.css?v={VER}" />
    <script>try{{if(localStorage.getItem("sugoi-theme")==="light")document.documentElement.setAttribute("data-theme","light")}}catch(e){{}}</script>
    <script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6381563330331265"
     crossorigin="anonymous"></script>
    {extra}
  </head>"""


TICKER = ["tick.tools|44 free tools", "tick.nosign|No sign-up", "tick.local|Files processed on your device", "tick.phone|Works on phone",
          "tick.langs|8 languages", "tick.clip|New: Long Video to Shorts Clipper", "tick.typing|New: Typing Speed Test", "tick.emi|New: EMI &amp; SIP Calculators"]


def shell_top(root):
    home_link = root or "./"
    items = "".join(f'<li data-i18n="{k}">{v}</li>' for k, v in (x.split("|", 1) for x in TICKER))
    logo = f'<a class="x-logo" href="{home_link}" aria-label="Toolsaku home"><span data-logo></span><span class="x-wm">Toolsaku<small class="x-tag">作 · <span data-i18n="logo.tag">means create</span></small></span></a>'
    return f"""
    <div class="x-app">
      <div class="x-bg" aria-hidden="true"><i class="x-blob x-b1"></i><i class="x-blob x-b2"></i><i class="x-blob x-b3"></i><span class="x-shine"><i></i></span></div>
      <div class="x-ticker" role="region" aria-label="Toolsaku highlights">
        <div class="x-ticker__track">
          <ul class="x-ticker__group">{items}</ul>
          <ul class="x-ticker__group" aria-hidden="true">{items}</ul>
        </div>
      </div>
      <header class="x-top">
        <div class="x-wrap x-hbar">
          {logo}
          <nav class="x-nav" aria-label="Tool categories" id="x-nav">{"".join(f'<a href="{home_link}#cat-{k}" data-cat="{k}">{e(c["name"])}</a>' for k, c in CATS.items())}</nav>
          <button class="x-hb x-sbtn" type="button" aria-label="Search tools" id="x-sbtn"></button>
          <button class="x-hb x-theme" type="button" aria-label="Switch to light theme" id="x-theme"></button>
          <button class="x-hb x-burger" type="button" aria-label="Menu" aria-expanded="false" aria-controls="x-nav" id="x-burger"></button>
        </div>
      </header>
      <main class="x-view" id="x-view">"""


def shell_bottom(root, scripts):
    home_link = root or "./"
    logo = f'<a class="x-logo" href="{home_link}" aria-label="Toolsaku home"><span data-logo></span><span class="x-wm">Toolsaku<small class="x-tag">作 · <span data-i18n="logo.tag">means create</span></small></span></a>'
    js = ["i18n.js", "i18n-tools.js", "routes.js", "core.js"] + scripts + ["ui-fx.js", "account.js"]
    return f"""</main>
      <div class="ad-slot" data-slot="above-footer">Advertisement</div>
      <footer class="x-foot">
        <div class="x-wrap">
          <div class="x-fgrid">
            <div>
              {logo}
              <p data-i18n="foot.tag">{e(EN["foot.tag"])}</p>
            </div>
            <div><h3 data-i18n="foot.tools">Tools</h3><ul id="x-fcats">{"".join(f'<li><a href="{home_link}#cat-{k}">{e(c["title"])}</a></li>' for k, c in CATS.items())}</ul></div>
            <div>
              <h3>Toolsaku</h3>
              <ul>
                <li><a href="{root}about/" data-i18n="page.about">About Us</a></li>
                <li><a href="{root}privacy/" data-i18n="page.privacy">Privacy Policy</a></li>
                <li><a href="{root}terms/" data-i18n="page.terms">Terms</a></li>
                <li><a href="{root}disclaimer/" data-i18n="page.disclaimer">Disclaimer</a></li>
              </ul>
            </div>
          </div>
          <p class="x-copy">© Toolsaku · Made by <a href="{root}about/#developer">Aditya Kumar</a></p>
        </div>
      </footer>
    </div>
""" + "".join(f'    <script src="{root}assets/js/{s}?v={VER}"></script>\n' for s in js) + "  </body>\n</html>\n"


def write(rel, text):
    p = os.path.join(ROOT_DIR, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)


def crumbs_ld(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}


def embed_html(t):
    """A tool with "embed" ships its own markup (tools/<embed>/app.html, made by tools/clipper/make_clipper.py)."""
    if not t.get("embed"): return ""
    return open(os.path.join(HERE, t["embed"], "app.html"), encoding="utf-8").read()


def guide_html(t):
    """Optional longer guide for a tool: tools.json "guide" = [[heading, paragraph], ...]."""
    g = t.get("guide")
    if not g: return ""
    inner = "".join(f"<h3>{e(h)}</h3><p>{e(p)}</p>" for h, p in g)
    return f'<section class="x-box x-wide x-guide" aria-labelledby="x-h-guide"><h2 id="x-h-guide">{tile(t["category"], "info", 18)}{e(t["name"])} guide</h2>{inner}</section>\n            '


AI_PRIV = ("text-ai", "link", "clipper")

# ---- Tool pages -----------------------------------------------------------------------
def tool_page(t):
    root, c = "../", CATS[t["category"]]
    ai = t["privacy"] in AI_PRIV
    title = (f'{t["title_name"]} – Free Online | {SITE_NAME}' if ai
             else f'{t["title_name"]} Online Free – No Upload | {SITE_NAME}')
    canonical = url(t["slug"])
    faq = t["faq"][:6]
    ld = (jsonld(faq_ld(faq)) + "\n    " +
          jsonld(crumbs_ld([("Home", url()), (t["name"], canonical)])) + "\n    " +
          jsonld({"@context": "https://schema.org", "@type": "WebApplication", "name": t["name"], "url": canonical,
                  "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any (runs in a web browser)",
                  "description": t["meta_description"], "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}))
    related = "".join(card(BY_ID[r], root) for r in t["related"])
    steps = "".join(f"<li>{e(s)}</li>" for s in t["steps"])
    gl = [g for g in GUIDES if g["tool"] == t["id"] or t["id"] in g["also"]]
    guides = (f'<section class="x-box x-wide" aria-labelledby="x-h-guides"><h2 id="x-h-guides">{tile(t["category"], "list", 18)}Step-by-step guides</h2><ul>' +
              "".join(f'<li><a href="{root}guides/{g["slug"]}/">{e(g["h1"])}</a></li>' for g in gl) + "</ul></section>\n            ") if gl else ""
    body = f"""
        <div class="x-page"><div class="x-wrap">
          <ol class="x-crumb"><li><a href="{root}" data-i18n="home">Home</a></li><li><a href="{root}#cat-{t["category"]}" data-i18n="cat.{t["category"]}.name">{e(c["name"])}</a></li><li aria-current="page">{e(t["name"])}</li></ol>
          <div class="x-thead">{tile(t["category"], t["icon"], 28)}<h1>{e(t["name"])}</h1></div>
          <p class="x-lead" data-tdesc>{e(t["description"])}</p>
          <p class="x-privacy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"/></svg>{'<strong>Uses AI (Google Gemini).</strong> ' if t["privacy"] in AI_PRIV else ''}{e(PRIVACY[t["privacy"]])}</p>
          <div id="x-tool">{embed_html(t)}<noscript><p class="x-lead">This tool runs in your browser and needs JavaScript turned on.</p></noscript></div>
          <div class="x-about">
            <section class="x-box" aria-labelledby="x-h-how"><h2 id="x-h-how">{tile(t["category"], "list", 18)}<span data-i18n="tool.how">How to use</span></h2><ol class="x-how">{steps}</ol></section>
            <section class="x-box" aria-labelledby="x-h-about"><h2 id="x-h-about">{tile(t["category"], "info", 18)}About {e(t["name"])}</h2><p>{e(t["about"])}</p></section>
            {guide_html(t)}{guides}<section class="x-box x-wide" aria-labelledby="x-h-faq"><h2 id="x-h-faq">{tile(t["category"], "help", 18)}<span data-i18n="tool.faq">FAQs</span></h2>{faq_html(faq)}</section>
          </div></div>
          <div class="ad-slot" data-slot="tool-below-instructions">Advertisement</div>
          <div class="x-wrap"><section class="x-sec"><h2 data-i18n="tool.related">Related tools</h2><div class="x-cards">{related}</div></section></div>
        </div>
      """
    if t.get("embed"): ld = f'<link rel="stylesheet" href="{root}assets/css/{t["embed"]}.css?v={VER}" />\n    ' + ld
    alts = [("en", canonical), ("hi", url("hi/" + t["slug"])), ("x-default", canonical)] if t["id"] in HI_TOOLS else None
    return (head(title, t["meta_description"], canonical, root, ld, img=og_image(t["slug"]), alts=alts,
                 html_attrs=f' data-alt-hi="{root}hi/{t["slug"]}/"' if alts else "") +
            f'\n  <body data-page="tool" data-tool="{t["id"]}" data-root="{root}">' + shell_top(root) + body + shell_bottom(root, tool_scripts(t)))


def hi_card(t, root):
    """Related-tool card on a Hindi page: Hindi name/description, links to the Hindi page."""
    n, d = HI.get(f'tool.{t["id"]}.name', t["name"]), HI.get(f'tool.{t["id"]}.desc', t["description"])
    href = f'{root}hi/{t["slug"]}/' if t["id"] in HI_TOOLS else f'{root}{t["slug"]}/'
    return (f'<a class="x-card" href="{href}" data-tool-card="{t["id"]}"><span class="x-live"><i aria-hidden="true"></i>लाइव</span>'
            f'{tile(t["category"], t["icon"])}<span class="x-cb"><strong>{e(n)}</strong><span>{e(d)}</span></span></a>')


# ---- Hindi tool pages (/hi/<slug>/) -----------------------------------------------------
def hi_tool_page(t):
    h, root, c = HI_TOOLS[t["id"]], "../../", CATS[t["category"]]
    name = h["name"]
    title = (f'{h["title_name"]} – मुफ़्त ऑनलाइन | {SITE_NAME}' if t["privacy"] in AI_PRIV
             else f'{h["title_name"]} – मुफ़्त ऑनलाइन, बिना अपलोड | {SITE_NAME}')
    canonical, en_url = url("hi/" + t["slug"]), url(t["slug"])
    faq = [tuple(x) for x in h["faq"][:6]]
    ld = (jsonld(faq_ld(faq)) + "\n    " +
          jsonld(crumbs_ld([("होम", url()), (name, canonical)])) + "\n    " +
          jsonld({"@context": "https://schema.org", "@type": "WebApplication", "name": name, "url": canonical, "inLanguage": "hi",
                  "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any (runs in a web browser)",
                  "description": h["meta_description"], "offers": {"@type": "Offer", "price": "0", "priceCurrency": "INR"}}))
    related = "".join(hi_card(BY_ID[r], root) for r in t["related"])
    steps = "".join(f"<li>{e(x)}</li>" for x in h["steps"])
    guide = ""
    if h.get("guide"):
        inner = "".join(f"<h3>{e(a)}</h3><p>{e(b)}</p>" for a, b in h["guide"])
        guide = f'<section class="x-box x-wide x-guide" aria-labelledby="x-h-guide"><h2 id="x-h-guide">{tile(t["category"], "info", 18)}{e(name)} गाइड</h2>{inner}</section>\n            '
    desc = HI.get(f'tool.{t["id"]}.desc', t["description"])
    body = f"""
        <div class="x-page"><div class="x-wrap">
          <ol class="x-crumb"><li><a href="{root}" data-i18n="home">होम</a></li><li><a href="{root}#cat-{t["category"]}" data-i18n="cat.{t["category"]}.name">{e(HI_CAT[t["category"]])}</a></li><li aria-current="page">{e(name)}</li></ol>
          <div class="x-thead">{tile(t["category"], t["icon"], 28)}<h1>{e(name)}</h1></div>
          <p class="x-lead" data-tdesc>{e(desc)}</p>
          <p class="x-privacy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"/></svg>{'<strong>AI का इस्तेमाल (Google Gemini)।</strong> ' if t["privacy"] in AI_PRIV else ''}{e(PRIVACY_HI[t["privacy"]])}</p>
          <p class="x-lead" style="font-size:14px"><a href="{root}{t["slug"]}/" hreflang="en" lang="en">Read this page in English</a></p>
          <div id="x-tool">{embed_html(t)}<noscript><p class="x-lead">यह टूल आपके ब्राउज़र में चलता है और इसके लिए JavaScript चालू होना चाहिए।</p></noscript></div>
          <div class="x-about">
            <section class="x-box" aria-labelledby="x-h-how"><h2 id="x-h-how">{tile(t["category"], "list", 18)}<span data-i18n="tool.how">इस्तेमाल कैसे करें</span></h2><ol class="x-how">{steps}</ol></section>
            <section class="x-box" aria-labelledby="x-h-about"><h2 id="x-h-about">{tile(t["category"], "info", 18)}{e(name)} के बारे में</h2><p>{e(h["about"])}</p></section>
            {guide}<section class="x-box x-wide" aria-labelledby="x-h-faq"><h2 id="x-h-faq">{tile(t["category"], "help", 18)}<span data-i18n="tool.faq">सवाल-जवाब</span></h2>{faq_html(faq)}</section>
          </div></div>
          <div class="ad-slot" data-slot="tool-below-instructions">Advertisement</div>
          <div class="x-wrap"><section class="x-sec"><h2 data-i18n="tool.related">मिलते-जुलते टूल</h2><div class="x-cards">{related}</div></section></div>
        </div>
      """
    if t.get("embed"): ld = f'<link rel="stylesheet" href="{root}assets/css/{t["embed"]}.css?v={VER}" />\n    ' + ld
    alts = [("en", en_url), ("hi", canonical), ("x-default", en_url)]
    return (head(title, h["meta_description"], canonical, root, ld, img=og_image(t["slug"]), lang="hi", alts=alts,
                 html_attrs=f' data-lang-page="hi" data-alt-en="{root}{t["slug"]}/"') +
            f'\n  <body data-page="tool" data-tool="{t["id"]}" data-root="{root}">' + shell_top(root) + body + shell_bottom(root, tool_scripts(t)))


# ---- Guide pages (/guides/<slug>/) ------------------------------------------------------
def guide_page(g):
    root, t = "../../", BY_ID[g["tool"]]
    canonical = url("guides/" + g["slug"])
    title = f'{g["title"]} | {SITE_NAME}'
    faq = [tuple(x) for x in g["faq"]]
    secs = "".join(
        f'<section class="x-box x-wide"><h2>{tile(t["category"], "list", 18)}{e(h)}</h2>'
        + (f'<ol class="x-how">' if i == 0 or h.startswith("Step") else '<ul>')
        + "".join(f"<li>{e(x)}</li>" for x in items)
        + ('</ol>' if i == 0 or h.startswith("Step") else '</ul>') + '</section>'
        for i, (h, items) in enumerate(g["sections"]))
    cta = f'<p><a class="x-btn x-primary" href="{root}{t["slug"]}/">{ic(t["icon"], 20)} Open {e(t["name"])}</a></p>'
    also = "".join(card(BY_ID[x], root) for x in [g["tool"]] + g["also"])
    ld = (jsonld({"@context": "https://schema.org", "@type": "Article", "headline": g["h1"], "description": g["meta_description"],
                  "inLanguage": "en", "datePublished": LASTMOD, "dateModified": LASTMOD, "mainEntityOfPage": canonical,
                  "image": og_image(t["slug"]), "author": {"@type": "Person", "name": "Aditya Kumar"},
                  "publisher": {"@type": "Organization", "name": SITE_NAME, "url": url()}}) + "\n    " +
          jsonld(faq_ld(faq)) + "\n    " +
          jsonld(crumbs_ld([("Home", url()), (t["name"], url(t["slug"])), (g["h1"], canonical)])))
    body = f"""
        <div class="x-page"><div class="x-wrap">
          <ol class="x-crumb"><li><a href="{root}" data-i18n="home">Home</a></li><li><a href="{root}{t["slug"]}/">{e(t["name"])}</a></li><li aria-current="page">{e(g["h1"])}</li></ol>
          <div class="x-thead">{tile(t["category"], t["icon"], 28)}<h1>{e(g["h1"])}</h1></div>
          <p class="x-lead">{e(g["lead"])}</p>
          {cta}
          <div class="x-about">
            {secs}
            <section class="x-box x-wide" lang="hi"><h2>{tile(t["category"], "info", 18)}हिन्दी में</h2><p>{e(g["hi"])}</p></section>
            <section class="x-box x-wide" aria-labelledby="x-h-faq"><h2 id="x-h-faq">{tile(t["category"], "help", 18)}<span data-i18n="tool.faq">FAQs</span></h2>{faq_html(faq)}</section>
          </div>
          <p class="x-lead" style="font-size:14px">Updated {LASTMOD_TEXT}</p>
        </div>
          <div class="ad-slot" data-slot="tool-below-instructions">Advertisement</div>
          <div class="x-wrap"><section class="x-sec"><h2 data-i18n="tool.related">Related tools</h2><div class="x-cards">{also}</div></section></div>
        </div>
      """
    return (head(title, g["meta_description"], canonical, root, ld, img=og_image(t["slug"])) +
            f'\n  <body data-page="info" data-root="{root}">' + shell_top(root) + body + shell_bottom(root, []))


# ---- Home -----------------------------------------------------------------------------
def home_page():
    root = ""
    title = EN["meta.home"]
    desc = ("Free online tools that run in your browser: resize and compress images, merge and split PDFs, trim and compress videos, "
            "calculators and more. No sign-up, no upload.")
    groups = [(k, c, [t for t in TOOLS if t["category"] == k]) for k, c in CATS.items()]
    groups = [g for g in groups if g[2]]
    pop = [BY_ID[i] for i in SITE["popular"] if i in BY_ID]
    secs = "".join(
        f'<section class="x-sec x-catsec" id="cat-{k}" aria-labelledby="h-{k}"><div class="x-wrap"><div class="x-cat-head">{tile(k, c["icon"])}'
        f'<h2 id="h-{k}">{e(c["title"])}</h2><span class="x-count">{len(lst)} tools</span></div><p class="x-lead">{e(c["desc"])}</p>'
        f'<div class="x-cards">{"".join(card(t, root) for t in lst)}</div></div></section>' for k, c, lst in groups)
    upcoming = "".join(f'<div class="x-card is-soon" aria-disabled="true"><span class="x-soon">{e(EN["soon"])}</span>{tile(cat, icon)}<span class="x-cb"><strong>{e(n)}</strong></span></div>'
                       for n, cat, icon in SITE["upcoming"])
    body = f"""
        <section class="x-hero"><div class="x-wrap">
          <p class="x-kicker">{e(EN["hero.kicker"])}</p>
          <h1>{e(EN["hero.h1"])} <em>{e(EN["hero.em"])}</em></h1>
          <p class="x-lead">{e(EN["hero.lead"])}</p>
        </div></section>
        <section class="x-sec x-sec-sm"><div class="x-wrap"><h2>{e(EN["popular"])}</h2><div class="x-pop">{"".join(f'<a href="{t["slug"]}/">{tile(t["category"], t["icon"], 20)}{e(t["name"])}</a>' for t in pop)}</div></div></section>
        {secs}
        <section class="x-sec"><div class="x-wrap"><h2>{e(EN["how.title"])}</h2>
          <ol class="x-steps">{"".join(f'<li><strong>{e(EN[f"how.{i}"])}</strong><span>{e(EN[f"how.{i}d"])}</span></li>' for i in range(1, 5))}</ol>
        </div></section>
        <section class="x-sec"><div class="x-wrap"><h2>{e(EN["faq.title"])}</h2>{faq_html(SITE["home_faq"])}</div></section>
        <section class="x-sec x-upcoming" aria-labelledby="h-upcoming"><div class="x-wrap"><h2 id="h-upcoming">{e(EN["upcoming.title"])}</h2><p class="x-lead">{e(EN["upcoming.sub"])}</p>
          <div class="x-cards">{upcoming}</div>
        </div></section>
      """
    ld = (jsonld({"@context": "https://schema.org", "@type": "WebSite", "name": SITE_NAME, "url": url()}) + "\n    " +
          jsonld(faq_ld(SITE["home_faq"])) + "\n    " +
          jsonld({"@context": "https://schema.org", "@type": "ItemList", "name": "Toolsaku free online tools",
                  "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": t["name"], "url": url(t["slug"])} for i, t in enumerate(TOOLS)]}))
    # Home renders its interactive version (search, chips) with core.js; the static markup above is the no-JS / crawler copy.
    return head(title, desc, url(), root, ld) + '\n  <body data-page="home" data-root="">' + shell_top(root) + body + shell_bottom(root, [])


# ---- Info pages -----------------------------------------------------------------------
def info_page(key, p):
    root = "../"
    title = f'{p["title"]} | {SITE_NAME}'
    body = f"""
        <div class="x-page"><div class="x-wrap x-body x-prose">
          <ol class="x-crumb"><li><a href="{root}" data-i18n="home">Home</a></li><li aria-current="page" data-i18n="page.{key}">{e(p["title"])}</li></ol>
          <h1 data-i18n="page.{key}">{e(p["title"])}</h1><div style="margin-top:16px">{p["html"]}</div>
        </div></div>
      """
    return head(title, p["desc"], url(key), root) + f'\n  <body data-page="info" data-root="{root}">' + shell_top(root) + body + shell_bottom(root, [])


# ---- 404 ------------------------------------------------------------------------------
def not_found_page():
    # 404.html can be served at any depth, so relative paths are resolved against a <base> picked at runtime:
    # a known subpath prefix (GitHub Pages project site) or the domain root (Netlify / custom domain).
    prefixes = json.dumps(SUBPATH_PREFIXES)
    base_script = ('<script>(function(){var p=location.pathname,b="/",l=' + prefixes +
                   ';for(var i=0;i<l.length;i++){if(p.toLowerCase().indexOf(l[i].toLowerCase())===0){b=l[i];break;}}'
                   'document.write(\'<base href="\'+b+\'">\');})();</script>\n    ')
    root = ""
    pop = [BY_ID[i] for i in SITE["popular"] if i in BY_ID]
    body = f"""
        <div class="x-page"><div class="x-wrap x-body">
          <h1 data-i18n="nf.title">{e(EN["nf.title"])}</h1><p class="x-lead" data-i18n="nf.text">{e(EN["nf.text"])}</p>
          <p><a class="x-btn x-primary" href="./" data-i18n="browse">{e(EN["browse"])}</a></p>
          <section class="x-sec"><h2>{e(EN["popular"])}</h2><div class="x-cards">{"".join(card(t, root) for t in pop)}</div></section>
        </div></div>
      """
    page = (head(f"Page not found | {SITE_NAME}", "This page doesn't exist. Browse Toolsaku' free online tools instead.", "", root,
                 robots="noindex", base_script=base_script) +
            '\n  <body data-page="404" data-root="">' + shell_top(root) + body + shell_bottom(root, []))
    # Emit asset tags from script too, so they are only requested after <base> is set (no stray requests at deep paths).
    page = re.sub(r'(<link rel="(?:icon|stylesheet)"[^>]*/>)', lambda m: "<script>document.write('" + m.group(1) + "')</script>", page)
    page = re.sub(r'<script src="([^"]+)"></script>', lambda m: "<script>document.write('<script src=\"" + m.group(1) + "\"><\\/script>')</script>", page)
    return page


def main():
    global VER
    VER = asset_ver()
    slugs = {t["id"]: t["slug"] for t in TOOLS}
    write("assets/js/routes.js", "/* Generated by tools/build.py: tool id -> page folder. */\nwindow.SUGOI_SLUGS = " + json.dumps(slugs, indent=1) + ";\n")
    for t in TOOLS:
        write(f'{t["slug"]}/index.html', tool_page(t))
        if t["id"] in HI_TOOLS: write(f'hi/{t["slug"]}/index.html', hi_tool_page(t))
    write("index.html", home_page())
    for k, p in SITE["pages"].items():
        write(f"{k}/index.html", info_page(k, p))
    write("404.html", not_found_page())
    def pair(t):  # hreflang alternates for a tool that has a Hindi page
        if t["id"] not in HI_TOOLS: return ""
        en, hi = url(t["slug"]), url("hi/" + t["slug"])
        return (f'<xhtml:link rel="alternate" hreflang="en" href="{en}"/><xhtml:link rel="alternate" hreflang="hi" href="{hi}"/>'
                f'<xhtml:link rel="alternate" hreflang="x-default" href="{en}"/>')
    urls = ([(url(), "1.0", "")] + [(url(t["slug"]), "0.8", pair(t)) for t in TOOLS] +
            [(url("hi/" + t["slug"]), "0.7", pair(t)) for t in TOOLS if t["id"] in HI_TOOLS] +
            [(url("guides/" + g["slug"]), "0.6", "") for g in GUIDES] +
            [(url(k), "0.3", "") for k in SITE["pages"]])
    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
          "".join(f"  <url><loc>{u}</loc><lastmod>{LASTMOD}</lastmod>{x}<priority>{p}</priority></url>\n" for u, p, x in urls) + "</urlset>\n")
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {BASE}sitemap.xml\n")
    for g in GUIDES:
        write(f'guides/{g["slug"]}/index.html', guide_page(g))
    print(f"Built {len(TOOLS)} tool pages, {sum(t['id'] in HI_TOOLS for t in TOOLS)} Hindi pages, {len(GUIDES)} guides, home, {len(SITE['pages'])} info pages and 404 for {BASE}")


if __name__ == "__main__":
    main()
