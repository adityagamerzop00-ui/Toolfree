# Toolora

Free online image, PDF, video, text and creator tools. Everything runs in the browser; files are never uploaded.

## Run locally
Open `index.html` in a browser, or serve the folder: `npx serve .`

## Deploy (Cloudflare Pages / Netlify / GitHub Pages)
Static site, no build step. Output directory: `/` (root).

## Files
- `index.html` – app shell, homepage, image tools, legal pages
- `pdf-tools.js` – Merge, Split, Organize, Compress, PDF to Images (pdf-lib + pdf.js from CDN)
- `video-tools.js` – Trimmer, Compressor, Resizer, Cropper, Converter, YouTube thumbnails (Mediabunny from CDN)
- `text-tools.js`, `creator-tools.js`, `creator-tools-2.js` – text and creator tools
- `ui-fx.js` – button sounds and animations
- `hark.css`, `hark.js` – base styles and components

## Before launch
- Replace placeholder contact email `contact@toolora.example`
- Add AdSense code to `.ad-slot` elements after approval
