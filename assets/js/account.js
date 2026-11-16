/* Toolsaku optional account: header "Account" button + "Post to YouTube / Instagram / Facebook" on Clipper results.
   Tools never need it. Nothing here pops up by itself: login starts only when someone taps a Connect button.
   Talks to the VPS backend at /api/ (server/api/app.py). If the backend is not reachable, it stays quiet. */
(function () {
  "use strict";
  if (!window.I18N || !window.fetch) return;
  window.__ltsAcct = true; // the clipper shows "Post to YouTube with this kit" only when this file is on the page

  /* ---------- Strings (8 languages) ---------- */
  var K = ["btn", "title", "opt", "why", "google", "yt", "ig", "fb", "cyt", "cig", "cfb", "signed", "connected", "none", "disc", "out", "del", "delQ",
    "unavail", "postTo", "post", "posting", "upl", "proc", "pub", "done", "open", "fail", "send", "ytTitle", "desc", "tags", "cap", "priv", "pPriv", "pUnl", "pPub",
    "ytNote", "igMp4", "acc", "cancel", "okConn", "eCancel", "eExpired", "eNoPages", "eNoIg", "eFailed", "eConf", "eBusy", "eBig", "eLogin", "privacy", "fbTitle"];
  var L = {
    en: ["Account", "Your Toolsaku account", "Optional", "Every tool works without an account. Sign in only if you want to post your clips straight to your channels.",
      "Continue with Google. We never see or store your password.", "YouTube", "Instagram", "Facebook", "Connect YouTube", "Connect Instagram", "Connect Facebook",
      "Signed in as {e}", "Connected accounts", "Nothing connected yet.", "Disconnect", "Log out", "Delete my account",
      "Delete your Toolsaku account? Your connected accounts and saved tokens are deleted for good. Your videos on YouTube, Instagram and Facebook stay.",
      "Accounts aren't available right now. All tools still work.", "Post to {p}", "Post", "Posting…", "Uploading… {n}%", "{p} is processing the video…", "Publishing…",
      "Posted to {p}.", "Open post", "Couldn't post: {e}", "This sends the clip from your device to Toolsaku's server and then to {p}. Our copy is deleted as soon as it's done.",
      "Title", "Description", "Tags (comma or space separated)", "Caption", "Visibility", "Private", "Unlisted", "Public",
      "Until Google verifies Toolsaku, YouTube keeps uploads private. You can make them public in YouTube Studio.",
      "Instagram needs an MP4 clip. Choose MP4 as the clip format and make it again.", "Account", "Cancel", "{p} connected.",
      "Connecting was cancelled.", "That took too long. Please tap Connect again.", "No Facebook Page found. Create a Page or allow access to it, then connect again.",
      "No Instagram professional account found. Switch Instagram to Creator or Business and link it to a Facebook Page, then connect again.",
      "Something went wrong while connecting. Please try again.", "Connecting isn't set up on this server yet.", "Another post is still running. Wait for it to finish.",
      "This clip is too big to post.", "Please connect again.", "How we handle your data", "Title"],
    hi: ["अकाउंट", "आपका Toolsaku अकाउंट", "वैकल्पिक", "हर टूल बिना अकाउंट के चलता है। साइन इन तभी करें जब आप अपनी क्लिप्स सीधे अपने चैनल पर पोस्ट करना चाहें।",
      "Google से जारी रखें। हम आपका पासवर्ड कभी नहीं देखते, न सेव करते हैं।", "YouTube", "Instagram", "Facebook", "YouTube जोड़ें", "Instagram जोड़ें", "Facebook जोड़ें",
      "{e} से साइन इन", "जुड़े हुए अकाउंट", "अभी कुछ नहीं जुड़ा है।", "हटाएँ", "लॉग आउट", "मेरा अकाउंट डिलीट करें",
      "अपना Toolsaku अकाउंट डिलीट करें? आपके जुड़े हुए अकाउंट और सेव टोकन हमेशा के लिए मिट जाएँगे। YouTube, Instagram और Facebook पर आपके वीडियो वैसे ही रहेंगे।",
      "अकाउंट अभी उपलब्ध नहीं है। सभी टूल फिर भी चलते हैं।", "{p} पर पोस्ट करें", "पोस्ट करें", "पोस्ट हो रहा है…", "अपलोड हो रहा है… {n}%", "{p} वीडियो प्रोसेस कर रहा है…", "पब्लिश हो रहा है…",
      "{p} पर पोस्ट हो गया।", "पोस्ट खोलें", "पोस्ट नहीं हो सका: {e}", "यह क्लिप आपके डिवाइस से Toolsaku के सर्वर पर और फिर {p} पर जाएगी। काम पूरा होते ही हमारी कॉपी मिटा दी जाती है।",
      "टाइटल", "विवरण", "टैग (कॉमा या स्पेस से अलग करें)", "कैप्शन", "कौन देख सकता है", "प्राइवेट", "अनलिस्टेड", "पब्लिक",
      "जब तक Google, Toolsaku को वेरिफ़ाई नहीं करता, YouTube अपलोड प्राइवेट रखता है। आप उन्हें YouTube Studio में पब्लिक कर सकते हैं।",
      "Instagram के लिए MP4 क्लिप चाहिए। क्लिप फ़ॉर्मेट में MP4 चुनें और क्लिप दोबारा बनाएँ।", "अकाउंट", "रद्द करें", "{p} जुड़ गया।",
      "जोड़ना रद्द हो गया।", "बहुत समय लग गया। कृपया फिर से 'जोड़ें' दबाएँ।", "कोई Facebook पेज नहीं मिला। पेज बनाएँ या उसकी अनुमति दें, फिर दोबारा जोड़ें।",
      "कोई Instagram प्रोफ़ेशनल अकाउंट नहीं मिला। Instagram को Creator या Business पर करें और Facebook पेज से लिंक करें, फिर दोबारा जोड़ें।",
      "जोड़ते समय कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।", "इस सर्वर पर जोड़ना अभी सेट नहीं है।", "एक पोस्ट अभी चल रही है। उसके पूरा होने तक रुकें।",
      "यह क्लिप पोस्ट करने के लिए बहुत बड़ी है।", "कृपया दोबारा जोड़ें।", "हम आपका डेटा कैसे रखते हैं", "टाइटल"],
    es: ["Cuenta", "Tu cuenta de Toolsaku", "Opcional", "Todas las herramientas funcionan sin cuenta. Inicia sesión solo si quieres publicar tus clips directamente en tus canales.",
      "Continúa con Google. Nunca vemos ni guardamos tu contraseña.", "YouTube", "Instagram", "Facebook", "Conectar YouTube", "Conectar Instagram", "Conectar Facebook",
      "Sesión iniciada como {e}", "Cuentas conectadas", "Aún no hay nada conectado.", "Desconectar", "Cerrar sesión", "Eliminar mi cuenta",
      "¿Eliminar tu cuenta de Toolsaku? Tus cuentas conectadas y los tokens guardados se borran para siempre. Tus vídeos en YouTube, Instagram y Facebook se quedan.",
      "Las cuentas no están disponibles ahora. Todas las herramientas siguen funcionando.", "Publicar en {p}", "Publicar", "Publicando…", "Subiendo… {n}%", "{p} está procesando el vídeo…", "Publicando…",
      "Publicado en {p}.", "Abrir publicación", "No se pudo publicar: {e}", "Esto envía el clip desde tu dispositivo al servidor de Toolsaku y luego a {p}. Nuestra copia se borra en cuanto termina.",
      "Título", "Descripción", "Etiquetas (separadas por comas o espacios)", "Texto", "Visibilidad", "Privado", "No listado", "Público",
      "Hasta que Google verifique Toolsaku, YouTube mantiene las subidas en privado. Puedes hacerlas públicas en YouTube Studio.",
      "Instagram necesita un clip MP4. Elige MP4 como formato y vuelve a crearlo.", "Cuenta", "Cancelar", "{p} conectado.",
      "Se canceló la conexión.", "Tardó demasiado. Toca Conectar otra vez.", "No se encontró ninguna página de Facebook. Crea una o permite el acceso y vuelve a conectar.",
      "No se encontró una cuenta profesional de Instagram. Cambia a Creador o Empresa y vincúlala a una página de Facebook, luego vuelve a conectar.",
      "Algo salió mal al conectar. Inténtalo de nuevo.", "La conexión aún no está configurada en este servidor.", "Otra publicación sigue en curso. Espera a que termine.",
      "Este clip es demasiado grande para publicarlo.", "Vuelve a conectar.", "Cómo tratamos tus datos", "Título"],
    pt: ["Conta", "Sua conta Toolsaku", "Opcional", "Todas as ferramentas funcionam sem conta. Entre só se quiser publicar seus clipes direto nos seus canais.",
      "Continue com o Google. Nunca vemos nem guardamos sua senha.", "YouTube", "Instagram", "Facebook", "Conectar YouTube", "Conectar Instagram", "Conectar Facebook",
      "Conectado como {e}", "Contas conectadas", "Nada conectado ainda.", "Desconectar", "Sair", "Excluir minha conta",
      "Excluir sua conta Toolsaku? Suas contas conectadas e tokens salvos são apagados de vez. Seus vídeos no YouTube, Instagram e Facebook continuam lá.",
      "As contas não estão disponíveis agora. Todas as ferramentas continuam funcionando.", "Publicar no {p}", "Publicar", "Publicando…", "Enviando… {n}%", "O {p} está processando o vídeo…", "Publicando…",
      "Publicado no {p}.", "Abrir publicação", "Não foi possível publicar: {e}", "Isto envia o clipe do seu dispositivo para o servidor do Toolsaku e depois para o {p}. Nossa cópia é apagada assim que termina.",
      "Título", "Descrição", "Tags (separadas por vírgula ou espaço)", "Legenda", "Visibilidade", "Privado", "Não listado", "Público",
      "Até o Google verificar o Toolsaku, o YouTube mantém os envios privados. Você pode torná-los públicos no YouTube Studio.",
      "O Instagram precisa de um clipe MP4. Escolha MP4 como formato e crie de novo.", "Conta", "Cancelar", "{p} conectado.",
      "A conexão foi cancelada.", "Demorou demais. Toque em Conectar de novo.", "Nenhuma Página do Facebook encontrada. Crie uma ou permita o acesso e conecte de novo.",
      "Nenhuma conta profissional do Instagram encontrada. Mude para Criador ou Empresa e vincule a uma Página do Facebook, depois conecte de novo.",
      "Algo deu errado ao conectar. Tente novamente.", "A conexão ainda não está configurada neste servidor.", "Outra publicação ainda está em andamento. Aguarde terminar.",
      "Este clipe é grande demais para publicar.", "Conecte de novo.", "Como tratamos seus dados", "Título"],
    fr: ["Compte", "Votre compte Toolsaku", "Facultatif", "Tous les outils fonctionnent sans compte. Connectez-vous seulement pour publier vos clips directement sur vos chaînes.",
      "Continuer avec Google. Nous ne voyons ni ne stockons jamais votre mot de passe.", "YouTube", "Instagram", "Facebook", "Connecter YouTube", "Connecter Instagram", "Connecter Facebook",
      "Connecté en tant que {e}", "Comptes connectés", "Rien n’est encore connecté.", "Déconnecter", "Se déconnecter", "Supprimer mon compte",
      "Supprimer votre compte Toolsaku ? Vos comptes connectés et jetons enregistrés sont effacés définitivement. Vos vidéos sur YouTube, Instagram et Facebook restent en ligne.",
      "Les comptes ne sont pas disponibles pour le moment. Tous les outils fonctionnent toujours.", "Publier sur {p}", "Publier", "Publication…", "Envoi… {n} %", "{p} traite la vidéo…", "Publication…",
      "Publié sur {p}.", "Ouvrir la publication", "Publication impossible : {e}", "Le clip part de votre appareil vers le serveur de Toolsaku, puis vers {p}. Notre copie est supprimée dès que c’est fini.",
      "Titre", "Description", "Tags (séparés par virgules ou espaces)", "Légende", "Visibilité", "Privée", "Non répertoriée", "Publique",
      "Tant que Google n’a pas vérifié Toolsaku, YouTube garde les envois en privé. Vous pouvez les rendre publics dans YouTube Studio.",
      "Instagram demande un clip MP4. Choisissez MP4 comme format et refaites le clip.", "Compte", "Annuler", "{p} connecté.",
      "La connexion a été annulée.", "Cela a pris trop de temps. Touchez Connecter à nouveau.", "Aucune Page Facebook trouvée. Créez une Page ou autorisez l’accès, puis reconnectez.",
      "Aucun compte Instagram professionnel trouvé. Passez en Créateur ou Entreprise et liez-le à une Page Facebook, puis reconnectez.",
      "Un problème est survenu pendant la connexion. Réessayez.", "La connexion n’est pas encore configurée sur ce serveur.", "Une autre publication est en cours. Attendez la fin.",
      "Ce clip est trop lourd pour être publié.", "Veuillez vous reconnecter.", "Comment nous traitons vos données", "Titre"],
    ar: ["الحساب", "حسابك على Toolsaku", "اختياري", "كل الأدوات تعمل دون حساب. سجّل الدخول فقط إذا أردت نشر مقاطعك مباشرةً على قنواتك.",
      "تابع باستخدام Google. لا نرى كلمة مرورك ولا نحفظها أبدًا.", "YouTube", "Instagram", "Facebook", "ربط YouTube", "ربط Instagram", "ربط Facebook",
      "تم تسجيل الدخول باسم {e}", "الحسابات المرتبطة", "لا يوجد حساب مرتبط بعد.", "إلغاء الربط", "تسجيل الخروج", "حذف حسابي",
      "هل تريد حذف حسابك على Toolsaku؟ ستُحذف حساباتك المرتبطة والرموز المحفوظة نهائيًا. تبقى مقاطعك على YouTube وInstagram وFacebook كما هي.",
      "الحسابات غير متاحة الآن. كل الأدوات ما زالت تعمل.", "النشر على {p}", "نشر", "جارٍ النشر…", "جارٍ الرفع… {n}%", "{p} يعالج الفيديو…", "جارٍ النشر…",
      "تم النشر على {p}.", "فتح المنشور", "تعذّر النشر: {e}", "يُرسل هذا المقطع من جهازك إلى خادم Toolsaku ثم إلى {p}. تُحذف نسختنا فور الانتهاء.",
      "العنوان", "الوصف", "الوسوم (افصل بفاصلة أو مسافة)", "التعليق", "من يمكنه المشاهدة", "خاص", "غير مدرج", "عام",
      "إلى أن تتحقق Google من Toolsaku، يبقي YouTube المقاطع المرفوعة خاصة. يمكنك جعلها عامة من YouTube Studio.",
      "يحتاج Instagram إلى مقطع MP4. اختر MP4 صيغةً للمقطع ثم أنشئه من جديد.", "الحساب", "إلغاء", "تم ربط {p}.",
      "أُلغي الربط.", "استغرق الأمر وقتًا طويلاً. اضغط ربط مرة أخرى.", "لم يتم العثور على صفحة Facebook. أنشئ صفحة أو اسمح بالوصول إليها ثم أعد الربط.",
      "لم يتم العثور على حساب Instagram احترافي. حوّله إلى صانع محتوى أو أعمال واربطه بصفحة Facebook ثم أعد الربط.",
      "حدث خطأ أثناء الربط. حاول مرة أخرى.", "الربط غير مُعدّ على هذا الخادم بعد.", "هناك منشور آخر قيد التنفيذ. انتظر حتى ينتهي.",
      "هذا المقطع أكبر من أن يُنشر.", "يُرجى الربط مرة أخرى.", "كيف نتعامل مع بياناتك", "العنوان"],
    bn: ["অ্যাকাউন্ট", "আপনার Toolsaku অ্যাকাউন্ট", "ঐচ্ছিক", "প্রতিটি টুল অ্যাকাউন্ট ছাড়াই চলে। ক্লিপ সরাসরি নিজের চ্যানেলে পোস্ট করতে চাইলে তবেই সাইন ইন করুন।",
      "Google দিয়ে চালিয়ে যান। আমরা কখনো আপনার পাসওয়ার্ড দেখি না বা রাখি না।", "YouTube", "Instagram", "Facebook", "YouTube যুক্ত করুন", "Instagram যুক্ত করুন", "Facebook যুক্ত করুন",
      "{e} হিসেবে সাইন ইন", "যুক্ত অ্যাকাউন্ট", "এখনও কিছু যুক্ত হয়নি।", "সরান", "লগ আউট", "আমার অ্যাকাউন্ট মুছুন",
      "আপনার Toolsaku অ্যাকাউন্ট মুছবেন? যুক্ত অ্যাকাউন্ট ও সেভ করা টোকেন চিরতরে মুছে যাবে। YouTube, Instagram ও Facebook-এ আপনার ভিডিও থেকে যাবে।",
      "অ্যাকাউন্ট এখন পাওয়া যাচ্ছে না। সব টুল তবুও চলে।", "{p}-এ পোস্ট করুন", "পোস্ট করুন", "পোস্ট হচ্ছে…", "আপলোড হচ্ছে… {n}%", "{p} ভিডিও প্রসেস করছে…", "প্রকাশ হচ্ছে…",
      "{p}-এ পোস্ট হয়েছে।", "পোস্ট খুলুন", "পোস্ট করা যায়নি: {e}", "ক্লিপটি আপনার ডিভাইস থেকে Toolsaku-এর সার্ভারে, তারপর {p}-এ যাবে। কাজ শেষ হলেই আমাদের কপি মুছে ফেলা হয়।",
      "শিরোনাম", "বিবরণ", "ট্যাগ (কমা বা স্পেস দিয়ে আলাদা)", "ক্যাপশন", "কে দেখতে পাবে", "প্রাইভেট", "আনলিস্টেড", "পাবলিক",
      "Google যতদিন Toolsaku যাচাই না করে, YouTube আপলোড প্রাইভেট রাখে। YouTube Studio-তে পাবলিক করতে পারবেন।",
      "Instagram-এর জন্য MP4 ক্লিপ লাগবে। ক্লিপ ফরম্যাটে MP4 বেছে আবার তৈরি করুন।", "অ্যাকাউন্ট", "বাতিল", "{p} যুক্ত হয়েছে।",
      "যুক্ত করা বাতিল হয়েছে।", "অনেক সময় লেগেছে। আবার যুক্ত করুন চাপুন।", "কোনো Facebook পেজ পাওয়া যায়নি। পেজ তৈরি করুন বা অনুমতি দিন, তারপর আবার যুক্ত করুন।",
      "কোনো Instagram প্রফেশনাল অ্যাকাউন্ট পাওয়া যায়নি। Creator বা Business-এ বদলে Facebook পেজের সাথে লিংক করুন, তারপর আবার যুক্ত করুন।",
      "যুক্ত করার সময় সমস্যা হয়েছে। আবার চেষ্টা করুন।", "এই সার্ভারে যুক্ত করা এখনও সেট করা হয়নি।", "আরেকটি পোস্ট চলছে। শেষ হওয়া পর্যন্ত অপেক্ষা করুন।",
      "এই ক্লিপ পোস্ট করার জন্য খুব বড়।", "আবার যুক্ত করুন।", "আমরা কীভাবে আপনার ডেটা রাখি", "শিরোনাম"],
    id: ["Akun", "Akun Toolsaku kamu", "Opsional", "Semua alat bisa dipakai tanpa akun. Masuk hanya jika ingin memposting klip langsung ke channel kamu.",
      "Lanjutkan dengan Google. Kami tidak pernah melihat atau menyimpan kata sandimu.", "YouTube", "Instagram", "Facebook", "Hubungkan YouTube", "Hubungkan Instagram", "Hubungkan Facebook",
      "Masuk sebagai {e}", "Akun terhubung", "Belum ada yang terhubung.", "Putuskan", "Keluar", "Hapus akun saya",
      "Hapus akun Toolsaku kamu? Akun terhubung dan token tersimpan dihapus permanen. Videomu di YouTube, Instagram, dan Facebook tetap ada.",
      "Akun sedang tidak tersedia. Semua alat tetap berfungsi.", "Posting ke {p}", "Posting", "Memposting…", "Mengunggah… {n}%", "{p} sedang memproses video…", "Menerbitkan…",
      "Terposting ke {p}.", "Buka postingan", "Gagal memposting: {e}", "Klip dikirim dari perangkatmu ke server Toolsaku, lalu ke {p}. Salinan kami dihapus begitu selesai.",
      "Judul", "Deskripsi", "Tag (pisahkan dengan koma atau spasi)", "Keterangan", "Visibilitas", "Pribadi", "Tidak publik", "Publik",
      "Sampai Google memverifikasi Toolsaku, YouTube menjaga unggahan tetap pribadi. Kamu bisa menjadikannya publik di YouTube Studio.",
      "Instagram butuh klip MP4. Pilih MP4 sebagai format klip lalu buat ulang.", "Akun", "Batal", "{p} terhubung.",
      "Penghubungan dibatalkan.", "Terlalu lama. Ketuk Hubungkan lagi.", "Halaman Facebook tidak ditemukan. Buat Halaman atau izinkan akses, lalu hubungkan lagi.",
      "Akun profesional Instagram tidak ditemukan. Ubah ke Kreator atau Bisnis dan tautkan ke Halaman Facebook, lalu hubungkan lagi.",
      "Terjadi kesalahan saat menghubungkan. Coba lagi.", "Penghubungan belum disiapkan di server ini.", "Postingan lain masih berjalan. Tunggu sampai selesai.",
      "Klip ini terlalu besar untuk diposting.", "Silakan hubungkan lagi.", "Cara kami menangani datamu", "Judul"],
  };
  Object.keys(L).forEach(function (c) { var o = {}; K.forEach(function (k, i) { o["acct." + k] = L[c][i]; }); I18N.addStrings(c, o); });
  var T = function (k, v) { return I18N.t("acct." + k, "", v); };
  var PN = { youtube: "YouTube", instagram: "Instagram", facebook: "Facebook" };

  /* ---------- Helpers ---------- */
  var ROOT = (document.body.dataset.root || "");
  var API = (function () { var s = (document.querySelector('script[src*="account.js"]') || {}).src || ""; return s ? s.replace(/assets\/js\/account\.js.*$/, "api/") : "/api/"; })();
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };
  var ICON = {
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
    youtube: "M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3zM10 9l5 3-5 3z",
    instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM17.5 6.5h.01",
    facebook: "M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5v4h3v7h4v-7h3l1-4h-4V7.5a.5.5 0 0 1 .5-.5H15z",
  };
  var ic = function (n, s) { s = s || 20; return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + ICON[n] + '"/></svg>'; };
  function api(path, opts) {
    opts = opts || {};
    opts.credentials = "same-origin";
    if (opts.method === "POST") opts.headers = Object.assign({ "X-Toolsaku": "1" }, opts.headers || {});
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.detail || ("HTTP " + r.status)); e.status = r.status; throw e; } return j; });
    });
  }
  function connectUrl(p) { return API + "connect/" + p + "?back=" + encodeURIComponent(location.pathname + location.hash); }

  var ME = null, MEP = null; // {user, connections, config}
  function loadMe(force) {
    if (MEP && !force) return MEP;
    MEP = api("me", { cache: "no-store" }).then(function (j) { ME = j; return j; }, function () { ME = { offline: true, user: null, connections: [] }; return ME; });
    MEP.then(function () { paintPanel(); paintClips(); });
    return MEP;
  }

  /* ---------- Styles (use the site's theme tokens) ---------- */
  var css = document.createElement("style");
  css.textContent = [
    ".x-acct{position:relative;flex:none}",
    ".x-acct-btn.is-in{border-color:var(--blue)}",
    ".x-acct-pan{position:absolute;top:calc(100% + 6px);inset-inline-end:0;z-index:41;width:min(340px,calc(100vw - 24px));padding:16px;background:var(--card);border:1px solid var(--line);border-radius:16px;box-shadow:0 18px 48px rgba(0,0,0,.35);color:var(--navy);font-size:14.5px}",
    ".x-acct-pan[hidden]{display:none}",
    ".x-acct-pan h2{margin:0 0 4px;font-size:16px}",
    ".x-acct-pan p{margin:6px 0;color:var(--muted);font-size:13.5px;line-height:1.45}",
    ".x-acct-opt{display:inline-block;margin-inline-start:6px;padding:1px 8px;border-radius:999px;background:var(--soft);border:1px solid var(--line);color:var(--muted);font-size:11.5px;font-weight:600;vertical-align:middle}",
    ".x-acct-list{list-style:none;margin:10px 0;padding:0;display:grid;gap:6px}",
    ".x-acct-list li{display:flex;align-items:center;gap:8px;min-height:44px;padding:4px 4px 4px 10px;border:1px solid var(--line);border-radius:12px}",
    ".x-acct-list li{box-sizing:border-box;width:100%;overflow:hidden}",
    ".x-acct-list .x-btn{flex:none;min-width:0}",
    ".x-acct-list li span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".x-acct-cbs{display:grid;gap:8px;margin:12px 0 6px}",
    ".x-acct-pan .x-btn,.x-post .x-btn{min-height:44px;padding:0 14px;font-size:14.5px;width:auto}",
    ".x-acct-cbs .x-btn{width:100%;justify-content:flex-start}",
    ".x-acct-sm{min-height:36px!important;padding:0 10px!important;font-size:13px!important}",
    ".x-acct-foot{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--line)}",
    ".x-acct-del{color:var(--err)!important}",
    ".x-acct-pan a.x-acct-link{color:var(--blue);font-size:13px}",
    ".x-acct-note{margin:10px 0 0;padding:10px 12px;border-radius:12px;font-size:14px}",
    ".x-acct-note.ok{background:var(--ok-bg);color:var(--ok)}.x-acct-note.err{background:var(--err-bg);color:var(--err)}",
    ".x-post-row{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}",
    ".x-post{margin-top:10px;padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--soft);display:grid;gap:10px}",
    ".x-post label{display:grid;gap:4px;font-size:13px;font-weight:600;color:var(--navy)}",
    ".x-post input,.x-post textarea,.x-post select{width:100%;min-height:44px;padding:8px 12px;border:1px solid var(--line-2);border-radius:12px;background:var(--field);color:var(--navy);font:inherit;font-size:14.5px;font-weight:400!important}",
    ".x-post textarea{min-height:90px;resize:vertical}",
    ".x-post p{margin:0;color:var(--muted);font-size:13px;line-height:1.45}",
    ".x-post .x-post-acts{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
    ".x-post progress{width:100%;height:8px}",
    "@media (max-width:420px){.x-acct-pan{position:fixed;top:64px;left:12px;right:12px;width:auto}}",
  ].join("\n");
  document.head.appendChild(css);

  /* ---------- Header button + panel ---------- */
  var box, btn, pan, note = null;
  function mountHeader() {
    var anchor = document.getElementById("x-theme");
    if (!anchor || box) return;
    box = document.createElement("div");
    box.className = "x-acct";
    box.innerHTML = '<button type="button" class="x-hb x-acct-btn" id="x-acct" aria-haspopup="true" aria-expanded="false" aria-controls="x-acct-pan">' + ic("user") + "</button>" +
      '<div class="x-acct-pan" id="x-acct-pan" role="dialog" hidden></div>';
    anchor.parentNode.insertBefore(box, anchor);
    btn = box.querySelector("button"); pan = box.querySelector(".x-acct-pan");
    btn.addEventListener("click", function () { open(pan.hidden); });
    document.addEventListener("click", function (e) { if (!pan.hidden && !box.contains(e.target)) open(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !pan.hidden) { open(false); btn.focus(); } });
    pan.addEventListener("click", onPanelClick);
    label();
  }
  function label() { if (btn) { btn.setAttribute("aria-label", T("btn")); btn.title = T("btn"); pan.setAttribute("aria-label", T("title")); } }
  function open(on) {
    pan.hidden = !on; btn.setAttribute("aria-expanded", String(on));
    if (on) { paintPanel(); loadMe(true); }
  }
  function paintPanel() {
    if (!pan) return;
    if (btn) btn.classList.toggle("is-in", !!(ME && ME.user));
    if (pan.hidden && !note) return;
    var h = '<h2>' + esc(T("title")) + '<span class="x-acct-opt">' + esc(T("opt")) + "</span></h2>";
    if (!ME) h += "<p>…</p>";
    else if (ME.offline) h += "<p>" + esc(T("unavail")) + "</p>";
    else if (!ME.user) {
      h += "<p>" + esc(T("why")) + "</p><div class=\"x-acct-cbs\">" +
        ["youtube", "instagram", "facebook"].map(function (p) { return '<a class="x-btn" href="' + esc(connectUrl(p)) + '">' + ic(p) + esc(T({ youtube: "cyt", instagram: "cig", facebook: "cfb" }[p])) + "</a>"; }).join("") +
        "</div><p>" + esc(T("google")) + "</p>";
    } else {
      var cs = ME.connections || [];
      h += "<p>" + esc(T("signed", { e: ME.user.email || ME.user.name || "" })) + "</p><p><strong>" + esc(T("connected")) + "</strong></p>";
      h += cs.length ? '<ul class="x-acct-list">' + cs.map(function (c) {
        return "<li>" + ic(c.provider, 18) + "<span>" + esc(PN[c.provider]) + " · " + esc(c.name || "") + '</span><button type="button" class="x-btn x-acct-sm" data-disc="' + c.id + '">' + esc(T("disc")) + "</button></li>";
      }).join("") + "</ul>" : "<p>" + esc(T("none")) + "</p>";
      h += '<div class="x-acct-cbs">' + ["youtube", "instagram", "facebook"].map(function (p) {
        return '<a class="x-btn" href="' + esc(connectUrl(p)) + '">' + ic(p) + esc(T({ youtube: "cyt", instagram: "cig", facebook: "cfb" }[p])) + "</a>";
      }).join("") + "</div>";
      h += '<div class="x-acct-foot"><button type="button" class="x-btn x-acct-sm" data-out="1">' + esc(T("out")) + '</button><button type="button" class="x-btn x-acct-sm x-acct-del" data-del="1">' + esc(T("del")) + "</button></div>";
    }
    h += '<p><a class="x-acct-link" href="' + ROOT + 'privacy/#account">' + esc(T("privacy")) + "</a></p>";
    if (note) h += '<p class="x-acct-note ' + note[0] + '" role="status">' + esc(note[1]) + "</p>";
    pan.innerHTML = h;
  }
  function onPanelClick(e) {
    var d = e.target.closest("[data-disc]"), o = e.target.closest("[data-out]"), x = e.target.closest("[data-del]");
    if (d) { d.disabled = true; api("connections/" + d.dataset.disc + "/disconnect", { method: "POST" }).then(function () { loadMe(true); }, function () { loadMe(true); }); }
    if (o) { api("logout", { method: "POST" }).then(function () { loadMe(true); }); }
    if (x && window.confirm(T("delQ"))) { x.disabled = true; api("account/delete", { method: "POST" }).then(function () { note = null; loadMe(true); }, function () { loadMe(true); }); }
  }

  /* Result of a Connect round trip: ?connected=youtube or ?account_error=... (shown once, then removed from the address bar). */
  function readReturn() {
    var q = new URLSearchParams(location.search), c = q.get("connected"), err = q.get("account_error");
    if (!c && !err) return;
    var map = { cancelled: "eCancel", expired: "eExpired", no_pages: "eNoPages", no_instagram: "eNoIg", not_configured: "eConf" };
    note = c ? ["ok", T("okConn", { p: PN[c] || c })] : ["err", T(map[err] || "eFailed")];
    q.delete("connected"); q.delete("account_error");
    try { history.replaceState(null, "", location.pathname + (q.toString() ? "?" + q : "") + location.hash); } catch (e) {}
    loadMe(true).then(function () { if (pan) { pan.hidden = false; btn.setAttribute("aria-expanded", "true"); paintPanel(); } setTimeout(function () { note = null; }, 8000); });
  }

  /* ---------- Clipper: "Post to …" under each finished clip, only when that platform is connected ---------- */
  var CLIPS = [];
  window.addEventListener("lts:clip", function (e) {
    var d = e.detail; if (!d || !d.row) return;
    CLIPS = CLIPS.filter(function (c) { return c.seg !== d.seg; });
    CLIPS.push(d);
    if (ME) paintClip(d); else loadMe();
  });
  // "Post to YouTube with this kit" inside the clipper's post kit: open the post form already filled from the kit.
  window.addEventListener("lts:post", function (e) {
    var x = e.detail || {}, p = x.p || "youtube", d = CLIPS.filter(function (c) { return c.seg === x.seg; })[0];
    if (!d) return;
    loadMe().then(function () {
      if (conns(p).length && d.row.isConnected) {
        paintClip(d);
        var r = d.row.parentNode.querySelector(":scope > .x-post-row");
        if (!r) return;
        form(d, p, r);
        var f = r.parentNode.querySelector(":scope > .x-post");
        if (f) { f.scrollIntoView({ block: "center", behavior: "smooth" }); var t = f.querySelector('[name="title"]'); if (t) try { t.focus({ preventScroll: true }); } catch (er) {} }
      } else if (btn) { btn.scrollIntoView({ block: "center", behavior: "smooth" }); open(true); }
    });
  });
  function conns(p) { return ((ME && ME.connections) || []).filter(function (c) { return c.provider === p; }); }
  function paintClips() { CLIPS.forEach(paintClip); }
  function paintClip(d) {
    if (!d.row.isConnected) return;
    var old = d.row.parentNode && d.row.parentNode.querySelector(":scope > .x-post-row");
    if (old) old.remove();
    var ps = ["youtube", "instagram", "facebook"].filter(function (p) { return conns(p).length; });
    if (!ps.length) return;
    var r = document.createElement("div"); r.className = "x-post-row";
    r.innerHTML = ps.map(function (p) { return '<button type="button" class="x-btn" data-post="' + p + '">' + ic(p, 18) + esc(T("postTo", { p: PN[p] })) + "</button>"; }).join("");
    d.row.parentNode.insertBefore(r, d.row.nextSibling);
    r.addEventListener("click", function (ev) { var b = ev.target.closest("[data-post]"); if (b) { ev.stopPropagation(); form(d, b.dataset.post, r); } });
  }
  function kitOf(d) { try { return (d.kit && d.kit()) || {}; } catch (e) { return {}; } }
  function form(d, p, r) {
    var prev = r.parentNode.querySelector(":scope > .x-post"); if (prev) prev.remove();
    var k = kitOf(d), title = (k.titles && k.titles[0]) || "", desc = k.desc || "", tags = k.tags || "";
    var cs = conns(p), f = document.createElement("form"); f.className = "x-post"; f.noValidate = true;
    var acc = cs.length > 1 ? '<label>' + esc(T("acc")) + '<select name="connection_id">' + cs.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + "</option>"; }).join("") + "</select></label>" : '<input type="hidden" name="connection_id" value="' + cs[0].id + '">';
    var h = "<strong>" + ic(p, 18) + " " + esc(T("postTo", { p: PN[p] })) + "</strong>" + acc;
    if (p === "youtube") {
      if (title && !/#shorts/i.test(title)) title = (title + " #Shorts").slice(0, 100);
      h += '<label>' + esc(T("ytTitle")) + '<input name="title" maxlength="100" value="' + esc(title) + '"></label>' +
        '<label>' + esc(T("desc")) + '<textarea name="description" maxlength="4900">' + esc((desc + "\n\n" + tags).trim()) + "</textarea></label>" +
        '<label>' + esc(T("priv")) + '<select name="privacy"><option value="private">' + esc(T("pPriv")) + '</option><option value="unlisted">' + esc(T("pUnl")) + '</option><option value="public">' + esc(T("pPub")) + "</option></select></label>" +
        "<p>" + esc(T("ytNote")) + "</p>";
    } else if (p === "instagram") {
      h += '<label>' + esc(T("cap")) + '<textarea name="caption" maxlength="2200">' + esc([title, desc, tags].filter(Boolean).join("\n\n")) + "</textarea></label>";
      if (!/mp4/.test((d.blob && d.blob.type) || "")) h += '<p class="x-acct-note err">' + esc(T("igMp4")) + "</p>";
    } else {
      h += '<label>' + esc(T("fbTitle")) + '<input name="title" maxlength="250" value="' + esc(title) + '"></label>' +
        '<label>' + esc(T("desc")) + '<textarea name="description" maxlength="5000">' + esc((desc + "\n\n" + tags).trim()) + "</textarea></label>";
    }
    h += "<p>" + esc(T("send", { p: PN[p] })) + "</p>" +
      '<div class="x-post-acts"><button type="submit" class="x-btn x-primary">' + esc(T("post")) + '</button><button type="button" class="x-btn" data-x="1">' + esc(T("cancel")) + "</button></div>" +
      '<progress max="100" value="0" hidden></progress><p class="x-post-st" role="status" aria-live="polite"></p>';
    f.innerHTML = h;
    r.parentNode.insertBefore(f, r.nextSibling);
    f.querySelector("[data-x]").addEventListener("click", function (ev) { ev.stopPropagation(); f.remove(); });
    f.addEventListener("click", function (ev) { ev.stopPropagation(); });
    f.addEventListener("submit", function (ev) { ev.preventDefault(); send(d, p, f); });
  }
  function send(d, p, f) {
    var st = f.querySelector(".x-post-st"), pr = f.querySelector("progress"), sub = f.querySelector('[type="submit"]');
    if (p === "instagram" && !/mp4/.test((d.blob && d.blob.type) || "")) { st.textContent = T("igMp4"); return; }
    var fd = new FormData(f);
    fd.append("file", d.blob, d.name || "clip.mp4");
    sub.disabled = true; sub.textContent = T("posting"); pr.hidden = false; pr.value = 0;
    var x = new XMLHttpRequest();
    x.open("POST", API + "post/" + p);
    x.withCredentials = true;
    x.setRequestHeader("X-Toolsaku", "1");
    x.upload.onprogress = function (e) { if (e.lengthComputable) { var n = Math.round((e.loaded / e.total) * 100); pr.value = n; st.textContent = T("upl", { n: n }); } };
    x.onerror = function () { fail("network"); };
    x.onload = function () {
      var j = {}; try { j = JSON.parse(x.responseText); } catch (e) {}
      if (x.status !== 200 || !j.job) return fail(j.detail || ("HTTP " + x.status));
      pr.removeAttribute("value"); st.textContent = T("proc", { p: PN[p] });
      poll(j.job);
    };
    x.send(fd);
    function poll(id) {
      api("post/status/" + id, { cache: "no-store" }).then(function (s) {
        if (s.status === "working") { st.textContent = s.step === "publishing" ? T("pub") : s.step === "uploading" ? T("proc", { p: PN[p] }) : T("proc", { p: PN[p] }); return setTimeout(function () { poll(id); }, 3000); }
        if (s.status === "done") {
          pr.hidden = true; sub.hidden = true;
          st.innerHTML = esc(T("done", { p: PN[p] })) + (s.url ? ' <a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(T("open")) + "</a>" : "");
        } else fail(s.error);
      }, function (e) { fail(e.message); });
    }
    function fail(code) {
      var m = { busy: T("eBusy"), too_big: T("eBig"), login_required: T("eLogin"), reconnect_youtube: T("eLogin"), instagram_needs_mp4: T("igMp4") }[code] || code || "?";
      pr.hidden = true; sub.disabled = false; sub.textContent = T("post"); st.textContent = T("fail", { e: m });
      if (code === "login_required" || code === "reconnect_youtube") loadMe(true);
    }
  }

  /* ---------- Start ---------- */
  mountHeader();
  readReturn();
  // Only the Clipper page asks the backend on load (to know which Post buttons to show); other pages wait for a tap.
  if (document.body.dataset.tool === "long-to-shorts") loadMe();
  window.addEventListener("i18n:change", function () { label(); paintPanel(); paintClips(); });
})();
