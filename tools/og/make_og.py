#!/usr/bin/env python3
"""Make the 1200x630 share images (og:image / twitter:image): assets/og/<slug>.jpg for every tool,
plus assets/og/home.jpg. tools/build.py adds the meta tags for every image that exists.

Dev-only (not needed by build.py): pip install playwright && python3 -m playwright install chromium
Run from the repo root:  python3 tools/og/make_og.py      (re-run when a tool's name or description changes)
Font: Inter (SIL Open Font License), tools/og/inter-latin.woff2.
"""
import asyncio, base64, html, json, os
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
TOOLS = json.load(open(os.path.join(ROOT, "tools", "tools.json"), encoding="utf-8"))
SITE = json.load(open(os.path.join(ROOT, "tools", "site.json"), encoding="utf-8"))
OUT = os.path.join(ROOT, "assets", "og")
FONT = base64.b64encode(open(os.path.join(HERE, "inter-latin.woff2"), "rb").read()).decode()
COL = {"image": ("#2563FF", "#22B8E0"), "pdf": ("#E11D48", "#FB7185"), "video": ("#9333EA", "#EC4899"),
       "calculators": ("#059669", "#34D399"), "utilities": ("#EA6A0C", "#FBBF24"), "text": ("#4F46E5", "#A78BFA"),
       "creator": ("#0891B2", "#2DD4BF"), "home": ("#2563FF", "#06B6D4")}
e = html.escape


def page(title, sub, cat, icon, kicker):
    c1, c2 = COL[cat]
    d = SITE["icons"].get(icon) or SITE["icons"]["image"]
    size = 92 if len(title) <= 16 else 80 if len(title) <= 22 else 66
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face {{ font-family: I; src: url(data:font/woff2;base64,{FONT}) format("woff2"); font-weight: 100 900; }}
* {{ margin: 0; box-sizing: border-box; }}
body {{ width: 1200px; height: 630px; overflow: hidden; font-family: I, sans-serif; color: #fff; background: #0A0F1E; position: relative; }}
.b {{ position: absolute; border-radius: 50%; filter: blur(90px); opacity: .55; }}
.b1 {{ width: 620px; height: 620px; right: -160px; top: -220px; background: {c1}; }}
.b2 {{ width: 520px; height: 520px; right: 140px; bottom: -330px; background: {c2}; opacity: .4; }}
.grid {{ position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.04) 1px, transparent 1px); background-size: 48px 48px; }}
.w {{ position: absolute; inset: 64px 72px; display: flex; flex-direction: column; }}
.top {{ display: flex; align-items: center; gap: 16px; font-weight: 800; font-size: 34px; letter-spacing: -.5px; }}
.top small {{ font-weight: 500; font-size: 22px; color: #9FB0D0; margin-left: 6px; }}
.mid {{ flex: 1; display: flex; align-items: center; gap: 48px; }}
.tile {{ flex: none; width: 196px; height: 196px; border-radius: 48px; background: linear-gradient(135deg, {c1}, {c2}); display: grid; place-items: center; box-shadow: 0 30px 80px -20px {c1}; }}
.k {{ font-size: 26px; font-weight: 500; color: {c2}; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 14px; }}
h1 {{ font-size: {size}px; line-height: 1.02; font-weight: 800; letter-spacing: -2px; }}
p {{ margin-top: 20px; font-size: 30px; line-height: 1.3; color: #C7D2E8; font-weight: 500; max-width: 760px;
     display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }}
.bot {{ display: flex; justify-content: space-between; align-items: center; font-size: 24px; font-weight: 500; color: #9FB0D0; }}
.chips span {{ border: 1px solid rgba(255,255,255,.18); background: rgba(255,255,255,.06); padding: 10px 20px; border-radius: 999px; margin-right: 12px; color: #E6ECF8; }}
.url {{ font-weight: 800; color: #fff; }}
</style></head><body><i class="b b1"></i><i class="b b2"></i><i class="grid"></i>
<div class="w">
  <div class="top">{SITE["logo"].replace('width="36" height="36"', 'width="52" height="52"')}Toolsaku<small>作 · free online tools</small></div>
  <div class="mid">
    <div class="tile"><svg width="112" height="112" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="{d}"/></svg></div>
    <div><div class="k">{e(kicker)}</div><h1>{e(title)}</h1><p>{e(sub)}</p></div>
  </div>
  <div class="bot"><div class="chips"><span>100% free</span><span>No sign-up</span><span>Works on phone</span></div><div class="url">toolsak.online</div></div>
</div></body></html>"""


async def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [("home", page(f"{len(TOOLS)} free online tools", "Images, PDFs, videos, calculators and creator tools that run right in your browser.", "home", "grid", "Toolsaku"))]
    jobs += [(t["slug"], page(t["name"], t["description"], t["category"], t["icon"], SITE["cats"][t["category"]]["title"])) for t in TOOLS]
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1200, "height": 630})
        for slug, h in jobs:
            await pg.set_content(h)
            await pg.evaluate("document.fonts.ready")
            await pg.screenshot(path=os.path.join(OUT, slug + ".jpg"), type="jpeg", quality=86)
        await b.close()
    print(f"Wrote {len(jobs)} images to assets/og/")

asyncio.run(main())
