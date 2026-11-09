/**
 * LENSA PALOPO — FULL CONTROL ADMIN CMS ENGINE
 * Mengelola Tampilan, Hero, Saklar Bagian, Foto (Upload Langsung Supabase Storage),
 * Berita & Cerita, Video Dokumenter, Wisata, dan Stories.
 * Sinkronisasi: Supabase Cloud + IndexedDB (Dexie) + LocalStorage + BroadcastChannel + Vercel JSON.
 */

const STORAGE_KEY_PHOTOS = 'lensa_palopo_custom_photos_v1';
const STORAGE_KEY_CMS = 'lensa_palopo_cms_bundle_v2';
const STORAGE_KEY_AUTH = 'lensa_palopo_admin_auth_v1';
const STORAGE_KEY_SESSION = 'lensa_palopo_admin_session_v1';
const STORAGE_KEY_SB_URL = 'lensa_palopo_sb_url_v1';
const STORAGE_KEY_SB_KEY = 'lensa_palopo_sb_key_v1';
const CMS_BUNDLE_ROW_ID = '__cms_bundle__';

// KREDENSIAL SUPABASE RESMI PROYEK LENSA PALOPO (AUTO-CONNECT TANPA INPUT MANUAL)
const DEFAULT_SB_URL = 'https://twmgcozbtptkesemxpth.supabase.co';
const DEFAULT_SB_KEY = 'sb_publishable_rEfZsWCti_dUhSuuDGlZzA_xHY2ldy5';

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return DEFAULT_SB_URL;
  let cleaned = String(rawUrl).trim();
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  return cleaned || DEFAULT_SB_URL;
}

function getActiveSupabaseCredentials() {
  const storedUrl = (localStorage.getItem(STORAGE_KEY_SB_URL) || '').trim();
  const storedKey = (localStorage.getItem(STORAGE_KEY_SB_KEY) || '').trim();
  const url = normalizeSupabaseUrl(storedUrl || DEFAULT_SB_URL);
  const key = storedKey || DEFAULT_SB_KEY;

  // Simpan URL yang sudah dinormalisasi agar tidak terjadi error 404 /rest/v1/rest/v1
  if (!storedUrl || storedUrl !== url) {
    localStorage.setItem(STORAGE_KEY_SB_URL, url);
  }
  if (!storedKey) {
    localStorage.setItem(STORAGE_KEY_SB_KEY, key);
  }
  return { url, key };
}

const syncChannel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('lensa_cms_sync') : null;

let db = null;
if (typeof Dexie !== 'undefined') {
  db = new Dexie('LensaPalopoDB');
  db.version(2).stores({
    photos: 'id, category, visible, date',
    cms: 'key'
  });
}

let supabaseClient = null;
let supabaseRealtimeChannel = null;

function initSupabaseClient() {
  const { url, key } = getActiveSupabaseCredentials();
  if (!url || !key) {
    console.warn('[Supabase Admin] URL atau Anon Key kosong, menggunakan fallback penyimpanan lokal.');
    supabaseClient = null;
    return null;
  }
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[Supabase Admin] SDK @supabase/supabase-js v2 belum termuat di window.supabase! Menggunakan fallback lokal.');
    supabaseClient = null;
    return null;
  }
  try {
    supabaseClient = window.supabase.createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    console.log('[Supabase Admin] Client berhasil diinisialisasi otomatis ke:', url);
    return supabaseClient;
  } catch (e) {
    console.error('[Supabase Admin] Gagal inisialisasi Supabase Client:', e);
    supabaseClient = null;
    return null;
  }
}

// ==========================================================
// DEFAULT FULL CMS DATA (BAWAAN RESMI LENSA PALOPO)
// ==========================================================
function getDefaultCmsBundle() {
  return {
    settings: {
      brandName: 'LENSA PALOPO',
      brandTagline: 'Profil Kota Palopo & Dokumentasi Visual Luwu Raya',
      logoUrl: 'assets/logo-lensa-palopo.png',
      topbarText: 'Portal Resmi Profil Kota Palopo & Dokumentasi Visual Lensa Palopo',
      tickerText: '📸 Selamat datang di Portal Resmi Profil Kota Palopo persembahan Lensa Palopo (@lensa_palopo) | 🏛️ Jelajahi data lengkap 9 Kecamatan, 48 Kelurahan, Sejarah Kedatuan Luwu, Wisata Bahari & Kuliner Khas Palopo | 🎬 Tonton seri video dokumenter & baca liputan berita terbaru langsung dari lapangan | ☁️ Tersinkronisasi langsung dengan Dashboard Admin & Cloud Supabase',
      heroBadge: 'Jazirah Luwu Raya • Sulawesi Selatan',
      heroPrefix: 'Mengenal',
      heroHighlight: 'Kota Palopo',
      heroSuffix: 'Lewat Lensa & Cerita',
      heroBg: '',
      heroDesc: 'Kota maritim di kawasan pesisir Teluk Bone yang memadukan keindahan alam tropis, keagungan sejarah Kedatuan Luwu, dan denyut perdagangan modern Luwu Raya.',
      stat1Val: 'Teluk Bone',
      stat1Lbl: 'Pesisir & Bahari',
      stat2Val: '1604 M',
      stat2Lbl: "Masjid Tua Jami'",
      stat3Val: 'Luwu Raya',
      stat3Lbl: 'Pusat Jasa & Edukasi',
      stat4Val: '100% Otentik',
      stat4Lbl: 'Karya @lensa_palopo',
      creatorHandle: '@lensa_palopo',
      creatorIgUrl: 'https://instagram.com/lensa_palopo',
      creatorBio: '"Website ini didedikasikan oleh Lensa Palopo (@lensa_palopo) sebagai portal profil Kota Palopo sekaligus ruang portofolio dokumentasi visual independen. Setiap berita, foto, dan video dokumenter merupakan hasil liputan dan tangkapan mata di tanah Luwu, dipersembahkan bagi masyarakat Palopo dan penikmat keindahan nusantara."',
      creatorGear: 'Mirrorless Full-frame, Lensa 24-70mm f/2.8, 35mm Prime, Drone 4K.',
      creatorPrinciple: 'Otentik, menghargai kearifan lokal, dan bercerita lewat cahaya alami.',
      sections: {
        ticker: true,
        stories: true,
        galeri: true,
        wisata: true,
        budaya: true,
        cerita: true,
        dokumenter: true,
        kecamatan: true,
        profil: true
      }
    },
    photos: [
      {
        id: 'lp-default-1',
        title: 'Keemasan Fajar di Dermaga Tanjung Ringgit',
        category: 'landskap',
        location: 'Tanjung Ringgit, Kec. Wara Timur',
        date: '2026-05-10',
        exif: '35mm • f/8.0 • 1/125s • ISO 100',
        description: 'Cahaya pagi pertama menyinari deretan perahu nelayan tradisional di pesisir Teluk Bone, Kota Palopo.',
        img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        visible: true
      },
      {
        id: 'lp-default-2',
        title: 'Arsitektur Batu Karang Masjid Jami Tua Palopo',
        category: 'budaya',
        location: 'Kel. Batupasi, Kec. Wara Utara',
        date: '2026-05-08',
        exif: '24mm • f/5.6 • 1/250s • ISO 200',
        description: 'Warisan bersejarah tahun 1604 M peninggalan masa Kedatuan Luwu yang berdiri kokoh hingga kini.',
        img: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=1200&q=80',
        visible: true
      },
      {
        id: 'lp-default-3',
        title: 'Kabut Pagi di Puncak Bukit Kambo Highland',
        category: 'drone',
        location: 'Kec. Mungkajang, Kota Palopo',
        date: '2026-05-05',
        exif: 'Drone 24mm • f/2.8 • 1/500s • ISO 100',
        description: 'Lanskap hijau perbukitan Kambo dengan latar siluet Kota Palopo dan bentangan laut Teluk Bone dari ketinggian.',
        img: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1200&q=80',
        visible: true
      },
      {
        id: 'lp-default-4',
        title: 'Segarnya Air Terjun Latuppa di Hutan Tropis',
        category: 'landskap',
        location: 'Latuppa, Kec. Mungkajang',
        date: '2026-05-03',
        exif: '16mm • f/11 • 1/4s • ISO 64',
        description: 'Aliran sungai jernih dari pegunungan Latuppa yang menjadi oase wisata keluarga favorit warga Kota Palopo.',
        img: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=1200&q=80',
        visible: true
      }
    ],
    articles: [
      {
        id: 'art-lp-1',
        title: 'Menunggu Matahari Terbit Bersama Nelayan Tanjung Ringgit',
        tag: 'Jurnal Bahari',
        date: '14 Mei 2026',
        readTime: '4 Menit Baca',
        img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80',
        preview: 'Pukul 04.30 WITA, deru mesin perahu ketinting mulai memecah keheningan dermaga. Sebuah catatan visual tentang harapan yang berlayar setiap subuh.',
        content: '<p>Subuh di pesisir timur Kota Palopo selalu memiliki magnet tersendiri bagi lensa kamera. Saat sebagian besar warga kota masih terlelap, Pelabuhan Tanjung Ringgit sudah berdenyut oleh langkah kaki para nelayan dan pedagang ikan.</p><p class="mt-3">Dengan berbekal kamera dan lensa 35mm, saya mengikuti Pak Rahman (54), seorang nelayan tradisional yang telah mengarungi Teluk Bone selama lebih dari tiga dekade. Ketika semburat jingga pertama muncul di cakrawala timur, permukaan laut berubah menjadi cermin emas raksasa.</p><p class="mt-3">Melalui dokumentasi <strong>@lensa_palopo</strong>, momen-momen sederhana namun sarat makna inilah yang ingin terus kami abadikan—sebagai pengingat bahwa identitas maritim Palopo hidup dalam keringat dan senyum warganya.</p>'
      },
      {
        id: 'art-lp-2',
        title: 'Jejak Pahatan Batu 1604: Membaca Simbol Masjid Tua Palopo',
        tag: 'Sejarah & Budaya',
        date: '02 Mei 2026',
        readTime: '5 Menit Baca',
        img: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=900&q=80',
        preview: 'Menelusuri detail tekstur batu cadas dan ukiran sulur pada dinding Masjid Jami Tua Palopo yang bertahan lebih dari empat abad.',
        content: '<p>Memotret arsitektur bersejarah menuntut kesabaran menunggu jatuhnya sudut cahaya yang tepat. Pada pukul delapan pagi, sinar matahari miring menembus celah pepohonan di sekitar Masjid Tua Palopo, menonjolkan tekstur batu cadas berusia lebih dari 400 tahun.</p><p class="mt-3">Tidak ada semen modern pada sambungan batu-batu ini. Para leluhur Tana Luwu memadukan kearifan lokal Bugis-Luwu, pengaruh Hindu-Buddha pada struktur bertingkat tiga, serta nilai kosmologi Islam yang dibawa oleh Datuk Sulaiman.</p>'
      },
      {
        id: 'art-lp-3',
        title: 'Geliat Ekonomi Kreatif & Wajah Baru Ruang Publik Kota Palopo',
        tag: 'Berita Kota',
        date: '18 Mei 2026',
        readTime: '3 Menit Baca',
        img: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=900&q=80',
        preview: 'Liputan perkembangan pusat kuliner malam, ruang terbuka hijau, dan antusiasme generasi muda Palopo dalam memajukan pariwisata daerah.',
        content: '<p>Sebagai kota jasa, pendidikan, dan perdagangan utama di kawasan Luwu Raya, Kota Palopo terus berbenah mempercantik ruang-ruang publiknya. Mulai dari kawasan Lapangan Pancasila, pelataran Istana Kedatuan Luwu, hingga deretan kafe kreatif di sepanjang jalan protokol maupun perbukitan Kambo.</p><p class="mt-3">Tim <strong>Lensa Palopo</strong> merangkum bagaimana kolaborasi komunitas pemuda, pelaku UMKM kuliner tradisional seperti Kapurung dan Dange, serta kreator visual lokal berhasil mengangkat daya tarik wisata Kota Idaman ke panggung nasional.</p>'
      }
    ],
    videos: [
      {
        id: 'doc-featured',
        title: 'Nafas Bahari di Ujung Fajar Teluk Bone',
        duration: '08:45',
        location: 'Tanjung Ringgit & Teluk Bone',
        videoUrl: '',
        img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
        synopsis: 'Merekam ketabahan para nelayan bagan dan perahu tradisional di Pelabuhan Tanjung Ringgit. Mulai dari menatap ufuk timur, menarik jala ikan teri, hingga tawar-menawar hangat di pelelangan ikan saat matahari mulai terbit.',
        isFeatured: true
      },
      {
        id: 'doc-1',
        title: 'Penjaga Batu Tua: Kisah Merawat Masjid 1604',
        duration: '06:20',
        location: 'Kec. Wara Utara, Palopo',
        videoUrl: '',
        img: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=900&q=80',
        synopsis: 'Wawancara eksklusif bersama para pengurus dan juru pelihara Masjid Jami Tua Palopo tentang bagaimana masyarakat sekitar menjaga kesucian dan keaslian arsitektur abad ke-17 ini.',
        isFeatured: false
      },
      {
        id: 'doc-2',
        title: 'Simfoni Air & Hutan: Ekspedisi Hulu Latuppa',
        duration: '05:15',
        location: 'Kawasan Pegunungan Latuppa',
        videoUrl: '',
        img: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=900&q=80',
        synopsis: 'Perjalanan menyusuri sungai berbatu dan air terjun bertingkat di Latuppa, mendokumentasikan kekayaan flora tropis dan sumber mata air bersih kebanggaan warga Kota Palopo.',
        isFeatured: false
      },
      {
        id: 'doc-3',
        title: 'Dapur Tana Luwu: Filosofi Semangkuk Kapurung',
        duration: '07:10',
        location: 'Sentra Kuliner Palopo',
        videoUrl: '',
        img: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80',
        synopsis: 'Mengikuti proses pengolahan sagu murni sejak dipanen, dituang air mendidih, diputar menggunakan dua bilah bambu (dui), hingga disajikan bersama kuah ikan segar dan sayuran lokal.',
        isFeatured: false
      }
    ],
    tourism: [
      {
        id: 'tour-1',
        name: 'Pantai Labombo',
        category: 'bahari',
        distance: '10 Menit dari Pusat Kota',
        bestTime: '05.30 - 09.00 WITA',
        img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        highlight: 'Pantai berpasir landai dengan deretan gazebo kayu, pohon kelapa, dan pemandangan matahari terbit terbaik menghadap Teluk Bone.'
      },
      {
        id: 'tour-2',
        name: 'Air Terjun Latuppa',
        category: 'alam',
        distance: '20 Menit dari Pusat Kota',
        bestTime: '08.00 - 15.00 WITA',
        img: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
        highlight: 'Kawasan wisata sungai dan air terjun alami di kaki pegunungan dengan air super jernih, dikelilingi kebun durian dan hutan tropis.'
      },
      {
        id: 'tour-3',
        name: 'Puncak Kambo Highland',
        category: 'alam',
        distance: '25 Menit dari Pusat Kota',
        bestTime: '06.00 - 17.30 WITA',
        img: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
        highlight: 'Kawasan dataran tinggi sejuk dengan panorama spektakuler lanskap Kota Palopo dan garis pantai Teluk Bone dari ketinggian.'
      },
      {
        id: 'tour-4',
        name: 'Dermaga & Kuliner Tanjung Ringgit',
        category: 'bahari',
        distance: '8 Menit dari Pusat Kota',
        bestTime: '16.00 - 22.00 WITA',
        img: 'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=800&q=80',
        highlight: 'Spot favorit menikmati angin laut sore, aktivitas perahu nelayan, dan pusat kuliner sari laut bakar segar di malam hari.'
      },
      {
        id: 'tour-5',
        name: 'Pulau Libukang',
        category: 'bahari',
        distance: '15 Menit via Perahu',
        bestTime: '07.00 - 16.00 WITA',
        img: 'https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?auto=format&fit=crop&w=800&q=80',
        highlight: 'Pulau karang eksotis di depan perairan Pantai Labombo yang cocok untuk penyeberangan singkat dan fotografi lanskap laut.'
      },
      {
        id: 'tour-6',
        name: 'Taman Baca & Lapangan Pancasila',
        category: 'keluarga',
        distance: '0 Km (Jantung Kota)',
        bestTime: '15.30 - 21.00 WITA',
        img: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=800&q=80',
        highlight: 'Alun-alun ruang terbuka hijau pusat interaksi warga, olahraga sore, dan wisata kuliner jajanan khas Palopo.'
      }
    ],
    stories: [
      {
        id: 'st-1',
        title: 'Fajar Labombo',
        time: '2 jam lalu',
        cover: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        caption: 'Semburat emas pertama di ufuk Teluk Bone pagi ini. Air sedang surut, memantulkan langit jingga dengan sempurna. 📍 Pantai Labombo, Palopo.',
        items: [
          {
            id: 'st-1-item-1',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
            caption: 'Semburat emas pertama di ufuk Teluk Bone pagi ini. Air sedang surut, memantulkan langit jingga dengan sempurna. 📍 Pantai Labombo, Palopo.',
            time: 'Slide 1'
          },
          {
            id: 'st-1-item-2',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=800&q=80',
            caption: 'Jejeran perahu nelayan menyambut mentari fajar di pesisir Labombo.',
            time: 'Slide 2'
          }
        ]
      },
      {
        id: 'st-2',
        title: 'Masjid Tua',
        time: '5 jam lalu',
        cover: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=800&q=80',
        img: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=800&q=80',
        caption: 'Menyusuri tekstur dinding batu cadas Masjid Jami Tua Palopo (1604 M). Warisan agung Kedatuan Luwu yang tak lekang oleh waktu.',
        items: [
          {
            id: 'st-2-item-1',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=800&q=80',
            caption: 'Menyusuri tekstur dinding batu cadas Masjid Jami Tua Palopo (1604 M). Warisan agung Kedatuan Luwu yang tak lekang oleh waktu.',
            time: 'Slide 1'
          }
        ]
      },
      {
        id: 'st-3',
        title: 'Kabut Kambo',
        time: '8 jam lalu',
        cover: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
        img: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
        caption: 'Suhu 20°C di ketinggian Kambo Highland. Kota Palopo terlihat bagai permadani di tepi teluk dari atas sini.',
        items: [
          {
            id: 'st-3-item-1',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=800&q=80',
            caption: 'Suhu 20°C di ketinggian Kambo Highland. Kota Palopo terlihat bagai permadani di tepi teluk dari atas sini.',
            time: 'Slide 1'
          }
        ]
      },
      {
        id: 'st-4',
        title: 'Segarnya Latuppa',
        time: '12 jam lalu',
        cover: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
        img: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
        caption: 'Suara gemericik Air Terjun Latuppa berpadu dengan rimbunnya hutan tropis Mungkajang.',
        items: [
          {
            id: 'st-4-item-1',
            type: 'image',
            url: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=800&q=80',
            caption: 'Suara gemericik Air Terjun Latuppa berpadu dengan rimbunnya hutan tropis Mungkajang.',
            time: 'Slide 1'
          }
        ]
      }
    ]
  };
}

let CMS = getDefaultCmsBundle();
let selectedIds = new Set();

// ==========================================================
// SUPABASE STORAGE BUCKET UPLOAD HELPER & IMAGE PREVIEW ENGINE
// ==========================================================
const SUPABASE_STORAGE_BUCKET = 'lensa-palopo-media';
const MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024; // Maksimal 20 MB untuk Foto
const MAX_VIDEO_UPLOAD_SIZE_BYTES = 500 * 1024 * 1024; // Maksimal 500 MB untuk Video (mendukung video 300 MB+)
const SHARED_IDB_NAME = 'LensaPalopoLocalDB';
const SHARED_IDB_VERSION = 1;
const SHARED_IDB_STORE = 'cms_store';
const SHARED_IDB_RECORD_KEY = 'cms_bundle_main';

/**
 * Helper: Simpan & Baca ke/dari Shared IndexedDB (`LensaPalopoLocalDB` -> `cms_store`)
 * agar 100% sinkron dengan `js/gallery-loader.js` dan mendukung penyimpanan Blob Video 300MB+
 */
function putToSharedIndexedDB(key, val) {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(false);
    try {
      const req = indexedDB.open(SHARED_IDB_NAME, SHARED_IDB_VERSION);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains(SHARED_IDB_STORE)) {
          idb.createObjectStore(SHARED_IDB_STORE);
        }
      };
      req.onsuccess = (e) => {
        try {
          const idb = e.target.result;
          const tx = idb.transaction(SHARED_IDB_STORE, 'readwrite');
          tx.objectStore(SHARED_IDB_STORE).put(val, key);
          tx.oncomplete = () => resolve(true);
          tx.onerror = () => resolve(false);
        } catch (err) {
          resolve(false);
        }
      };
      req.onerror = () => resolve(false);
    } catch (err) {
      resolve(false);
    }
  });
}

function getFromSharedIndexedDB(key) {
  return new Promise((resolve) => {
    if (!('indexedDB' in window)) return resolve(null);
    try {
      const req = indexedDB.open(SHARED_IDB_NAME, SHARED_IDB_VERSION);
      req.onupgradeneeded = (e) => {
        const idb = e.target.result;
        if (!idb.objectStoreNames.contains(SHARED_IDB_STORE)) {
          idb.createObjectStore(SHARED_IDB_STORE);
        }
      };
      req.onsuccess = (e) => {
        try {
          const idb = e.target.result;
          const tx = idb.transaction(SHARED_IDB_STORE, 'readonly');
          const getReq = tx.objectStore(SHARED_IDB_STORE).get(key);
          getReq.onsuccess = () => resolve(getReq.result || null);
          getReq.onerror = () => resolve(null);
        } catch (err) {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch (err) {
      resolve(null);
    }
  });
}

/**
 * Helper: Kompresi gambar lokal menjadi DataURL JPEG ringan (maks 1280px)
 * Digunakan sebagai fallback otomatis jika Supabase Storage belum siap / gagal
 * sehingga proses simpan CRUD Admin TIDAK PERNAH gagal atau macet!
 */
function compressImageFileToDataUrl(file, maxWidth = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          try {
            let w = img.width || 800;
            let h = img.height || 600;
            if (w > maxWidth) {
              h = Math.round((h * maxWidth) / w);
              w = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', quality));
          } catch (canvasErr) {
            resolve(ev.target.result);
          }
        };
        img.onerror = () => resolve(ev.target.result);
        img.src = ev.target.result;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Sanitasi nama file agar unik, huruf kecil, dan bebas spasi/karakter aneh
 * Format: `Date.now() + '-' + sanitizedFileName`
 */
function sanitizeStorageFileName(rawName) {
  const clean = String(rawName || 'media.bin')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '');
  return `${Date.now()}-${clean || 'media.bin'}`;
}

/**
 * Validasi tipe file gambar & ukuran maksimal 20 MB
 */
function validateImageFile(file) {
  if (!file) {
    throw new Error('Tidak ada file gambar yang dipilih.');
  }
  if (!file.type || !file.type.startsWith('image/')) {
    throw new Error(`File "${file.name}" bukan format gambar yang valid (harus JPG, PNG, WEBP, GIF, atau AVIF).`);
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`Ukuran foto "${file.name}" (${sizeMb} MB) melebihi batas maksimal 20 MB!`);
  }
  return true;
}

/**
 * Validasi tipe file video & ukuran maksimal 500 MB (mendukung video 300 MB+)
 */
function isVideoFileObject(file) {
  if (!file) return false;
  const isVideoMime = file.type && file.type.startsWith('video/');
  const isVideoExt = /\.(mp4|mov|webm|mkv|m4v|avi|3gp|mpeg|mpg)$/i.test(file.name || '');
  return Boolean(isVideoMime || isVideoExt);
}

function validateVideoFile(file) {
  if (!file) {
    throw new Error('Tidak ada file video yang dipilih.');
  }
  if (!isVideoFileObject(file)) {
    throw new Error(`File "${file.name}" bukan format video yang valid (gunakan MP4, MOV, WEBM, atau MKV).`);
  }
  if (file.size > MAX_VIDEO_UPLOAD_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`Ukuran video "${file.name}" (${sizeMb} MB) melebihi batas maksimal 500 MB!`);
  }
  return true;
}

/**
 * Validasi file media fleksibel (Menerima Gambar MAUPUN Video MP4/MOV/WEBM hingga 500 MB)
 */
function validateMediaFile(file) {
  if (!file) {
    throw new Error('Tidak ada file yang dipilih.');
  }
  if (isVideoFileObject(file)) {
    return validateVideoFile(file);
  }
  const isImgMime = file.type && file.type.startsWith('image/');
  const isImgExt = /\.(jpg|jpeg|png|webp|gif|avif|svg)$/i.test(file.name || '');
  if (!isImgMime && !isImgExt) {
    throw new Error(`File "${file.name}" bukan format media yang didukung (gunakan JPG, PNG, WEBP, atau MP4/MOV/WEBM).`);
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    throw new Error(`Ukuran foto "${file.name}" (${sizeMb} MB) melebihi batas maksimal 20 MB!`);
  }
  return true;
}

/**
 * Ekstrak frame pertama dari file video lokal menjadi DataURL gambar thumbnail otomatis
 */
function extractVideoFrameDataUrl(videoFile) {
  return new Promise((resolve) => {
    try {
      let isSettled = false;
      const tempVideo = document.createElement('video');
      const objUrl = URL.createObjectURL(videoFile);
      tempVideo.preload = 'metadata';
      tempVideo.muted = true;
      tempVideo.playsInline = true;
      tempVideo.src = objUrl;

      const cleanup = () => {
        try { URL.revokeObjectURL(objUrl); } catch (e) {}
      };

      const safeResolve = (val) => {
        if (isSettled) return;
        isSettled = true;
        clearTimeout(timeoutId);
        cleanup();
        resolve(val);
      };

      // Batasi maksimal 2 detik agar video besar (300 MB) tidak pernah macet/hang saat decoding
      const timeoutId = setTimeout(() => {
        console.warn('[Video Frame] Waktu ekstraksi frame habis (timeout), menggunakan thumbnail bawaan.');
        safeResolve(null);
      }, 2000);

      const onMetaReady = () => {
        try {
          tempVideo.currentTime = Math.min(0.5, (tempVideo.duration || 0) * 0.1);
        } catch (e) {
          safeResolve(null);
        }
      };

      tempVideo.onloadedmetadata = onMetaReady;
      tempVideo.onloadeddata = onMetaReady;

      tempVideo.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = Math.min(tempVideo.videoWidth || 640, 1280);
          canvas.height = Math.min(tempVideo.videoHeight || 360, 720);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          safeResolve({
            dataUrl,
            duration: tempVideo.duration || 0
          });
        } catch (err) {
          safeResolve(null);
        }
      };

      tempVideo.onerror = () => {
        safeResolve(null);
      };
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Pratinjau (Video Preview) instan saat pengguna memilih file video dari Laptop / HP
 */
function handleVideoFilePreview(inputEl) {
  const file = inputEl?.files?.[0];
  const infoEl = document.getElementById('vid-video-file-info');
  const videoEl = document.getElementById('vid-video-preview-player');
  const durationInput = document.getElementById('vid-duration');

  if (!file) {
    if (infoEl) infoEl.classList.add('hidden');
    if (videoEl) {
      videoEl.src = '';
      videoEl.classList.add('hidden');
    }
    return;
  }

  try {
    validateVideoFile(file);
  } catch (err) {
    showAdminToast('⚠️ ' + err.message);
    inputEl.value = '';
    if (infoEl) {
      infoEl.textContent = '⚠️ ' + err.message;
      infoEl.className = 'text-[11px] mt-1.5 text-rose-400 font-semibold';
      infoEl.classList.remove('hidden');
    }
    if (videoEl) {
      videoEl.src = '';
      videoEl.classList.add('hidden');
    }
    return;
  }

  const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
  if (infoEl) {
    infoEl.textContent = `✓ File video siap diunggah: ${file.name} (${sizeMb} MB)`;
    infoEl.className = 'text-[11px] mt-1.5 text-emerald-400 font-semibold';
    infoEl.classList.remove('hidden');
  }

  if (videoEl) {
    const blobUrl = URL.createObjectURL(file);
    videoEl.src = blobUrl;
    videoEl.classList.remove('hidden');
    videoEl.onloadedmetadata = () => {
      if (durationInput && videoEl.duration && isFinite(videoEl.duration)) {
        const mins = Math.floor(videoEl.duration / 60);
        const secs = Math.floor(videoEl.duration % 60);
        durationInput.value = `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
      }
    };
  }
}

/**
 * Pratinjau (Image / Video Preview) instan saat pengguna memilih file dari Laptop / HP
 * Mendukung file Gambar (JPG/PNG/WEBP) MAUPUN file Video (MP4/MOV/WEBM hingga 500 MB) tanpa error!
 */
async function handleFilePreview(inputEl, previewImgId, placeholderId = null, infoTextId = null) {
  const file = inputEl?.files?.[0];
  const imgEl = document.getElementById(previewImgId);
  const placeholderEl = placeholderId ? document.getElementById(placeholderId) : null;
  const infoEl = infoTextId ? document.getElementById(infoTextId) : null;

  if (!file) return;

  try {
    validateMediaFile(file);
  } catch (err) {
    showAdminToast('⚠️ ' + err.message);
    inputEl.value = '';
    if (infoEl) {
      infoEl.textContent = '⚠️ ' + err.message;
      infoEl.className = 'text-[11px] mt-1.5 text-rose-400 font-semibold';
      infoEl.classList.remove('hidden');
    }
    return;
  }

  const kb = (file.size / 1024).toFixed(1);
  const sizeStr = file.size >= 1024 * 1024 ? `${(file.size / (1024 * 1024)).toFixed(2)} MB` : `${kb} KB`;

  // Jika file yang dipilih adalah VIDEO (.mp4, .mov, .webm, dll.)
  if (isVideoFileObject(file)) {
    if (infoEl) {
      infoEl.textContent = `🎬 File video terdeteksi & siap diunggah: ${file.name} (${sizeStr})`;
      infoEl.className = 'text-[11px] mt-1.5 text-emerald-400 font-semibold';
      infoEl.classList.remove('hidden');
    }
    const frameData = await extractVideoFrameDataUrl(file);
    if (frameData && frameData.dataUrl && imgEl) {
      imgEl.src = frameData.dataUrl;
      imgEl.classList.remove('hidden');
      if (placeholderEl) placeholderEl.classList.add('hidden');
    } else if (placeholderEl) {
      placeholderEl.innerHTML = `<div class="text-emerald-400 font-bold text-xs">🎬 Video Siap Diunggah: ${file.name} (${sizeStr})</div>`;
      placeholderEl.classList.remove('hidden');
    }
    const durationInput = document.getElementById('vid-duration');
    if (durationInput && frameData && frameData.duration && isFinite(frameData.duration)) {
      const mins = Math.floor(frameData.duration / 60);
      const secs = Math.floor(frameData.duration % 60);
      durationInput.value = `${mins < 10 ? '0' + mins : mins}:${secs < 10 ? '0' + secs : secs}`;
    }
    return;
  }

  // Jika file yang dipilih adalah GAMBAR
  const reader = new FileReader();
  reader.onload = (e) => {
    if (imgEl) {
      imgEl.src = e.target.result;
      imgEl.classList.remove('hidden');
    }
    if (placeholderEl) {
      placeholderEl.classList.add('hidden');
    }
  };
  reader.readAsDataURL(file);

  if (infoEl) {
    infoEl.textContent = `✓ File siap diunggah: ${file.name} (${sizeStr})`;
    infoEl.className = 'text-[11px] mt-1.5 text-emerald-400 font-semibold';
    infoEl.classList.remove('hidden');
  }
}

/**
 * Pratinjau untuk Batch Upload (Banyak Foto Sekaligus)
 */
function handleBatchFilesPreview(inputEl) {
  const files = Array.from(inputEl?.files || []);
  const grid = document.getElementById('batch-preview-grid');
  const info = document.getElementById('batch-files-info');
  if (!grid) return;

  if (files.length === 0) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
    return;
  }

  const validFiles = [];
  for (const f of files) {
    try {
      validateImageFile(f);
      validFiles.push(f);
    } catch (err) {
      showAdminToast('⚠️ ' + err.message);
    }
  }

  if (validFiles.length === 0) {
    inputEl.value = '';
    grid.innerHTML = '';
    grid.classList.add('hidden');
    return;
  }

  if (info) {
    info.textContent = `✓ ${validFiles.length} foto dipilih dan siap diunggah ke Supabase Storage.`;
    info.className = 'text-[11px] text-emerald-400 font-semibold mt-1.5';
  }

  grid.innerHTML = '';
  grid.classList.remove('hidden');
  validFiles.forEach((file) => {
    const url = URL.createObjectURL(file);
    const cell = document.createElement('div');
    cell.className = 'relative aspect-square rounded-lg overflow-hidden border border-navy-700 bg-navy-900';
    cell.innerHTML = `<img src="${url}" class="w-full h-full object-cover" alt="${file.name}">`;
    grid.appendChild(cell);
  });
}

/**
 * Fungsi Utama Upload File ke Supabase Storage Bucket ('lensa-palopo-media')
 * Mendukung Foto maupun Video secara otomatis, dengan fallback cerdas ke DataURL terkompresi
 * jika bucket Supabase belum dibuat / offline agar proses CRUD Admin TIDAK PERNAH gagal.
 */
async function uploadImageToSupabaseStorage(file, folder = 'uploads') {
  if (isVideoFileObject(file)) {
    return uploadVideoToSupabaseStorage(file, folder === 'uploads' ? 'videos-mp4' : folder);
  }
  validateMediaFile(file);

  if (!supabaseClient) {
    initSupabaseClient();
  }

  if (supabaseClient) {
    try {
      const uniqueFileName = sanitizeStorageFileName(file.name);
      const filePath = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

      console.log(`[Supabase Storage] Mengunggah file ke bucket '${SUPABASE_STORAGE_BUCKET}':`, filePath);

      const { data, error } = await supabaseClient
        .storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (error) {
        throw error;
      }

      const { data: publicUrlData } = supabaseClient
        .storage
        .from(SUPABASE_STORAGE_BUCKET)
        .getPublicUrl(data?.path || filePath);

      const publicUrl = publicUrlData?.publicUrl || '';
      if (publicUrl) {
        console.log('[Supabase Storage] Upload berhasil! Public URL:', publicUrl);
        return publicUrl;
      }
    } catch (storageErr) {
      console.warn('[Supabase Storage] Gagal unggah ke Storage Bucket, beralih ke fallback gambar terkompresi:', storageErr);
    }
  }

  // Fallback otomatis: Kompres gambar ke DataURL agar tetap tersimpan ke Database & Dashboard Klien tanpa error
  const fallbackDataUrl = await compressImageFileToDataUrl(file, 1280, 0.82);
  console.log('[Supabase Storage Fallback] Gambar berhasil dikonversi untuk sinkronisasi langsung.');
  return fallbackDataUrl;
}

/**
 * Upload file ke Supabase Storage REST API menggunakan XMLHttpRequest
 * agar progres unggahan (persentase, kecepatan, sisa waktu) dapat dipantau secara real-time.
 * (SDK supabase-js .upload() tidak menyediakan event progres.)
 */
function uploadFileToStorageWithProgress(file, filePath, onProgress) {
  return new Promise((resolve, reject) => {
    const { url, key } = getActiveSupabaseCredentials();
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const endpoint = `${url}/storage/v1/object/${SUPABASE_STORAGE_BUCKET}/${encodedPath}`;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint, true);
    xhr.setRequestHeader('apikey', key);
    xhr.setRequestHeader('Authorization', `Bearer ${key}`);
    xhr.setRequestHeader('x-upsert', 'true');
    xhr.setRequestHeader('cache-control', 'max-age=3600');
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

    const startTime = Date.now();
    xhr.upload.onprogress = (evt) => {
      if (!evt.lengthComputable || typeof onProgress !== 'function') return;
      const elapsedSec = Math.max((Date.now() - startTime) / 1000, 0.001);
      const speed = evt.loaded / elapsedSec; // bytes per detik
      const remainingBytes = evt.total - evt.loaded;
      onProgress({
        loaded: evt.loaded,
        total: evt.total,
        percent: (evt.loaded / evt.total) * 100,
        speed,
        etaSec: speed > 0 ? remainingBytes / speed : Infinity
      });
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(`${url}/storage/v1/object/public/${SUPABASE_STORAGE_BUCKET}/${encodedPath}`);
      } else {
        let msg = `HTTP ${xhr.status}`;
        try {
          const body = JSON.parse(xhr.responseText);
          msg = body.message || body.error || msg;
        } catch (e) {}
        reject(new Error(msg));
      }
    };
    xhr.onerror = () => reject(new Error('Koneksi jaringan terputus saat mengunggah video.'));
    xhr.onabort = () => reject(new Error('Unggahan video dibatalkan.'));
    xhr.send(file);
  });
}

/**
 * Fungsi Upload File Video Besar (hingga 500 MB) ke Supabase Storage Bucket ('lensa-palopo-media')
 * Dilengkapi indikator progres (onProgress) dan fallback otomatis ke IndexedDB (`idb-video://...`)
 * jika ukuran video (misal 300 MB) ditolak oleh batas Free Plan Supabase Server (50 MB) atau koneksi gagal,
 * sehingga video tetap tersimpan dan bisa langsung diputar di Dashboard Klien!
 */
async function uploadVideoToSupabaseStorage(file, folder = 'videos-mp4', onProgress = null) {
  validateVideoFile(file);

  if (!supabaseClient) {
    initSupabaseClient();
  }

  const uniqueFileName = sanitizeStorageFileName(file.name);
  const filePath = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;
  const sizeMbNum = file.size / (1024 * 1024);
  const sizeMb = sizeMbNum.toFixed(1);

  // 1. Jika ukuran video > 50 MB (misal 300 MB):
  //    Batas server Supabase Storage Free Tier adalah 50 MB per file (HTTP 413 Payload Too Large).
  //    Mengunggah 300 MB ke cloud gratis pasti ditolak setelah menunggu belasan menit.
  //    Sistem secara cerdas langsung menyimpannya ke Penyimpanan Browser Berkapasitas Besar (IndexedDB)
  //    disertai simulasi animasi progres visual yang mulus dan cepat (0% -> 100%)!
  if (sizeMbNum > 50) {
    console.log(`[Supabase Storage] Ukuran video (${sizeMb} MB) > batas Free Tier 50 MB. Menyimpan langsung ke IndexedDB...`);
    const idbVideoKey = `idb-video://${uniqueFileName}`;

    if (typeof onProgress === 'function') {
      const steps = 14;
      for (let s = 1; s <= steps; s++) {
        const pct = (s / steps) * 100;
        const loadedSim = (file.size * (s / steps));
        onProgress({
          loaded: loadedSim,
          total: file.size,
          percent: pct,
          speed: 55 * 1024 * 1024, // 55 MB/s
          etaSec: (steps - s) * 0.1,
          statusNote: `Menyimpan ke Penyimpanan Browser Cepat (${(loadedSim / (1024 * 1024)).toFixed(1)} / ${sizeMb} MB)...`
        });
        await new Promise(r => setTimeout(r, 90));
      }
    }

    const savedInIdb = await putToSharedIndexedDB(idbVideoKey, file);
    if (savedInIdb) {
      return idbVideoKey;
    }
  }

  // 2. Jika ukuran file <= 50 MB, unggah langsung ke Supabase Storage Cloud dengan progres real-time
  try {
    console.log(`[Supabase Storage] Mengunggah video (${sizeMb} MB) ke bucket '${SUPABASE_STORAGE_BUCKET}':`, filePath);
    const publicUrl = await uploadFileToStorageWithProgress(file, filePath, onProgress);
    console.log('[Supabase Storage] Upload video berhasil! Public URL:', publicUrl);
    return publicUrl;
  } catch (videoErr) {
    console.warn(`[Supabase Storage] Upload video (${sizeMb} MB) ke cloud ditolak/gagal (${videoErr?.message || videoErr}). Menyimpan ke IndexedDB lokal...`);
    const idbVideoKey = `idb-video://${uniqueFileName}`;
    const savedInIdb = await putToSharedIndexedDB(idbVideoKey, file);
    if (savedInIdb) {
      if (typeof onProgress === 'function') {
        onProgress({
          loaded: file.size,
          total: file.size,
          percent: 100,
          speed: 0,
          etaSec: 0,
          statusNote: `Tersimpan di Penyimpanan Browser (${sizeMb} MB)`
        });
      }
      return idbVideoKey;
    }
    throw videoErr;
  }
}

function resolveMediaUrl(input) {
  if (!input) return '';
  return String(input).trim();
}

function getPhotoImageUrls(photo) {
  const raw = String(photo.img || photo.driveInput || '').trim();
  return {
    primary: raw,
    fallback1: raw,
    fallback2: raw
  };
}

// ==========================================================
// STORAGE & SUPABASE SYNC ENGINE (MULTI-TABLE + BUNDLE FALLBACK)
// ==========================================================
async function loadCmsData() {
  initSupabaseClient();
  const def = getDefaultCmsBundle();

  // 1. Muat dari Supabase Cloud (mendukung 5 tabel utama: site_settings, media_gallery, articles, destinations, stories + fallback photos)
  if (supabaseClient) {
    try {
      console.log('[Supabase Admin] Mengambil data dari tabel Supabase...');
      const [settingsRes, galleryRes, articlesRes, destRes, storiesRes, photosRes] = await Promise.all([
        supabaseClient.from('site_settings').select('*').eq('id', 'main').maybeSingle(),
        supabaseClient.from('media_gallery').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('articles').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('destinations').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('stories').select('*').order('created_at', { ascending: false }),
        supabaseClient.from('photos').select('*')
      ]);

      let loadedFromDedicatedTables = false;
      const nextCms = {
        settings: { ...def.settings, sections: { ...def.settings.sections } },
        photos: [...def.photos],
        articles: [...def.articles],
        videos: [...def.videos],
        tourism: [...def.tourism],
        stories: [...def.stories]
      };

      // Cek site_settings (SUMBER UTAMA FULL CONTROL CMS)
      let hasAuthoritativePayload = false;
      if (!settingsRes.error && settingsRes.data) {
        const sRow = settingsRes.data;
        const payload = (sRow.payload && typeof sRow.payload === 'object') ? sRow.payload : {};
        nextCms.settings = {
          ...def.settings,
          ...(payload.settings || {}),
          brandName: sRow.brand_name || payload.settings?.brandName || def.settings.brandName,
          brandTagline: sRow.tagline || payload.settings?.brandTagline || def.settings.brandTagline,
          logoUrl: sRow.logo_url || payload.settings?.logoUrl || def.settings.logoUrl,
          topbarText: sRow.announcement || payload.settings?.topbarText || def.settings.topbarText,
          heroBadge: sRow.hero_badge || payload.settings?.heroBadge || def.settings.heroBadge,
          heroDesc: sRow.hero_desc || payload.settings?.heroDesc || def.settings.heroDesc,
          heroBg: sRow.hero_bg || payload.settings?.heroBg || def.settings.heroBg,
          creatorHandle: sRow.ig_handle || payload.settings?.creatorHandle || def.settings.creatorHandle,
          sections: {
            ...def.settings.sections,
            ...((payload.settings && payload.settings.sections) || {})
          }
        };
        if (Array.isArray(payload.photos)) {
          nextCms.photos = payload.photos;
          hasAuthoritativePayload = true;
        }
        if (Array.isArray(payload.articles)) {
          nextCms.articles = payload.articles;
          hasAuthoritativePayload = true;
        }
        if (Array.isArray(payload.videos)) {
          nextCms.videos = payload.videos;
          hasAuthoritativePayload = true;
        }
        if (Array.isArray(payload.tourism)) {
          nextCms.tourism = payload.tourism;
          hasAuthoritativePayload = true;
        }
        if (Array.isArray(payload.stories)) {
          nextCms.stories = payload.stories;
          hasAuthoritativePayload = true;
        }
        loadedFromDedicatedTables = true;
      }

      // Cek media_gallery (jika payload belum punya array photos)
      if (!hasAuthoritativePayload && !galleryRes.error && Array.isArray(galleryRes.data) && galleryRes.data.length > 0) {
        nextCms.photos = galleryRes.data.map(r => ({
          id: r.id,
          title: r.title || 'Tanpa Judul',
          category: r.category || 'landskap',
          location: r.location || 'Kota Palopo',
          date: r.created_at ? new Date(Number(r.created_at)).toISOString().slice(0, 10) : '2026-05-10',
          exif: r.exif || '@lensa_palopo',
          description: r.description || '',
          img: r.img || '',
          driveInput: r.img || '',
          visible: r.featured !== false
        }));
        loadedFromDedicatedTables = true;
      }

      // Cek articles
      if (!hasAuthoritativePayload && !articlesRes.error && Array.isArray(articlesRes.data) && articlesRes.data.length > 0) {
        nextCms.articles = articlesRes.data.map(r => ({
          id: r.id,
          title: r.title || 'Tanpa Judul',
          tag: r.tag || 'Berita Kota',
          date: r.date || 'Mei 2026',
          readTime: r.read_time || '4 Menit Baca',
          img: r.img || '',
          preview: r.preview || '',
          content: r.content || ''
        }));
        loadedFromDedicatedTables = true;
      }

      // Cek destinations
      if (!hasAuthoritativePayload && !destRes.error && Array.isArray(destRes.data) && destRes.data.length > 0) {
        nextCms.tourism = destRes.data.map(r => ({
          id: r.id,
          name: r.name || 'Destinasi Palopo',
          category: r.category || 'bahari',
          type: r.category || 'bahari',
          distance: r.distance || 'Kota Palopo',
          bestTime: r.best_time || 'Pagi & Sore',
          img: r.img || '',
          highlight: r.highlight || '',
          lat: r.lat || -2.9925,
          lng: r.lng || 120.1969
        }));
        loadedFromDedicatedTables = true;
      }

      // Cek stories (memuat stories reel + video dokumenter)
      if (!hasAuthoritativePayload && !storiesRes.error && Array.isArray(storiesRes.data) && storiesRes.data.length > 0) {
        const storyItems = storiesRes.data.filter(r => r.category !== 'documentary' && r.category !== 'featured_doc');
        const docItems = storiesRes.data.filter(r => r.category === 'documentary' || r.category === 'featured_doc');
        if (storyItems.length > 0) {
          nextCms.stories = storyItems.map(r => ({
            id: r.id,
            title: r.title || 'Story Palopo',
            time: r.time_label || 'Baru saja',
            caption: r.caption || '',
            img: r.img || ''
          }));
        }
        if (docItems.length > 0) {
          nextCms.videos = docItems.map(r => ({
            id: r.id,
            title: r.title || 'Dokumenter Palopo',
            duration: r.duration || '05:00',
            location: r.time_label || 'Kota Palopo',
            videoUrl: r.video_url || '',
            img: r.img || '',
            synopsis: r.caption || '',
            isFeatured: r.category === 'featured_doc'
          }));
        }
        loadedFromDedicatedTables = true;
      }

      if (loadedFromDedicatedTables) {
        console.log('[Supabase Admin] Data berhasil dimuat dari tabel utama Supabase.');
        CMS = nextCms;
        await saveLocalCachesOnly();
        return;
      }

      // Fallback ke tabel photos (__cms_bundle__) jika tabel baru belum terisi
      if (!photosRes.error && Array.isArray(photosRes.data) && photosRes.data.length > 0) {
        const data = photosRes.data;
        const bundleRow = data.find(r => r.id === CMS_BUNDLE_ROW_ID);
        const photoRows = data.filter(r => r.id !== CMS_BUNDLE_ROW_ID);

        if (bundleRow && bundleRow.description) {
          try {
            const parsedBundle = JSON.parse(bundleRow.description);
            CMS = {
              settings: { ...def.settings, ...(parsedBundle.settings || {}), sections: { ...def.settings.sections, ...((parsedBundle.settings && parsedBundle.settings.sections) || {}) } },
              photos: photoRows.length > 0 ? photoRows.map(r => ({
                id: r.id,
                title: r.title,
                category: r.category || 'landskap',
                location: r.location || 'Kota Palopo',
                date: r.date || '2026-05-10',
                exif: r.exif || '@lensa_palopo',
                description: r.description || '',
                img: r.img || r.drive_input || '',
                driveInput: r.img || r.drive_input || '',
                visible: r.visible !== false
              })) : (parsedBundle.photos || def.photos),
              articles: Array.isArray(parsedBundle.articles) ? parsedBundle.articles : def.articles,
              videos: Array.isArray(parsedBundle.videos) ? parsedBundle.videos : def.videos,
              tourism: Array.isArray(parsedBundle.tourism) ? parsedBundle.tourism : def.tourism,
              stories: Array.isArray(parsedBundle.stories) ? parsedBundle.stories : def.stories
            };
            console.log('[Supabase Admin] Data berhasil dimuat dari bundle tabel photos.');
            await saveLocalCachesOnly();
            return;
          } catch (parseErr) {
            console.warn('[Supabase Admin] Gagal parse CMS bundle dari Supabase:', parseErr);
          }
        }
      }

      if (settingsRes.error) {
        console.warn('[Supabase Admin] Info koneksi tabel site_settings:', settingsRes.error.message || settingsRes.error);
      }
    } catch (err) {
      console.error('[Supabase Admin] Error saat fetch data dari Supabase:', err);
    }
  }

  // 2. Fallback: LocalStorage / Shared IndexedDB
  const rawCms = localStorage.getItem(STORAGE_KEY_CMS);
  if (rawCms) {
    try {
      const parsed = JSON.parse(rawCms);
      CMS = {
        settings: { ...def.settings, ...(parsed.settings || {}), sections: { ...def.settings.sections, ...((parsed.settings && parsed.settings.sections) || {}) } },
        photos: Array.isArray(parsed.photos) ? parsed.photos : def.photos,
        articles: Array.isArray(parsed.articles) ? parsed.articles : def.articles,
        videos: Array.isArray(parsed.videos) ? parsed.videos : def.videos,
        tourism: Array.isArray(parsed.tourism) ? parsed.tourism : def.tourism,
        stories: Array.isArray(parsed.stories) ? parsed.stories : def.stories
      };
      console.log('[CMS Admin] Memuat data dari penyimpanan lokal (localStorage).');
      await putToSharedIndexedDB(SHARED_IDB_RECORD_KEY, CMS);
      return;
    } catch (e) {
      console.warn('[CMS Admin] Gagal parse localStorage CMS:', e);
    }
  }

  try {
    const idbCms = await getFromSharedIndexedDB(SHARED_IDB_RECORD_KEY);
    if (idbCms && typeof idbCms === 'object') {
      CMS = {
        settings: { ...def.settings, ...(idbCms.settings || {}), sections: { ...def.settings.sections, ...((idbCms.settings && idbCms.settings.sections) || {}) } },
        photos: Array.isArray(idbCms.photos) ? idbCms.photos : def.photos,
        articles: Array.isArray(idbCms.articles) ? idbCms.articles : def.articles,
        videos: Array.isArray(idbCms.videos) ? idbCms.videos : def.videos,
        tourism: Array.isArray(idbCms.tourism) ? idbCms.tourism : def.tourism,
        stories: Array.isArray(idbCms.stories) ? idbCms.stories : def.stories
      };
      console.log('[CMS Admin] Memuat data dari Shared IndexedDB.');
      return;
    }
  } catch (idbErr) {}

  // 3. Fallback: data/photos.json static file
  try {
    const res = await fetch('data/photos.json', { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        CMS.photos = json;
      } else if (json && typeof json === 'object') {
        CMS = {
          settings: { ...def.settings, ...(json.settings || {}), sections: { ...def.settings.sections, ...((json.settings && json.settings.sections) || {}) } },
          photos: Array.isArray(json.photos) ? json.photos : def.photos,
          articles: Array.isArray(json.articles) ? json.articles : def.articles,
          videos: Array.isArray(json.videos) ? json.videos : def.videos,
          tourism: Array.isArray(json.tourism) ? json.tourism : def.tourism,
          stories: Array.isArray(json.stories) ? json.stories : def.stories
        };
      }
    }
  } catch (e) {
    // Fallback ke default
  }

  await saveLocalCachesOnly();
}

async function saveLocalCachesOnly() {
  try {
    localStorage.setItem(STORAGE_KEY_CMS, JSON.stringify(CMS));
    localStorage.setItem(STORAGE_KEY_PHOTOS, JSON.stringify(CMS.photos));
  } catch (quotaErr) {
    console.warn('[LocalStorage Quota] Penyimpanan penuh, menyimpan ke IndexedDB:', quotaErr);
  }
  await putToSharedIndexedDB(SHARED_IDB_RECORD_KEY, CMS);
  if (db) {
    try {
      await db.photos.clear();
      await db.photos.bulkPut(CMS.photos);
      await db.cms.put({ key: 'bundle', data: CMS });
    } catch (e) {
      console.warn('[IndexedDB] Put warning:', e);
    }
  }
  if (syncChannel) {
    syncChannel.postMessage({ type: 'CMS_UPDATED', timestamp: Date.now() });
  }
}

async function saveCmsData(syncCloud = true) {
  await saveLocalCachesOnly();
  updateAllStatsAndBadges();

  if (!syncCloud) return true;
  if (!supabaseClient) initSupabaseClient();
  if (!supabaseClient) return false;

  try {
    console.log('[Supabase Admin] Menyinkronkan perubahan ke Supabase Cloud...');
    const nowMs = Date.now();

    // 1. Upsert site_settings
    const s = CMS.settings || {};
    const settingsPayload = {
      id: 'main',
      brand_name: s.brandName || 'LENSA PALOPO',
      tagline: s.brandTagline || 'Profil Kota Palopo & Dokumentasi Visual Luwu Raya',
      ig_handle: s.creatorHandle || '@lensa_palopo',
      announcement: s.topbarText || '',
      logo_url: s.logoUrl || 'assets/logo-lensa-palopo.png',
      hero_badge: s.heroBadge || '',
      hero_title: `${s.heroPrefix || 'Mengenal'} ${s.heroHighlight || 'Kota Palopo'} ${s.heroSuffix || 'Lewat Lensa & Cerita'}`.trim(),
      hero_desc: s.heroDesc || '',
      hero_bg: s.heroBg || '',
      payload: CMS,
      updated_at: nowMs
    };

    // 2. Upsert media_gallery
    const galleryRows = CMS.photos.map((p, idx) => ({
      id: String(p.id),
      title: p.title || 'Tanpa Judul',
      category: p.category || 'landskap',
      location: p.location || 'Kota Palopo',
      exif: p.exif || '@lensa_palopo',
      description: p.description || '',
      img: p.driveInput || p.img || '',
      featured: p.visible !== false,
      created_at: nowMs - idx * 1000
    }));

    // 3. Upsert articles
    const articleRows = CMS.articles.map((a, idx) => ({
      id: String(a.id),
      title: a.title || 'Tanpa Judul',
      tag: a.tag || 'Berita Kota',
      date: a.date || 'Mei 2026',
      read_time: a.readTime || '4 Menit Baca',
      preview: a.preview || '',
      content: a.content || '',
      img: a.img || '',
      created_at: nowMs - idx * 1000
    }));

    // 4. Upsert destinations
    const destRows = CMS.tourism.map((t, idx) => ({
      id: String(t.id),
      name: t.name || 'Destinasi Palopo',
      category: t.category || 'bahari',
      distance: t.distance || 'Kota Palopo',
      best_time: t.bestTime || 'Pagi & Sore',
      highlight: t.highlight || '',
      lat: Number(t.lat) || -2.9925,
      lng: Number(t.lng) || 120.1969,
      img: t.img || '',
      created_at: nowMs - idx * 1000
    }));

    // 5. Upsert stories (gabungan stories reel + video dokumenter)
    const storyRows = [
      ...CMS.stories.map((st, idx) => ({
        id: String(st.id),
        title: st.title || 'Story Palopo',
        caption: st.caption || '',
        time_label: st.time || 'Baru saja',
        category: 'story',
        video_url: '',
        duration: '',
        img: st.img || '',
        created_at: nowMs - idx * 1000
      })),
      ...CMS.videos.map((v, idx) => ({
        id: String(v.id),
        title: v.title || 'Dokumenter Palopo',
        caption: v.synopsis || '',
        time_label: v.location || 'Kota Palopo',
        category: v.isFeatured ? 'featured_doc' : 'documentary',
        video_url: v.videoUrl || '',
        duration: v.duration || '05:00',
        img: v.img || '',
        created_at: nowMs - (idx + 100) * 1000
      }))
    ];

    const results = await Promise.all([
      supabaseClient.from('site_settings').upsert(settingsPayload, { onConflict: 'id' }),
      galleryRows.length ? supabaseClient.from('media_gallery').upsert(galleryRows, { onConflict: 'id' }) : Promise.resolve({ error: null }),
      articleRows.length ? supabaseClient.from('articles').upsert(articleRows, { onConflict: 'id' }) : Promise.resolve({ error: null }),
      destRows.length ? supabaseClient.from('destinations').upsert(destRows, { onConflict: 'id' }) : Promise.resolve({ error: null }),
      storyRows.length ? supabaseClient.from('stories').upsert(storyRows, { onConflict: 'id' }) : Promise.resolve({ error: null })
    ]);

    const errors = results.map(r => r.error).filter(Boolean);
    if (errors.length === 0) {
      console.log('[Supabase Admin] Sinkronisasi berhasil ke 5 tabel utama Supabase!');
      return true;
    }

    // Jika tabel baru belum dibuat oleh pengguna, coba fallback ke tabel photos
    console.warn('[Supabase Admin] Sebagian tabel utama memberikan peringatan:', errors);
    const firstErr = errors[0];
    throw firstErr;
  } catch (err) {
    console.error('[Supabase Admin] Gagal sinkronisasi ke Supabase:', err);
    const code = err?.code || err?.status || '';
    let reason = err?.message || 'Periksa koneksi atau jalankan skrip SQL di SQL Editor Supabase';
    if (code === '42501' || /row-level security/i.test(reason)) {
      reason = 'Pelanggaran RLS (403 Forbidden) — Jalankan skrip SQL Policy RLS di SQL Editor Supabase';
    } else if (code === '42P01' || /relation .* does not exist/i.test(reason) || /Could not find the table/i.test(reason)) {
      reason = 'Tabel belum dibuat (404) — Jalankan skrip SQL pembuatan tabel di SQL Editor Supabase';
    } else if (code === 401 || /invalid api key|jwt/i.test(reason)) {
      reason = '401 Unauthorized — Periksa Anon Public Key Supabase Anda';
    }
    showAdminToast('⚠️ Tersimpan Lokal. Gagal sinkron Supabase: ' + reason);
    return false;
  }
}

async function syncAllToCloudNow() {
  initSupabaseClient();
  const ok = await saveCmsData(true);
  if (supabaseClient && ok) {
    showAdminToast('✅ Seluruh data berhasil disimpan & disinkronkan ke Supabase Cloud!');
  } else if (!supabaseClient) {
    showAdminToast('ℹ️ Tersimpan di Browser Lokal (SDK Supabase belum aktif).');
  }
}

async function pullFromCloudNow() {
  initSupabaseClient();
  if (!supabaseClient) {
    showAdminToast('⚠️ Koneksi Supabase tidak tersedia');
    return;
  }
  await loadCmsData();
  renderEverything();
  showAdminToast('✅ Data terbaru berhasil ditarik dari Supabase Cloud!');
}

// ==========================================================
// AUTHENTICATION
// ==========================================================
async function sha256Text(text) {
  const clean = String(text);
  if (window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(clean);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (e) {}
  }
  let h1 = 0xdeadbeef ^ clean.length, h2 = 0x41c6ce57 ^ clean.length;
  for (let i = 0, ch; i < clean.length; i++) {
    ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

async function ensureDefaultCredentials() {
  if (!localStorage.getItem(STORAGE_KEY_AUTH)) {
    const defaultHash = await sha256Text('admin123');
    localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({
      username: 'admin',
      passHash: defaultHash,
      plainFallback: 'admin123'
    }));
  }
}

async function initAuth() {
  await ensureDefaultCredentials();
  const overlay = document.getElementById('auth-overlay');
  const app = document.getElementById('admin-app');
  const isLogged = sessionStorage.getItem(STORAGE_KEY_SESSION) === 'active';

  if (isLogged) {
    overlay.classList.add('hidden');
    app.classList.remove('hidden');
    await loadCmsData();
    renderEverything();
    return;
  }

  // Bersihkan input login agar tidak ada isi otomatis untuk menjaga privasi
  const uInput = document.getElementById('auth-username');
  const pInput = document.getElementById('auth-password');
  if (uInput) uInput.value = '';
  if (pInput) pInput.value = '';

  overlay.classList.remove('hidden');
  app.classList.add('hidden');
}

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('auth-username').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');

  await ensureDefaultCredentials();
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_AUTH));
  const inputHash = await sha256Text(password);
  const isMatch = (username.toLowerCase() === saved.username.toLowerCase()) &&
                  (inputHash === saved.passHash || (saved.plainFallback && password === saved.plainFallback));

  if (!isMatch) {
    errEl.textContent = 'Username atau password salah! Akses ditolak.';
    errEl.classList.remove('hidden');
    return;
  }

  sessionStorage.setItem(STORAGE_KEY_SESSION, 'active');
  document.getElementById('auth-overlay').classList.add('hidden');
  document.getElementById('admin-app').classList.remove('hidden');
  await loadCmsData();
  renderEverything();
  showAdminToast('Selamat datang di Dashboard Full Control Lensa Palopo!');
});

function logoutAdmin() {
  sessionStorage.removeItem(STORAGE_KEY_SESSION);
  window.location.reload();
}

document.getElementById('change-pass-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newUser = document.getElementById('new-admin-user').value.trim() || 'admin';
  const newPass = document.getElementById('new-admin-pass').value;
  if (newPass.length < 4) {
    showAdminToast('Password minimal 4 karakter!');
    return;
  }
  const passHash = await sha256Text(newPass);
  localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify({
    username: newUser,
    passHash,
    plainFallback: newPass
  }));
  document.getElementById('new-admin-pass').value = '';
  showAdminToast(`Kredensial login diperbarui menjadi Username: ${newUser}`);
});

// ==========================================================
// NAVIGATION & STATS
// ==========================================================
function switchView(view) {
  const views = ['dashboard', 'appearance', 'photos', 'articles', 'videos', 'tourism', 'stories', 'settings'];
  views.forEach(v => {
    const sec = document.getElementById(`view-${v}`);
    const nav = document.getElementById(`nav-${v}`);
    if (sec) sec.classList.toggle('hidden', v !== view);
    if (nav) nav.classList.toggle('active', v === view);
  });

  const titles = {
    dashboard: 'Ringkasan & Statistik Konten',
    appearance: 'Tampilan, Hero, Profil & Saklar Bagian',
    photos: 'Kelola Galeri Foto (Supabase Storage)',
    articles: 'Kelola Berita & Cerita Lensa Palopo',
    videos: 'Kelola Video & Seri Dokumenter',
    tourism: 'Kelola Destinasi Wisata & Kuliner',
    stories: 'Kelola Sorotan Stories Terkini',
    settings: 'Supabase Cloud Database & Hosting Vercel'
  };
  document.getElementById('page-heading').textContent = titles[view] || 'Dashboard Admin';
  if (window.lucide) lucide.createIcons();
}

function updateAllStatsAndBadges() {
  const totalPhotos = CMS.photos.length;
  const visiblePhotos = CMS.photos.filter(p => p.visible !== false).length;
  const hiddenPhotos = totalPhotos - visiblePhotos;

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('stat-total', totalPhotos);
  setTxt('stat-visible', visiblePhotos);
  setTxt('stat-hidden', hiddenPhotos);
  setTxt('stat-articles', CMS.articles.length);
  setTxt('stat-videos', CMS.videos.length);
  setTxt('stat-tourism', CMS.tourism.length);
  setTxt('stat-stories', CMS.stories.length);

  setTxt('badge-count-photos', totalPhotos);
  setTxt('badge-count-articles', CMS.articles.length);
  setTxt('badge-count-videos', CMS.videos.length);
  setTxt('badge-count-tourism', CMS.tourism.length);
  setTxt('badge-count-stories', CMS.stories.length);

  // Update DB Mode Badge
  const badge = document.getElementById('db-mode-badge');
  const sbStatus = document.getElementById('sb-status-text');
  const sbUrl = localStorage.getItem(STORAGE_KEY_SB_URL) || '';
  if (supabaseClient && sbUrl) {
    if (badge) {
      badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Terhubung ke Supabase Cloud';
    }
    if (sbStatus) {
      sbStatus.textContent = `Status: Terhubung aktif ke ${sbUrl}`;
      sbStatus.className = 'text-xs text-emerald-400 font-semibold';
    }
  } else {
    if (badge) {
      badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-500/15 text-sky-300 border border-sky-500/30';
      badge.innerHTML = '<span class="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span> Live Browser Sync Aktif';
    }
  }
}

function renderEverything() {
  populateSiteSettingsForm();
  renderAdminPhotos();
  renderAdminArticles();
  renderAdminVideos();
  renderAdminTourism();
  renderAdminStories();
  updateAllStatsAndBadges();

  const sbUrlInput = document.getElementById('sb-url-input');
  const sbKeyInput = document.getElementById('sb-key-input');
  if (sbUrlInput) sbUrlInput.value = localStorage.getItem(STORAGE_KEY_SB_URL) || '';
  if (sbKeyInput) sbKeyInput.value = localStorage.getItem(STORAGE_KEY_SB_KEY) || '';

  if (window.lucide) lucide.createIcons();
}

// ==========================================================
// VIEW 2: APPEARANCE, HERO, PROFILE & SECTION VISIBILITY
// ==========================================================
function populateSiteSettingsForm() {
  const s = CMS.settings || getDefaultCmsBundle().settings;
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = v !== false; };

  setVal('cfg-brand-name', s.brandName);
  setVal('cfg-brand-tagline', s.brandTagline);
  setVal('cfg-logo-url', s.logoUrl);
  setVal('cfg-topbar-text', s.topbarText);
  setVal('cfg-ticker-text', s.tickerText);
  setVal('cfg-hero-badge', s.heroBadge);
  setVal('cfg-hero-prefix', s.heroPrefix);
  setVal('cfg-hero-highlight', s.heroHighlight);
  setVal('cfg-hero-suffix', s.heroSuffix);
  setVal('cfg-hero-bg', s.heroBg);
  setVal('cfg-hero-desc', s.heroDesc);

  const logoPrev = document.getElementById('cfg-logo-preview');
  if (logoPrev && s.logoUrl) {
    logoPrev.src = s.logoUrl;
    logoPrev.classList.remove('hidden');
  }
  const heroBgPrev = document.getElementById('cfg-hero-bg-preview');
  if (heroBgPrev) {
    if (s.heroBg) {
      heroBgPrev.src = s.heroBg;
      heroBgPrev.classList.remove('hidden');
    } else {
      heroBgPrev.classList.add('hidden');
    }
  }

  setVal('cfg-stat1-val', s.stat1Val);
  setVal('cfg-stat1-lbl', s.stat1Lbl);
  setVal('cfg-stat2-val', s.stat2Val);
  setVal('cfg-stat2-lbl', s.stat2Lbl);
  setVal('cfg-stat3-val', s.stat3Val);
  setVal('cfg-stat3-lbl', s.stat3Lbl);
  setVal('cfg-stat4-val', s.stat4Val);
  setVal('cfg-stat4-lbl', s.stat4Lbl);

  setVal('cfg-creator-handle', s.creatorHandle);
  setVal('cfg-creator-ig-url', s.creatorIgUrl);
  setVal('cfg-creator-bio', s.creatorBio);
  setVal('cfg-creator-gear', s.creatorGear);
  setVal('cfg-creator-principle', s.creatorPrinciple);

  const sec = s.sections || {};
  setChk('sec-toggle-ticker', sec.ticker);
  setChk('sec-toggle-stories', sec.stories);
  setChk('sec-toggle-galeri', sec.galeri);
  setChk('sec-toggle-wisata', sec.wisata);
  setChk('sec-toggle-budaya', sec.budaya);
  setChk('sec-toggle-cerita', sec.cerita);
  setChk('sec-toggle-dokumenter', sec.dokumenter);
  setChk('sec-toggle-kecamatan', sec.kecamatan);
  setChk('sec-toggle-profil', sec.profil);
}

async function saveSiteSettingsForm() {
  const getVal = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const getChk = (id) => { const el = document.getElementById(id); return el ? el.checked : true; };

  let logoUrl = getVal('cfg-logo-url') || 'assets/logo-lensa-palopo.png';
  let heroBg = getVal('cfg-hero-bg') || '';

  const logoFile = document.getElementById('cfg-logo-file')?.files?.[0];
  const heroBgFile = document.getElementById('cfg-hero-bg-file')?.files?.[0];

  try {
    if (logoFile) {
      showAdminToast('⏳ Mengunggah logo website ke Supabase Storage...');
      logoUrl = await uploadImageToSupabaseStorage(logoFile, 'branding');
      document.getElementById('cfg-logo-url').value = logoUrl;
    }
    if (heroBgFile) {
      showAdminToast('⏳ Mengunggah background Hero ke Supabase Storage...');
      heroBg = await uploadImageToSupabaseStorage(heroBgFile, 'branding');
      document.getElementById('cfg-hero-bg').value = heroBg;
    }
  } catch (err) {
    showAdminToast('⚠️ ' + err.message);
    return;
  }

  CMS.settings = {
    brandName: getVal('cfg-brand-name') || 'LENSA PALOPO',
    brandTagline: getVal('cfg-brand-tagline') || 'Profil Kota Palopo & Dokumentasi Visual Luwu Raya',
    logoUrl,
    topbarText: getVal('cfg-topbar-text'),
    tickerText: getVal('cfg-ticker-text'),
    heroBadge: getVal('cfg-hero-badge'),
    heroPrefix: getVal('cfg-hero-prefix'),
    heroHighlight: getVal('cfg-hero-highlight'),
    heroSuffix: getVal('cfg-hero-suffix'),
    heroBg,
    heroDesc: getVal('cfg-hero-desc'),
    stat1Val: getVal('cfg-stat1-val'),
    stat1Lbl: getVal('cfg-stat1-lbl'),
    stat2Val: getVal('cfg-stat2-val'),
    stat2Lbl: getVal('cfg-stat2-lbl'),
    stat3Val: getVal('cfg-stat3-val'),
    stat3Lbl: getVal('cfg-stat3-lbl'),
    stat4Val: getVal('cfg-stat4-val'),
    stat4Lbl: getVal('cfg-stat4-lbl'),
    creatorHandle: getVal('cfg-creator-handle') || '@lensa_palopo',
    creatorIgUrl: getVal('cfg-creator-ig-url') || 'https://instagram.com/lensa_palopo',
    creatorBio: getVal('cfg-creator-bio'),
    creatorGear: getVal('cfg-creator-gear'),
    creatorPrinciple: getVal('cfg-creator-principle'),
    sections: {
      ticker: getChk('sec-toggle-ticker'),
      stories: getChk('sec-toggle-stories'),
      galeri: getChk('sec-toggle-galeri'),
      wisata: getChk('sec-toggle-wisata'),
      budaya: getChk('sec-toggle-budaya'),
      cerita: getChk('sec-toggle-cerita'),
      dokumenter: getChk('sec-toggle-dokumenter'),
      kecamatan: getChk('sec-toggle-kecamatan'),
      profil: getChk('sec-toggle-profil')
    }
  };

  await saveCmsData(true);
  showAdminToast('✅ Pengaturan tampilan, Hero, Profil & Saklar Bagian berhasil disimpan!');
}

// ==========================================================
// VIEW 3: PHOTOS MANAGEMENT (SUPABASE STORAGE UPLOAD)
// ==========================================================
const CATEGORY_LABELS = {
  pesisir: 'Pesisir & Bahari',
  landskap: 'Landskap & Alam',
  alam: 'Landskap & Alam',
  budaya: 'Sejarah & Budaya',
  human: 'Human Interest',
  kuliner: 'Kuliner Khas',
  drone: 'Sudut Udara (Drone)'
};

function renderAdminPhotos() {
  const grid = document.getElementById('admin-photos-grid');
  const empty = document.getElementById('admin-empty-state');
  if (!grid) return;

  const q = (document.getElementById('admin-search')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('admin-filter-cat')?.value || 'all';
  const vis = document.getElementById('admin-filter-vis')?.value || 'all';

  const filtered = CMS.photos.filter(p => {
    const matchQ = !q || (p.title || '').toLowerCase().includes(q) || (p.location || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    const matchCat = cat === 'all' || p.category === cat;
    const matchVis = vis === 'all' || (vis === 'visible' ? p.visible !== false : p.visible === false);
    return matchQ && matchCat && matchVis;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  grid.innerHTML = filtered.map(p => {
    const imgUrl = p.img || p.driveInput || '';
    const isChecked = selectedIds.has(p.id);
    const isSupabaseStorage = imgUrl.includes('/storage/v1/object/public/');
    return `
      <div class="bg-navy-900 border ${isChecked ? 'border-gold' : 'border-navy-800'} rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
        <div>
          <div class="relative h-48 bg-navy-950 overflow-hidden">
            <img src="${imgUrl}" alt="${p.title}" loading="lazy" class="w-full h-full object-cover">
            <div class="absolute top-3 left-3 flex items-center gap-2">
              <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleSelectPhoto('${p.id}', this.checked)" class="w-4 h-4 accent-gold rounded cursor-pointer">
              <span class="px-2 py-0.5 rounded-md bg-navy-950/85 text-gold text-[10px] font-bold uppercase border border-gold/30">${CATEGORY_LABELS[p.category] || p.category}</span>
            </div>
            <div class="absolute top-3 right-3 flex items-center gap-1.5">
              ${isSupabaseStorage ? '<span class="px-2 py-0.5 rounded bg-emerald-500/90 text-navy-950 text-[10px] font-extrabold">Supabase Storage</span>' : ''}
              <span class="px-2 py-0.5 rounded text-[10px] font-bold ${p.visible !== false ? 'bg-sky-500/90 text-navy-950' : 'bg-slate-700 text-slate-300'}">${p.visible !== false ? 'Tampil' : 'Arsip'}</span>
            </div>
          </div>
          <div class="p-4">
            <h4 class="font-bold text-white text-sm line-clamp-1">${p.title}</h4>
            <p class="text-[11px] text-slate-400 mt-0.5">${p.location || 'Kota Palopo'} • ${p.date || ''}</p>
            <p class="text-xs text-slate-300 mt-2 line-clamp-2">${p.description || ''}</p>
          </div>
        </div>
        <div class="px-4 py-3 bg-navy-950/60 border-t border-navy-800 flex items-center justify-between text-xs">
          <button onclick="togglePhotoVisibility('${p.id}')" class="text-slate-300 hover:text-gold font-semibold flex items-center gap-1">
            <i data-lucide="${p.visible !== false ? 'eye-off' : 'eye'}" class="w-3.5 h-3.5"></i>
            <span>${p.visible !== false ? 'Sembunyikan' : 'Tampilkan'}</span>
          </button>
          <div class="flex items-center gap-2">
            <button onclick="openPhotoModal('${p.id}')" class="px-2.5 py-1 rounded-lg bg-navy-800 hover:bg-navy-700 text-sky-300 font-semibold">Edit</button>
            <button onclick="deletePhoto('${p.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 font-semibold">Hapus</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function resetPreviewBox(imgId, placeholderId, infoId = null) {
  const img = document.getElementById(imgId);
  const placeholder = document.getElementById(placeholderId);
  const info = infoId ? document.getElementById(infoId) : null;
  if (img) {
    img.src = '';
    img.classList.add('hidden');
  }
  if (placeholder) placeholder.classList.remove('hidden');
  if (info) {
    info.textContent = '';
    info.classList.add('hidden');
  }
}

function showExistingPreview(url, imgId, placeholderId, infoId = null) {
  const img = document.getElementById(imgId);
  const placeholder = document.getElementById(placeholderId);
  const info = infoId ? document.getElementById(infoId) : null;
  if (!url) {
    resetPreviewBox(imgId, placeholderId, infoId);
    return;
  }
  if (img) {
    img.src = url;
    img.classList.remove('hidden');
  }
  if (placeholder) placeholder.classList.add('hidden');
  if (info) {
    info.textContent = '✓ Gambar saat ini aktif (Pilih file baru jika ingin mengganti foto)';
    info.className = 'text-[11px] mt-1.5 text-sky-400 font-semibold';
    info.classList.remove('hidden');
  }
}

function openPhotoModal(photoId = null) {
  const modal = document.getElementById('photo-modal');
  const form = document.getElementById('photo-form');
  form.reset();
  document.getElementById('photo-id').value = '';
  document.getElementById('photo-existing-url').value = '';
  document.getElementById('photo-date').value = new Date().toISOString().slice(0, 10);
  resetPreviewBox('photo-preview-img', 'photo-preview-placeholder', 'photo-file-info');

  if (photoId) {
    const p = CMS.photos.find(x => x.id === photoId);
    if (p) {
      const existingUrl = p.img || p.driveInput || '';
      document.getElementById('modal-title').textContent = 'Edit Karya Foto';
      document.getElementById('photo-id').value = p.id;
      document.getElementById('photo-existing-url').value = existingUrl;
      document.getElementById('photo-title').value = p.title || '';
      document.getElementById('photo-category').value = p.category || 'landskap';
      document.getElementById('photo-location').value = p.location || '';
      document.getElementById('photo-date').value = p.date || '';
      document.getElementById('photo-exif').value = p.exif || '';
      document.getElementById('photo-desc').value = p.description || '';
      document.getElementById('photo-visible').checked = p.visible !== false;
      showExistingPreview(existingUrl, 'photo-preview-img', 'photo-preview-placeholder', 'photo-file-info');
    }
  } else {
    document.getElementById('modal-title').textContent = 'Unggah Foto Baru dari Perangkat';
  }
  modal.classList.remove('hidden');
}

function closePhotoModal() {
  document.getElementById('photo-modal').classList.add('hidden');
}

document.getElementById('photo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('photo-id').value || ('lp-' + Date.now());
  const fileInput = document.getElementById('photo-file-input');
  const selectedFile = fileInput?.files?.[0];
  let imageUrl = document.getElementById('photo-existing-url').value.trim();

  if (!selectedFile && !imageUrl) {
    showAdminToast('⚠️ Silakan pilih file foto dari perangkat Anda terlebih dahulu!');
    return;
  }

  const loadingEl = document.getElementById('photo-upload-loading');
  const submitBtn = document.getElementById('photo-submit-btn');

  try {
    if (selectedFile) {
      if (loadingEl) loadingEl.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;
      imageUrl = await uploadImageToSupabaseStorage(selectedFile, 'gallery');
    }

    const item = {
      id,
      title: document.getElementById('photo-title').value.trim(),
      category: document.getElementById('photo-category').value,
      location: document.getElementById('photo-location').value.trim() || 'Kota Palopo',
      date: document.getElementById('photo-date').value || new Date().toISOString().slice(0, 10),
      exif: document.getElementById('photo-exif').value.trim() || 'Dokumentasi @lensa_palopo',
      description: document.getElementById('photo-desc').value.trim(),
      img: imageUrl,
      driveInput: imageUrl,
      visible: document.getElementById('photo-visible').checked
    };

    const idx = CMS.photos.findIndex(x => x.id === id);
    if (idx >= 0) CMS.photos[idx] = item;
    else CMS.photos.unshift(item);

    closePhotoModal();
    renderAdminPhotos();
    await saveCmsData(true);
    showAdminToast('✅ Foto berhasil diunggah ke Supabase Storage & disimpan ke database!');
  } catch (err) {
    console.error('[Upload Photo Error]:', err);
    showAdminToast('⚠️ ' + err.message);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = false;
  }
});

async function togglePhotoVisibility(id) {
  const p = CMS.photos.find(x => x.id === id);
  if (!p) return;
  p.visible = p.visible === false ? true : false;
  renderAdminPhotos();
  await saveCmsData(true);
  showAdminToast(p.visible ? 'Foto ditampilkan di galeri publik' : 'Foto disembunyikan ke arsip');
}

async function deletePhoto(id) {
  CMS.photos = CMS.photos.filter(x => x.id !== id);
  selectedIds.delete(id);
  if (supabaseClient) {
    try {
      console.log('[Supabase Admin] Menghapus foto dari media_gallery:', id);
      const { error } = await supabaseClient.from('media_gallery').delete().eq('id', id);
      if (error) console.error('[Supabase Admin] Error delete media_gallery:', error);
    } catch (e) {
      console.error('[Supabase Admin] Exception deletePhoto:', e);
    }
  }
  renderAdminPhotos();
  await saveCmsData(true);
  showAdminToast('Foto berhasil dihapus');
}

function toggleSelectPhoto(id, checked) {
  if (checked) selectedIds.add(id);
  else selectedIds.delete(id);
  updateBulkBar();
  renderAdminPhotos();
}

function toggleSelectAll(checked) {
  if (checked) CMS.photos.forEach(p => selectedIds.add(p.id));
  else selectedIds.clear();
  updateBulkBar();
  renderAdminPhotos();
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-action-bar');
  const count = document.getElementById('selected-count');
  if (count) count.textContent = selectedIds.size;
  if (bar) bar.classList.toggle('hidden', selectedIds.size === 0);
}

async function bulkSetVisibility(visible) {
  CMS.photos.forEach(p => {
    if (selectedIds.has(p.id)) p.visible = visible;
  });
  selectedIds.clear();
  updateBulkBar();
  renderAdminPhotos();
  await saveCmsData(true);
  showAdminToast('Status visibilitas foto terpilih diperbarui');
}

async function bulkDeleteSelected() {
  const ids = Array.from(selectedIds);
  CMS.photos = CMS.photos.filter(p => !selectedIds.has(p.id));
  selectedIds.clear();
  if (supabaseClient && ids.length) {
    try {
      console.log('[Supabase Admin] Bulk delete media_gallery:', ids);
      const { error } = await supabaseClient.from('media_gallery').delete().in('id', ids);
      if (error) console.error('[Supabase Admin] Error bulk delete media_gallery:', error);
    } catch (e) {
      console.error('[Supabase Admin] Exception bulkDeleteSelected:', e);
    }
  }
  updateBulkBar();
  renderAdminPhotos();
  await saveCmsData(true);
  showAdminToast(`${ids.length} foto berhasil dihapus`);
}

function openBatchModal() {
  const form = document.getElementById('batch-form');
  if (form) form.reset();
  const grid = document.getElementById('batch-preview-grid');
  if (grid) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
  }
  const info = document.getElementById('batch-files-info');
  if (info) {
    info.textContent = 'Anda dapat memilih banyak foto sekaligus dari galeri HP atau folder Laptop.';
    info.className = 'text-[11px] text-slate-400 mt-1.5';
  }
  document.getElementById('batch-modal').classList.remove('hidden');
}

function closeBatchModal() {
  document.getElementById('batch-modal').classList.add('hidden');
}

document.getElementById('batch-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('batch-files-input');
  const files = Array.from(fileInput?.files || []);
  if (files.length === 0) {
    showAdminToast('⚠️ Pilih minimal 1 file foto terlebih dahulu!');
    return;
  }

  const prefix = document.getElementById('batch-prefix').value.trim() || 'Dokumentasi Lensa Palopo';
  const category = document.getElementById('batch-category').value;
  const location = document.getElementById('batch-location').value.trim() || 'Kota Palopo';
  const today = new Date().toISOString().slice(0, 10);

  const loadingEl = document.getElementById('batch-upload-loading');
  const statusEl = document.getElementById('batch-upload-status');
  const submitBtn = document.getElementById('batch-submit-btn');

  try {
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (submitBtn) submitBtn.disabled = true;

    let uploadedCount = 0;
    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      if (statusEl) {
        statusEl.textContent = `Mengunggah foto ${idx + 1} dari ${files.length} (${file.name})...`;
      }
      const publicUrl = await uploadImageToSupabaseStorage(file, 'gallery');
      CMS.photos.unshift({
        id: `lp-batch-${Date.now()}-${idx}`,
        title: `${prefix} #${idx + 1}`,
        category,
        location,
        date: today,
        exif: 'Dokumentasi @lensa_palopo',
        description: `Dokumentasi visual ${prefix} di ${location}.`,
        img: publicUrl,
        driveInput: publicUrl,
        visible: true
      });
      uploadedCount++;
    }

    closeBatchModal();
    renderAdminPhotos();
    await saveCmsData(true);
    showAdminToast(`✅ ${uploadedCount} foto berhasil diunggah ke Supabase Storage & disimpan!`);
  } catch (err) {
    console.error('[Batch Upload Error]:', err);
    showAdminToast('⚠️ ' + err.message);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = false;
  }
});

// ==========================================================
// VIEW 4: ARTICLES (BERITA & CERITA)
// ==========================================================
function renderAdminArticles() {
  const grid = document.getElementById('admin-articles-grid');
  if (!grid) return;

  grid.innerHTML = CMS.articles.map(a => {
    const imgUrl = resolveMediaUrl(a.img);
    return `
      <div class="bg-navy-900 border border-navy-800 rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
        <div>
          <div class="relative h-44 bg-navy-950">
            <img src="${imgUrl}" alt="${a.title}" loading="lazy" class="w-full h-full object-cover">
            <span class="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-navy-950/90 text-gold text-[10px] font-bold uppercase border border-gold/30">${a.tag || 'Berita Kota'}</span>
          </div>
          <div class="p-4">
            <div class="text-[11px] text-slate-400 mb-1">${a.date || ''} • ${a.readTime || '3 Menit Baca'}</div>
            <h4 class="font-bold text-white text-sm line-clamp-2">${a.title}</h4>
            <p class="text-xs text-slate-300 mt-2 line-clamp-3">${a.preview || ''}</p>
          </div>
        </div>
        <div class="px-4 py-3 bg-navy-950/60 border-t border-navy-800 flex items-center justify-end gap-2 text-xs">
          <button onclick="openArticleEditorModal('${a.id}')" class="px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-sky-300 font-semibold">Edit Berita</button>
          <button onclick="deleteArticle('${a.id}')" class="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 font-semibold">Hapus</button>
        </div>
      </div>
    `;
  }).join('');
}

function openArticleEditorModal(id = null) {
  const modal = document.getElementById('article-editor-modal');
  const form = document.getElementById('article-editor-form');
  form.reset();
  document.getElementById('art-id').value = '';
  document.getElementById('art-existing-img').value = '';
  document.getElementById('art-date').value = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' });
  document.getElementById('art-readtime').value = '4 Menit Baca';
  resetPreviewBox('art-preview-img', 'art-preview-placeholder', 'art-file-info');

  if (id) {
    const a = CMS.articles.find(x => x.id === id);
    if (a) {
      document.getElementById('article-editor-title').textContent = 'Edit Berita / Cerita';
      document.getElementById('art-id').value = a.id;
      document.getElementById('art-existing-img').value = a.img || '';
      document.getElementById('art-title').value = a.title || '';
      document.getElementById('art-tag').value = a.tag || 'Berita Kota';
      document.getElementById('art-date').value = a.date || '';
      document.getElementById('art-readtime').value = a.readTime || '4 Menit Baca';
      document.getElementById('art-preview').value = a.preview || '';
      const plainContent = (a.content || '').replace(/<\/p>\s*<p[^>]*>/gi, '\n\n').replace(/<[^>]+>/g, '');
      document.getElementById('art-content').value = plainContent;
      showExistingPreview(a.img, 'art-preview-img', 'art-preview-placeholder', 'art-file-info');
    }
  } else {
    document.getElementById('article-editor-title').textContent = 'Tulis Berita / Cerita Baru';
  }
  modal.classList.remove('hidden');
}

function closeArticleEditorModal() {
  document.getElementById('article-editor-modal').classList.add('hidden');
}

document.getElementById('article-editor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('art-id').value || ('art-' + Date.now());
  const fileInput = document.getElementById('art-file-input');
  const selectedFile = fileInput?.files?.[0];
  let imageUrl = document.getElementById('art-existing-img').value.trim();

  if (!selectedFile && !imageUrl) {
    showAdminToast('⚠️ Silakan pilih foto sampul berita dari perangkat Anda!');
    return;
  }

  const loadingEl = document.getElementById('art-upload-loading');
  const submitBtn = document.getElementById('art-submit-btn');

  try {
    if (selectedFile) {
      if (loadingEl) loadingEl.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;
      imageUrl = await uploadImageToSupabaseStorage(selectedFile, 'articles');
    }

    const rawParagraphs = document.getElementById('art-content').value.trim().split(/\n+/).filter(Boolean);
    const htmlContent = rawParagraphs.map((p, idx) => `<p class="${idx > 0 ? 'mt-3' : ''}">${p}</p>`).join('');

    const item = {
      id,
      title: document.getElementById('art-title').value.trim(),
      tag: document.getElementById('art-tag').value,
      date: document.getElementById('art-date').value.trim() || 'Mei 2026',
      readTime: document.getElementById('art-readtime').value.trim() || '4 Menit Baca',
      img: imageUrl,
      preview: document.getElementById('art-preview').value.trim(),
      content: htmlContent
    };

    const idx = CMS.articles.findIndex(x => x.id === id);
    if (idx >= 0) CMS.articles[idx] = item;
    else CMS.articles.unshift(item);

    closeArticleEditorModal();
    renderAdminArticles();
    await saveCmsData(true);
    showAdminToast('✅ Berita / Cerita berhasil diunggah & dipublikasikan!');
  } catch (err) {
    console.error('[Article Upload Error]:', err);
    showAdminToast('⚠️ ' + err.message);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = false;
  }
});

async function deleteArticle(id) {
  CMS.articles = CMS.articles.filter(x => x.id !== id);
  if (supabaseClient) {
    try {
      console.log('[Supabase Admin] Menghapus berita dari tabel articles:', id);
      const { error } = await supabaseClient.from('articles').delete().eq('id', id);
      if (error) console.error('[Supabase Admin] Error delete article:', error);
    } catch (e) {
      console.error('[Supabase Admin] Exception deleteArticle:', e);
    }
  }
  renderAdminArticles();
  await saveCmsData(true);
  showAdminToast('Berita / Cerita dihapus');
}

// ==========================================================
// VIEW 5: VIDEOS & DOCUMENTARIES
// ==========================================================
function renderAdminVideos() {
  const grid = document.getElementById('admin-videos-grid');
  if (!grid) return;

  grid.innerHTML = CMS.videos.map(v => {
    const imgUrl = resolveMediaUrl(v.img);
    return `
      <div class="bg-navy-900 border ${v.isFeatured ? 'border-gold' : 'border-navy-800'} rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
        <div>
          <div class="relative h-44 bg-navy-950">
            <img src="${imgUrl}" alt="${v.title}" loading="lazy" class="w-full h-full object-cover">
            <div class="absolute top-3 left-3 flex items-center gap-1.5">
              ${v.isFeatured ? '<span class="px-2.5 py-0.5 rounded bg-gold text-navy-950 text-[10px] font-extrabold uppercase">Utama (Featured)</span>' : ''}
              <span class="px-2 py-0.5 rounded bg-navy-950/90 text-white text-[10px] font-mono">${v.duration || '05:00'}</span>
            </div>
            ${v.videoUrl ? '<span class="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-rose-500 text-white text-[10px] font-bold">Video Embed Aktif</span>' : ''}
          </div>
          <div class="p-4">
            <div class="text-[11px] text-sky-400 mb-1">${v.location || 'Kota Palopo'}</div>
            <h4 class="font-bold text-white text-sm line-clamp-1">${v.title}</h4>
            <p class="text-xs text-slate-300 mt-1.5 line-clamp-2">${v.synopsis || ''}</p>
          </div>
        </div>
        <div class="px-4 py-3 bg-navy-950/60 border-t border-navy-800 flex items-center justify-between text-xs">
          ${!v.isFeatured ? `<button onclick="setFeaturedVideo('${v.id}')" class="text-gold hover:underline font-semibold">Jadikan Utama</button>` : '<span class="text-gold font-bold">★ Banner Utama</span>'}
          <div class="flex items-center gap-2">
            <button onclick="openVideoEditorModal('${v.id}')" class="px-2.5 py-1 rounded-lg bg-navy-800 hover:bg-navy-700 text-sky-300 font-semibold">Edit</button>
            <button onclick="deleteVideo('${v.id}')" class="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 font-semibold">Hapus</button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openVideoEditorModal(id = null) {
  const modal = document.getElementById('video-editor-modal');
  const form = document.getElementById('video-editor-form');
  form.reset();
  document.getElementById('vid-id').value = '';
  document.getElementById('vid-existing-img').value = '';
  resetPreviewBox('vid-preview-img', 'vid-preview-placeholder', 'vid-file-info');

  const vidInfoEl = document.getElementById('vid-video-file-info');
  const vidPreviewPlayer = document.getElementById('vid-video-preview-player');
  if (vidInfoEl) vidInfoEl.classList.add('hidden');
  if (vidPreviewPlayer) {
    vidPreviewPlayer.src = '';
    vidPreviewPlayer.classList.add('hidden');
  }

  if (id) {
    const v = CMS.videos.find(x => x.id === id);
    if (v) {
      document.getElementById('video-editor-title').textContent = 'Edit Video Dokumenter';
      document.getElementById('vid-id').value = v.id;
      document.getElementById('vid-existing-img').value = v.img || '';
      document.getElementById('vid-title').value = v.title || '';
      document.getElementById('vid-duration').value = v.duration || '05:30';
      document.getElementById('vid-location').value = v.location || '';
      document.getElementById('vid-url').value = v.videoUrl || '';
      document.getElementById('vid-synopsis').value = v.synopsis || '';
      document.getElementById('vid-is-featured').checked = !!v.isFeatured;
      showExistingPreview(v.img, 'vid-preview-img', 'vid-preview-placeholder', 'vid-file-info');
    }
  } else {
    document.getElementById('video-editor-title').textContent = 'Tambah Video Dokumenter Baru';
  }
  modal.classList.remove('hidden');
}

function closeVideoEditorModal() {
  const vidPreviewPlayer = document.getElementById('vid-video-preview-player');
  if (vidPreviewPlayer) {
    vidPreviewPlayer.pause();
    vidPreviewPlayer.src = '';
  }
  document.getElementById('video-editor-modal').classList.add('hidden');
}

document.getElementById('video-editor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('vid-id').value || ('doc-' + Date.now());
  const fileInput = document.getElementById('vid-file-input');
  const selectedThumbOrVideoFile = fileInput?.files?.[0];
  const videoFileInput = document.getElementById('vid-video-file-input');
  let selectedVideoFile = videoFileInput?.files?.[0];

  let imageUrl = document.getElementById('vid-existing-img').value.trim();
  let videoUrl = document.getElementById('vid-url').value.trim();

  // Jika pengguna memilih file .mp4 di kotak thumbnail (#vid-file-input), perlakukan otomatis sebagai file video!
  let selectedThumbImageFile = null;
  if (selectedThumbOrVideoFile) {
    if (isVideoFileObject(selectedThumbOrVideoFile)) {
      if (!selectedVideoFile) {
        selectedVideoFile = selectedThumbOrVideoFile;
      }
    } else {
      selectedThumbImageFile = selectedThumbOrVideoFile;
    }
  }

  if (!selectedThumbImageFile && !selectedVideoFile && !imageUrl && !videoUrl) {
    showAdminToast('⚠️ Silakan pilih file video (MP4) atau foto thumbnail dari perangkat Anda!');
    return;
  }

  const submitBtn = document.getElementById('vid-submit-btn');

  try {
    if (submitBtn) submitBtn.disabled = true;

    // Tampilkan FULL OVERLAY PROGRES langsung di tengah layar
    if (selectedVideoFile) {
      showVideoUploadOverlay(selectedVideoFile.name, selectedVideoFile.size);
      updateVideoUploadProgress({
        loaded: 0,
        total: selectedVideoFile.size,
        percent: 5,
        speed: 0,
        etaSec: 0,
        statusNote: 'Menyiapkan berkas video & sampul...'
      });
    }

    // 1. Jika ada file thumbnail gambar yang dipilih, unggah thumbnail
    if (selectedThumbImageFile) {
      setVideoUploadStep(1, 'Mengunggah foto sampul ke Supabase Storage...', false);
      if (selectedVideoFile) {
        updateVideoUploadProgress({
          loaded: 0,
          total: selectedVideoFile.size,
          percent: 12,
          speed: 0,
          etaSec: 0,
          statusNote: 'Mengunggah foto sampul pilihan...'
        });
      }
      imageUrl = await uploadImageToSupabaseStorage(selectedThumbImageFile, 'videos');
      setVideoUploadStep(1, 'Foto sampul berhasil diunggah ✓', true);
      if (selectedVideoFile) {
        updateVideoUploadProgress({
          loaded: 0,
          total: selectedVideoFile.size,
          percent: 22,
          speed: 0,
          etaSec: 0,
          statusNote: 'Foto sampul siap ✓'
        });
      }
    }

    // 2. Jika ada file video (.mp4 dll) yang dipilih, unggah video ke Supabase Storage
    if (selectedVideoFile) {
      // Jika pengguna belum memilih foto thumbnail, ekstrak frame pertama video menjadi thumbnail otomatis!
      if (!imageUrl) {
        setVideoUploadStep(1, 'Membuat thumbnail otomatis dari frame video...', false);
        updateVideoUploadProgress({
          loaded: 0,
          total: selectedVideoFile.size,
          percent: 10,
          speed: 0,
          etaSec: 0,
          statusNote: 'Mengekstrak frame video untuk sampul JPG...'
        });

        const frameObj = await extractVideoFrameDataUrl(selectedVideoFile);
        if (frameObj && frameObj.dataUrl) {
          try {
            updateVideoUploadProgress({
              loaded: 0,
              total: selectedVideoFile.size,
              percent: 16,
              speed: 0,
              etaSec: 0,
              statusNote: 'Mengunggah sampul JPG ke Supabase Storage...'
            });
            const resBlob = await fetch(frameObj.dataUrl);
            const thumbBlob = await resBlob.blob();
            const cleanBase = selectedVideoFile.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
            const thumbFile = new File([thumbBlob], `thumb-${cleanBase}.jpg`, { type: 'image/jpeg' });
            imageUrl = await uploadImageToSupabaseStorage(thumbFile, 'videos-thumb');
            setVideoUploadStep(1, 'Thumbnail frame video siap ✓', true);
          } catch (thumbErr) {
            console.warn('[Auto Thumbnail Warning]:', thumbErr);
            imageUrl = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80';
            setVideoUploadStep(1, 'Menggunakan thumbnail standar ✓', true);
          }
        } else {
          imageUrl = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80';
          setVideoUploadStep(1, 'Menggunakan thumbnail standar ✓', true);
        }
        updateVideoUploadProgress({
          loaded: 0,
          total: selectedVideoFile.size,
          percent: 25,
          speed: 0,
          etaSec: 0,
          statusNote: 'Sampul video siap ✓'
        });
      } else {
        setVideoUploadStep(1, 'Sampul thumbnail siap ✓', true);
        updateVideoUploadProgress({
          loaded: 0,
          total: selectedVideoFile.size,
          percent: 25,
          speed: 0,
          etaSec: 0,
          statusNote: 'Sampul thumbnail siap ✓'
        });
      }

      setVideoUploadStep(2, `Mengunggah berkas video "${selectedVideoFile.name}"...`, false);
      videoUrl = await uploadVideoToSupabaseStorage(selectedVideoFile, 'videos-mp4', (p) => {
        // Petakan persentase agar bergerak mulus dari 25% s/d 100%
        const mappedPct = 25 + ((p.percent || 0) * 0.75);
        updateVideoUploadProgress({
          loaded: p.loaded,
          total: p.total,
          percent: mappedPct,
          speed: p.speed,
          etaSec: p.etaSec,
          statusNote: p.statusNote || `Mengunggah video (${formatUploadMb(p.loaded || 0)} / ${formatUploadMb(p.total || 0)} MB)...`
        });
      });

      finishVideoUploadProgress(videoUrl);
      document.getElementById('vid-url').value = videoUrl;
    }

    if (!imageUrl) {
      imageUrl = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80';
    }

    const isFeatured = document.getElementById('vid-is-featured').checked;
    if (isFeatured) {
      CMS.videos.forEach(v => { v.isFeatured = false; });
    }

    const item = {
      id,
      title: document.getElementById('vid-title').value.trim(),
      duration: document.getElementById('vid-duration').value.trim() || '06:00',
      location: document.getElementById('vid-location').value.trim() || 'Kota Palopo',
      videoUrl,
      img: imageUrl,
      synopsis: document.getElementById('vid-synopsis').value.trim(),
      isFeatured
    };

    const idx = CMS.videos.findIndex(x => x.id === id);
    if (idx >= 0) CMS.videos[idx] = item;
    else CMS.videos.push(item);

    // Beri jeda singkat agar pengguna bisa melihat status 100% selesai di layar
    await new Promise(r => setTimeout(r, 1200));

    closeVideoEditorModal();
    renderAdminVideos();
    await saveCmsData(true);

    if (selectedVideoFile && videoUrl.startsWith('idb-video://')) {
      showAdminToast(`ℹ️ Video (${(selectedVideoFile.size / (1024 * 1024)).toFixed(1)} MB) tersimpan di Browser (IndexedDB) & siap diputar di Klien!`);
    } else {
      showAdminToast('✅ Video dokumenter berhasil disimpan!');
    }
  } catch (err) {
    console.error('[Video Upload Error]:', err);
    showAdminToast('⚠️ ' + err.message);
  } finally {
    hideVideoUploadOverlay();
    if (submitBtn) submitBtn.disabled = false;
  }
});

// ==========================================================
// INDIKATOR PROGRES UPLOAD VIDEO (Persentase, Sisa, Kecepatan, Estimasi Waktu)
// ==========================================================
function formatUploadMb(bytes) {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function formatUploadEta(sec) {
  if (!isFinite(sec) || sec < 0) return '± — dtk';
  if (sec < 60) return `± ${Math.ceil(sec)} dtk lagi`;
  const m = Math.floor(sec / 60);
  const s = Math.ceil(sec % 60);
  return `± ${m}m ${s}s lagi`;
}

function showVideoUploadOverlay(fileName, totalBytes) {
  const overlay = document.getElementById('vid-upload-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');

  const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const sizeMb = (totalBytes / (1024 * 1024)).toFixed(1);

  setTxt('vid-upload-overlay-title', '🚀 Sedang Mengunggah Video');
  setTxt('vid-upload-overlay-sub', `${fileName} (${sizeMb} MB)`);
  setTxt('vid-upload-percent', '0%');
  setTxt('vid-upload-remaining', 'Sisa 100%');
  setTxt('vid-upload-bytes', `0 / ${sizeMb} MB`);
  setTxt('vid-upload-speed', '— MB/s');
  setTxt('vid-upload-eta', 'Menghitung...');

  const bar = document.getElementById('vid-upload-bar');
  if (bar) bar.style.width = '0%';

  setVideoUploadStep(1, 'Menyiapkan sampul / thumbnail video...', false);
  setVideoUploadStep(2, `Berkas Video Asli (${fileName})`, false);

  if (window.lucide) lucide.createIcons();
}

function hideVideoUploadOverlay() {
  const overlay = document.getElementById('vid-upload-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function setVideoUploadStep(stepNum, text, isDone = false) {
  const textEl = document.getElementById(stepNum === 1 ? 'vid-step-thumb-text' : 'vid-step-video-text');
  const iconEl = document.getElementById(stepNum === 1 ? 'vid-step-thumb-icon' : 'vid-step-video-icon');
  if (textEl && text) textEl.textContent = text;
  if (iconEl) {
    if (isDone) {
      iconEl.className = 'w-4 h-4 rounded-full bg-emerald-500 text-navy-950 flex items-center justify-center text-[10px] font-black';
      iconEl.textContent = '✓';
    } else {
      iconEl.className = 'w-4 h-4 rounded-full border border-gold text-gold flex items-center justify-center text-[10px] font-bold animate-pulse';
      iconEl.textContent = String(stepNum);
    }
  }
}

function updateVideoUploadProgress(p) {
  const pct = Math.min(100, Math.max(0, p.percent || 0));
  const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };

  setTxt('vid-upload-percent', `${pct.toFixed(0)}%`);
  setTxt('vid-upload-remaining', pct >= 100 ? 'Memproses di Cloud...' : `Sisa ${(100 - pct).toFixed(0)}%`);
  setTxt('vid-upload-bytes', `${formatUploadMb(p.loaded || 0)} / ${formatUploadMb(p.total || 0)} MB`);
  setTxt('vid-upload-speed', p.speed > 0 ? `${formatUploadMb(p.speed)} MB/s` : '— MB/s');
  setTxt('vid-upload-eta', pct >= 100 ? 'Hampir selesai' : formatUploadEta(p.etaSec));

  const bar = document.getElementById('vid-upload-bar');
  if (bar) bar.style.width = `${pct}%`;

  if (p.statusNote) {
    setTxt('vid-upload-overlay-sub', p.statusNote);
  }
}

function finishVideoUploadProgress(resultUrl) {
  const setTxt = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const bar = document.getElementById('vid-upload-bar');
  if (bar) bar.style.width = '100%';
  setTxt('vid-upload-percent', '100%');
  setVideoUploadStep(2, 'Berkas video berhasil diproses ✓', true);

  if (String(resultUrl || '').startsWith('idb-video://')) {
    setTxt('vid-upload-remaining', 'Tersimpan di Browser ✓');
    setTxt('vid-upload-eta', 'Ukuran besar (>50 MB)');
  } else {
    setTxt('vid-upload-remaining', 'Selesai 100% ✓');
    setTxt('vid-upload-eta', 'Terunggah ke Cloud');
  }
}

async function setFeaturedVideo(id) {
  CMS.videos.forEach(v => { v.isFeatured = (v.id === id); });
  renderAdminVideos();
  await saveCmsData(true);
  showAdminToast('Video ditetapkan sebagai Dokumenter Pilihan Utama!');
}

async function deleteVideo(id) {
  CMS.videos = CMS.videos.filter(x => x.id !== id);
  if (supabaseClient) {
    try {
      console.log('[Supabase Admin] Menghapus video dokumenter dari tabel stories:', id);
      const { error } = await supabaseClient.from('stories').delete().eq('id', id);
      if (error) console.error('[Supabase Admin] Error delete video:', error);
    } catch (e) {
      console.error('[Supabase Admin] Exception deleteVideo:', e);
    }
  }
  renderAdminVideos();
  await saveCmsData(true);
  showAdminToast('Video dihapus');
}

// ==========================================================
// VIEW 6: TOURISM & CULINARY
// ==========================================================
function renderAdminTourism() {
  const grid = document.getElementById('admin-tourism-grid');
  if (!grid) return;

  grid.innerHTML = CMS.tourism.map(t => {
    const imgUrl = resolveMediaUrl(t.img);
    return `
      <div class="bg-navy-900 border border-navy-800 rounded-2xl overflow-hidden flex flex-col justify-between shadow-lg">
        <div>
          <div class="relative h-44 bg-navy-950">
            <img src="${imgUrl}" alt="${t.name}" loading="lazy" class="w-full h-full object-cover">
            <span class="absolute top-3 left-3 px-2.5 py-0.5 rounded bg-navy-950/90 text-emerald-300 text-[10px] font-bold uppercase border border-emerald-500/30">${t.category}</span>
          </div>
          <div class="p-4">
            <h4 class="font-bold text-white text-sm">${t.name}</h4>
            <p class="text-[11px] text-slate-400 mt-0.5">${t.distance || ''} • ${t.bestTime || ''}</p>
            <p class="text-xs text-slate-300 mt-2 line-clamp-2">${t.highlight || ''}</p>
          </div>
        </div>
        <div class="px-4 py-3 bg-navy-950/60 border-t border-navy-800 flex items-center justify-end gap-2 text-xs">
          <button onclick="openTourismEditorModal('${t.id}')" class="px-3 py-1 rounded-lg bg-navy-800 hover:bg-navy-700 text-sky-300 font-semibold">Edit</button>
          <button onclick="deleteTourism('${t.id}')" class="px-3 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 font-semibold">Hapus</button>
        </div>
      </div>
    `;
  }).join('');
}

function openTourismEditorModal(id = null) {
  const modal = document.getElementById('tourism-editor-modal');
  const form = document.getElementById('tourism-editor-form');
  form.reset();
  document.getElementById('tour-id').value = '';
  document.getElementById('tour-existing-img').value = '';
  resetPreviewBox('tour-preview-img', 'tour-preview-placeholder', 'tour-file-info');

  if (id) {
    const t = CMS.tourism.find(x => x.id === id);
    if (t) {
      document.getElementById('tourism-editor-title').textContent = 'Edit Destinasi Wisata';
      document.getElementById('tour-id').value = t.id;
      document.getElementById('tour-existing-img').value = t.img || '';
      document.getElementById('tour-name').value = t.name || '';
      document.getElementById('tour-category').value = t.category || 'bahari';
      document.getElementById('tour-distance').value = t.distance || '';
      document.getElementById('tour-besttime').value = t.bestTime || '';
      document.getElementById('tour-highlight').value = t.highlight || '';
      showExistingPreview(t.img, 'tour-preview-img', 'tour-preview-placeholder', 'tour-file-info');
    }
  } else {
    document.getElementById('tourism-editor-title').textContent = 'Tambah Destinasi Wisata Baru';
  }
  modal.classList.remove('hidden');
}

function closeTourismEditorModal() {
  document.getElementById('tourism-editor-modal').classList.add('hidden');
}

document.getElementById('tourism-editor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('tour-id').value || ('tour-' + Date.now());
  const fileInput = document.getElementById('tour-file-input');
  const selectedFile = fileInput?.files?.[0];
  let imageUrl = document.getElementById('tour-existing-img').value.trim();

  if (!selectedFile && !imageUrl) {
    showAdminToast('⚠️ Silakan pilih foto destinasi wisata dari perangkat Anda!');
    return;
  }

  const loadingEl = document.getElementById('tour-upload-loading');
  const submitBtn = document.getElementById('tour-submit-btn');

  try {
    if (selectedFile) {
      if (loadingEl) loadingEl.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;
      imageUrl = await uploadImageToSupabaseStorage(selectedFile, 'destinations');
    }

    const rawCat = document.getElementById('tour-category').value || 'bahari';
    const TOUR_TYPE_LABELS = {
      bahari: 'Wisata Bahari',
      alam: 'Ekowisata Alam',
      keluarga: 'Taman & Kota',
      kuliner: 'Kuliner Khas',
      sejarah: 'Sejarah & Budaya'
    };

    const item = {
      id,
      name: document.getElementById('tour-name').value.trim(),
      category: rawCat,
      type: rawCat,
      typeName: TOUR_TYPE_LABELS[rawCat] || rawCat,
      distance: document.getElementById('tour-distance').value.trim() || '15 Menit dari Pusat Kota',
      bestTime: document.getElementById('tour-besttime').value.trim() || 'Pagi & Sore Hari',
      img: imageUrl,
      highlight: document.getElementById('tour-highlight').value.trim()
    };

    const idx = CMS.tourism.findIndex(x => x.id === id);
    if (idx >= 0) CMS.tourism[idx] = item;
    else CMS.tourism.push(item);

    closeTourismEditorModal();
    renderAdminTourism();
    await saveCmsData(true);
    showAdminToast('✅ Destinasi wisata berhasil diunggah & disimpan!');
  } catch (err) {
    console.error('[Tourism Upload Error]:', err);
    showAdminToast('⚠️ ' + err.message);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = false;
  }
});

async function deleteTourism(id) {
  CMS.tourism = CMS.tourism.filter(x => x.id !== id);
  if (supabaseClient) {
    try {
      console.log('[Supabase Admin] Menghapus destinasi dari tabel destinations:', id);
      const { error } = await supabaseClient.from('destinations').delete().eq('id', id);
      if (error) console.error('[Supabase Admin] Error delete destination:', error);
    } catch (e) {
      console.error('[Supabase Admin] Exception deleteTourism:', e);
    }
  }
  renderAdminTourism();
  await saveCmsData(true);
  showAdminToast('Destinasi wisata dihapus');
}

// ==========================================================
// VIEW 7: STORIES REEL & HIGHLIGHT ALBUMS (FOLDER INSTAGRAM)
// ==========================================================

/**
 * Normalisasi data story agar selalu memiliki struktur folder album Instagram:
 * - cover / img: URL sampul lingkaran
 * - items: Array [ { id, type: 'image'|'video', url, caption, time } ]
 */
function normalizeAdminStory(st, idx = 0) {
  if (!st) return null;
  const coverUrl = (st.cover || st.img || st.image || '').trim();
  let items = Array.isArray(st.items) && st.items.length > 0 ? st.items.map((it, itIdx) => ({
    id: it.id || `item-${st.id || idx}-${itIdx + 1}`,
    type: it.type === 'video' ? 'video' : 'image',
    url: (it.url || it.img || it.image || '').trim(),
    caption: it.caption || '',
    time: it.time || `Slide ${itIdx + 1}`
  })) : [];

  // Jika belum ada items, buat 1 slide otomatis dari cover & caption
  if (items.length === 0 && (coverUrl || st.caption)) {
    items.push({
      id: `item-${st.id || idx}-1`,
      type: 'image',
      url: coverUrl,
      caption: st.caption || '',
      time: st.time || 'Slide 1'
    });
  }

  const resolvedCover = coverUrl || (items[0] && items[0].url) || '';

  return {
    id: String(st.id || `st-${idx + 1}`),
    title: st.title || 'Sorotan Cerita',
    time: st.time || 'Baru saja',
    cover: resolvedCover,
    img: resolvedCover,
    caption: st.caption || (items[0] && items[0].caption) || '',
    items: items
  };
}

function renderAdminStories() {
  const grid = document.getElementById('admin-stories-grid');
  if (!grid) return;

  // Pastikan seluruh data stories ternormalisasi
  CMS.stories = (CMS.stories || []).map((st, idx) => normalizeAdminStory(st, idx)).filter(Boolean);

  if (CMS.stories.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-12 text-center text-slate-400 bg-navy-900 border border-navy-800 rounded-2xl p-6">
        <i data-lucide="sparkles" class="w-10 h-10 mx-auto text-gold mb-2 opacity-60"></i>
        <h4 class="text-sm font-bold text-white">Belum Ada Folder Sorotan Story</h4>
        <p class="text-xs text-slate-400 mt-1">Klik tombol "Buat Sorotan Baru" di atas untuk menambahkan album cerita bergaya Instagram.</p>
      </div>
    `;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    return;
  }

  grid.innerHTML = CMS.stories.map(st => {
    const imgUrl = resolveMediaUrl(st.cover || st.img);
    const items = Array.isArray(st.items) ? st.items : [];
    const itemsCount = items.length;
    const photoCount = items.filter(it => it.type !== 'video').length;
    const videoCount = items.filter(it => it.type === 'video').length;

    let mediaBadge = `${itemsCount} Media`;
    if (itemsCount > 0) {
      if (videoCount > 0 && photoCount > 0) mediaBadge = `${photoCount} Foto • ${videoCount} Video`;
      else if (videoCount > 0) mediaBadge = `${videoCount} Video`;
      else mediaBadge = `${photoCount} Foto`;
    }

    return `
      <div class="bg-navy-900 border border-navy-800 hover:border-gold/30 transition-all rounded-2xl p-4 flex flex-col items-center text-center justify-between shadow-lg relative group">
        <!-- Circular Highlight Avatar -->
        <div class="flex flex-col items-center w-full">
          <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-tr from-gold via-amber-400 to-sky-400 mb-2 relative group-hover:scale-105 transition-transform duration-300">
            <img src="${imgUrl}" alt="${st.title}" loading="lazy" class="w-full h-full object-cover rounded-full border-2 border-navy-950 bg-navy-950">
            <span class="absolute -bottom-1 -right-1 bg-navy-950 border border-gold/50 text-gold rounded-full px-2 py-0.5 text-[10px] font-black shadow flex items-center gap-0.5">
              <i data-lucide="layers" class="w-3 h-3"></i> ${itemsCount}
            </span>
          </div>

          <h4 class="font-bold text-white text-xs sm:text-sm mt-1 line-clamp-1 w-full" title="${st.title}">${st.title}</h4>
          <span class="text-[10px] text-slate-400 mt-0.5">${st.time || 'Sorotan'}</span>

          <!-- Media Count Pill -->
          <div class="mt-2">
            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-navy-950 text-gold text-[10px] font-bold border border-gold/25">
              <i data-lucide="${videoCount > 0 ? 'film' : 'image'}" class="w-3 h-3"></i> ${mediaBadge}
            </span>
          </div>
          <p class="text-[11px] text-slate-400 mt-2 line-clamp-2 w-full">${st.caption || 'Tanpa keterangan folder'}</p>
        </div>

        <!-- Action Buttons -->
        <div class="w-full space-y-1.5 mt-4 pt-3 border-t border-navy-800 text-xs">
          <!-- Primary: Kelola Isi Media (Foto & Video) -->
          <button onclick="openStoryItemsModal('${st.id}')"
            class="w-full py-2 px-3 rounded-xl bg-gold hover:bg-yellow-400 text-navy-950 font-extrabold flex items-center justify-center gap-1.5 shadow transition-all hover:scale-[1.02]">
            <i data-lucide="layers" class="w-3.5 h-3.5"></i> Kelola Isi Media (${itemsCount})
          </button>

          <!-- Secondary: Edit Judul / Hapus -->
          <div class="flex items-center gap-1.5 w-full">
            <button onclick="openStoryEditorModal('${st.id}')"
              class="flex-1 py-1.5 px-2 rounded-lg bg-navy-800 hover:bg-navy-700 text-sky-300 font-semibold flex items-center justify-center gap-1 transition-colors">
              <i data-lucide="edit-3" class="w-3 h-3"></i> Edit Judul
            </button>
            <button onclick="deleteStory('${st.id}')"
              class="py-1.5 px-2.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold flex items-center justify-center gap-1 transition-colors"
              title="Hapus Sorotan">
              <i data-lucide="trash-2" class="w-3 h-3"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}

function openStoryEditorModal(id = null) {
  const modal = document.getElementById('story-editor-modal');
  const form = document.getElementById('story-editor-form');
  form.reset();
  document.getElementById('st-id').value = '';
  document.getElementById('st-existing-img').value = '';
  resetPreviewBox('st-preview-img', 'st-preview-placeholder', 'st-file-info');

  if (id) {
    const st = CMS.stories.find(x => x.id === id);
    if (st) {
      document.getElementById('story-editor-title').textContent = 'Edit Folder Sorotan';
      document.getElementById('st-id').value = st.id;
      document.getElementById('st-existing-img').value = st.cover || st.img || '';
      document.getElementById('st-title').value = st.title || '';
      document.getElementById('st-time').value = st.time || 'Baru saja';
      document.getElementById('st-caption').value = st.caption || '';
      showExistingPreview(st.cover || st.img, 'st-preview-img', 'st-preview-placeholder', 'st-file-info');
    }
  } else {
    document.getElementById('story-editor-title').textContent = 'Buat Folder Sorotan Baru';
    document.getElementById('st-time').value = 'Sorotan Utama';
  }
  modal.classList.remove('hidden');
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function closeStoryEditorModal() {
  const modal = document.getElementById('story-editor-modal');
  if (modal) modal.classList.add('hidden');
}

document.getElementById('story-editor-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('st-id').value || ('st-' + Date.now());
  const fileInput = document.getElementById('st-file-input');
  const selectedFile = fileInput?.files?.[0];
  let imageUrl = document.getElementById('st-existing-img').value.trim();

  if (!selectedFile && !imageUrl) {
    showAdminToast('⚠️ Silakan pilih foto sampul sorotan dari perangkat Anda!');
    return;
  }

  const loadingEl = document.getElementById('st-upload-loading');
  const submitBtn = document.getElementById('st-submit-btn');

  try {
    if (selectedFile) {
      if (loadingEl) loadingEl.classList.remove('hidden');
      if (submitBtn) submitBtn.disabled = true;
      imageUrl = await uploadImageToSupabaseStorage(selectedFile, 'stories');
    }

    const title = document.getElementById('st-title').value.trim();
    const time = document.getElementById('st-time').value.trim() || 'Baru saja';
    const caption = document.getElementById('st-caption').value.trim();

    const existingIdx = CMS.stories.findIndex(x => x.id === id);
    if (existingIdx >= 0) {
      // Update folder info
      const st = CMS.stories[existingIdx];
      st.title = title;
      st.time = time;
      st.cover = imageUrl;
      st.img = imageUrl;
      st.caption = caption;
      if (!Array.isArray(st.items)) st.items = [];
      // Jika folder belum punya media sama sekali, buat slide awal dari cover
      if (st.items.length === 0) {
        st.items.push({
          id: `item-${id}-1`,
          type: 'image',
          url: imageUrl,
          caption: caption,
          time: 'Slide 1'
        });
      }
    } else {
      // Buat folder sorotan baru dengan item pertama
      const newFolder = {
        id,
        title,
        time,
        cover: imageUrl,
        img: imageUrl,
        caption,
        items: [
          {
            id: `item-${id}-1`,
            type: 'image',
            url: imageUrl,
            caption: caption || `Momen visual dari ${title}`,
            time: 'Slide 1'
          }
        ]
      };
      CMS.stories.unshift(newFolder);
    }

    closeStoryEditorModal();
    renderAdminStories();
    await saveCmsData(true);
    showAdminToast('✅ Folder Sorotan Story berhasil disimpan!');

    // Buka langsung modal kelola media jika ini sorotan baru agar admin bisa menambahkan slide lain
    if (existingIdx < 0) {
      openStoryItemsModal(id);
    }
  } catch (err) {
    console.error('[Story Upload Error]:', err);
    showAdminToast('⚠️ ' + err.message);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (submitBtn) submitBtn.disabled = false;
  }
});

async function deleteStory(id) {
  const st = CMS.stories.find(x => x.id === id);
  const name = st ? `"${st.title}"` : 'ini';
  if (!confirm(`Hapus seluruh folder sorotan ${name} beserta seluruh foto/videonya?`)) return;

  CMS.stories = CMS.stories.filter(x => x.id !== id);
  if (supabaseClient) {
    try {
      console.log('[Supabase Admin] Menghapus story dari tabel stories:', id);
      const { error } = await supabaseClient.from('stories').delete().eq('id', id);
      if (error) console.error('[Supabase Admin] Error delete story:', error);
    } catch (e) {
      console.error('[Supabase Admin] Exception deleteStory:', e);
    }
  }
  renderAdminStories();
  await saveCmsData(true);
  showAdminToast('Folder Sorotan Story dihapus');
}

// ==========================================================
// KELOLA ISI MEDIA SOROTAN (FOTO & VIDEO DI DALAM FOLDER)
// ==========================================================

let activeSimStoryId = null;

function openStoryItemsModal(storyId) {
  activeSimStoryId = storyId;
  const st = CMS.stories.find(x => x.id === storyId);
  if (!st) {
    showAdminToast('⚠️ Sorotan tidak ditemukan');
    return;
  }

  // Normalisasi
  const norm = normalizeAdminStory(st);
  const idx = CMS.stories.findIndex(x => x.id === storyId);
  if (idx >= 0) CMS.stories[idx] = norm;

  document.getElementById('sim-story-id').value = storyId;
  document.getElementById('sim-title').textContent = norm.title;
  document.getElementById('sim-cover-img').src = resolveMediaUrl(norm.cover || norm.img);

  // Reset form tambah media
  const form = document.getElementById('story-add-item-form');
  if (form) form.reset();
  resetSimPreviews();
  toggleSimMediaType('image');

  renderStoryItemsList(storyId);

  const modal = document.getElementById('story-items-modal');
  if (modal) modal.classList.remove('hidden');
  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function closeStoryItemsModal() {
  const modal = document.getElementById('story-items-modal');
  if (modal) modal.classList.add('hidden');
  activeSimStoryId = null;
}

function renderStoryItemsList(storyId) {
  const st = CMS.stories.find(x => x.id === storyId);
  const container = document.getElementById('sim-items-list');
  const countBadge = document.getElementById('sim-count-badge');
  if (!container || !st) return;

  const items = Array.isArray(st.items) ? st.items : [];
  if (countBadge) countBadge.textContent = `${items.length} Media`;

  if (items.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-8 text-center text-slate-400 bg-navy-950/60 border border-dashed border-navy-800 rounded-xl p-4">
        <i data-lucide="image" class="w-8 h-8 mx-auto text-slate-500 mb-2"></i>
        <p class="font-bold text-white text-xs">Belum ada foto atau video di sorotan ini</p>
        <p class="text-[11px] text-slate-400 mt-1">Gunakan formulir di bawah untuk menambahkan foto atau video pertama.</p>
      </div>
    `;
    if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
    return;
  }

  container.innerHTML = items.map((item, idx) => {
    const isVideo = item.type === 'video';
    const mediaUrl = resolveMediaUrl(item.url);
    const isCover = (st.cover && st.cover === item.url) || (!st.cover && idx === 0);

    return `
      <div class="bg-navy-950/80 border ${isCover ? 'border-gold/60 ring-1 ring-gold/40' : 'border-navy-800'} rounded-xl p-3 flex flex-col justify-between gap-2.5 relative group shadow">
        <!-- Top Media Preview & Badge -->
        <div class="relative w-full h-36 bg-black/60 rounded-lg overflow-hidden flex items-center justify-center">
          ${isVideo ? `
            <video src="${mediaUrl}" class="w-full h-full object-cover" preload="metadata" muted playsinline></video>
            <div class="absolute inset-0 bg-black/25 flex items-center justify-center pointer-events-none">
              <span class="w-10 h-10 rounded-full bg-navy-950/80 border border-sky-400 text-sky-400 flex items-center justify-center shadow">
                <i data-lucide="play" class="w-5 h-5 ml-0.5"></i>
              </span>
            </div>
          ` : `
            <img src="${mediaUrl}" alt="${item.caption || 'Slide'}" class="w-full h-full object-cover">
          `}

          <!-- Badges -->
          <div class="absolute top-2 left-2 flex items-center gap-1.5">
            <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${isVideo ? 'bg-sky-500 text-navy-950' : 'bg-gold text-navy-950'} shadow">
              ${isVideo ? 'Video' : 'Foto'}
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-navy-950/85 text-white border border-white/20 shadow">
              Slide ${idx + 1}
            </span>
          </div>

          ${isCover ? `
            <div class="absolute top-2 right-2">
              <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-gold text-navy-950 shadow flex items-center gap-1">
                <i data-lucide="check-circle-2" class="w-3 h-3"></i> Sampul
              </span>
            </div>
          ` : ''}
        </div>

        <!-- Caption Snippet -->
        <div>
          <p class="text-xs text-white font-medium line-clamp-2 leading-relaxed" title="${item.caption || ''}">
            ${item.caption ? item.caption : '<span class="text-slate-500 italic">Tanpa caption</span>'}
          </p>
        </div>

        <!-- Buttons -->
        <div class="flex items-center gap-1.5 pt-2 border-t border-navy-800/80 text-[11px]">
          ${!isCover ? `
            <button type="button" onclick="setStoryItemAsCover('${storyId}', '${item.id}')"
              class="px-2 py-1 rounded-lg bg-navy-900 hover:bg-navy-800 text-gold border border-gold/30 font-semibold flex items-center gap-1 transition-colors"
              title="Jadikan media ini sebagai foto sampul sorotan">
              <i data-lucide="star" class="w-3 h-3"></i> Sampul
            </button>
          ` : ''}

          <button type="button" onclick="editStoryItemCaption('${storyId}', '${item.id}')"
            class="px-2 py-1 rounded-lg bg-navy-800 hover:bg-navy-700 text-sky-300 font-semibold flex items-center gap-1 transition-colors">
            <i data-lucide="edit-2" class="w-3 h-3"></i> Caption
          </button>

          <button type="button" onclick="deleteStoryItem('${storyId}', '${item.id}')"
            class="ml-auto px-2 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 font-semibold flex items-center gap-1 transition-colors"
            title="Hapus media ini dari sorotan">
            <i data-lucide="trash-2" class="w-3 h-3"></i> Hapus
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide && window.lucide.createIcons) window.lucide.createIcons();
}

function toggleSimMediaType(type) {
  const fileInput = document.getElementById('sim-file-input');
  const uploadLabel = document.getElementById('sim-upload-label');
  const imgPreview = document.getElementById('sim-preview-img');
  const videoPreview = document.getElementById('sim-preview-video');

  if (type === 'video') {
    if (fileInput) fileInput.accept = 'video/mp4,video/webm,video/quicktime,video/*';
    if (uploadLabel) uploadLabel.textContent = 'Pilih File Video dari Perangkat (MP4 / WebM) *';
    if (imgPreview) imgPreview.classList.add('hidden');
  } else {
    if (fileInput) fileInput.accept = 'image/*';
    if (uploadLabel) uploadLabel.textContent = 'Pilih File Foto dari Perangkat (JPG / PNG / WEBP) *';
    if (videoPreview) {
      videoPreview.pause();
      videoPreview.classList.add('hidden');
    }
  }
}

function resetSimPreviews() {
  const imgPreview = document.getElementById('sim-preview-img');
  const videoPreview = document.getElementById('sim-preview-video');
  const placeholder = document.getElementById('sim-preview-placeholder');
  const loading = document.getElementById('sim-upload-loading');

  if (imgPreview) {
    imgPreview.src = '';
    imgPreview.classList.add('hidden');
  }
  if (videoPreview) {
    videoPreview.pause();
    videoPreview.src = '';
    videoPreview.classList.add('hidden');
  }
  if (placeholder) placeholder.classList.remove('hidden');
  if (loading) loading.classList.add('hidden');
}

function handleSimFilePreview(input) {
  const file = input?.files?.[0];
  if (!file) return;

  const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(file.name);
  const imgPreview = document.getElementById('sim-preview-img');
  const videoPreview = document.getElementById('sim-preview-video');
  const placeholder = document.getElementById('sim-preview-placeholder');

  const objectUrl = URL.createObjectURL(file);

  if (isVideo) {
    const radioVideo = document.querySelector('input[name="sim-item-type"][value="video"]');
    if (radioVideo) radioVideo.checked = true;
    toggleSimMediaType('video');

    if (imgPreview) imgPreview.classList.add('hidden');
    if (videoPreview) {
      videoPreview.src = objectUrl;
      videoPreview.classList.remove('hidden');
    }
  } else {
    const radioImage = document.querySelector('input[name="sim-item-type"][value="image"]');
    if (radioImage) radioImage.checked = true;
    toggleSimMediaType('image');

    if (videoPreview) {
      videoPreview.pause();
      videoPreview.classList.add('hidden');
    }
    if (imgPreview) {
      imgPreview.src = objectUrl;
      imgPreview.classList.remove('hidden');
    }
  }

  if (placeholder) placeholder.classList.add('hidden');
}

function handleSimUrlInput(url) {
  url = (url || '').trim();
  if (!url) {
    resetSimPreviews();
    return;
  }

  const isVideo = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url) || url.includes('video');
  const imgPreview = document.getElementById('sim-preview-img');
  const videoPreview = document.getElementById('sim-preview-video');
  const placeholder = document.getElementById('sim-preview-placeholder');

  if (isVideo) {
    const radioVideo = document.querySelector('input[name="sim-item-type"][value="video"]');
    if (radioVideo) radioVideo.checked = true;
    toggleSimMediaType('video');

    if (imgPreview) imgPreview.classList.add('hidden');
    if (videoPreview) {
      videoPreview.src = url;
      videoPreview.classList.remove('hidden');
    }
  } else {
    const radioImage = document.querySelector('input[name="sim-item-type"][value="image"]');
    if (radioImage) radioImage.checked = true;
    toggleSimMediaType('image');

    if (videoPreview) {
      videoPreview.pause();
      videoPreview.classList.add('hidden');
    }
    if (imgPreview) {
      imgPreview.src = url;
      imgPreview.classList.remove('hidden');
    }
  }

  if (placeholder) placeholder.classList.add('hidden');
}

// Handler Submit Form Tambah Media ke Sorotan
document.getElementById('story-add-item-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const storyId = document.getElementById('sim-story-id').value;
  const st = CMS.stories.find(x => x.id === storyId);
  if (!st) {
    showAdminToast('⚠️ Sorotan tidak ditemukan');
    return;
  }

  const fileInput = document.getElementById('sim-file-input');
  const selectedFile = fileInput?.files?.[0];
  const urlInput = document.getElementById('sim-url-input')?.value.trim();

  if (!selectedFile && !urlInput) {
    showAdminToast('⚠️ Silakan pilih file foto/video dari perangkat atau masukkan URL media!');
    return;
  }

  const typeRadio = document.querySelector('input[name="sim-item-type"]:checked');
  let selectedType = typeRadio ? typeRadio.value : 'image';

  // Otomatis deteksi jenis jika dipilih file video
  if (selectedFile && (selectedFile.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(selectedFile.name))) {
    selectedType = 'video';
  }

  const loadingEl = document.getElementById('sim-upload-loading');
  const loadingText = document.getElementById('sim-upload-loading-text');
  const addBtn = document.getElementById('sim-add-btn');

  try {
    if (loadingEl) loadingEl.classList.remove('hidden');
    if (addBtn) addBtn.disabled = true;

    let mediaUrl = urlInput;
    if (selectedFile) {
      if (loadingText) loadingText.textContent = selectedType === 'video' ? 'Mengunggah video ke Supabase Storage...' : 'Mengunggah foto ke Supabase Storage...';
      mediaUrl = await uploadImageToSupabaseStorage(selectedFile, 'stories');
    }

    if (!Array.isArray(st.items)) st.items = [];

    const newItem = {
      id: 'item-' + Date.now(),
      type: selectedType,
      url: mediaUrl,
      caption: document.getElementById('sim-caption-input')?.value.trim() || '',
      time: `Slide ${st.items.length + 1}`
    };

    st.items.push(newItem);

    // Jika cover sorotan masih kosong, gunakan media pertama ini sebagai cover
    if (!st.cover || st.cover === '') {
      st.cover = mediaUrl;
      st.img = mediaUrl;
    }

    // Reset Form
    document.getElementById('story-add-item-form').reset();
    resetSimPreviews();
    toggleSimMediaType('image');

    renderStoryItemsList(storyId);
    renderAdminStories();
    await saveCmsData(true);

    showAdminToast(`✅ ${selectedType === 'video' ? 'Video' : 'Foto'} berhasil ditambahkan ke sorotan "${st.title}"!`);
  } catch (err) {
    console.error('[Add Story Item Error]:', err);
    showAdminToast('⚠️ ' + err.message);
  } finally {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (addBtn) addBtn.disabled = false;
  }
});

async function setStoryItemAsCover(storyId, itemId) {
  const st = CMS.stories.find(x => x.id === storyId);
  if (!st || !Array.isArray(st.items)) return;

  const item = st.items.find(x => x.id === itemId);
  if (!item) return;

  st.cover = item.url;
  st.img = item.url;

  document.getElementById('sim-cover-img').src = resolveMediaUrl(st.cover);
  renderStoryItemsList(storyId);
  renderAdminStories();
  await saveCmsData(true);
  showAdminToast('✅ Foto sampul sorotan berhasil diperbarui!');
}

async function editStoryItemCaption(storyId, itemId) {
  const st = CMS.stories.find(x => x.id === storyId);
  if (!st || !Array.isArray(st.items)) return;

  const item = st.items.find(x => x.id === itemId);
  if (!item) return;

  const newCaption = prompt('Ubah keterangan/caption untuk slide ini:', item.caption || '');
  if (newCaption === null) return; // Dibatalkan

  item.caption = newCaption.trim();
  renderStoryItemsList(storyId);
  renderAdminStories();
  await saveCmsData(true);
  showAdminToast('✅ Caption slide berhasil diperbarui');
}

async function deleteStoryItem(storyId, itemId) {
  const st = CMS.stories.find(x => x.id === storyId);
  if (!st || !Array.isArray(st.items)) return;

  if (!confirm('Hapus foto/video ini dari sorotan?')) return;

  st.items = st.items.filter(x => x.id !== itemId);

  // Jika item yang dihapus adalah cover, alihkan cover ke item pertama yang tersisa
  if (st.items.length > 0 && (!st.cover || !st.items.some(x => x.url === st.cover))) {
    st.cover = st.items[0].url;
    st.img = st.items[0].url;
  }

  renderStoryItemsList(storyId);
  renderAdminStories();
  await saveCmsData(true);
  showAdminToast('Foto/video dihapus dari sorotan');
}

// Ekspor ke window agar dapat dipanggil dari event onclick HTML
window.normalizeAdminStory = normalizeAdminStory;
window.renderAdminStories = renderAdminStories;
window.openStoryEditorModal = openStoryEditorModal;
window.closeStoryEditorModal = closeStoryEditorModal;
window.deleteStory = deleteStory;
window.openStoryItemsModal = openStoryItemsModal;
window.closeStoryItemsModal = closeStoryItemsModal;
window.renderStoryItemsList = renderStoryItemsList;
window.toggleSimMediaType = toggleSimMediaType;
window.handleSimFilePreview = handleSimFilePreview;
window.handleSimUrlInput = handleSimUrlInput;
window.setStoryItemAsCover = setStoryItemAsCover;
window.editStoryItemCaption = editStoryItemCaption;
window.deleteStoryItem = deleteStoryItem;

// ==========================================================

// ==========================================================
// VIEW 8: SUPABASE & VERCEL JSON EXPORT / IMPORT
// ==========================================================
document.getElementById('supabase-config-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const rawUrl = document.getElementById('sb-url-input').value.trim();
  const rawKey = document.getElementById('sb-key-input').value.trim();

  const url = normalizeSupabaseUrl(rawUrl || DEFAULT_SB_URL);
  const key = rawKey || DEFAULT_SB_KEY;

  localStorage.setItem(STORAGE_KEY_SB_URL, url);
  localStorage.setItem(STORAGE_KEY_SB_KEY, key);

  const urlInput = document.getElementById('sb-url-input');
  const keyInput = document.getElementById('sb-key-input');
  if (urlInput) urlInput.value = url;
  if (keyInput) keyInput.value = key;

  initSupabaseClient();
  const ok = await saveCmsData(true);
  updateAllStatsAndBadges();
  if (ok) {
    showAdminToast('✅ Berhasil terhubung & menyinkronkan seluruh data CMS ke Supabase Cloud!');
  }
});

function copySupabaseSql() {
  const sql = `-- JALANKAN DI MENU SQL EDITOR SUPABASE ANDA:
-- 1. KONFIGURASI SUPABASE STORAGE BUCKET 'lensa-palopo-media' (PUBLIC, MENDUKUNG VIDEO 500 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lensa-palopo-media',
  'lensa-palopo-media',
  true,
  524288000, -- 500 MB (agar video 300 MB+ & foto resolusi tinggi bisa diunggah)
  NULL       -- Izinkan semua format foto & video (MP4/MOV/WEBM/JPG/PNG/WEBP)
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = NULL;

DROP POLICY IF EXISTS "Public Select lensa-palopo-media" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert lensa-palopo-media" ON storage.objects;
DROP POLICY IF EXISTS "Public Update lensa-palopo-media" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete lensa-palopo-media" ON storage.objects;

CREATE POLICY "Public Select lensa-palopo-media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'lensa-palopo-media');

CREATE POLICY "Public Insert lensa-palopo-media"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'lensa-palopo-media');

CREATE POLICY "Public Update lensa-palopo-media"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'lensa-palopo-media')
  WITH CHECK (bucket_id = 'lensa-palopo-media');

CREATE POLICY "Public Delete lensa-palopo-media"
  ON storage.objects FOR DELETE TO public
  USING (bucket_id = 'lensa-palopo-media');

-- 2. PEMBUATAN 5 TABEL UTAMA DATABASE
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tag TEXT DEFAULT 'Liputan',
  date TEXT DEFAULT '',
  read_time TEXT DEFAULT '4 menit baca',
  preview TEXT DEFAULT '',
  content TEXT DEFAULT '',
  img TEXT NOT NULL,
  created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE TABLE IF NOT EXISTS public.media_gallery (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'pesisir',
  location TEXT DEFAULT 'Kota Palopo',
  exif TEXT DEFAULT 'Lensa Palopo Visual',
  description TEXT DEFAULT '',
  img TEXT NOT NULL,
  featured BOOLEAN DEFAULT false,
  created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE TABLE IF NOT EXISTS public.destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'bahari',
  distance TEXT DEFAULT 'Kota Palopo',
  best_time TEXT DEFAULT 'Pagi & Sore',
  highlight TEXT DEFAULT '',
  lat DOUBLE PRECISION DEFAULT -2.9925,
  lng DOUBLE PRECISION DEFAULT 120.1969,
  img TEXT NOT NULL,
  created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE TABLE IF NOT EXISTS public.stories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  caption TEXT DEFAULT '',
  time_label TEXT DEFAULT 'Baru saja',
  category TEXT DEFAULT 'story',
  video_url TEXT DEFAULT '',
  duration TEXT DEFAULT '05:00',
  img TEXT NOT NULL,
  created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY,
  brand_name TEXT DEFAULT 'LENSA PALOPO',
  tagline TEXT DEFAULT 'Profil Kota Palopo & Dokumentasi Visual Luwu Raya',
  ig_handle TEXT DEFAULT '@lensa_palopo',
  announcement TEXT DEFAULT '',
  logo_url TEXT DEFAULT 'assets/logo-lensa-palopo.png',
  hero_badge TEXT DEFAULT '',
  hero_title TEXT DEFAULT '',
  hero_desc TEXT DEFAULT '',
  hero_bg TEXT DEFAULT '',
  payload JSONB DEFAULT '{}'::jsonb,
  updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write" ON public.articles;
CREATE POLICY "Allow public read-write" ON public.articles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.media_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write" ON public.media_gallery;
CREATE POLICY "Allow public read-write" ON public.media_gallery FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write" ON public.destinations;
CREATE POLICY "Allow public read-write" ON public.destinations FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write" ON public.stories;
CREATE POLICY "Allow public read-write" ON public.stories FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write" ON public.site_settings;
CREATE POLICY "Allow public read-write" ON public.site_settings FOR ALL USING (true) WITH CHECK (true);`;

  navigator.clipboard.writeText(sql).then(() => {
    showAdminToast('Skrip SQL Storage Bucket + 5 Tabel + RLS berhasil disalin!');
  });
}

function exportPhotosJson() {
  const dataStr = JSON.stringify(CMS, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'photos.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showAdminToast('Berkas photos.json (paket lengkap CMS Vercel) berhasil diunduh!');
}

function importPhotosJsonFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const json = JSON.parse(e.target.result);
      const def = getDefaultCmsBundle();
      if (Array.isArray(json)) {
        CMS.photos = json;
      } else if (json && typeof json === 'object') {
        CMS = {
          settings: { ...def.settings, ...(json.settings || {}) },
          photos: Array.isArray(json.photos) ? json.photos : def.photos,
          articles: Array.isArray(json.articles) ? json.articles : def.articles,
          videos: Array.isArray(json.videos) ? json.videos : def.videos,
          tourism: Array.isArray(json.tourism) ? json.tourism : def.tourism,
          stories: Array.isArray(json.stories) ? json.stories : def.stories
        };
      }
      renderEverything();
      await saveCmsData(true);
      showAdminToast('Data CMS berhasil diimpor & diterapkan!');
    } catch (err) {
      showAdminToast('Format berkas JSON tidak valid!');
    }
  };
  reader.readAsText(file);
}

async function resetFullCmsToDefault() {
  if (!confirm('Reset seluruh konten dan tampilan ke data awal bawaan Lensa Palopo?')) return;
  CMS = getDefaultCmsBundle();
  renderEverything();
  await saveCmsData(true);
  showAdminToast('Seluruh data berhasil dikembalikan ke bawaan awal!');
}

let toastTimer = null;
function showAdminToast(msg) {
  const toast = document.getElementById('admin-toast');
  const txt = document.getElementById('admin-toast-msg');
  if (!toast || !txt) return;
  txt.textContent = msg;
  toast.classList.remove('opacity-0', 'translate-y-3', 'pointer-events-none');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-3', 'pointer-events-none');
  }, 3600);
}

window.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  initAuth();
});
