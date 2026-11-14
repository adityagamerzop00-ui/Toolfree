/* SugoiTools i18n: site chrome strings, language picker, RTL. Per-tool strings arrive via I18N.addStrings (i18n-tools.js). */
(function () {
  "use strict";
  var LANGS = [["en", "English"], ["hi", "हिन्दी"], ["es", "Español"], ["pt", "Português"], ["fr", "Français"], ["ar", "العربية"], ["bn", "বাংলা"], ["id", "Bahasa Indonesia"]];
  var CATS = ["image", "pdf", "video", "calculators", "utilities", "text", "creator"];
  var K = ["lang", "home", "menu", "menuClose", "search", "themeL", "themeD"];
  CATS.forEach(function (c) { K.push("cat." + c + ".name", "cat." + c + ".title", "cat." + c + ".all"); });
  K = K.concat(["hero.kicker", "hero.h1", "hero.em", "hero.lead", "search.ph", "search.none", "jump", "popular", "tools.one", "tools.other", "live", "soon",
    "how.title", "how.1", "how.1d", "how.2", "how.2d", "how.3", "how.3d", "how.4", "how.4d", "faq.title",
    "tool.about", "tool.how", "tool.faq", "tool.related",
    "ws.drop", "ws.tap", "ws.max", "ws.local", "ws.choose", "ws.orig", "ws.preview", "ws.dl", "ws.reset", "ws.busy", "ws.hint", "ws.err", "ws.read",
    "foot.tag", "foot.tools", "page.about", "page.contact", "page.privacy", "page.terms", "page.disclaimer",
    "nf.title", "nf.text", "browse", "soon.title", "meta.home"]);

  var L = {
    en: ["Language", "Home", "Menu", "Close menu", "Search tools", "Switch to light theme", "Switch to dark theme",
      "Image", "Image tools", "All image tools", "PDF", "PDF tools", "All PDF tools", "Video", "Video tools", "All video tools",
      "Calculators", "Calculators", "All calculators", "Utilities", "Utilities", "All utilities", "Text", "Text tools", "All text tools", "Creator", "Creator tools", "All creator tools",
      "{n} free tools · nothing uploaded", "Free online tools that work", "right in your browser", "Edit images, make PDFs and more — fast, private, no sign-up.",
      "What do you want to do today?", "No tools found for “{q}”. Try “resize”, “compress” or “jpg”.", "Jump to a category", "Popular", "{n} tool", "{n} tools", "LIVE", "SOON",
      "How SugoiTools works", "Pick a tool", "Search or browse by category.", "Add your file", "Drop it in or tap to choose.", "Adjust and preview", "See the result before you save.", "Download", "Your files never leave your device.", "Frequently asked questions",
      "About {tool}", "How to use", "FAQs", "Related tools",
      "Drop an image here or", "tap to choose", "max 20 MB", "Processed on your device — nothing is uploaded.", "Choose an image", "Original:", "Preview of the result", "Download", "Reset", "Processing…",
      "If download doesn't start, long-press the image to save it.", "Something went wrong while processing this image. Please try again.", "Couldn't read this file. Please try again.",
      "Free tools that run in your browser. Your files never leave your device.", "Tools", "About Us", "Contact", "Privacy Policy", "Terms of Use", "Disclaimer",
      "Page not found", "That page doesn't exist. Try one of our free tools instead.", "Browse all tools", "{tool} is coming soon", "SugoiTools – Free Online Image, PDF & Video Tools"],
    hi: ["भाषा", "होम", "मेन्यू", "मेन्यू बंद करें", "टूल खोजें", "लाइट थीम पर जाएँ", "डार्क थीम पर जाएँ",
      "इमेज", "इमेज टूल्स", "सभी इमेज टूल्स", "PDF", "PDF टूल्स", "सभी PDF टूल्स", "वीडियो", "वीडियो टूल्स", "सभी वीडियो टूल्स",
      "कैलकुलेटर", "कैलकुलेटर", "सभी कैलकुलेटर", "यूटिलिटी", "यूटिलिटी टूल्स", "सभी यूटिलिटी", "टेक्स्ट", "टेक्स्ट टूल्स", "सभी टेक्स्ट टूल्स", "क्रिएटर", "क्रिएटर टूल्स", "सभी क्रिएटर टूल्स",
      "{n} मुफ़्त टूल · कुछ भी अपलोड नहीं", "मुफ़्त ऑनलाइन टूल्स जो चलते हैं", "सीधे आपके ब्राउज़र में", "इमेज एडिट करें, PDF बनाएँ और भी बहुत कुछ — तेज़, निजी, बिना साइन-अप।",
      "आज आप क्या करना चाहते हैं?", "“{q}” के लिए कोई टूल नहीं मिला। “resize”, “compress” या “jpg” आज़माएँ।", "किसी श्रेणी पर जाएँ", "लोकप्रिय", "{n} टूल", "{n} टूल", "लाइव", "जल्द",
      "SugoiTools कैसे काम करता है", "टूल चुनें", "खोजें या श्रेणी के अनुसार देखें।", "अपनी फ़ाइल जोड़ें", "उसे यहाँ छोड़ें या चुनने के लिए टैप करें।", "बदलें और प्रीव्यू देखें", "सेव करने से पहले नतीजा देखें।", "डाउनलोड करें", "आपकी फ़ाइलें कभी आपके डिवाइस से बाहर नहीं जातीं।", "अक्सर पूछे जाने वाले सवाल",
      "{tool} के बारे में", "इस्तेमाल कैसे करें", "सवाल-जवाब", "मिलते-जुलते टूल",
      "इमेज यहाँ छोड़ें या", "चुनने के लिए टैप करें", "अधिकतम 20 MB", "आपके डिवाइस पर प्रोसेस होता है — कुछ भी अपलोड नहीं होता।", "इमेज चुनें", "मूल:", "नतीजे का प्रीव्यू", "डाउनलोड", "रीसेट", "प्रोसेस हो रहा है…",
      "अगर डाउनलोड शुरू न हो, तो सेव करने के लिए इमेज को देर तक दबाएँ।", "इस इमेज को प्रोसेस करते समय कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।", "यह फ़ाइल पढ़ी नहीं जा सकी। कृपया फिर से कोशिश करें।",
      "मुफ़्त टूल्स जो आपके ब्राउज़र में चलते हैं। आपकी फ़ाइलें कभी आपके डिवाइस से बाहर नहीं जातीं।", "टूल्स", "हमारे बारे में", "संपर्क", "गोपनीयता नीति", "उपयोग की शर्तें", "अस्वीकरण",
      "पेज नहीं मिला", "यह पेज मौजूद नहीं है। इसके बजाय हमारा कोई मुफ़्त टूल आज़माएँ।", "सभी टूल्स देखें", "{tool} जल्द आ रहा है", "SugoiTools – मुफ़्त ऑनलाइन इमेज, PDF और वीडियो टूल्स"],
    es: ["Idioma", "Inicio", "Menú", "Cerrar menú", "Buscar herramientas", "Cambiar a tema claro", "Cambiar a tema oscuro",
      "Imagen", "Herramientas de imagen", "Todas las de imagen", "PDF", "Herramientas PDF", "Todas las de PDF", "Vídeo", "Herramientas de vídeo", "Todas las de vídeo",
      "Calculadoras", "Calculadoras", "Todas las calculadoras", "Utilidades", "Utilidades", "Todas las utilidades", "Texto", "Herramientas de texto", "Todas las de texto", "Creadores", "Herramientas para creadores", "Todas las de creadores",
      "{n} herramientas gratis · nada se sube", "Herramientas online gratis que funcionan", "directamente en tu navegador", "Edita imágenes, crea PDF y mucho más: rápido, privado y sin registro.",
      "¿Qué quieres hacer hoy?", "No se encontraron herramientas para “{q}”. Prueba “resize”, “compress” o “jpg”.", "Ir a una categoría", "Populares", "{n} herramienta", "{n} herramientas", "ACTIVA", "PRONTO",
      "Cómo funciona SugoiTools", "Elige una herramienta", "Busca o explora por categoría.", "Añade tu archivo", "Suéltalo aquí o toca para elegirlo.", "Ajusta y previsualiza", "Mira el resultado antes de guardarlo.", "Descarga", "Tus archivos nunca salen de tu dispositivo.", "Preguntas frecuentes",
      "Acerca de {tool}", "Cómo usarla", "Preguntas frecuentes", "Herramientas relacionadas",
      "Suelta una imagen aquí o", "toca para elegir", "máx. 20 MB", "Se procesa en tu dispositivo: no se sube nada.", "Elige una imagen", "Original:", "Vista previa del resultado", "Descargar", "Restablecer", "Procesando…",
      "Si la descarga no empieza, mantén pulsada la imagen para guardarla.", "Algo salió mal al procesar esta imagen. Inténtalo de nuevo.", "No se pudo leer este archivo. Inténtalo de nuevo.",
      "Herramientas gratis que funcionan en tu navegador. Tus archivos nunca salen de tu dispositivo.", "Herramientas", "Sobre nosotros", "Contacto", "Política de privacidad", "Términos de uso", "Aviso legal",
      "Página no encontrada", "Esa página no existe. Prueba una de nuestras herramientas gratis.", "Ver todas las herramientas", "{tool} llegará pronto", "SugoiTools – Herramientas online gratis de imagen, PDF y vídeo"],
    pt: ["Idioma", "Início", "Menu", "Fechar menu", "Buscar ferramentas", "Mudar para tema claro", "Mudar para tema escuro",
      "Imagem", "Ferramentas de imagem", "Todas de imagem", "PDF", "Ferramentas de PDF", "Todas de PDF", "Vídeo", "Ferramentas de vídeo", "Todas de vídeo",
      "Calculadoras", "Calculadoras", "Todas as calculadoras", "Utilitários", "Utilitários", "Todos os utilitários", "Texto", "Ferramentas de texto", "Todas de texto", "Criadores", "Ferramentas para criadores", "Todas para criadores",
      "{n} ferramentas grátis · nada é enviado", "Ferramentas online grátis que funcionam", "direto no seu navegador", "Edite imagens, crie PDFs e muito mais — rápido, privado e sem cadastro.",
      "O que você quer fazer hoje?", "Nenhuma ferramenta encontrada para “{q}”. Tente “resize”, “compress” ou “jpg”.", "Ir para uma categoria", "Populares", "{n} ferramenta", "{n} ferramentas", "ATIVA", "EM BREVE",
      "Como o SugoiTools funciona", "Escolha uma ferramenta", "Pesquise ou navegue por categoria.", "Adicione seu arquivo", "Arraste-o ou toque para escolher.", "Ajuste e visualize", "Veja o resultado antes de salvar.", "Baixe", "Seus arquivos nunca saem do seu dispositivo.", "Perguntas frequentes",
      "Sobre {tool}", "Como usar", "Perguntas frequentes", "Ferramentas relacionadas",
      "Solte uma imagem aqui ou", "toque para escolher", "máx. 20 MB", "Processado no seu dispositivo — nada é enviado.", "Escolha uma imagem", "Original:", "Prévia do resultado", "Baixar", "Redefinir", "Processando…",
      "Se o download não começar, toque e segure a imagem para salvá-la.", "Algo deu errado ao processar esta imagem. Tente novamente.", "Não foi possível ler este arquivo. Tente novamente.",
      "Ferramentas grátis que funcionam no seu navegador. Seus arquivos nunca saem do seu dispositivo.", "Ferramentas", "Sobre nós", "Contato", "Política de privacidade", "Termos de uso", "Aviso legal",
      "Página não encontrada", "Essa página não existe. Experimente uma das nossas ferramentas grátis.", "Ver todas as ferramentas", "{tool} chega em breve", "SugoiTools – Ferramentas online grátis de imagem, PDF e vídeo"],
    fr: ["Langue", "Accueil", "Menu", "Fermer le menu", "Rechercher un outil", "Passer au thème clair", "Passer au thème sombre",
      "Image", "Outils image", "Tous les outils image", "PDF", "Outils PDF", "Tous les outils PDF", "Vidéo", "Outils vidéo", "Tous les outils vidéo",
      "Calculatrices", "Calculatrices", "Toutes les calculatrices", "Utilitaires", "Utilitaires", "Tous les utilitaires", "Texte", "Outils texte", "Tous les outils texte", "Créateurs", "Outils pour créateurs", "Tous les outils créateurs",
      "{n} outils gratuits · rien n’est envoyé", "Des outils en ligne gratuits qui fonctionnent", "directement dans votre navigateur", "Retouchez des images, créez des PDF et plus encore — rapide, privé, sans inscription.",
      "Que voulez-vous faire aujourd’hui ?", "Aucun outil trouvé pour « {q} ». Essayez « resize », « compress » ou « jpg ».", "Aller à une catégorie", "Populaires", "{n} outil", "{n} outils", "ACTIF", "BIENTÔT",
      "Comment fonctionne SugoiTools", "Choisissez un outil", "Recherchez ou parcourez par catégorie.", "Ajoutez votre fichier", "Déposez-le ou touchez pour le choisir.", "Réglez et prévisualisez", "Voyez le résultat avant d’enregistrer.", "Téléchargez", "Vos fichiers ne quittent jamais votre appareil.", "Questions fréquentes",
      "À propos de {tool}", "Mode d’emploi", "FAQ", "Outils similaires",
      "Déposez une image ici ou", "touchez pour choisir", "20 Mo max.", "Traité sur votre appareil — rien n’est envoyé.", "Choisir une image", "Original :", "Aperçu du résultat", "Télécharger", "Réinitialiser", "Traitement…",
      "Si le téléchargement ne démarre pas, appuyez longuement sur l’image pour l’enregistrer.", "Un problème est survenu lors du traitement de cette image. Veuillez réessayer.", "Impossible de lire ce fichier. Veuillez réessayer.",
      "Des outils gratuits qui fonctionnent dans votre navigateur. Vos fichiers ne quittent jamais votre appareil.", "Outils", "À propos", "Contact", "Politique de confidentialité", "Conditions d’utilisation", "Avertissement",
      "Page introuvable", "Cette page n’existe pas. Essayez plutôt l’un de nos outils gratuits.", "Voir tous les outils", "{tool} arrive bientôt", "SugoiTools – Outils en ligne gratuits pour images, PDF et vidéos"],
    ar: ["اللغة", "الرئيسية", "القائمة", "إغلاق القائمة", "ابحث عن أداة", "التبديل إلى المظهر الفاتح", "التبديل إلى المظهر الداكن",
      "الصور", "أدوات الصور", "كل أدوات الصور", "PDF", "أدوات PDF", "كل أدوات PDF", "الفيديو", "أدوات الفيديو", "كل أدوات الفيديو",
      "الحاسبات", "الحاسبات", "كل الحاسبات", "أدوات مساعدة", "أدوات مساعدة", "كل الأدوات المساعدة", "النصوص", "أدوات النصوص", "كل أدوات النصوص", "صنّاع المحتوى", "أدوات صنّاع المحتوى", "كل أدوات صنّاع المحتوى",
      "أدوات مجانية: {n} · لا يُرفع أي شيء", "أدوات مجانية على الإنترنت تعمل", "مباشرةً في متصفحك", "عدّل الصور وأنشئ ملفات PDF والمزيد — بسرعة وخصوصية ودون تسجيل.",
      "ماذا تريد أن تفعل اليوم؟", "لم يتم العثور على أدوات لـ «{q}». جرّب «resize» أو «compress» أو «jpg».", "انتقل إلى فئة", "الأكثر استخدامًا", "أداة واحدة", "{n} أداة", "متاحة", "قريبًا",
      "كيف يعمل SugoiTools", "اختر أداة", "ابحث أو تصفّح حسب الفئة.", "أضف ملفك", "اسحبه هنا أو اضغط للاختيار.", "عدّل وعاين", "شاهد النتيجة قبل الحفظ.", "نزّل", "ملفاتك لا تغادر جهازك أبدًا.", "الأسئلة الشائعة",
      "عن {tool}", "طريقة الاستخدام", "الأسئلة الشائعة", "أدوات ذات صلة",
      "اسحب صورة إلى هنا أو", "اضغط للاختيار", "الحد الأقصى 20 ميغابايت", "تتم المعالجة على جهازك — لا يُرفع أي شيء.", "اختر صورة", "الأصل:", "معاينة النتيجة", "تنزيل", "إعادة ضبط", "جارٍ المعالجة…",
      "إذا لم يبدأ التنزيل، اضغط مطولًا على الصورة لحفظها.", "حدث خطأ أثناء معالجة هذه الصورة. يُرجى المحاولة مرة أخرى.", "تعذّرت قراءة هذا الملف. يُرجى المحاولة مرة أخرى.",
      "أدوات مجانية تعمل في متصفحك. ملفاتك لا تغادر جهازك أبدًا.", "الأدوات", "من نحن", "اتصل بنا", "سياسة الخصوصية", "شروط الاستخدام", "إخلاء المسؤولية",
      "الصفحة غير موجودة", "هذه الصفحة غير موجودة. جرّب إحدى أدواتنا المجانية بدلًا منها.", "تصفّح كل الأدوات", "{tool} قادمة قريبًا", "SugoiTools – أدوات مجانية على الإنترنت للصور وملفات PDF والفيديو"],
    bn: ["ভাষা", "হোম", "মেনু", "মেনু বন্ধ করুন", "টুল খুঁজুন", "লাইট থিমে যান", "ডার্ক থিমে যান",
      "ছবি", "ছবির টুল", "সব ছবির টুল", "PDF", "PDF টুল", "সব PDF টুল", "ভিডিও", "ভিডিও টুল", "সব ভিডিও টুল",
      "ক্যালকুলেটর", "ক্যালকুলেটর", "সব ক্যালকুলেটর", "ইউটিলিটি", "ইউটিলিটি", "সব ইউটিলিটি", "টেক্সট", "টেক্সট টুল", "সব টেক্সট টুল", "ক্রিয়েটর", "ক্রিয়েটর টুল", "সব ক্রিয়েটর টুল",
      "{n}টি ফ্রি টুল · কিছুই আপলোড হয় না", "ফ্রি অনলাইন টুল যা কাজ করে", "সরাসরি আপনার ব্রাউজারে", "ছবি এডিট করুন, PDF বানান এবং আরও অনেক কিছু — দ্রুত, ব্যক্তিগত, সাইন-আপ ছাড়াই।",
      "আজ আপনি কী করতে চান?", "“{q}”-এর জন্য কোনো টুল পাওয়া যায়নি। “resize”, “compress” বা “jpg” লিখে দেখুন।", "একটি বিভাগে যান", "জনপ্রিয়", "{n}টি টুল", "{n}টি টুল", "লাইভ", "শীঘ্রই",
      "SugoiTools কীভাবে কাজ করে", "একটি টুল বাছুন", "খুঁজুন বা বিভাগ অনুযায়ী দেখুন।", "আপনার ফাইল যোগ করুন", "এখানে ছেড়ে দিন বা বাছতে ট্যাপ করুন।", "ঠিক করুন ও প্রিভিউ দেখুন", "সেভ করার আগে ফলাফল দেখুন।", "ডাউনলোড করুন", "আপনার ফাইল কখনো আপনার ডিভাইস ছেড়ে যায় না।", "সাধারণ প্রশ্নাবলি",
      "{tool} সম্পর্কে", "কীভাবে ব্যবহার করবেন", "প্রশ্নোত্তর", "সম্পর্কিত টুল",
      "এখানে একটি ছবি ছেড়ে দিন বা", "বাছতে ট্যাপ করুন", "সর্বোচ্চ 20 MB", "আপনার ডিভাইসেই প্রসেস হয় — কিছুই আপলোড হয় না।", "একটি ছবি বাছুন", "মূল:", "ফলাফলের প্রিভিউ", "ডাউনলোড", "রিসেট", "প্রসেস হচ্ছে…",
      "ডাউনলোড শুরু না হলে, ছবিটি সেভ করতে চেপে ধরে রাখুন।", "এই ছবিটি প্রসেস করার সময় কিছু ভুল হয়েছে। আবার চেষ্টা করুন।", "এই ফাইলটি পড়া যায়নি। আবার চেষ্টা করুন।",
      "ফ্রি টুল যা আপনার ব্রাউজারে চলে। আপনার ফাইল কখনো আপনার ডিভাইস ছেড়ে যায় না।", "টুল", "আমাদের সম্পর্কে", "যোগাযোগ", "গোপনীয়তা নীতি", "ব্যবহারের শর্তাবলি", "দায়মুক্তি",
      "পেজ পাওয়া যায়নি", "এই পেজটি নেই। বরং আমাদের কোনো ফ্রি টুল ব্যবহার করে দেখুন।", "সব টুল দেখুন", "{tool} শীঘ্রই আসছে", "SugoiTools – ফ্রি অনলাইন ছবি, PDF ও ভিডিও টুল"],
    id: ["Bahasa", "Beranda", "Menu", "Tutup menu", "Cari alat", "Beralih ke tema terang", "Beralih ke tema gelap",
      "Gambar", "Alat gambar", "Semua alat gambar", "PDF", "Alat PDF", "Semua alat PDF", "Video", "Alat video", "Semua alat video",
      "Kalkulator", "Kalkulator", "Semua kalkulator", "Utilitas", "Utilitas", "Semua utilitas", "Teks", "Alat teks", "Semua alat teks", "Kreator", "Alat kreator", "Semua alat kreator",
      "{n} alat gratis · tanpa unggah", "Alat online gratis yang bekerja", "langsung di browser Anda", "Edit gambar, buat PDF, dan lainnya — cepat, privat, tanpa daftar.",
      "Apa yang ingin Anda lakukan hari ini?", "Tidak ada alat untuk “{q}”. Coba “resize”, “compress”, atau “jpg”.", "Lompat ke kategori", "Populer", "{n} alat", "{n} alat", "AKTIF", "SEGERA",
      "Cara kerja SugoiTools", "Pilih alat", "Cari atau jelajahi per kategori.", "Tambahkan file", "Letakkan di sini atau ketuk untuk memilih.", "Atur dan pratinjau", "Lihat hasilnya sebelum disimpan.", "Unduh", "File Anda tidak pernah keluar dari perangkat.", "Pertanyaan umum",
      "Tentang {tool}", "Cara pakai", "Tanya jawab", "Alat terkait",
      "Letakkan gambar di sini atau", "ketuk untuk memilih", "maks. 20 MB", "Diproses di perangkat Anda — tidak ada yang diunggah.", "Pilih gambar", "Asli:", "Pratinjau hasil", "Unduh", "Atur ulang", "Memproses…",
      "Jika unduhan tidak dimulai, tekan lama gambar untuk menyimpannya.", "Terjadi kesalahan saat memproses gambar ini. Silakan coba lagi.", "File ini tidak dapat dibaca. Silakan coba lagi.",
      "Alat gratis yang berjalan di browser Anda. File Anda tidak pernah keluar dari perangkat.", "Alat", "Tentang Kami", "Kontak", "Kebijakan Privasi", "Ketentuan Penggunaan", "Penafian",
      "Halaman tidak ditemukan", "Halaman itu tidak ada. Coba salah satu alat gratis kami.", "Lihat semua alat", "{tool} segera hadir", "SugoiTools – Alat Online Gratis untuk Gambar, PDF & Video"],
  };

  var S = {};
  LANGS.forEach(function (l) { S[l[0]] = {}; });
  Object.keys(L).forEach(function (code) { K.forEach(function (k, i) { if (L[code][i] != null) S[code][k] = L[code][i]; }); });
  /* Arabic plural forms for the tool count */
  /* Ticker bar: tools, nosign, local, phone, langs, qr, typing, emi */
  var TK = ["tools", "nosign", "local", "phone", "langs", "clip", "typing", "emi"];
  var TL = {
    en: ["43 free tools", "No sign-up", "Files never leave your device", "Works on phone", "8 languages", "New: Long Video to Shorts Clipper", "New: Typing Speed Test", "New: EMI & SIP Calculators"],
    hi: ["43 मुफ़्त टूल", "साइन-अप की ज़रूरत नहीं", "फ़ाइलें आपके डिवाइस से बाहर नहीं जातीं", "फ़ोन पर चलता है", "8 भाषाएँ", "नया: लंबे वीडियो से शॉर्ट्स क्लिपर", "नया: टाइपिंग स्पीड टेस्ट", "नया: EMI और SIP कैलकुलेटर"],
    es: ["43 herramientas gratis", "Sin registro", "Tus archivos nunca salen de tu dispositivo", "Funciona en el móvil", "8 idiomas", "Nuevo: de vídeo largo a Shorts", "Nuevo: test de velocidad de escritura", "Nuevo: calculadoras EMI y SIP"],
    pt: ["43 ferramentas grátis", "Sem cadastro", "Seus arquivos nunca saem do seu dispositivo", "Funciona no celular", "8 idiomas", "Novo: de vídeo longo para Shorts", "Novo: teste de velocidade de digitação", "Novo: calculadoras EMI e SIP"],
    fr: ["43 outils gratuits", "Sans inscription", "Vos fichiers ne quittent jamais votre appareil", "Fonctionne sur mobile", "8 langues", "Nouveau : vidéo longue en Shorts", "Nouveau : test de vitesse de frappe", "Nouveau : calculateurs EMI et SIP"],
    ar: ["43 أداة مجانية", "بدون تسجيل", "ملفاتك لا تغادر جهازك أبدًا", "يعمل على الهاتف", "8 لغات", "جديد: من فيديو طويل إلى Shorts", "جديد: اختبار سرعة الكتابة", "جديد: حاسبات EMI و SIP"],
    bn: ["৪৩টি ফ্রি টুল", "সাইন-আপ লাগে না", "ফাইল আপনার ডিভাইসের বাইরে যায় না", "ফোনে চলে", "৮টি ভাষা", "নতুন: লম্বা ভিডিও থেকে শর্টস", "নতুন: টাইপিং স্পিড টেস্ট", "নতুন: EMI ও SIP ক্যালকুলেটর"],
    id: ["43 alat gratis", "Tanpa daftar", "File tidak pernah keluar dari perangkat Anda", "Berfungsi di ponsel", "8 bahasa", "Baru: Video panjang jadi Shorts", "Baru: Tes Kecepatan Mengetik", "Baru: Kalkulator EMI & SIP"],
  };
  Object.keys(TL).forEach(function (code) { TK.forEach(function (k, i) { S[code]["tick." + k] = TL[code][i]; }); });
  S.ar["tools.zero"] = "لا أدوات"; S.ar["tools.two"] = "أداتان"; S.ar["tools.few"] = "{n} أدوات"; S.ar["tools.many"] = "{n} أداة";

  var codes = LANGS.map(function (l) { return l[0]; });
  function detect() {
    try { var saved = localStorage.getItem("sugoi-lang"); if (saved && codes.indexOf(saved) > -1) return saved; } catch (e) {}
    var list = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"]);
    for (var i = 0; i < list.length; i++) { var c = String(list[i] || "").slice(0, 2).toLowerCase(); if (codes.indexOf(c) > -1) return c; }
    return "en";
  }
  var lang = detect();

  function fill(s, vars) { return vars ? String(s).replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }) : s; }
  function has(c, k) { return S[c] && Object.prototype.hasOwnProperty.call(S[c], k); }
  function t(key, fallback, vars) {
    var s = has(lang, key) ? S[lang][key] : has("en", key) ? S.en[key] : fallback != null ? fallback : key;
    return fill(s, vars);
  }
  function n(key, num) {
    var r = "other";
    try { r = new Intl.PluralRules(lang).select(num); } catch (e) {}
    var k = has(lang, key + "." + r) ? key + "." + r : has(lang, key + ".other") ? key + ".other" : (num === 1 ? key + ".one" : key + ".other");
    return t(k, String(num), { n: num.toLocaleString(lang) });
  }
  function addStrings(code, obj) {
    if (!S[code]) S[code] = {};
    for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) S[code][k] = obj[k];
  }

  var GLOBE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>';
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  /* Phone-menu picker, rendered by the page into its nav */
  function menuPicker() {
    return '<label class="x-lang-m">' + GLOBE + "<span>" + esc(t("lang")) + '</span><select class="x-lang-sel" aria-label="' + esc(t("lang")) + '">' +
      LANGS.map(function (l) { return '<option value="' + l[0] + '" lang="' + l[0] + '"' + (l[0] === lang ? " selected" : "") + ">" + l[1] + "</option>"; }).join("") + "</select></label>";
  }

  var box, btn, list;
  function open(on) {
    if (!box) return;
    list.hidden = !on; btn.setAttribute("aria-expanded", String(on));
    if (on) { var cur = list.querySelector('[aria-current="true"]') || list.querySelector("button"); if (cur) cur.focus(); }
  }
  function paint() {
    if (!box) return;
    btn.querySelector(".x-lang-code").textContent = lang.toUpperCase();
    btn.setAttribute("aria-label", t("lang") + ": " + LANGS[codes.indexOf(lang)][1]);
    list.querySelectorAll("button").forEach(function (b) { if (b.dataset.lang === lang) b.setAttribute("aria-current", "true"); else b.removeAttribute("aria-current"); });
  }
  function mount() {
    var anchor = document.getElementById("x-theme");
    if (!anchor || box) return;
    box = document.createElement("div");
    box.className = "x-lang";
    box.innerHTML = '<button type="button" class="x-hb x-lang-btn" aria-haspopup="true" aria-expanded="false" aria-controls="x-lang-list">' + GLOBE + '<span class="x-lang-code"></span></button>' +
      '<ul class="x-lang-list" id="x-lang-list" hidden>' + LANGS.map(function (l) { return '<li><button type="button" data-lang="' + l[0] + '" lang="' + l[0] + '"' + (l[0] === "ar" ? ' dir="rtl"' : "") + ">" + l[1] + "</button></li>"; }).join("") + "</ul>";
    anchor.parentNode.insertBefore(box, anchor);
    btn = box.querySelector(".x-lang-btn"); list = box.querySelector(".x-lang-list");
    btn.addEventListener("click", function () { open(list.hidden); });
    list.addEventListener("click", function (e) { var b = e.target.closest("[data-lang]"); if (b) { open(false); btn.focus(); setLang(b.dataset.lang); } });
    document.addEventListener("click", function (e) { if (!list.hidden && !box.contains(e.target)) open(false); });
    document.addEventListener("keydown", function (e) {
      if (list.hidden) return;
      if (e.key === "Escape") { open(false); btn.focus(); }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        var bs = [].slice.call(list.querySelectorAll("button")), i = bs.indexOf(document.activeElement);
        bs[(i + (e.key === "ArrowDown" ? 1 : bs.length - 1)) % bs.length].focus();
      }
    });
    paint();
  }
  document.addEventListener("change", function (e) { if (e.target.classList && e.target.classList.contains("x-lang-sel")) setLang(e.target.value); });

  function applyDoc() {
    var h = document.documentElement;
    h.setAttribute("lang", lang);
    h.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
  }
  function setLang(code) {
    if (codes.indexOf(code) < 0 || code === lang) return;
    lang = code; applyDoc(); paint();
    try { localStorage.setItem("sugoi-lang", code); } catch (e) {}
    window.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang: lang } }));
  }

  var css = document.createElement("style");
  css.textContent = [
    ".x-lang{position:relative;flex:none}",
    ".x-lang-btn{width:auto;display:inline-flex;align-items:center;gap:6px;padding:0 10px;font-size:13px;font-weight:600;letter-spacing:.04em}",
    ".x-lang-list{position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:40;min-width:200px;margin:0;padding:6px;list-style:none;background:var(--card);border:1px solid var(--line);border-radius:14px;box-shadow:0 18px 48px rgba(0,0,0,.35)}",
    ".x-lang-list[hidden]{display:none}",
    ".x-lang-list button{display:block;width:100%;min-height:44px;padding:0 12px;border:0;border-radius:10px;background:transparent;color:var(--navy);text-align:start;font-size:15px;cursor:pointer}",
    ".x-lang-list button:hover{background:var(--row-hover,var(--soft))}",
    ".x-lang-list button[aria-current=true]{background:var(--tint);color:var(--tint-ink);font-weight:600}",
    ".x-lang-m{display:none}",
    "@media (max-width:1000px){.x-lang-m{display:flex;align-items:center;gap:10px;min-height:44px;padding:6px 14px 2px;margin-top:6px;border-top:1px solid var(--line);color:var(--muted);font-size:14px}",
    ".x-lang-m select{margin-inline-start:auto;min-height:44px;max-width:60%;padding:0 12px;border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--navy);font-size:15px}}",
    "@media (max-width:420px){.x-lang{display:none}}",
    "@media (min-width:1001px) and (max-width:1200px){.x-nav a{padding:0 8px;font-size:14px}}",
    /* RTL mirroring */
    "[dir=rtl] .x-logo{margin-right:0;margin-left:8px}",
    "[dir=rtl] .x-nav{margin-left:0;margin-right:auto}",
    "[dir=rtl] .x-sbtn{margin-left:0;margin-right:4px}",
    "@media (max-width:1000px){[dir=rtl] .x-sbtn{margin-right:auto}}",
    "[dir=rtl] .x-search svg{left:auto;right:20px}",
    "[dir=rtl] .x-search input{padding:0 52px 0 20px}",
    "[dir=rtl] .x-card strong{padding-right:0;padding-left:4px}",
    "[dir=rtl] .x-live,[dir=rtl] .x-soon{right:auto;left:12px}",
    "[dir=rtl] .x-app a.x-card::after{margin-right:0;margin-left:4px;transform:rotate(-135deg)}",
    "[dir=rtl] .x-app a.x-card:hover::after{transform:translateX(-3px) rotate(-135deg)}",
    "[dir=rtl] .x-crumb li+li::before{margin-right:0;margin-left:6px}",
    "[dir=rtl] .x-cat-head a{margin-left:0;margin-right:auto}",
    "@media (max-width:400px){[dir=rtl] .x-cat-head a{margin-right:0}}",
    "[dir=rtl] .x-chip{text-align:right}",
    "[dir=rtl] .x-chip svg{margin-right:0;margin-left:4px}",
    "[dir=rtl] ol.x-how{padding-left:0;padding-right:22px}",
    "[dir=rtl] .x-tb{margin-left:0;margin-right:auto}",
    "[dir=rtl] .x-fx-mute{right:auto;left:16px}",
    "[dir=rtl] .x-app{overflow-x:clip}",
  ].join("\n");
  document.head.appendChild(css);

  applyDoc();
  window.I18N = {
    get lang() { return lang; },
    langs: LANGS,
    t: t, n: n, setLang: setLang, addStrings: addStrings, menuPicker: menuPicker, mount: mount,
    arrow: function () { return lang === "ar" ? "←" : "→"; },
  };
  mount();
})();

/* Upcoming tools section (homepage) */
(function () {
  var U = {
    en: ["Coming soon", "We're building these next"],
    hi: ["जल्द आ रहे हैं", "हम आगे ये टूल बना रहे हैं"],
    es: ["Próximamente", "Estamos creando estas herramientas"],
    pt: ["Em breve", "Estamos criando estas ferramentas"],
    fr: ["Bientôt disponible", "Nous préparons ces outils"],
    ar: ["قريبًا", "نعمل على هذه الأدوات الآن"],
    bn: ["শীঘ্রই আসছে", "আমরা এরপর এগুলো তৈরি করছি"],
    id: ["Segera hadir", "Kami sedang membuat alat-alat ini"],
  };
  for (var c in U) window.I18N.addStrings(c, { "upcoming.title": U[c][0], "upcoming.sub": U[c][1] });
})();

/* Logo tagline: "すごい · <means amazing>" */
(function () {
  var G = { en: "means amazing", hi: "मतलब कमाल", es: "significa increíble", pt: "significa incrível", fr: "veut dire génial", ar: "تعني رائع", bn: "মানে অসাধারণ", id: "artinya luar biasa" };
  for (var c in G) window.I18N.addStrings(c, { "logo.tag": G[c] });
})();
