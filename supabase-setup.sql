-- ============================================================================
-- LENSA PALOPO — SKRIP SQL LENGKAP SUPABASE
-- (TABEL DATABASE + STORAGE BUCKET 'lensa-palopo-media' + RLS POLICIES + REALTIME)
-- ============================================================================
-- Petunjuk:
-- 1. Buka Dashboard Supabase proyek Anda (https://supabase.com/dashboard)
-- 2. Masuk ke menu "SQL Editor" di sidebar kiri -> Klik "New Query"
-- 3. Tempel (Paste) seluruh isi skrip ini lalu klik tombol "Run" (atau Ctrl+Enter)
-- ============================================================================

-- ============================================================================
-- BAGIAN 1: KONFIGURASI SUPABASE STORAGE BUCKET ('lensa-palopo-media') & RLS
-- ============================================================================

-- 1A. Buat Bucket Publik 'lensa-palopo-media' (Mendukung Foto & Video hingga 500 MB)
-- Catatan: Set file_size_limit = NULL (atau 524288000 = 500 MB) dan allowed_mime_types = NULL
-- agar bisa mengunggah foto resolusi tinggi maupun video dokumenter MP4/WEBM/MOV besar (~300 MB+).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lensa-palopo-media',
  'lensa-palopo-media',
  true,
  524288000, -- 500 MB (500 * 1024 * 1024 bytes) agar video 300 MB+ leluasa diunggah
  NULL       -- Izinkan semua format gambar (JPG/PNG/WEBP) & video (MP4/MOV/WEBM/MKV)
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 524288000,
  allowed_mime_types = NULL;

-- 1B. Hapus Policy Storage lama jika sudah ada agar tidak bentrok (idempotent)
DROP POLICY IF EXISTS "Public Select lensa-palopo-media" ON storage.objects;
DROP POLICY IF EXISTS "Public Insert lensa-palopo-media" ON storage.objects;
DROP POLICY IF EXISTS "Public Update lensa-palopo-media" ON storage.objects;
DROP POLICY IF EXISTS "Public Delete lensa-palopo-media" ON storage.objects;

-- 1C. Policy SELECT: Izinkan publik melihat & mengunduh gambar dari bucket 'lensa-palopo-media'
CREATE POLICY "Public Select lensa-palopo-media"
ON storage.objects FOR SELECT
TO public, anon, authenticated
USING (bucket_id = 'lensa-palopo-media');

-- 1D. Policy INSERT: Izinkan unggah (upload) file baru ke bucket 'lensa-palopo-media' tanpa kendala RLS
CREATE POLICY "Public Insert lensa-palopo-media"
ON storage.objects FOR INSERT
TO public, anon, authenticated
WITH CHECK (bucket_id = 'lensa-palopo-media');

-- 1E. Policy UPDATE: Izinkan pembaruan/timpa file di bucket 'lensa-palopo-media'
CREATE POLICY "Public Update lensa-palopo-media"
ON storage.objects FOR UPDATE
TO public, anon, authenticated
USING (bucket_id = 'lensa-palopo-media')
WITH CHECK (bucket_id = 'lensa-palopo-media');

-- 1F. Policy DELETE: Izinkan penghapusan file dari bucket 'lensa-palopo-media'
CREATE POLICY "Public Delete lensa-palopo-media"
ON storage.objects FOR DELETE
TO public, anon, authenticated
USING (bucket_id = 'lensa-palopo-media');


-- ============================================================================
-- BAGIAN 2: PEMBUATAN 5 TABEL UTAMA DATABASE (DDL)
-- ============================================================================

-- 1. TABEL: site_settings (Pengaturan Situs, Hero, Statistik, & Master Bundle)
CREATE TABLE IF NOT EXISTS public.site_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  brand_name TEXT DEFAULT 'LENSA PALOPO',
  tagline TEXT DEFAULT 'Profil Kota Palopo & Dokumentasi Visual Luwu Raya',
  ig_handle TEXT DEFAULT '@lensa_palopo',
  announcement TEXT DEFAULT '',
  logo_url TEXT DEFAULT 'assets/logo-lensa-palopo.png',
  hero_badge TEXT DEFAULT 'Jazirah Luwu Raya • Sulawesi Selatan',
  hero_title TEXT DEFAULT 'Mengenal Kota Palopo Lewat Lensa & Cerita',
  hero_desc TEXT DEFAULT '',
  hero_bg TEXT DEFAULT '',
  payload JSONB DEFAULT '{}'::jsonb,
  updated_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- 2. TABEL: articles (Berita, Liputan Khusus, & Artikel Kota Palopo)
CREATE TABLE IF NOT EXISTS public.articles (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  tag TEXT DEFAULT 'Berita Kota',
  date TEXT DEFAULT '',
  read_time TEXT DEFAULT '4 Menit Baca',
  preview TEXT DEFAULT '',
  content TEXT DEFAULT '',
  img TEXT NOT NULL,
  created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- 3. TABEL: media_gallery (Foto Galeri Lensa Palopo)
CREATE TABLE IF NOT EXISTS public.media_gallery (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT DEFAULT 'landskap',
  location TEXT DEFAULT 'Kota Palopo',
  exif TEXT DEFAULT 'Lensa Palopo Visual',
  description TEXT DEFAULT '',
  img TEXT NOT NULL,
  featured BOOLEAN DEFAULT true,
  created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- 4. TABEL: destinations (Destinasi Wisata Unggulan Kota Palopo)
CREATE TABLE IF NOT EXISTS public.destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'bahari',
  distance TEXT DEFAULT '15 Menit dari Pusat Kota',
  best_time TEXT DEFAULT 'Pagi & Sore Hari',
  highlight TEXT DEFAULT '',
  lat DOUBLE PRECISION DEFAULT -2.9925,
  lng DOUBLE PRECISION DEFAULT 120.1969,
  img TEXT NOT NULL,
  created_at BIGINT DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- 5. TABEL: stories (Sorotan Cerita / Highlight Stories & Seri Video Dokumenter)
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


-- ============================================================================
-- BAGIAN 3: ROW LEVEL SECURITY (RLS) POLICIES UNTUK TABEL DATABASE
-- ============================================================================

-- 1. RLS untuk site_settings
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write" ON public.site_settings;
CREATE POLICY "Allow public read-write" ON public.site_settings
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 2. RLS untuk articles
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write" ON public.articles;
CREATE POLICY "Allow public read-write" ON public.articles
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 3. RLS untuk media_gallery
ALTER TABLE public.media_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write" ON public.media_gallery;
CREATE POLICY "Allow public read-write" ON public.media_gallery
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 4. RLS untuk destinations
ALTER TABLE public.destinations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write" ON public.destinations;
CREATE POLICY "Allow public read-write" ON public.destinations
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);

-- 5. RLS untuk stories
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read-write" ON public.stories;
CREATE POLICY "Allow public read-write" ON public.stories
  FOR ALL TO public, anon, authenticated USING (true) WITH CHECK (true);


-- ============================================================================
-- BAGIAN 4: AKTIFKAN FITUR REALTIME REPLICATION PADA TABEL UTAMA
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.articles;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.media_gallery;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.destinations;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stories;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
