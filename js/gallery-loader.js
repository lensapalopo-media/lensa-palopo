/**
 * Lensa Palopo — Dynamic Full-Site CMS & Cloud Loader (`js/gallery-loader.js`)
 * ============================================================================
 * 1. Auto-Inisialisasi Supabase Client v2 menggunakan kredensial default proyek
 *    (tidak perlu koneksi manual, otomatis tersambung dari JS).
 * 2. Semua URL gambar diambil langsung dari Public URL Supabase Storage Bucket
 *    (`lensa-palopo-media`) tanpa konversi Google Drive.
 * 3. Sinkronisasi dua arah dengan 5 tabel utama Supabase:
 *    - `site_settings`
 *    - `media_gallery`
 *    - `articles`
 *    - `destinations`
 *    - `stories`
 * 4. Realtime Channel v2 (`schema-db-changes` via `postgres_changes`) sehingga
 *    setiap INSERT, UPDATE, atau DELETE di Supabase otomatis me-render ulang
 *    `index.html` secara langsung tanpa perlu refresh browser.
 * 5. Fallback berlapis (Graceful Degradation):
 *    Supabase Cloud -> LocalStorage (`lensa_palopo_cms_v1`) -> IndexedDB -> `data/photos.json` -> Default HTML
 */

(function () {
  'use strict';

  const CMS_STORAGE_KEY = 'lensa_palopo_cms_bundle_v2';
  const LEGACY_CMS_STORAGE_KEY = 'lensa_palopo_cms_v1';
  const LEGACY_STORAGE_KEY = 'lensa_palopo_custom_photos_v1';
  const SUPABASE_CONFIG_KEY = 'lensa_palopo_supabase_cfg';
  const STORAGE_KEY_SB_URL = 'lensa_palopo_sb_url_v1';
  const STORAGE_KEY_SB_KEY = 'lensa_palopo_sb_key_v1';

  // Kredensial Default Otomatis Proyek Lensa Palopo
  const DEFAULT_SB_URL = 'https://twmgcozbtptkesemxpth.supabase.co';
  const DEFAULT_SB_KEY = 'sb_publishable_rEfZsWCti_dUhSuuDGlZzA_xHY2ldy5';

  // IndexedDB Fallback Constants
  const IDB_NAME = 'LensaPalopoLocalDB';
  const IDB_VERSION = 1;
  const IDB_STORE = 'cms_store';
  const IDB_RECORD_KEY = 'cms_bundle_main';

  let activeSupabaseClient = null;
  let activeRealtimeChannel = null;
  let realtimeDebounceTimer = null;

  /**
   * Normalisasi URL Supabase:
   * Menghapus `/rest/v1/` atau trailing slash jika user memasukkan endpoint REST secara langsung
   * agar SDK `@supabase/supabase-js` v2 tidak mengalami error 404 `/rest/v1/rest/v1/...`.
   */
  function normalizeSupabaseUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    return rawUrl
      .trim()
      .replace(/\/rest\/v1\/?$/i, '')
      .replace(/\/+$/, '');
  }

  /**
   * Mengambil konfigurasi kredensial Supabase (otomatis fallback ke DEFAULT_SB_URL & DEFAULT_SB_KEY)
   */
  function getActiveSupabaseConfig() {
    let saved = {};
    try {
      const raw = localStorage.getItem(SUPABASE_CONFIG_KEY);
      if (raw) saved = JSON.parse(raw) || {};
    } catch (err) {
      console.warn('[LensaPalopo Loader] Gagal membaca localStorage config Supabase:', err);
    }

    const directUrl = localStorage.getItem(STORAGE_KEY_SB_URL);
    const directKey = localStorage.getItem(STORAGE_KEY_SB_KEY);

    const url = normalizeSupabaseUrl(directUrl || saved.url || DEFAULT_SB_URL);
    const anonKey = (directKey || saved.anonKey || DEFAULT_SB_KEY || '').trim();

    try {
      localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify({ url, anonKey }));
    } catch (e) {}

    return { url, anonKey };
  }

  /**
   * Inisialisasi Supabase Client v2 dengan proteksi anti-crash
   */
  function getSupabaseClient() {
    if (activeSupabaseClient) return activeSupabaseClient;

    const { url, anonKey } = getActiveSupabaseConfig();
    if (!url || !anonKey) {
      console.warn('[LensaPalopo Loader] Kredensial Supabase kosong. Menggunakan mode lokal (LocalStorage/IndexedDB).');
      return null;
    }

    if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
      console.warn('[LensaPalopo Loader] SDK window.supabase belum termuat dari CDN. Menggunakan data lokal.');
      return null;
    }

    try {
      activeSupabaseClient = window.supabase.createClient(url, anonKey, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 10 } }
      });
      console.log('[LensaPalopo Loader] Supabase Client v2 berhasil diinisialisasi otomatis:', url);
      return activeSupabaseClient;
    } catch (err) {
      console.error('[LensaPalopo Loader] Gagal menginisialisasi Supabase Client:', err);
      return null;
    }
  }

  /**
   * Helper: Membaca cadangan dari IndexedDB browser
   */
  function readFromIndexedDB() {
    return new Promise((resolve) => {
      if (!('indexedDB' in window)) return resolve(null);
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = (e) => {
          try {
            const db = e.target.result;
            const tx = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const getReq = store.get(IDB_RECORD_KEY);
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
   * Helper: Menyimpan cache bundle ke LocalStorage & IndexedDB
   */
  function cacheBundleLocally(bundle) {
    if (!bundle || typeof bundle !== 'object') return;
    try {
      localStorage.setItem(CMS_STORAGE_KEY, JSON.stringify(bundle));
    } catch (e) {}

    if ('indexedDB' in window) {
      try {
        const req = indexedDB.open(IDB_NAME, IDB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE);
          }
        };
        req.onsuccess = (e) => {
          try {
            const db = e.target.result;
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.objectStore(IDB_STORE).put(bundle, IDB_RECORD_KEY);
          } catch (err) {}
        };
      } catch (err) {}
    }
  }

  /**
   * Mengambil data lengkap dari Supabase (5 tabel utama)
   */
  async function fetchFromSupabaseCloud() {
    const sb = getSupabaseClient();
    if (!sb) return null;

    console.log('[LensaPalopo Loader] Mengambil data terbaru dari Supabase Cloud...');

    try {
      const [settingsMainRes, galleryRes, articlesRes, destRes, storiesRes] = await Promise.all([
        sb.from('site_settings').select('*').eq('id', 'main').maybeSingle(),
        sb.from('media_gallery').select('*').order('created_at', { ascending: false }),
        sb.from('articles').select('*').order('created_at', { ascending: false }),
        sb.from('destinations').select('*').order('created_at', { ascending: false }),
        sb.from('stories').select('*').order('created_at', { ascending: false })
      ]);

      // Admin selalu menyimpan ke baris id='main'. Fallback ke baris terbaru jika belum ada.
      let settingsRes = settingsMainRes;
      if (!settingsMainRes.data) {
        settingsRes = await sb.from('site_settings').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle();
      }

      if (settingsRes.error) console.error('[Supabase Fetch Error] Tabel site_settings:', settingsRes.error.message, settingsRes.error);
      if (galleryRes.error) console.error('[Supabase Fetch Error] Tabel media_gallery:', galleryRes.error.message, galleryRes.error);
      if (articlesRes.error) console.error('[Supabase Fetch Error] Tabel articles:', articlesRes.error.message, articlesRes.error);
      if (destRes.error) console.error('[Supabase Fetch Error] Tabel destinations:', destRes.error.message, destRes.error);
      if (storiesRes.error) console.error('[Supabase Fetch Error] Tabel stories:', storiesRes.error.message, storiesRes.error);

      let baseBundle = {};
      let hasAuthoritativePayload = false;

      // Ambil bundle lengkap dari site_settings.payload atau site_settings.cms_bundle (Sumber Utama Full Control CMS)
      if (settingsRes.data) {
        const row = settingsRes.data;
        const payloadObj = row.payload || row.cms_bundle;
        if (payloadObj && typeof payloadObj === 'object') {
          baseBundle = { ...payloadObj };
          if (
            Array.isArray(payloadObj.photos) ||
            Array.isArray(payloadObj.articles) ||
            Array.isArray(payloadObj.videos) ||
            Array.isArray(payloadObj.tourism) ||
            Array.isArray(payloadObj.stories)
          ) {
            hasAuthoritativePayload = true;
          }
        }
        baseBundle.settings = {
          ...(baseBundle.settings || {}),
          brandName: row.brand_name || baseBundle.settings?.brandName || 'LENSA PALOPO',
          brandTagline: row.tagline || baseBundle.settings?.brandTagline || baseBundle.settings?.tagline || 'Profil Kota Palopo & Dokumentasi Visual Luwu Raya',
          tagline: row.tagline || baseBundle.settings?.brandTagline || baseBundle.settings?.tagline || 'Profil Kota Palopo & Dokumentasi Visual Luwu Raya',
          creatorHandle: row.ig_handle || baseBundle.settings?.creatorHandle || baseBundle.settings?.igHandle || '@lensa_palopo',
          igHandle: row.ig_handle || baseBundle.settings?.creatorHandle || baseBundle.settings?.igHandle || '@lensa_palopo',
          topbarText: row.announcement || baseBundle.settings?.topbarText || baseBundle.settings?.announcement || '',
          announcement: row.announcement || baseBundle.settings?.topbarText || baseBundle.settings?.announcement || '',
          logoUrl: row.logo_url || baseBundle.settings?.logoUrl || 'assets/logo-lensa-palopo.png',
          heroBadge: row.hero_badge || baseBundle.settings?.heroBadge || '',
          heroTitle: row.hero_title || baseBundle.settings?.heroTitle || '',
          heroDesc: row.hero_desc || baseBundle.settings?.heroDesc || '',
          heroBg: row.hero_bg || baseBundle.settings?.heroBg || ''
        };
      }

      // 1. Media Gallery (Foto dari Supabase Storage)
      if (!hasAuthoritativePayload && Array.isArray(galleryRes.data) && galleryRes.data.length > 0) {
        baseBundle.photos = galleryRes.data.map((row, idx) => {
          const imgUrl = (row.img || row.image_url || '').trim();
          return {
            id: row.id || `p-${idx + 1}`,
            title: row.title || 'Karya Lensa Palopo',
            category: (row.category || 'pesisir').toLowerCase(),
            location: row.location || 'Kota Palopo',
            exif: row.exif || 'Lensa Palopo Visual',
            featured: row.featured !== false,
            visible: row.featured !== false,
            img: imgUrl,
            image: imgUrl,
            desc: row.description || row.desc || ''
          };
        });
      }

      // 2. Articles (Berita & Liputan)
      if (!hasAuthoritativePayload && Array.isArray(articlesRes.data) && articlesRes.data.length > 0) {
        baseBundle.articles = articlesRes.data.map((row, idx) => {
          const imgUrl = (row.img || row.image_url || '').trim();
          const bodyText = row.content || row.preview || row.excerpt || '';
          return {
            id: row.id || `art-${idx + 1}`,
            title: row.title || 'Liputan Lensa Palopo',
            tag: row.tag || row.category || 'Liputan',
            category: row.tag || row.category || 'Liputan',
            date: row.date || 'Baru saja',
            readTime: row.read_time || '4 menit baca',
            img: imgUrl,
            image: imgUrl,
            preview: row.preview || row.excerpt || bodyText.substring(0, 140) + '...',
            content: bodyText
          };
        });
      }

      // 3. Destinations (Destinasi Wisata)
      if (!hasAuthoritativePayload && Array.isArray(destRes.data) && destRes.data.length > 0) {
        baseBundle.tourism = destRes.data.map((row, idx) => {
          const imgUrl = (row.img || row.image_url || '').trim();
          return {
            id: row.id || `t-${idx + 1}`,
            name: row.name || 'Destinasi Palopo',
            category: (row.category || 'bahari').toLowerCase(),
            type: (row.category || 'bahari').toLowerCase(),
            distance: row.distance || 'Kota Palopo',
            bestTime: row.best_time || 'Pagi & Sore',
            highlight: row.highlight || row.description || row.desc || '',
            desc: row.highlight || row.description || row.desc || '',
            lat: Number(row.lat) || -2.9925,
            lng: Number(row.lng) || 120.1969,
            img: imgUrl,
            image: imgUrl
          };
        });
      }

      // 4. Stories & Video Dokumenter
      if (!hasAuthoritativePayload && Array.isArray(storiesRes.data) && storiesRes.data.length > 0) {
        const isVideoRow = (item) =>
          item.category === 'video' || item.category === 'documentary' || item.category === 'featured_doc';
        const storyRows = storiesRes.data.filter((item) => !isVideoRow(item));
        const videoRows = storiesRes.data.filter((item) => isVideoRow(item));

        if (storyRows.length > 0) {
          baseBundle.stories = storyRows.map((row, idx) => {
            const imgUrl = (row.img || row.image_url || '').trim();
            return {
              id: row.id || `s-${idx + 1}`,
              title: row.title || 'Cerita Palopo',
              caption: row.caption || '',
              time: row.time_label || 'Baru saja',
              img: imgUrl,
              image: imgUrl
            };
          });
        }

        if (videoRows.length > 0) {
          baseBundle.videos = videoRows.map((row, idx) => {
            const thumbUrl = (row.img || row.image_url || '').trim();
            return {
              id: row.id || `doc-${idx + 1}`,
              title: row.title || 'Dokumenter Lensa Palopo',
              duration: row.duration || '05:00',
              location: row.time_label || 'Kota Palopo',
              synopsis: row.caption || '',
              videoUrl: row.video_url || '',
              isFeatured: row.category === 'featured_doc',
              thumb: thumbUrl,
              img: thumbUrl
            };
          });
        }
      }

      const hasCloudData =
        Object.keys(baseBundle).length > 0 &&
        (hasAuthoritativePayload ||
          Array.isArray(baseBundle.photos) ||
          Array.isArray(baseBundle.articles) ||
          Array.isArray(baseBundle.tourism) ||
          Array.isArray(baseBundle.stories) ||
          baseBundle.settings);

      if (hasCloudData) {
        console.log('[LensaPalopo Loader] Data Supabase Cloud berhasil dimuat:', {
          photos: (baseBundle.photos || []).length,
          articles: (baseBundle.articles || []).length,
          tourism: (baseBundle.tourism || []).length,
          stories: (baseBundle.stories || []).length,
          videos: (baseBundle.videos || []).length
        });
        cacheBundleLocally(baseBundle);
        return baseBundle;
      }
    } catch (err) {
      console.error('[LensaPalopo Loader] Exception saat mengambil data dari Supabase:', err);
    }

    return null;
  }

  /**
   * Mengambil bundle CMS dengan prioritas:
   * 1. Supabase Cloud
   * 2. LocalStorage (`lensa_palopo_cms_v1`)
   * 3. IndexedDB (`LensaPalopoLocalDB`)
   * 4. `data/photos.json`
   */
  async function fetchCmsBundle() {
    const cloudBundle = await fetchFromSupabaseCloud();
    if (cloudBundle) return cloudBundle;

    try {
      const localRaw = localStorage.getItem(CMS_STORAGE_KEY) || localStorage.getItem(LEGACY_CMS_STORAGE_KEY);
      if (localRaw) {
        const parsed = JSON.parse(localRaw);
        if (parsed && typeof parsed === 'object') {
          console.log('[LensaPalopo Loader] Menggunakan data cadangan dari LocalStorage.');
          return parsed;
        }
      }
    } catch (err) {
      console.warn('[LensaPalopo Loader] Gagal membaca LocalStorage:', err);
    }

    try {
      const idbBundle = await readFromIndexedDB();
      if (idbBundle && typeof idbBundle === 'object') {
        console.log('[LensaPalopo Loader] Menggunakan data cadangan dari IndexedDB.');
        return idbBundle;
      }
    } catch (err) {}

    try {
      const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyRaw) {
        const parsedPhotos = JSON.parse(legacyRaw);
        if (Array.isArray(parsedPhotos) && parsedPhotos.length > 0) {
          return { photos: parsedPhotos };
        }
      }
    } catch (e) {}

    try {
      const response = await fetch('data/photos.json', { cache: 'no-store' });
      if (response.ok) {
        const json = await response.json();
        const list = Array.isArray(json) ? json : json.photos || [];
        if (list.length > 0) {
          console.log('[LensaPalopo Loader] Menggunakan data statis dari data/photos.json.');
          return { photos: list };
        }
      }
    } catch (err) {}

    return null;
  }

  /**
   * Menerapkan seluruh perubahan CMS ke DOM & STATE di `index.html`
   * Mencakup: Identitas Brand, Topbar, Live News Ticker, Hero & 4 Statistik,
   * Profil Kreator & Footer, Saklar Visibilitas Bagian (`settings.sections`),
   * Galeri Foto, Berita, Video Dokumenter & Banner Utama, Destinasi Wisata, dan Stories.
   */
  function applyCmsBundleToPage(bundle) {
    if (!bundle || typeof bundle !== 'object') return;

    const settings = bundle.settings || {};

    // 1. Terapkan Pengaturan Situs, Hero, Statistik, Profil Kreator, & Running Text
    const setText = (id, val) => {
      if (val === undefined || val === null || val === '') return;
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    // Identitas Brand & Topbar
    setText('site-brand-name', settings.brandName);
    setText('footer-brand-name', settings.brandName);
    setText('site-brand-tagline', settings.brandTagline || settings.tagline);
    setText('topbar-announcement', settings.topbarText || settings.announcement);
    setText('topbar-ig-handle', settings.creatorHandle || settings.igHandle);

    // Logo di Navbar, Profil Kreator & Footer
    if (settings.logoUrl) {
      ['site-logo-nav', 'site-logo-profile', 'site-logo-footer', 'site-logo-img', 'hero-logo-watermark', 'footer-logo-img', 'creator-logo-img'].forEach((id) => {
        const imgEl = document.getElementById(id);
        if (imgEl) imgEl.src = settings.logoUrl;
      });
    }

    // Live News Ticker (`#news-ticker-track`)
    const tickerRaw = settings.tickerText || '';
    if (tickerRaw.trim()) {
      const tickerTrack = document.getElementById('news-ticker-track');
      if (tickerTrack) {
        const parts = tickerRaw.split('|').map((s) => s.trim()).filter(Boolean);
        if (parts.length > 0) {
          const itemsHtml = parts
            .map(
              (txt) =>
                `<span class="inline-flex items-center gap-2 px-4 whitespace-nowrap shrink-0 text-xs text-slate-200 font-medium"><span class="w-1.5 h-1.5 rounded-full bg-gold shrink-0"></span><span>${txt}</span></span>`
            )
            .join('');
          // Gandakan isi menjadi 2 clone terpisah agar animasi marquee -50% berjalan mulus terus-menerus ke kiri tanpa terputus
          tickerTrack.innerHTML = `
            <div class="inline-flex items-center whitespace-nowrap shrink-0">${itemsHtml}</div>
            <div class="inline-flex items-center whitespace-nowrap shrink-0" aria-hidden="true">${itemsHtml}</div>
          `;

          // Hitung durasi animasi dinamis agar teks panjang tetap berkecepatan stabil dan nyaman dibaca
          setTimeout(() => {
            const trackWidth = tickerTrack.scrollWidth;
            if (trackWidth > 0) {
              const speedPxPerSec = 70; // 70px per detik
              const dynamicSec = Math.max(25, Math.round((trackWidth / 2) / speedPxPerSec));
              tickerTrack.style.animationDuration = dynamicSec + 's';
            }
          }, 50);
        }
      }
    }

    // Hero Section (Badge, Prefix, Highlight, Suffix, Deskripsi, Background, & 4 Statistik)
    setText('hero-badge-text', settings.heroBadge);
    setText('hero-title-prefix', settings.heroPrefix);
    setText('hero-title-highlight', settings.heroHighlight);
    setText('hero-title-suffix', settings.heroSuffix);
    setText('hero-desc-text', settings.heroDesc);

    const heroBgUrl = settings.heroBg || settings.heroBgUrl;
    if (heroBgUrl) {
      ['hero-bg-img', 'hero-bg-image'].forEach((id) => {
        const heroImg = document.getElementById(id);
        if (!heroImg) return;
        heroImg.removeAttribute('srcset');
        heroImg.onload = () => {
          heroImg.classList.remove('opacity-25', 'opacity-0');
          heroImg.classList.add('opacity-80');
          console.log('[LensaPalopo Loader] Background Hero dari Admin berhasil ditampilkan.');
        };
        heroImg.onerror = () => {
          console.error('[LensaPalopo Loader] Gagal memuat Background Hero:', heroBgUrl.slice(0, 120));
        };
        if (heroImg.getAttribute('src') !== heroBgUrl) heroImg.src = heroBgUrl;
      });
      // Pasang juga sebagai CSS background pada wadah gambar agar tetap tampil walau <img> gagal
      const heroImgEl = document.getElementById('hero-bg-img');
      const heroBgWrap = heroImgEl ? heroImgEl.parentElement : null;
      if (heroBgWrap) {
        heroBgWrap.style.backgroundImage = `url("${heroBgUrl.replace(/"/g, '%22')}")`;
        heroBgWrap.style.backgroundSize = 'cover';
        heroBgWrap.style.backgroundPosition = 'center';
      }
    }

    setText('hero-stat-1-val', settings.stat1Val);
    setText('hero-stat-1-lbl', settings.stat1Lbl);
    setText('hero-stat-2-val', settings.stat2Val);
    setText('hero-stat-2-lbl', settings.stat2Lbl);
    setText('hero-stat-3-val', settings.stat3Val);
    setText('hero-stat-3-lbl', settings.stat3Lbl);
    setText('hero-stat-4-val', settings.stat4Val);
    setText('hero-stat-4-lbl', settings.stat4Lbl);

    // Profil Pemilik Website / Kreator (@lensa_palopo)
    setText('creator-handle-badge', settings.creatorHandle || settings.igHandle);
    setText('creator-bio-text', settings.creatorBio);
    setText('creator-gear-text', settings.creatorGear);
    setText('creator-principle-text', settings.creatorPrinciple);
    if (settings.creatorIgUrl) {
      const igLink = document.getElementById('creator-ig-link');
      if (igLink) igLink.href = settings.creatorIgUrl;
    }

    // Saklar Visibilitas Bagian Website (`settings.sections`)
    if (settings.sections && typeof settings.sections === 'object') {
      const sec = settings.sections;
      const toggleTargets = (ids, isVisible) => {
        ids.forEach((id) => {
          const el = document.getElementById(id);
          if (el) el.classList.toggle('hidden', isVisible === false);
        });
      };
      toggleTargets(['news-ticker-section'], sec.ticker);
      toggleTargets(['stories-section'], sec.stories);
      toggleTargets(['galeri-section'], sec.galeri);
      toggleTargets(['wisata-section', 'pariwisata'], sec.wisata);
      toggleTargets(['budaya-section', 'sejarah'], sec.budaya);
      toggleTargets(['cerita-section'], sec.cerita);
      toggleTargets(['dokumenter-section'], sec.dokumenter);
      toggleTargets(['kecamatan', 'statistik', 'pemerintahan'], sec.kecamatan);
      toggleTargets(['profil-section'], sec.profil);
    }

    // 2. Sinkronisasi Galeri Foto (`STATE.gallery` & `window.galleryData`)
    if (Array.isArray(bundle.photos)) {
      const CAT_NAMES = {
        pesisir: 'Pesisir & Bahari',
        landskap: 'Landskap & Alam',
        alam: 'Landskap & Alam',
        budaya: 'Sejarah & Budaya',
        human: 'Human Interest',
        kuliner: 'Kuliner Khas',
        drone: 'Sudut Udara (Drone)'
      };
      const visiblePhotos = bundle.photos.filter((item) => item.visible !== false);
      const normalizedPhotos = visiblePhotos.map((item, idx) => {
        const imgUrl = (item.img || item.image || item.driveInput || '').trim();
        const catKey = (item.category || 'landskap').toLowerCase();
        return {
          id: item.id || `p-${idx + 1}`,
          title: item.title || 'Karya Lensa Palopo',
          category: catKey,
          categoryName: item.categoryName || CAT_NAMES[catKey] || item.category || 'Galeri',
          location: item.location || 'Kota Palopo',
          exif: item.exif || 'Lensa Palopo Visual',
          featured: Boolean(item.featured),
          img: imgUrl,
          image: imgUrl,
          desc: item.desc || item.description || ''
        };
      });

      window.galleryData = normalizedPhotos;
      if (typeof STATE !== 'undefined' && STATE) {
        STATE.gallery = normalizedPhotos;
      }
      if (typeof window.renderGallery === 'function') {
        window.renderGallery('all');
      }
    }

    // 3. Sinkronisasi Berita & Artikel (`STATE.articles` & `window.articlesData`)
    if (Array.isArray(bundle.articles)) {
      const normalizedArticles = bundle.articles.map((art, idx) => {
        const imgUrl = (art.img || art.image || '').trim();
        const bodyText = art.content || art.fullText || art.preview || art.excerpt || '';
        return {
          id: art.id || `art-${idx + 1}`,
          title: art.title || 'Liputan Lensa Palopo',
          tag: art.tag || art.category || 'Berita Kota',
          category: art.tag || art.category || 'Berita Kota',
          date: art.date || 'Baru saja',
          readTime: art.readTime || '4 menit baca',
          img: imgUrl,
          image: imgUrl,
          preview: art.preview || art.excerpt || bodyText.replace(/<[^>]+>/g, '').substring(0, 140) + '...',
          content: bodyText,
          fullText: bodyText
        };
      });

      window.articlesData = normalizedArticles;
      if (typeof STATE !== 'undefined' && STATE) {
        STATE.articles = normalizedArticles;
      }
      if (typeof window.renderArticles === 'function') {
        window.renderArticles('all');
      }
    }

    // 4. Sinkronisasi Video Dokumenter (`STATE.documentaries`, `window.documentariesData`, & Banner Utama `#feat-doc-*`)
    if (Array.isArray(bundle.videos)) {
      const normalizedVideos = bundle.videos.map((vid, idx) => {
        const thumbUrl = (vid.thumb || vid.img || '').trim();
        return {
          id: vid.id || `doc-${idx + 1}`,
          title: vid.title || 'Dokumenter Lensa Palopo',
          duration: vid.duration || '05:00',
          location: vid.location || 'Kota Palopo',
          synopsis: vid.synopsis || vid.desc || '',
          videoUrl: vid.videoUrl || '',
          isFeatured: Boolean(vid.isFeatured),
          thumb: thumbUrl,
          img: thumbUrl
        };
      });

      window.documentariesData = normalizedVideos;
      if (typeof STATE !== 'undefined' && STATE) {
        STATE.documentaries = normalizedVideos;
      }

      // Perbarui Banner Dokumenter Pilihan Utama (Featured Documentary Showcase)
      const featuredDoc = normalizedVideos.find((v) => v.isFeatured) || normalizedVideos[0];
      if (featuredDoc) {
        const featThumb = document.getElementById('feat-doc-thumb');
        if (featThumb && (featuredDoc.thumb || featuredDoc.img)) {
          featThumb.src = featuredDoc.thumb || featuredDoc.img;
        }
        setText('feat-doc-duration', `${featuredDoc.duration || '06:00'} • HD`);
        setText('feat-doc-title', featuredDoc.title);
        setText('feat-doc-desc', featuredDoc.synopsis);
        const locEl = document.getElementById('feat-doc-meta-loc');
        if (locEl) {
          locEl.innerHTML = `<i data-lucide="map-pin" class="w-3.5 h-3.5 text-gold"></i> Lokasi: ${featuredDoc.location || 'Kota Palopo'}`;
        }
        const shareBtn = document.getElementById('feat-doc-share-btn');
        if (shareBtn) {
          shareBtn.dataset.title = featuredDoc.title || 'Dokumenter Lensa Palopo';
        }
        window.__featuredDocId = featuredDoc.id;
      }

      if (typeof window.renderDocumentaries === 'function') {
        window.renderDocumentaries();
      }
    }

    // 5. Sinkronisasi Destinasi Wisata (`STATE.tourism`, `window.tourismData`, & `TOURISM_AND_CULINARY`)
    if (Array.isArray(bundle.tourism)) {
      const TOUR_LABELS = {
        bahari: 'Wisata Bahari',
        alam: 'Ekowisata Alam',
        keluarga: 'Taman & Kota',
        kuliner: 'Kuliner Khas',
        sejarah: 'Sejarah & Budaya'
      };
      const normalizedTourism = bundle.tourism.map((dest, idx) => {
        const rawCat = (dest.category || dest.type || 'bahari').toLowerCase();
        let typeKey = rawCat;
        if (rawCat.includes('bahari') || rawCat.includes('pesisir')) typeKey = 'bahari';
        else if (rawCat.includes('alam') || rawCat.includes('ekowisata') || rawCat.includes('pegunungan')) typeKey = 'alam';
        else if (rawCat.includes('keluarga') || rawCat.includes('taman') || rawCat.includes('kota')) typeKey = 'keluarga';
        else if (rawCat.includes('kuliner')) typeKey = 'kuliner';
        else if (rawCat.includes('sejarah') || rawCat.includes('budaya')) typeKey = 'sejarah';

        const imgUrl = (dest.img || dest.image || '').trim();
        return {
          id: dest.id || `t-${idx + 1}`,
          name: dest.name || 'Destinasi Palopo',
          category: typeKey,
          type: typeKey,
          typeName: dest.typeName || TOUR_LABELS[typeKey] || dest.category || 'Wisata Palopo',
          distance: dest.distance || 'Kota Palopo',
          bestTime: dest.bestTime || 'Pagi & Sore',
          highlight: dest.highlight || dest.desc || '',
          desc: dest.highlight || dest.desc || '',
          lat: Number(dest.lat) || -2.9925,
          lng: Number(dest.lng) || 120.1969,
          img: imgUrl,
          image: imgUrl
        };
      });

      window.tourismData = normalizedTourism;
      if (typeof STATE !== 'undefined' && STATE) {
        STATE.tourism = normalizedTourism;
      }
      if (typeof window.renderTourism === 'function') {
        window.renderTourism('all');
      }

      // Sinkronkan juga ke bagian kedua (#pariwisata / TOURISM_AND_CULINARY) jika ada item baru dari Admin
      if (typeof TOURISM_AND_CULINARY !== 'undefined' && Array.isArray(TOURISM_AND_CULINARY)) {
        normalizedTourism.forEach((tItem) => {
          const mappedCategory =
            tItem.type === 'kuliner'
              ? 'Kuliner Khas'
              : tItem.type === 'sejarah'
                ? 'Wisata Sejarah & Budaya'
                : 'Wisata Alam & Bahari';
          const existingIdx = TOURISM_AND_CULINARY.findIndex(
            (x) => x.id === tItem.id || x.name.toLowerCase() === tItem.name.toLowerCase()
          );
          const syncedEntry = {
            id: tItem.id,
            name: tItem.name,
            category: mappedCategory,
            location: tItem.distance || 'Kota Palopo',
            description: tItem.highlight || tItem.desc || '',
            badge: tItem.bestTime || 'Rekomendasi Lensa Palopo',
            sourceName: 'Lensa Palopo',
            sourceUrl: '#wisata-section'
          };
          if (existingIdx >= 0) {
            TOURISM_AND_CULINARY[existingIdx] = { ...TOURISM_AND_CULINARY[existingIdx], ...syncedEntry };
          } else {
            TOURISM_AND_CULINARY.unshift(syncedEntry);
          }
        });
        if (typeof window.renderTourismCards === 'function') {
          window.renderTourismCards();
        }
      }
    }

    // 6. Sinkronisasi Highlight Stories (`STATE.stories` & `window.storiesData`)
    if (Array.isArray(bundle.stories)) {
      const normalizedStories = bundle.stories.map((st, idx) => {
        const coverUrl = (st.cover || st.img || st.image || '').trim();
        let items = Array.isArray(st.items) && st.items.length > 0 ? st.items.map((it, itIdx) => ({
          id: it.id || `item-${st.id || idx}-${itIdx + 1}`,
          type: it.type === 'video' ? 'video' : 'image',
          url: (it.url || it.img || it.image || '').trim(),
          caption: it.caption || '',
          time: it.time || `Slide ${itIdx + 1}`
        })) : [];

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
          id: st.id || `s-${idx + 1}`,
          title: st.title || 'Cerita Palopo',
          time: st.time || 'Baru saja',
          cover: resolvedCover,
          img: resolvedCover,
          image: resolvedCover,
          caption: st.caption || (items[0] && items[0].caption) || '',
          items: items
        };
      });

      window.storiesData = normalizedStories;
      if (typeof STATE !== 'undefined' && STATE) {
        STATE.stories = normalizedStories;
      }
      if (typeof window.renderStories === 'function') {
        window.renderStories();
      }
    }

    if (typeof window.lucide !== 'undefined' && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  /**
   * Fungsi utama untuk memuat dan merender data ke halaman publik
   */
  async function syncAndRender() {
    const bundle = await fetchCmsBundle();
    if (bundle) {
      applyCmsBundleToPage(bundle);
    }
  }

  /**
   * Berlangganan (Subscribe) ke Supabase Realtime v2 (`schema-db-changes`)
   */
  function initSupabaseRealtime() {
    const sb = getSupabaseClient();
    if (!sb || typeof sb.channel !== 'function') return;

    if (activeRealtimeChannel) {
      try {
        sb.removeChannel(activeRealtimeChannel);
      } catch (e) {}
    }

    const handleRealtimePayload = (payload) => {
      console.log(
        `[Supabase Realtime] Perubahan terdeteksi pada tabel "${payload.table}" (${payload.eventType}):`,
        payload
      );
      clearTimeout(realtimeDebounceTimer);
      realtimeDebounceTimer = setTimeout(() => {
        syncAndRender();
      }, 300);
    };

    activeRealtimeChannel = sb
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'articles' },
        handleRealtimePayload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media_gallery' },
        handleRealtimePayload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'destinations' },
        handleRealtimePayload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'stories' },
        handleRealtimePayload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_settings' },
        handleRealtimePayload
      )
      .subscribe((status, err) => {
        console.log('[Supabase Realtime] Status Channel `schema-db-changes`:', status);
        if (err) {
          console.error('[Supabase Realtime] Error langganan channel:', err);
        }
      });
  }

  // Ekspor API global
  window.LensaPalopoLoader = {
    syncAndRender,
    normalizeSupabaseUrl,
    getSupabaseClient,
    initSupabaseRealtime
  };

  // Jalankan otomatis saat DOM selesai dimuat
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      syncAndRender();
      initSupabaseRealtime();
    });
  } else {
    syncAndRender();
    initSupabaseRealtime();
  }

  // Dengarkan event `storage` & BroadcastChannel (sinkronisasi instan antar tab di browser yang sama)
  window.addEventListener('storage', (event) => {
    if (
      event.key === CMS_STORAGE_KEY ||
      event.key === LEGACY_CMS_STORAGE_KEY ||
      event.key === LEGACY_STORAGE_KEY ||
      event.key === SUPABASE_CONFIG_KEY ||
      event.key === STORAGE_KEY_SB_URL ||
      event.key === STORAGE_KEY_SB_KEY
    ) {
      console.log('[LensaPalopo Loader] Perubahan LocalStorage terdeteksi dari tab Admin. Memuat ulang...');
      activeSupabaseClient = null;
      syncAndRender();
      initSupabaseRealtime();
    }
  });

  if ('BroadcastChannel' in window) {
    try {
      const bc = new BroadcastChannel('lensa_cms_sync');
      bc.onmessage = (ev) => {
        if (ev.data && ev.data.type === 'CMS_UPDATED') {
          console.log('[LensaPalopo Loader] Sinyal BroadcastChannel diterima dari Admin. Memuat ulang...');
          syncAndRender();
        }
      };
    } catch (e) {}
  }
})();
