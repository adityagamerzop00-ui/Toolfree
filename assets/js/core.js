/* SugoiTools core: tool registry, icons, site chrome, theme, search and the per-page router. Loaded on every page. */

      const T_ = (k, fb, v) => I18N.t(k, fb, v);
      const tName = (t) => T_(`tool.${t.key || t.id}.name`, t.name), tDesc = (t) => T_(`tool.${t.key || t.id}.desc`, t.description);
      /* Page context comes from <body data-page data-tool data-root>; links stay relative so the site works at a domain root or a subpath. */
      const BODY = document.body.dataset, PAGE_KIND = BODY.page || "home", ROOT = BODY.root || "";
      const SLUGS = window.SUGOI_SLUGS || {};
      const toolHref = (id) => ROOT + (SLUGS[id] || id) + "/";
      const catHref = (k) => (ROOT || "./") + "#cat-" + k;
      const cName = (k) => T_(`cat.${k}.name`, CATS[k].name), cTitle = (k) => T_(`cat.${k}.title`, CATS[k].title), cDesc = (k) => T_(`cat.${k}.desc`, CATS[k].desc);
      /* ===== Data ===== */
      const ICONS = {
        resize: "M4 9V4h5M20 15v5h-5M4 4l7 7M20 20l-7-7",
        compress: "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7",
        convert: "M4 7h13l-3-3M20 17H7l3 3",
        rotate: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5",
        crop: "M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2",
        image: "M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 9h.01",
        edit: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
        video: "M3 6h12v12H3zM15 10l6-4v12l-6-4",
        trim: "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12",
        download: "M12 3v12M7 10l5 5 5-5M4 21h16",
        upload: "M12 16V4M7 9l5-5 5 5M4 20h16",
        file: "M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6",
        merge: "M8 3v6l4 4 4-4V3M12 13v8",
        split: "M12 3v8l-4 4v6M12 11l4 4v6",
        layers: "M12 3l9 5-9 5-9-5zM3 13l9 5 9-5",
        chat: "M4 5h16v11H8l-4 4z",
        hash: "M5 9h14M5 15h14M10 3 8 21M16 3l-2 18",
        type: "M4 7V4h16v3M9 20h6M12 4v16",
        count: "M4 6h16M4 12h10M4 18h7",
        user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
        play: "M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3zM10 9l5 3-5 3z",
        search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5",
        flip: "M12 3v18M8 7l-5 5 5 5zM16 7l5 5-5 5z",
        text: "M4 6h16M4 10h16M4 14h10M4 18h7",
        calc: "M5 3h14v18H5zM8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15v3M8 18h.01M12 18h.01",
        percent: "M19 5 5 19M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
        cake: "M4 21h16v-8H4zM4 17c2.7 1.3 5.3-1.3 8 0s5.3 1.3 8 0M12 13V9M12 6.5V5",
        growth: "M3 17l6-6 4 4 8-8M15 7h6v6",
        bank: "M3 10l9-6 9 6M5 10v8M10 10v8M14 10v8M19 10v8M3 21h18",
        scale: "M4 4h16v16H4zM8 10a4 4 0 0 1 8 0zM12 10l2-3",
        receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
        clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
        timer: "M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z",
        stopwatch: "M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 10v4M10 2h4M12 2v4M18 6l2-2",
        key: "M15 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM10.8 13.2 3 21M6 18l3 3M16 8h.01",
        qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4",
        braces: "M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1",
        ruler: "M3 17 17 3l4 4L7 21zM7 13l2 2M10 10l2 2M13 7l2 2",
        case: "M3 18 7 6l4 12M4.5 14h5M15 10a3 3 0 1 1 0 6 3 3 0 0 1 0-6zM18 9v9",
        code: "M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16",
        keyboard: "M2 6h20v12H2zM6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10",
        grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
        sun: "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
        moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
        menu: "M4 6h16M4 12h16M4 18h16",
        close: "M6 6l12 12M18 6 6 18",
        info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01",
        list: "M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01",
        help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01",
        star: "M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z",
      };
      const ic = (n, s = 22) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n] || ICONS.image}"/></svg>`;
      const LOGO = `<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><defs><linearGradient id="xg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2563FF"/><stop offset="1" stop-color="#06B6D4"/></linearGradient></defs><rect width="36" height="36" rx="10" fill="url(#xg)"/><path d="M23 13.2c-1.1-1.6-3-2.5-5.3-2.5-3.1 0-5.2 1.7-5.2 4.1 0 2.6 2.4 3.6 5.3 4.3 3 .7 5.4 1.8 5.4 4.5 0 2.5-2.3 4.2-5.5 4.2-2.5 0-4.6-.9-5.8-2.6" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M27.5 5.5l1 2.6 2.6 1-2.6 1-1 2.6-1-2.6-2.6-1 2.6-1z" fill="#fff"/></svg>`;

      const CATS = {
        image: { name: "Image", title: "Image tools", icon: "image", desc: "Resize, compress, convert, crop, edit and rotate photos, or turn them into a PDF, in your browser." },
        pdf: { name: "PDF", title: "PDF tools", icon: "file", desc: "Merge and split PDFs, turn pages into images, or images into a PDF, in your browser." },
        video: { name: "Video", title: "Video tools", icon: "video", desc: "Resize, crop, trim, compress and convert videos, and save YouTube thumbnails, in your browser." },
        calculators: { name: "Calculators", title: "Calculators", icon: "calc", all: "All calculators", desc: "Age, percentage, SIP, loan EMI, BMI, GST and scientific calculators that work as you type." },
        utilities: { name: "Utilities", title: "Utilities", icon: "grid", all: "All utilities", desc: "Timers and a stopwatch, plus password and QR code generators, JSON, Base64 and URL tools, unit conversion and a typing test, right in your browser." },
        text: { name: "Text", title: "Text tools", icon: "type", desc: "Count words and characters, change text case and make fancy Unicode text, in your browser." },
        creator: { name: "Creator", title: "Creator tools", icon: "chat", desc: "Captions, titles, hashtags, descriptions and bios for social media, in your browser." },
      };
      const POPULAR = ["long-to-shorts", "image-compressor", "image-resizer", "merge-pdf", "age-calculator", "loan-calculator", "qr-code-generator", "word-character-counter", "typing-speed-test"];

      const FMT = "JPG, PNG or WEBP, up to 20 MB";
      /* Tool registry: add a tool by adding an entry. Live tools need render(mount) and info. */
      const TOOLS = [
        { id: "image-resizer", name: "Image Resizer", category: "image", icon: "resize", status: "live", popular: 1, added: 1,
          description: "Resize any image to exact pixels, a percentage or a social media preset.",
          keywords: "resize scale dimensions width height instagram story youtube thumbnail facebook cover passport hd shrink enlarge",
          render: (m) => toolResizer(m),
          info: { steps: ["Add a JPG, PNG or WEBP image.", "Type a width and height, pick a preset, or scale by a percentage.", "Check the preview and the new size.", "Tap Download to save the resized image."],
            about: "SugoiTools's Image Resizer changes the pixel dimensions of a photo without sending it anywhere. Keep the aspect ratio locked to avoid stretching, or pick a preset such as an Instagram post or YouTube thumbnail and the image is cropped from the centre to fill the new shape. PNG files stay PNG so transparency is kept; other images are saved as high-quality JPEG.",
            faq: [["Will resizing reduce quality?", "Making an image smaller keeps it sharp. Making it much larger than the original can look soft, because new pixels have to be invented."], ["What happens when I pick a preset with a different shape?", "By default the image is cropped from the centre to fill the preset exactly. Choose Stretch if you would rather keep everything in frame."], ["Is there a size limit?", "Files up to 20 MB, and output up to 10,000 pixels on each side."]] } },
        { id: "image-compressor", name: "Image Compressor", category: "image", icon: "compress", status: "live", popular: 1, added: 2,
          description: "Shrink image file size with a quality slider and see how much you saved.",
          keywords: "compress reduce file size kb mb optimize smaller jpeg webp quality",
          render: (m) => toolCompressor(m),
          info: { steps: ["Add a JPG, PNG or WEBP image.", "Move the quality slider; lower means a smaller file.", "Optionally set a maximum width and choose JPEG or WEBP.", "Compare the before and after size, then download."],
            about: "The Image Compressor re-encodes your photo at the quality you choose, and can scale it down to a maximum width for an even smaller file. Everything runs on a canvas inside your browser, so it works offline once the page has loaded and nothing is uploaded. If the compressed file comes out bigger than your original, SugoiTools tells you and lets you keep the original instead.",
            faq: [["What quality should I choose?", "70 is a good balance for photos on the web. Go to 80–90 for printing, or 40–60 when file size matters most."], ["JPEG or WEBP?", "WEBP is usually 25–35% smaller at the same quality and works in all modern browsers. JPEG opens everywhere."], ["Why is my file bigger after compressing?", "Already-optimised images, or PNGs with few colours, can grow when re-encoded. In that case, download the original."]] } },
        { id: "image-converter", name: "Image Converter", category: "image", icon: "convert", status: "live", popular: 1, added: 3,
          description: "Convert images between JPG, PNG and WEBP in one tap.",
          keywords: "convert format change jpg jpeg png webp transparent",
          render: (m) => toolConverter(m),
          info: { steps: ["Add a JPG, PNG or WEBP image.", "Choose JPG, PNG or WEBP as the output format.", "For JPG or WEBP, set the quality.", "Download the converted file with the right extension."],
            about: "Use the Image Converter to switch a picture to the format a website, app or printer expects. PNG keeps transparency and sharp edges, JPG is the most compatible for photos, and WEBP gives small files for the web. JPG has no transparency, so transparent areas are filled with white rather than turning black.",
            faq: [["Does converting to PNG improve quality?", "No. PNG is lossless, so it keeps what is there, but it cannot restore detail lost in an earlier JPG."], ["Why did my transparent background turn white?", "JPG cannot store transparency. Choose PNG or WEBP to keep it."], ["My browser can't make WEBP. What now?", "Some older browsers cannot create WEBP files. SugoiTools will tell you and you can choose PNG or JPG instead."]] } },
        { id: "rotate-flip", name: "Rotate & Flip", category: "image", icon: "rotate", status: "live", popular: 1, added: 4,
          description: "Rotate images 90° left or right and flip them horizontally or vertically.",
          keywords: "rotate flip mirror turn sideways upside down orientation 90 degrees",
          render: (m) => toolRotate(m),
          info: { steps: ["Add a JPG, PNG or WEBP image.", "Tap rotate left or right to turn it 90°.", "Tap flip to mirror it horizontally or vertically.", "Download it in its original format."],
            about: "Rotate & Flip fixes sideways phone photos and mirrored selfies in a couple of taps. The preview updates as you go, and the result is saved in the same format you started with, with the width and height swapped when you rotate a quarter turn.",
            faq: [["Does rotating lose quality?", "PNG stays lossless. JPG and WEBP are saved again at high quality, so the difference is very hard to see."], ["Can I rotate by any angle?", "This tool turns in 90° steps, which covers sideways and upside-down photos."], ["Why does my photo look rotated already?", "Your browser applies the orientation your camera recorded, so what you see in the preview is what you will download."]] } },
        { id: "image-cropper", name: "Image Cropper", category: "image", icon: "crop", status: "live", added: 5,
          description: "Crop images freely or to a fixed aspect ratio like 1:1, 4:5 or 16:9.",
          keywords: "crop cut trim aspect ratio square portrait landscape instagram 1:1 4:5 3:4 16:9 4:3",
          render: (m) => toolCropper(m),
          info: { steps: ["Add a JPG, PNG or WEBP image.", "Pick Free or a fixed aspect ratio such as Square 1:1 or Landscape 16:9.", "Drag inside the box to move it, or drag a corner to resize it.", "Tap Crop, check the preview, then Download."],
            about: "The Image Cropper cuts your photo down to the part that matters. Drag the crop box with a mouse or your finger, lock it to a common shape for Instagram, YouTube or print, and see the exact crop size in pixels as you go. The result keeps the original resolution of the area you chose and is saved in the same format as your original.",
            faq: [["Does cropping reduce quality?", "No. Cropping only removes pixels; the area you keep stays at its original resolution. JPG and WEBP are saved again at high quality."], ["Which aspect ratio should I use?", "Square 1:1 or Portrait 4:5 for Instagram posts, Landscape 16:9 for YouTube and screens, and 4:3 or 3:4 for prints and most phone photos."], ["Can I move the box with a keyboard?", "Yes. Click or tab to the image and use the arrow keys to move the crop box; hold Shift for bigger steps."]] } },
        { id: "images-to-pdf", name: "Images to PDF", category: "image", also: "pdf", icon: "file", status: "live", added: 6,
          description: "Turn up to 20 images into one PDF, in the order you choose.",
          keywords: "jpg to pdf png to pdf webp to pdf combine images photos document scan merge",
          render: (m) => toolPdf(m),
          info: { steps: ["Add up to 20 JPG, PNG or WEBP images.", "Use the arrows to put them in order, or × to remove one.", "Choose the page size, orientation and margin.", "Tap Create PDF, then download sugoitools.pdf."],
            about: "Images to PDF puts each picture on its own page of a single PDF, ready to email, print or upload as one document. Choose A4 or Letter pages, or let each page match its image. Auto orientation turns pages sideways for landscape photos. The PDF is built entirely in your browser, so your images are never uploaded.",
            faq: [["Is there a limit?", "Up to 20 images per PDF, each up to 20 MB. Very large photos are scaled to at most 4,000 pixels on the long side to keep the PDF a sensible size."], ["Why is my PNG's transparent background white?", "Pages are saved as JPEG inside the PDF, which has no transparency, so transparent areas become white like paper."], ["What does Auto orientation do?", "It uses a landscape page for wide images and a portrait page for tall ones. Fit to image makes each page exactly the shape of its image."]] } },
        { id: "photo-editor", name: "Photo Editor", category: "image", icon: "edit", status: "live", added: 7,
          description: "Adjust brightness, contrast and colour, add filters, borders and a watermark.",
          keywords: "edit filter brightness contrast saturation sepia grayscale black white vintage warm cool vivid border frame polaroid watermark text",
          render: (m) => toolEditor(m),
          info: { steps: ["Add a JPG, PNG or WEBP image.", "Adjust brightness, contrast and saturation, or tap a filter.", "Add a border or frame and an optional text watermark.", "Choose JPG or PNG and download."],
            about: "The Photo Editor covers the quick fixes most photos need: lighten a dark shot, add punch with contrast and saturation, or give it a look with one-tap filters such as Vintage, Warm or Vivid. Add a solid, rounded or Polaroid-style frame and a text watermark in any corner. The preview updates as you go and everything happens in your browser.",
            faq: [["Can it remove the background?", "Background removal isn't included yet — free browser-only options are too heavy for phones. It's planned for a later version."], ["Why choose PNG instead of JPG?", "PNG keeps transparency, including the corners of a Rounded frame, and is lossless. JPG files are much smaller for photos."], ["Will the watermark cover my photo?", "It sits inside the photo at the position you choose. Lower the opacity to make it subtle, or pick a corner to keep it out of the way."]] } },
        { id: "long-to-shorts", name: "Long Video to Shorts", category: "video", icon: "play", status: "live", added: 43, description: "Turn one long video into vertical 30–60 second Shorts and Reels with captions, hook titles and music.", keywords: "long video to shorts reels clipper clip maker youtube shorts instagram reels captions vertical 9:16" },
        { id: "video-resizer", name: "Video Resizer", category: "video", icon: "resize", status: "live", description: "Change a video's resolution or reshape it for Reels, Shorts and TikTok.", keywords: "video resize reels tiktok" },
        { id: "video-cropper", name: "Video Cropper", category: "video", icon: "crop", status: "live", description: "Crop the frame of a video to any shape, right in your browser.", keywords: "video crop" },
        { id: "video-trimmer", name: "Video Trimmer", category: "video", icon: "trim", status: "live", description: "Cut the start and end off a video, right in your browser.", keywords: "video trim cut clip" },
        { id: "video-compressor", name: "Video Compressor", category: "video", icon: "compress", status: "live", description: "Make a video file smaller, right in your browser.", keywords: "video compress reduce size mp4" },
        { id: "video-converter", name: "Video Converter", category: "video", icon: "convert", status: "live", description: "Convert videos to MP4, WebM or MOV, or pull out the audio.", keywords: "video convert mp4 webm mov" },
        { id: "youtube-thumbnail-downloader", name: "YouTube Thumbnail Downloader", category: "video", icon: "play", status: "live", description: "Get the thumbnail images of any YouTube video in every size.", keywords: "youtube thumbnail download" },
        { id: "merge-pdf", name: "Merge PDF", category: "pdf", icon: "merge", status: "live", description: "Combine several PDFs into one file, in the order you choose.", keywords: "pdf merge combine join" },
        { id: "split-pdf", name: "Split PDF", category: "pdf", icon: "split", status: "live", description: "Extract pages, or split a PDF into single pages or chunks.", keywords: "pdf split extract pages" },
        { id: "compress-pdf", name: "Compress PDF", category: "pdf", icon: "compress", status: "live", description: "Make a PDF smaller by turning its pages into compressed images.", keywords: "pdf compress reduce size" },
        { id: "organize-pdf", key: "pdf-page-organizer", name: "PDF Page Organizer", category: "pdf", icon: "layers", status: "live", description: "Reorder, rotate and delete the pages of a PDF.", keywords: "pdf organize reorder delete pages" },
        { id: "pdf-to-images", name: "PDF to Images", category: "pdf", icon: "image", status: "live", description: "Turn every page of a PDF into a JPG or PNG image.", keywords: "pdf to jpg png images" },
        { id: "instagram-caption-generator", name: "Instagram Caption Generator", category: "creator", icon: "chat", status: "live", description: "Caption ideas for any topic, in four tones, with optional call to action and hashtags.", keywords: "instagram caption" },
        { id: "youtube-title-generator", name: "YouTube Title Generator", category: "creator", icon: "play", status: "live", description: "Clickable YouTube title ideas with a character count for each.", keywords: "youtube title" },
        { id: "video-description-templates", name: "Video Description Templates", category: "creator", icon: "text", status: "live", description: "Full YouTube descriptions with timestamps, links and socials.", keywords: "youtube description template" },
        { id: "hashtag-suggestions", name: "Hashtag Suggestions", category: "creator", icon: "hash", status: "live", description: "Up to 30 hashtags for your keyword, grouped into broad, niche and variants.", keywords: "hashtags tags instagram tiktok" },
        { id: "bio-generator", name: "Bio Generator", category: "creator", icon: "user", status: "live", description: "Eight short bios at a time for Instagram, X, LinkedIn or YouTube.", keywords: "bio profile instagram tiktok" },
        { id: "fancy-text-generator", name: "Fancy Text Generator", category: "text", icon: "type", status: "live", description: "Turn plain text into bold, script, bubble and other Unicode styles to copy.", keywords: "fancy text fonts unicode" },
        { id: "word-character-counter", name: "Word & Character Counter", category: "text", icon: "count", status: "live", description: "Count words, characters, sentences and reading time as you type.", keywords: "word count character counter" },
        /* Calculators and utilities: render and info come from calc-tools.js and util-tools.js */
        { id: "percentage-calculator", name: "Percentage Calculator", category: "calculators", icon: "percent", status: "live", added: 35, description: "Work out X% of Y, what percent X is of Y, and the % change between two numbers.", keywords: "percent percentage calculator % of increase decrease change discount marks" },
        { id: "age-calculator", name: "Age Calculator", category: "calculators", icon: "cake", status: "live", added: 34, description: "Your exact age in years, months and days, plus your next birthday countdown.", keywords: "age calculator birthday date of birth dob how old years months days" },
        { id: "sip-calculator", name: "SIP Calculator", category: "calculators", icon: "growth", status: "live", added: 33, description: "Estimate what a monthly SIP could grow to, with invested amount and returns in ₹.", keywords: "sip calculator mutual fund monthly investment returns rupee inr compound" },
        { id: "loan-calculator", name: "Loan / EMI Calculator", category: "calculators", icon: "bank", status: "live", added: 32, description: "Monthly EMI, total interest and a year-by-year repayment table for any loan.", keywords: "emi loan calculator home car personal interest amortization repayment" },
        { id: "bmi-calculator", name: "BMI Calculator", category: "calculators", icon: "scale", status: "live", added: 31, description: "Body Mass Index from your height and weight, in metric or imperial units.", keywords: "bmi calculator body mass index weight height kg lb cm feet health" },
        { id: "gst-calculator", name: "GST Calculator", category: "calculators", icon: "receipt", status: "live", added: 30, description: "Add or remove GST at 5%, 12%, 18%, 28% or any rate, with the CGST and SGST split.", keywords: "gst calculator tax cgst sgst inclusive exclusive india invoice" },
        { id: "scientific-calculator", name: "Scientific Calculator", category: "calculators", icon: "calc", status: "live", added: 29, description: "A scientific calculator with trig, logs, powers and roots, by tap or keyboard.", keywords: "scientific calculator sin cos tan log ln power root math" },
        { id: "pomodoro-timer", name: "Pomodoro Timer", category: "utilities", icon: "timer", status: "live", added: 28, description: "Focus in 25-minute sessions with short and long breaks and a chime between them.", keywords: "pomodoro timer focus study productivity break work" },
        { id: "timer-online", name: "Online Timer", category: "utilities", icon: "clock", status: "live", added: 27, description: "A countdown timer with big digits, quick presets and an alarm when time is up.", keywords: "timer countdown online alarm minutes kitchen" },
        { id: "stopwatch-online", name: "Online Stopwatch", category: "utilities", icon: "stopwatch", status: "live", added: 26, description: "A precise stopwatch with laps, lap times and splits to the hundredth of a second.", keywords: "stopwatch online lap split time running" },
        /* Add-on tools: render and info come from more-tools.js */
        { id: "password-generator", name: "Password Generator", category: "utilities", icon: "key", status: "live", added: 36, description: "Strong random passwords with your choice of length, character sets and a strength meter.", keywords: "password generator strong random secure passphrase symbols numbers entropy" },
        { id: "unit-converter", name: "Unit Converter", category: "utilities", icon: "ruler", status: "live", added: 37, description: "Convert length, weight, temperature, area, volume, speed, time and data units.", keywords: "unit converter convert length weight temperature celsius fahrenheit km miles kg lb area volume speed time data mb gb mib gib" },
        { id: "base64-encoder-decoder", name: "Base64 & URL Encoder / Decoder", category: "utilities", icon: "code", status: "live", added: 38, description: "Encode or decode Base64 with full UTF-8, make data URLs from files, and URL-encode text.", keywords: "base64 encode decode data url file url encoder decoder percent encoding encodeuricomponent urlencode" },
        { id: "typing-speed-test", name: "Typing Speed Test", category: "utilities", icon: "keyboard", status: "live", added: 39, description: "Test your typing speed in WPM and accuracy over 30, 60 or 120 seconds.", keywords: "typing speed test wpm words per minute accuracy keyboard practice" },
        { id: "qr-code-generator", name: "QR Code Generator", category: "utilities", icon: "qr", status: "live", added: 40, description: "Make a QR code from text or a link, with custom colours, and download PNG or SVG.", keywords: "qr code generator url link barcode scan png svg" },
        { id: "json-formatter", name: "JSON Formatter", category: "utilities", icon: "braces", status: "live", added: 41, description: "Format, minify and validate JSON, with the line and column of any error.", keywords: "json formatter beautify pretty print minify validate validator lint" },
        { id: "text-case-converter", name: "Text Case Converter", category: "text", icon: "case", status: "live", added: 42, description: "Switch text to UPPER, lower, Title, Sentence, camelCase, snake_case, kebab-case and more.", keywords: "text case converter uppercase lowercase title sentence camelcase pascalcase snake case kebab alternate inverse capitalize" },
      ];

      /* ===== Helpers ===== */
      const $ = (s, r = document) => r.querySelector(s);
      const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
      const fmtSize = (b) => (b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(2) + " MB");
      const dataSize = (u) => { const b = u.slice(u.indexOf(",") + 1); return Math.floor((b.length * 3) / 4) - (b.endsWith("==") ? 2 : b.endsWith("=") ? 1 : 0); };
      const byId = Object.fromEntries(TOOLS.map((t) => [t.id, t]));
      const live = () => TOOLS.filter((t) => t.status === "live");
      const ad = (slot) => `<div class="ad-slot" data-slot="${slot}">Advertisement</div>`;
      const faqHtml = (list) => `<div class="x-faq">${list.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join("")}</div>`;
      const tile = (k, icon, s) => `<span class="x-ic" data-c="${k}">${ic(icon, s)}</span>`;
      function card(t) {
        const soon = t.status !== "live";
        const badge = soon ? `<span class="x-soon">${T_("soon")}</span>` : `<span class="x-live"><i aria-hidden="true"></i>${T_("live")}</span>`;
        const inner = `${badge}${tile(t.category, t.icon)}<span class="x-cb"><strong>${esc(tName(t))}</strong><span>${esc(tDesc(t))}</span></span>`;
        return soon ? `<div class="x-card is-soon" aria-disabled="true">${inner}</div>` : `<a class="x-card" href="${toolHref(t.id)}" data-tool-card="${t.id}">${inner}</a>`;
      }
      const cards = (list) => `<div class="x-cards">${list.map(card).join("")}</div>`;
      function search(q) {
        const words = q.toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length) return [];
        return TOOLS.filter((t) => { const hay = `${t.name} ${t.description} ${t.keywords || ""} ${CATS[t.category].name} ${tName(t)} ${tDesc(t)} ${cName(t.category)}`.toLowerCase(); return words.every((w) => hay.includes(w)); })
          .sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1));
      }
      function setMeta(title, desc) {
        document.title = title;
        $('meta[name="description"]').content = desc;
        $('meta[property="og:title"]').content = title;
        $('meta[property="og:description"]').content = desc;
      }

      /* ===== Views ===== */
      const view = $("#x-view");
      const HOME_FAQ = [["Is SugoiTools really free?", "Yes. Every tool is free to use with no sign-up, no watermark and no daily limit."], ["Are my files uploaded?", "No. Your files are processed on your own device, inside your browser. Nothing is sent to a server."], ["Is there a file size limit?", "Image tools take files up to 20 MB each, PDF tools up to 50 MB and video tools up to 500 MB. Very large files can be slow on older phones."], ["Does it work on my phone?", "Yes. SugoiTools works in modern browsers on iPhone, Android, tablets and computers."], ["Which formats are supported?", "Image tools open and save JPG, PNG and WEBP. Video tools open MP4, MOV, WEBM and MKV and save MP4 (or WebM, MOV and audio in the converter). PDF tools work with standard PDF files."]];
      /* Upcoming tools: shown on the homepage only; kept out of TOOLS, search and counts */
      const UPCOMING = [
        ["Currency Converter", "calculators", "convert"], ["Income Tax Calculator", "calculators", "receipt"], ["Markdown Editor", "text", "edit"],
        ["Invoice Generator", "utilities", "file"], ["Resume Builder", "creator", "user"], ["Color Picker", "utilities", "grid"],
        ["Lorem Ipsum Generator", "text", "text"], ["Slug Generator", "text", "code"], ["Meta Title & Description Generator", "creator", "type"],
        ["Image to Text (OCR)", "image", "image"], ["GIF Maker", "video", "play"], ["Text to Speech", "text", "chat"],
        ["Screen Recorder", "video", "video"], ["Remove Background", "image", "layers"], ["PDF to Word", "pdf", "convert"],
        ["Word to PDF", "pdf", "file"], ["Grammar Checker", "text", "case"], ["Cover Letter Generator", "creator", "edit"],
      ];
      function home() {
        setMeta(T_("meta.home"), "Free online tools that run in your browser: resize and compress images, merge and split PDFs, trim and compress videos, calculators and more. No sign-up, no upload.");
        const groups = Object.entries(CATS).map(([k, c]) => [k, c, TOOLS.filter((t) => t.category === k)]).filter((g) => g[2].length);
        const pop = POPULAR.map((id) => byId[id]).filter((t) => t && t.status === "live");
        const mid = Math.ceil(groups.length / 2);
        const catSec = ([k, c, list]) => `<section class="x-sec x-catsec" id="cat-${k}" aria-labelledby="h-${k}"><div class="x-wrap"><div class="x-cat-head">${tile(k, c.icon)}<h2 id="h-${k}">${cTitle(k)}</h2><span class="x-count">${I18N.n("tools", list.length)}</span></div>${cards(list)}</div></section>`;
        view.innerHTML = `
          <section class="x-hero"><div class="x-wrap">
            <p class="x-kicker"><span class="x-live" style="position:static"><i aria-hidden="true"></i>${T_("live")}</span>${T_("hero.kicker", "", { n: live().length })}</p>
            <h1>${T_("hero.h1")} <em>${T_("hero.em")}</em></h1>
            <p class="x-lead">${T_("hero.lead")}</p>
            <div class="x-search" role="search">${ic("search")}<input id="x-q" type="search" aria-label="${T_("search")}" placeholder="${T_("search.ph")}" autocomplete="off"></div>
            <div class="x-results" id="x-res" aria-live="polite"></div>
          </div></section>
          <nav class="x-chipbar" aria-label="${T_("jump")}"><div class="x-wrap">${groups.map(([k, c, list]) => `<button type="button" class="x-cbtn" data-go="${k}">${tile(k, c.icon, 16)}${cName(k)} <small>${list.length}</small></button>`).join("")}</div></nav>
          <section class="x-sec x-sec-sm"><div class="x-wrap"><h2>${ic("star", 18)} ${T_("popular")}</h2><div class="x-pop">${pop.map((t) => `<a href="${toolHref(t.id)}">${tile(t.category, t.icon, 20)}${esc(tName(t))}</a>`).join("")}</div></div></section>
          ${groups.slice(0, mid).map(catSec).join("")}
          ${ad("home-1")}
          ${groups.slice(mid).map(catSec).join("")}
          ${ad("home-2")}
          <section class="x-sec"><div class="x-wrap"><h2>${T_("how.title")}</h2>
            <ol class="x-steps">${[1, 2, 3, 4].map((i) => `<li><strong>${T_(`how.${i}`)}</strong><span>${T_(`how.${i}d`)}</span></li>`).join("")}</ol>
          </div></section>
          <section class="x-sec"><div class="x-wrap"><h2>${T_("faq.title")}</h2>${faqHtml(HOME_FAQ)}</div></section>
          <section class="x-sec x-upcoming" aria-labelledby="h-upcoming"><div class="x-wrap"><h2 id="h-upcoming">${T_("upcoming.title", "Coming soon")}</h2><p class="x-lead">${T_("upcoming.sub", "We're building these next")}</p>
            <div class="x-cards">${UPCOMING.map(([name, cat, icon]) => `<div class="x-card is-soon" aria-disabled="true"><span class="x-soon">${T_("soon", "Soon")}</span>${tile(cat, icon)}<span class="x-cb"><strong>${esc(name)}</strong></span></div>`).join("")}</div>
          </div></section>`;
        const q = $("#x-q"), res = $("#x-res");
        q.addEventListener("input", () => {
          const v = q.value.trim(), r = search(v);
          res.innerHTML = !v ? "" : r.length ? cards(r) : `<p class="x-empty">${T_("search.none", "", { q: esc(v) })}</p>`;
        });
        /* chip bar: jump to a category, and follow the scroll */
        const bar = $(".x-chipbar .x-wrap"), chips = [...bar.querySelectorAll(".x-cbtn")];
        const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
        const mark = (k) => chips.forEach((b) => {
          const on = b.dataset.go === k; b.classList.toggle("is-on", on);
          if (on) { b.setAttribute("aria-current", "true"); const l = b.offsetLeft - bar.offsetLeft, r = l + b.offsetWidth; if (l < bar.scrollLeft || r > bar.scrollLeft + bar.clientWidth) bar.scrollTo({ left: l - 16, behavior: reduce ? "auto" : "smooth" }); }
          else b.removeAttribute("aria-current");
        });
        chips.forEach((b) => b.addEventListener("click", () => { const s = document.getElementById("cat-" + b.dataset.go); if (s) { s.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" }); mark(b.dataset.go); } }));
        if (window.IntersectionObserver) {
          const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) mark(e.target.id.slice(4)); }), { rootMargin: "-40% 0px -55% 0px" });
          document.querySelectorAll(".x-catsec").forEach((s) => io.observe(s));
        }
      }
      /* Static tool page: put translated names on the server-rendered heading, lead and related cards. */
      function relabel(t) {
        const h = $(".x-thead h1"), l = $("[data-tdesc]");
        if (h) h.textContent = tName(t);
        if (l) l.textContent = tDesc(t);
        const cur = $(".x-crumb [aria-current]"); if (cur) cur.textContent = tName(t);
        document.querySelectorAll("[data-tool-card]").forEach((a) => { const x = byId[a.dataset.toolCard]; if (!x) return; const s = a.querySelector("strong"), d = a.querySelector(".x-cb > span"); if (s) s.textContent = tName(x); if (d) d.textContent = tDesc(x); });
      }

      /* ===== Router (one page per tool; tool scripts call route() after registering) ===== */
      let ready = false, mounted = null;
      function route(force) {
        if (!ready) return;
        const id = BODY.tool, t = id ? byId[id] : null;
        if (PAGE_KIND === "home") {
          home();
          const h = location.hash;
          if (h === "#search" && $("#x-q")) $("#x-q").focus();
          else if (h.startsWith("#cat-")) { const s = document.getElementById(h.slice(1)); if (s) s.scrollIntoView({ block: "start" }); }
        } else if (PAGE_KIND === "tool" && t && t.render) {
          if (mounted !== t || force === true) { const m = $("#x-tool"); if (m) { m.innerHTML = ""; t.render(m); mounted = t; } }
          if (I18N.lang !== "en" || force === true) relabel(t);
        }
        document.querySelectorAll("#x-nav a").forEach((l) => l.classList.toggle("is-on", !!(t && l.dataset.cat === t.category)));
      }
      document.querySelectorAll("[data-logo]").forEach((s, i) => (s.outerHTML = LOGO.replace(/xg/g, "xg" + i)));
      /* site chrome in the current language; re-run on language change */
      function chrome(first) {
        $("#x-nav").innerHTML = Object.keys(CATS).map((k) => `<a href="${catHref(k)}" data-cat="${k}">${cName(k)}</a>`).join("") + I18N.menuPicker();
        $("#x-fcats").innerHTML = Object.keys(CATS).map((k) => `<li><a href="${catHref(k)}">${cTitle(k)}</a></li>`).join("");
        document.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = T_(el.dataset.i18n, el.textContent)));
        $("#x-sbtn").setAttribute("aria-label", T_("search"));
        $("#x-nav").setAttribute("aria-label", T_("jump"));
        if (!first) { setTheme(root.getAttribute("data-theme") || "dark"); menu(false); }
      }
      chrome(true);
      window.addEventListener("i18n:change", () => { chrome(); route(true); });
      $("#x-sbtn").innerHTML = ic("search", 20);
      /* theme: dark by default; the choice is remembered in localStorage */
      const root = document.documentElement, themeBtn = $("#x-theme");
      themeBtn.innerHTML = `<span class="x-moon">${ic("moon", 20)}</span><span class="x-sun">${ic("sun", 20)}</span>`;
      function setTheme(t) {
        root.setAttribute("data-theme", t);
        themeBtn.setAttribute("aria-label", T_(t === "dark" ? "themeL" : "themeD"));
        themeBtn.setAttribute("aria-pressed", String(t === "dark"));
        $('meta[name="theme-color"]').content = t === "dark" ? "#0A0F1E" : "#FFFFFF";
      }
      let savedTheme = null; try { savedTheme = localStorage.getItem("sugoi-theme"); } catch (e) {}
      setTheme(savedTheme === "light" ? "light" : "dark");
      themeBtn.addEventListener("click", () => { const n = root.getAttribute("data-theme") === "dark" ? "light" : "dark"; setTheme(n); try { localStorage.setItem("sugoi-theme", n); } catch (e) {} });
      /* phone menu */
      const burger = $("#x-burger"), nav = $("#x-nav");
      function menu(open) { nav.classList.toggle("is-open", open); burger.setAttribute("aria-expanded", String(open)); burger.setAttribute("aria-label", T_(open ? "menuClose" : "menu")); burger.innerHTML = ic(open ? "close" : "menu", 20); }
      menu(false);
      burger.addEventListener("click", () => menu(!nav.classList.contains("is-open")));
      nav.addEventListener("click", (e) => { if (e.target.closest("a")) menu(false); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && nav.classList.contains("is-open")) { menu(false); burger.focus(); } });
      document.addEventListener("click", (e) => { if (nav.classList.contains("is-open") && !e.target.closest("#x-nav, #x-burger")) menu(false); });
      $("#x-sbtn").addEventListener("click", () => { if (PAGE_KIND !== "home" || !$("#x-q")) { location.href = (ROOT || "./") + "#search"; return; } window.scrollTo({ top: 0, behavior: "instant" }); const s = $(".x-search"); s.classList.remove("is-flash"); void s.offsetWidth; s.classList.add("is-flash"); $("#x-q").focus(); });

      ["dragover", "drop"].forEach((ev) => window.addEventListener(ev, (e) => e.preventDefault()));
      const toB64 = (b) => { let s = ""; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); };
      window.Toolora = { tools: TOOLS, byId, cats: CATS, ic, esc, fmtSize, toB64, route };
      /* Tool scripts load after this file; mount once everything has run. */
      document.addEventListener("DOMContentLoaded", () => { ready = true; route(); });
    