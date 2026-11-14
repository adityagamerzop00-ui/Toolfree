#!/usr/bin/env python3
"""Generate the static SugoiTools site: one page per tool, the home page, info pages,
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

# ---- Settings -------------------------------------------------------------------------
BASE_URL = "https://sugoitools.netlify.app"  # change to e.g. https://sugoitools.com and re-run
LASTMOD = "2026-11-14"                         # <lastmod> written to sitemap.xml
SITE_NAME = "SugoiTools"
# Subpaths the site may be served under (for 404.html, which can be shown at any depth).
# A request path starting with one of these resolves 404 assets from that prefix, otherwise "/".
SUBPATH_PREFIXES = ["/Toolfree/"]
# ---------------------------------------------------------------------------------------

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(HERE)
BASE = BASE_URL.rstrip("/") + "/"
TOOLS = json.load(open(os.path.join(HERE, "tools.json"), encoding="utf-8"))
SITE = json.load(open(os.path.join(HERE, "site.json"), encoding="utf-8"))
BY_ID = {t["id"]: t for t in TOOLS}
CATS, ICONS, EN = SITE["cats"], SITE["icons"], SITE["en"]
e = lambda s: html.escape(str(s), quote=True)

# Which tool script(s) each tool needs, in load order (core, i18n and ui-fx load on every page).
def tool_scripts(t):
    i, c = t["id"], t["category"]
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
    "calc": "Everything is worked out in your browser; nothing is sent anywhere or saved.",
    "yt": "Thumbnails load straight from YouTube's public image server (img.youtube.com). SugoiTools stores nothing.",
}


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


def head(title, desc, canonical, root, extra="", robots=None, base_script=""):
    home_link = root or "./"
    return f"""<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    {base_script}<title>{e(title)}</title>
    <meta name="description" content="{e(desc)}" />
    {f'<meta name="robots" content="{robots}" />' if robots else f'<link rel="canonical" href="{e(canonical)}" />'}
    <meta name="theme-color" content="#0A0F1E" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="{SITE_NAME}" />
    <meta property="og:title" content="{e(title)}" />
    <meta property="og:description" content="{e(desc)}" />
    {'' if robots else f'<meta property="og:url" content="{e(canonical)}" />'}
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="{e(title)}" />
    <meta name="twitter:description" content="{e(desc)}" />
    <link rel="icon" href="{root}favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="{root}assets/css/base.css" />
    <link rel="stylesheet" href="{root}assets/css/site.css" />
    <script>try{{if(localStorage.getItem("sugoi-theme")==="light")document.documentElement.setAttribute("data-theme","light")}}catch(e){{}}</script>
    {extra}
  </head>"""


TICKER = ["tick.tools|42 free tools", "tick.nosign|No sign-up", "tick.local|Files never leave your device", "tick.phone|Works on phone",
          "tick.langs|8 languages", "tick.qr|New: QR Code Generator", "tick.typing|New: Typing Speed Test", "tick.emi|New: EMI &amp; SIP Calculators"]


def shell_top(root):
    home_link = root or "./"
    items = "".join(f'<li data-i18n="{k}">{v}</li>' for k, v in (x.split("|", 1) for x in TICKER))
    logo = f'<a class="x-logo" href="{home_link}" aria-label="SugoiTools home"><span data-logo></span><span class="x-wm">SugoiTools<small class="x-tag">すごい · <span data-i18n="logo.tag">means amazing</span></small></span></a>'
    return f"""
    <div class="x-app">
      <div class="x-bg" aria-hidden="true"><i class="x-blob x-b1"></i><i class="x-blob x-b2"></i><i class="x-blob x-b3"></i><span class="x-shine"><i></i></span></div>
      <div class="x-ticker" role="region" aria-label="SugoiTools highlights">
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
    logo = f'<a class="x-logo" href="{home_link}" aria-label="SugoiTools home"><span data-logo></span><span class="x-wm">SugoiTools<small class="x-tag">すごい · <span data-i18n="logo.tag">means amazing</span></small></span></a>'
    js = ["i18n.js", "i18n-tools.js", "routes.js", "core.js"] + scripts + ["ui-fx.js"]
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
              <h3>SugoiTools</h3>
              <ul>
                <li><a href="{root}about/" data-i18n="page.about">About Us</a></li>
                <li><a href="{root}privacy/" data-i18n="page.privacy">Privacy Policy</a></li>
                <li><a href="{root}terms/" data-i18n="page.terms">Terms</a></li>
                <li><a href="{root}disclaimer/" data-i18n="page.disclaimer">Disclaimer</a></li>
              </ul>
            </div>
          </div>
          <p class="x-copy">© SugoiTools</p>
        </div>
      </footer>
    </div>
""" + "".join(f'    <script src="{root}assets/js/{s}"></script>\n' for s in js) + "  </body>\n</html>\n"


def write(rel, text):
    p = os.path.join(ROOT_DIR, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(text)


def crumbs_ld(items):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList",
            "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": n, "item": u} for i, (n, u) in enumerate(items)]}


# ---- Tool pages -----------------------------------------------------------------------
def tool_page(t):
    root, c = "../", CATS[t["category"]]
    title = f'{t["title_name"]} Online Free – No Upload | {SITE_NAME}'
    canonical = url(t["slug"])
    faq = t["faq"][:3]
    ld = (jsonld(faq_ld(faq)) + "\n    " +
          jsonld(crumbs_ld([("Home", url()), (t["name"], canonical)])) + "\n    " +
          jsonld({"@context": "https://schema.org", "@type": "WebApplication", "name": t["name"], "url": canonical,
                  "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any (runs in a web browser)",
                  "description": t["meta_description"], "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"}}))
    related = "".join(card(BY_ID[r], root) for r in t["related"])
    steps = "".join(f"<li>{e(s)}</li>" for s in t["steps"])
    body = f"""
        <div class="x-page"><div class="x-wrap">
          <ol class="x-crumb"><li><a href="{root}" data-i18n="home">Home</a></li><li><a href="{root}#cat-{t["category"]}" data-i18n="cat.{t["category"]}.name">{e(c["name"])}</a></li><li aria-current="page">{e(t["name"])}</li></ol>
          <div class="x-thead">{tile(t["category"], t["icon"], 28)}<h1>{e(t["name"])}</h1></div>
          <p class="x-lead" data-tdesc>{e(t["description"])}</p>
          <p class="x-privacy"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4"/></svg>{e(PRIVACY[t["privacy"]])}</p>
          <div id="x-tool"><noscript><p class="x-lead">This tool runs in your browser and needs JavaScript turned on.</p></noscript></div>
          <div class="x-about">
            <section class="x-box" aria-labelledby="x-h-how"><h2 id="x-h-how">{tile(t["category"], "list", 18)}<span data-i18n="tool.how">How to use</span></h2><ol class="x-how">{steps}</ol></section>
            <section class="x-box" aria-labelledby="x-h-about"><h2 id="x-h-about">{tile(t["category"], "info", 18)}About {e(t["name"])}</h2><p>{e(t["about"])}</p></section>
            <section class="x-box x-wide" aria-labelledby="x-h-faq"><h2 id="x-h-faq">{tile(t["category"], "help", 18)}<span data-i18n="tool.faq">FAQs</span></h2>{faq_html(faq)}</section>
          </div></div>
          <div class="ad-slot" data-slot="tool-below-instructions">Advertisement</div>
          <div class="x-wrap"><section class="x-sec"><h2 data-i18n="tool.related">Related tools</h2><div class="x-cards">{related}</div></section></div>
        </div>
      """
    return (head(title, t["meta_description"], canonical, root, ld) +
            f'\n  <body data-page="tool" data-tool="{t["id"]}" data-root="{root}">' + shell_top(root) + body + shell_bottom(root, tool_scripts(t)))


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
          jsonld({"@context": "https://schema.org", "@type": "ItemList", "name": "SugoiTools free online tools",
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
    page = (head(f"Page not found | {SITE_NAME}", "This page doesn't exist. Browse SugoiTools' free online tools instead.", "", root,
                 robots="noindex", base_script=base_script) +
            '\n  <body data-page="404" data-root="">' + shell_top(root) + body + shell_bottom(root, []))
    # Emit asset tags from script too, so they are only requested after <base> is set (no stray requests at deep paths).
    page = re.sub(r'(<link rel="(?:icon|stylesheet)"[^>]*/>)', lambda m: "<script>document.write('" + m.group(1) + "')</script>", page)
    page = re.sub(r'<script src="([^"]+)"></script>', lambda m: "<script>document.write('<script src=\"" + m.group(1) + "\"><\\/script>')</script>", page)
    return page


def main():
    slugs = {t["id"]: t["slug"] for t in TOOLS}
    write("assets/js/routes.js", "/* Generated by tools/build.py: tool id -> page folder. */\nwindow.SUGOI_SLUGS = " + json.dumps(slugs, indent=1) + ";\n")
    for t in TOOLS:
        write(f'{t["slug"]}/index.html', tool_page(t))
    write("index.html", home_page())
    for k, p in SITE["pages"].items():
        write(f"{k}/index.html", info_page(k, p))
    write("404.html", not_found_page())
    urls = [(url(), "1.0")] + [(url(t["slug"]), "0.8") for t in TOOLS] + [(url(k), "0.3") for k in SITE["pages"]]
    write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          "".join(f"  <url><loc>{u}</loc><lastmod>{LASTMOD}</lastmod><priority>{p}</priority></url>\n" for u, p in urls) + "</urlset>\n")
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {BASE}sitemap.xml\n")
    print(f"Built {len(TOOLS)} tool pages, home, {len(SITE['pages'])} info pages and 404 for {BASE}")


if __name__ == "__main__":
    main()
