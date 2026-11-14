# SugoiTools

**SugoiTools** (すごい, "amazing") is a set of 42 free online tools that run entirely in the browser:
image (resize, compress, convert, crop, rotate, edit, image to PDF), PDF (merge, split, compress, organize, PDF to image),
video (resize, crop, trim, compress, convert, YouTube thumbnails), creator tools (captions, titles, descriptions, hashtags, bios),
text tools, calculators (percentage, age, SIP, EMI, BMI, GST, scientific) and utilities (timers, stopwatch, passwords, QR codes,
unit converter, Base64/URL, JSON formatter, typing test). Files are processed on the user's device and are never uploaded.

It is a plain static site: no framework, no build step needed to deploy. Every tool has its own URL (for example
`/resize-image/`, `/merge-pdf/`, `/compress-video/`) with its own title, description, canonical URL, FAQ and structured data.

## Layout

```
index.html                 Home (lists every tool; "coming soon" tools are shown as non-linked cards)
<slug>/index.html          One page per tool (42 of them)
about/ privacy/ terms/ disclaimer/
404.html                   Not-found page (works at any depth, at a domain root or under /Toolfree/)
assets/css/                base.css (design tokens/components), site.css (SugoiTools styles)
assets/js/                 core.js (registry, chrome, router) + one script per tool family + i18n
sitemap.xml, robots.txt, favicon.svg
netlify.toml               Netlify config (publish ".", no build command)
.nojekyll                  Tells GitHub Pages to serve files as-is
tools/build.py             Page generator (re-run after editing copy or the base URL)
tools/tools.json           Per-tool data: slug, SEO title/description, steps, FAQ, related tools
tools/site.json            Categories, icons, home copy, info pages
```

All links and asset paths are **relative**, so the same files work at a domain root (Netlify, a custom domain)
and under a subpath (GitHub Pages project site such as `https://adityagamerzop00-ui.github.io/Toolfree/`).
Only canonical / Open Graph / sitemap URLs are absolute.

## Changing the site URL

Open `tools/build.py`, set `BASE_URL` (currently `https://sugoitools.netlify.app`), then run:

```bash
python3 tools/build.py
```

This rewrites every page, `sitemap.xml`, `robots.txt` and `assets/js/routes.js`. It needs only Python 3 (standard library).
Edit `tools/tools.json` to change a tool's slug, title, meta description, steps or FAQ, and re-run the same command.
If you serve the site under a different subpath than `/Toolfree/`, add it to `SUBPATH_PREFIXES` in `tools/build.py`
(only `404.html` needs it).

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000/
```

(`python -m http.server` does not serve `404.html` for missing pages; Netlify and GitHub Pages do.)

## Deploy

### Netlify
1. In Netlify, **Add new site → Import an existing project** and pick this GitHub repo.
2. Leave the build command empty and the publish directory as `.` (already set in `netlify.toml`).
3. Deploy. Netlify serves `404.html` automatically for unknown paths.
4. When you add a custom domain, set `BASE_URL` in `tools/build.py` to it, re-run the build and push.

### GitHub Pages
- The repo already deploys with a GitHub Actions workflow in `.github/` (not included here; keep yours).
  It should upload the repository root as the Pages artifact (e.g. `actions/upload-pages-artifact` with `path: .`).
- Alternatively: **Settings → Pages → Deploy from a branch**, branch `main`, folder `/ (root)`.
- `.nojekyll` is included so files are served as-is. No `CNAME` file is included; add one only when a custom domain is set.

### Cloudflare Pages
Connect the repo, framework preset **None**, build command empty, output directory `/`.

## After deploying
- Submit `sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- **TODO: contact email.** The old placeholder (`contact@sugoitools.example`) has been removed from every page and the
  Contact page was dropped. When you have a real address, add it to the About or Privacy page in `tools/site.json`
  (and a Contact page if you like), then re-run the build.
- The grey "Advertisement" boxes are placeholders for future ad slots (class `ad-slot`). Hide or fill them before launch.
- There is no social share image yet (`og:image`); add one to `head()` in `tools/build.py` if you want rich link previews.

## Notes
- PDF tools load pdf-lib / PDF.js, video tools load Mediabunny, and the QR generator loads qrcode-generator from public CDNs
  (jsDelivr / unpkg) when the tool opens. Files are still processed locally.
- Theme (light/dark) and language choices are remembered in `localStorage` (`sugoi-theme`, `sugoi-lang`).
