# DERMA-DFU.ID - Dokumentasi Sistem Lengkap

**Versi**: 1.0  
**Tanggal**: 3 Desember 2025  
**Nama Aplikasi**: DERMA-DFU.ID  
**Deskripsi**: Sistem Triase Luka Kaki Diabetik Berbasis AI

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Struktur Proyek](#3-struktur-proyek)
4. [Frontend - Komponen & Halaman](#4-frontend---komponen--halaman)
5. [Logika AI & ONNX](#5-logika-ai--onnx)
6. [Backend - Supabase Configuration](#6-backend---supabase-configuration)
7. [Database Schema](#7-database-schema)
8. [Autentikasi & Otorisasi](#8-autentikasi--otorisasi)
9. [Alur Pengguna](#9-alur-pengguna)
10. [Parameter & Konfigurasi](#10-parameter--konfigurasi)
11. [Keamanan & Privasi](#11-keamanan--privasi)
12. [Cara Menjalankan](#12-cara-menjalankan)
13. [API Reference](#13-api-reference)
14. [Lampiran Teknis](#14-lampiran-teknis)

---

## 1. Ringkasan Eksekutif

### 1.1 Tujuan Aplikasi

DERMA-DFU.ID adalah aplikasi web untuk **triase luka kaki diabetik (Diabetic Foot Ulcer/DFU)** yang menggunakan kecerdasan buatan (AI) untuk membantu tenaga kesehatan dan pasien dalam:

- Mendeteksi tingkat **infeksi** dan **iskemia** pada luka DFU
- Mengukur **luas area luka** secara otomatis
- Memberikan rekomendasi triase: **MERAH** (darurat), **KUNING** (perlu perhatian), **HIJAU** (aman)
- Menyimpan riwayat pemeriksaan untuk monitoring berkelanjutan

### 1.2 Pengguna Target

| Pengguna | Kebutuhan |
|----------|-----------|
| Pasien Diabetes | Self-assessment luka kaki |
| Perawat/Bidan | Screening awal di puskesmas |
| Dokter Umum | Triase sebelum rujukan |
| Admin Klinik | Monitoring statistik pasien |

### 1.3 Nilai Klinis Utama

- **Deteksi dini** komplikasi luka diabetik
- **Standarisasi** proses triase berbasis evidence
- **Dokumentasi** visual dan numerik untuk follow-up
- **Efisiensi** waktu tenaga kesehatan

---

## 2. Arsitektur Sistem

### 2.1 Diagram Arsitektur

```
┌─────────────────────────────────────────────────────────────────┐
│                         BROWSER (Client)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   React     │  │   ONNX      │  │    Supabase Client      │ │
│  │   + Vite    │  │   Runtime   │  │    (Auth, DB, Storage)  │ │
│  │   + shadcn  │  │   (WASM)    │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LOVABLE CLOUD (Supabase)                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  PostgreSQL │  │   Storage   │  │     Auth Service        │ │
│  │  Database   │  │   (Photos)  │  │     (JWT + RLS)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Teknologi | Versi |
|-------|-----------|-------|
| Frontend Framework | React | 18.3.1 |
| Build Tool | Vite | Latest |
| UI Components | shadcn/ui + Radix | Latest |
| Styling | Tailwind CSS | 3.x |
| State Management | TanStack Query | 5.83.0 |
| Routing | React Router | 6.30.1 |
| AI Inference | ONNX Runtime Web | 1.23.0 |
| Backend | Supabase (Lovable Cloud) | Latest |
| Language | TypeScript | 5.x |

### 2.3 Inferensi AI (Browser-side)

Model AI dijalankan **sepenuhnya di browser** menggunakan ONNX Runtime WebAssembly:

- **Tidak ada data dikirim ke server AI eksternal**
- Model di-load dari `/public/models/`
- WASM files dari CDN jsDelivr

---

## 3. Struktur Proyek

```
derma-dfu/
├── public/
│   ├── models/
│   │   ├── dfu_4class.onnx      # Model klasifikasi 4-kelas
│   │   ├── unet_wound.onnx      # Model segmentasi U-Net
│   │   └── calibration.json     # Parameter kalibrasi
│   ├── manifest.json
│   └── robots.txt
│
├── src/
│   ├── components/
│   │   ├── ui/                  # shadcn/ui components
│   │   ├── CameraCapture.tsx    # Komponen kamera
│   │   ├── Layout.tsx           # Layout utama dengan navigasi
│   │   └── ReferralModal.tsx    # Modal rujukan
│   │
│   ├── contexts/
│   │   └── LanguageContext.tsx  # i18n (ID/EN)
│   │
│   ├── features/
│   │   └── triage/
│   │       └── DFUAnalyzer.tsx  # Standalone analyzer component
│   │
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   │
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts        # Supabase client (auto-generated)
│   │       └── types.ts         # Database types (auto-generated)
│   │
│   ├── lib/
│   │   ├── dfu-onnx.ts          # ⭐ Core AI inference logic
│   │   └── utils.ts
│   │
│   ├── pages/
│   │   ├── Index.tsx            # Halaman utama (tab container)
│   │   ├── Auth.tsx             # Login/Register
│   │   ├── Triage.tsx           # ⭐ Halaman triase utama
│   │   ├── History.tsx          # Riwayat pasien
│   │   ├── Admin.tsx            # Dashboard admin
│   │   ├── Education.tsx        # Edukasi pasien
│   │   ├── Settings.tsx         # Pengaturan
│   │   └── NotFound.tsx
│   │
│   ├── App.tsx                  # Root component dengan routing
│   ├── main.tsx                 # Entry point
│   └── index.css                # Global styles + Tailwind
│
├── supabase/
│   ├── config.toml              # Supabase configuration
│   └── migrations/              # Database migrations
│
├── docs/
│   └── *.md                     # Dokumentasi
│
├── tailwind.config.ts
├── vite.config.ts
└── package.json
```

---

## 4. Frontend - Komponen & Halaman

### 4.1 Halaman Utama (`Index.tsx`)

```typescript
// Entry point dengan tab navigation
const [activeTab, setActiveTab] = useState("triage");

// Tabs: triage | education | settings
```

### 4.2 Halaman Triase (`Triage.tsx`)

**Fitur Utama:**
- Upload/capture foto luka
- Input data klinis (demam, nanah, dll)
- Kalibrasi ukuran dengan 2 titik
- Analisis AI → hasil triase
- Simpan ke database
- Modal rujukan

**State Management:**
```typescript
interface TriageFormData {
  photo?: File;
  hasScaleCard: boolean;
  hasFever: boolean;
  hasSmellPus: boolean;
  hasSpreadingRedness: boolean;
  hasRestPain: boolean;
  hasFootPulse: boolean;
  woundDuration: string;
  woundLocation: string;      // toes | midfoot | heel
  diabetesHistory: string;
  kidneyCondition: string;    // none | mild | severe | hemodialysis
  abiValue: string;
  hasBlackColdSkin: boolean;
  notes: string;
}
```

### 4.3 Halaman Auth (`Auth.tsx`)

- Login dengan email/password
- Register dengan nama lengkap
- Auto-redirect jika sudah login
- Check admin role → redirect ke `/admin`

### 4.4 Halaman History (`History.tsx`)

- Tabel riwayat triase pengguna
- Filter by user_id (RLS)
- Status rujukan

### 4.5 Halaman Admin (`Admin.tsx`)

**Akses**: Hanya user dengan role `admin`

**Dashboard Metrics:**
- Waktu rata-rata ke rujukan
- Persentase penyelesaian rujukan
- Kepatuhan foto
- Distribusi triase (Red/Yellow/Green)

**Fitur:**
- Export data ke CSV
- Tabel semua triage records

---

## 5. Logika AI & ONNX

### 5.1 File Utama: `src/lib/dfu-onnx.ts`

### 5.2 Model yang Digunakan

| Model | File | Input | Output |
|-------|------|-------|--------|
| Classifier 4-Class | `dfu_4class.onnx` | 256×256×3 (NHWC) | 4-class softmax |
| Segmenter U-Net | `unet_wound.onnx` | 512×512×3 (NHWC) | Probability mask |

### 5.3 Kelas Klasifikasi

```typescript
CLASS4_LABELS = ["None", "Infection", "Ischaemia", "Both"]
// Index:          0         1            2           3
```

### 5.4 Parameter Default

```typescript
// Thresholds
ISCH_THRESHOLD = 0.5      // Ambang iskemia
INF_THRESHOLD = 0.5       // Ambang infeksi
MIN_WOUND_FRAC = 0.01     // Gate area minimum (1%)

// Input sizes
CLF_INPUT_SIZE = 256      // Classifier input
SEG_INPUT_SIZE = 512      // Segmenter input
SEG_THRESHOLD = 0.5       // Mask threshold
```

### 5.5 Preprocessing

**Classifier (EfficientNet-style):**
```typescript
// Normalize: [0,255] → [-1, 1]
pixel = pixel / 127.5 - 1.0
```

**Segmenter:**
```typescript
// Normalize: [0,255] → [0, 1]
pixel = pixel / 255
```

### 5.6 Output Struktur (`inferDFU`)

```typescript
interface InferOutput {
  infection: {
    topIdx: number;           // 0-3
    probs: number[];          // [pNone, pInf, pIsc, pBoth]
    labels: string[];         // ["None", "Infection", ...]
    pRaw: number;             // P(Infection only)
    pPresent: number;         // P(Infection present) = pInf + pBoth
  };
  ischaemia: {
    prob: number;             // P(Ischaemia present) = pIsc + pBoth
    threshold: number;
    gated: boolean;           // True if area too small
  };
  seg: {
    areaPx: number;           // Wound area in pixels
    areaFrac: number;         // Fraction of image
    areaCm2: number | null;   // Area in cm² (if calibrated)
  };
  img: {
    width: number;
    height: number;
    totalPx: number;
  };
  calibration: { ... };
  model: {
    sha256: string;
    nearConstant: boolean;
    preprocess: string;
    quality: number;
  };
}
```

### 5.7 Gating Logic

Jika area luka terlalu kecil (`areaFrac < MIN_WOUND_FRAC`), prediksi classifier diabaikan:
```typescript
if (areaFrac < MIN_WOUND_FRAC) {
  gated = true;
  topIdx = 0;  // Force "None"
  probs = [1, 0, 0, 0];
}
```

### 5.8 ONNX Runtime Configuration

```typescript
// CDN untuk WASM files
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/";

// Non-COI safe configuration
ort.env.wasm.proxy = false;    // Tidak pakai worker
ort.env.wasm.simd = false;     // Matikan SIMD
ort.env.wasm.numThreads = 1;   // Single thread
```

---

## 6. Backend - Supabase Configuration

### 6.1 Project Info

| Key | Value |
|-----|-------|
| Project ID | `tmipvpwehelyguywyvrt` |
| Region | Lovable Cloud (managed) |
| Database | PostgreSQL |

### 6.2 Environment Variables

```env
VITE_SUPABASE_URL=https://tmipvpwehelyguywyvrt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=tmipvpwehelyguywyvrt
```

### 6.3 Storage Buckets

| Bucket | Public | Deskripsi |
|--------|--------|-----------|
| `wound-photos` | Yes | Foto luka pasien |

### 6.4 Secrets

| Secret Name | Deskripsi |
|-------------|-----------|
| `SUPABASE_PUBLISHABLE_KEY` | Anon key untuk client |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (backend only) |
| `SUPABASE_DB_URL` | Database connection URL |
| `SUPABASE_URL` | API URL |

---

## 7. Database Schema

### 7.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐
│    profiles     │       │   user_roles    │
├─────────────────┤       ├─────────────────┤
│ id (PK, FK)     │       │ id (PK)         │
│ full_name       │       │ user_id (FK)    │
│ created_at      │       │ role            │
│ updated_at      │       │ created_at      │
└────────┬────────┘       └─────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────┐
│              triage_records                  │
├─────────────────────────────────────────────┤
│ id (PK)                                      │
│ user_id (FK → auth.users)                   │
│ created_at                                   │
│ photo_url                                    │
│ triage_result (red/yellow/green)            │
│ has_scale_card, has_fever, has_smell_pus... │
│ infection_class, infection_prob, ...        │
│ wound_area_px, wound_area_cm2, ...          │
│ ai_summary (JSON)                            │
└────────┬────────────────────────────────────┘
         │
         │ 1:N
         ▼
┌─────────────────────────────────────────────┐
│               referrals                      │
├─────────────────────────────────────────────┤
│ id (PK)                                      │
│ triage_id (FK → triage_records)             │
│ facility                                     │
│ scheduled_date                               │
│ completed_at                                 │
│ status                                       │
│ consultation_type                            │
└─────────────────────────────────────────────┘
```

### 7.2 Tabel `profiles`

```sql
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY,  -- References auth.users
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  full_name TEXT
);
```

### 7.3 Tabel `user_roles`

```sql
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
```

### 7.4 Tabel `triage_records`

```sql
CREATE TABLE public.triage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Photo
  photo_url TEXT,
  has_scale_card BOOLEAN DEFAULT false,
  
  -- Clinical flags
  has_fever BOOLEAN DEFAULT false,
  has_smell_pus BOOLEAN DEFAULT false,
  has_spreading_redness BOOLEAN DEFAULT false,
  has_rest_pain BOOLEAN DEFAULT false,
  has_foot_pulse BOOLEAN DEFAULT true,
  has_black_cold_skin BOOLEAN DEFAULT false,
  
  -- Patient history
  wound_duration INTEGER,
  wound_location TEXT,
  diabetes_history TEXT,
  kidney_condition TEXT DEFAULT 'none',
  abi_value NUMERIC,
  notes TEXT,
  
  -- AI results
  triage_result TEXT NOT NULL,          -- 'red' | 'yellow' | 'green'
  infection_class INTEGER,               -- 0-3
  infection_prob NUMERIC,
  infection_prob_present NUMERIC,
  ischaemia_prob NUMERIC,
  top_class_name TEXT,
  top_class_prob NUMERIC,
  
  -- Wound measurements
  wound_area_px INTEGER,
  wound_area_pct NUMERIC,
  wound_area_cm2 NUMERIC,
  calibration_mm_per_px NUMERIC,
  model_gated BOOLEAN DEFAULT false,
  
  -- Summary
  ai_summary TEXT
);
```

### 7.5 Tabel `referrals`

```sql
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triage_id UUID NOT NULL REFERENCES triage_records(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  facility TEXT,
  consultation_type TEXT
);
```

---

## 8. Autentikasi & Otorisasi

### 8.1 Flow Autentikasi

```
User → Login Form → Supabase Auth → JWT Token
                                        │
                                        ▼
                              Session stored in localStorage
                                        │
                                        ▼
                              All API calls include JWT
                                        │
                                        ▼
                              RLS policies enforce access
```

### 8.2 Row Level Security (RLS) Policies

#### Tabel `profiles`
```sql
-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);
```

#### Tabel `triage_records`
```sql
-- Users can view their own triage records
CREATE POLICY "Users can view their own triage records"
ON public.triage_records FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Users can insert their own triage records
CREATE POLICY "Users can insert their own triage records"
ON public.triage_records FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Admins can view all triage records
CREATE POLICY "Admins can view all triage records"
ON public.triage_records FOR SELECT
USING (has_role(auth.uid(), 'admin'));
```

#### Tabel `referrals`
```sql
-- Users can view referrals for their triages
CREATE POLICY "Users can view referrals for their triages"
ON public.referrals FOR SELECT
USING (
  EXISTS (SELECT 1 FROM triage_records tr 
          WHERE tr.id = referrals.triage_id 
          AND tr.user_id = auth.uid())
  OR has_role(auth.uid(), 'admin')
);

-- Users can insert referrals for their triages
CREATE POLICY "Users can insert referrals for their triages"
ON public.referrals FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM triage_records tr 
          WHERE tr.id = referrals.triage_id 
          AND tr.user_id = auth.uid())
);

-- Admins can manage all referrals
CREATE POLICY "Admins can manage all referrals"
ON public.referrals FOR ALL
USING (has_role(auth.uid(), 'admin'));
```

### 8.3 Helper Function

```sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;
```

### 8.4 Trigger: Auto-create Profile

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email)
  );
  
  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'user');
  
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 9. Alur Pengguna

### 9.1 Alur Triase

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   1. Login   │────▶│ 2. Upload    │────▶│ 3. Isi Data  │
│              │     │    Foto      │     │    Klinis    │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
                                                  ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  6. Simpan   │◀────│ 5. Lihat     │◀────│ 4. Analisis  │
│   Rujukan    │     │    Hasil     │     │      AI      │
└──────────────┘     └──────────────┘     └──────────────┘
```

### 9.2 Langkah Detail

1. **Login/Register** di `/auth`
2. **Upload Foto** luka kaki (capture atau upload)
3. **Kalibrasi** (opsional): klik 2 titik pada kartu skala
4. **Isi Data Klinis**:
   - Tanda bahaya (demam, nanah, dll)
   - Durasi luka
   - Riwayat diabetes
   - Kondisi ginjal
5. **Klik "Analisis"**
6. **Lihat Hasil**:
   - Warna triase (Merah/Kuning/Hijau)
   - Probabilitas infeksi & iskemia
   - Luas luka (cm² atau %)
7. **Buat Rujukan** (jika perlu)

---

## 10. Parameter & Konfigurasi

### 10.1 File `calibration.json`

Lokasi: `/public/models/calibration.json`

```json
{
  "ischaemia_threshold": 0.5,
  "infection_threshold": 0.5,
  "clf_input_size": 256,
  "labels_4class": ["None", "Infection", "Ischaemia", "Both"]
}
```

### 10.2 Logika Triase

| Warna | Kondisi |
|-------|---------|
| **MERAH** | Ada tanda bahaya klinis ATAU p(Ischaemia-present) ≥ threshold ATAU AI top = Both ATAU (ginjal berat + infeksi kuat) |
| **KUNING** | Luka kecil & klinis aman (tidak gated) ATAU AI top = Infection/Ischaemia |
| **HIJAU** | Lainnya (termasuk "gated" - area terlalu kecil) |

### 10.3 Tanda Bahaya Klinis

```typescript
const dangerFlags = {
  fever: formData.hasFever,
  smell: formData.hasSmellPus,
  redSpread: formData.hasSpreadingRedness,
  restPain: formData.hasRestPain,
  noPulse: !formData.hasFootPulse,
  blackCold: formData.hasBlackColdSkin,
};
```

### 10.4 Bobot Internal (Tidak Ditampilkan)

```typescript
// Hanya untuk skor internal
const W_ISC = 0.45;   // Bobot iskemia
const W_INF = 0.45;   // Bobot infeksi
const W_AREA = 0.10;  // Bobot area luka
```

---

## 11. Keamanan & Privasi

### 11.1 Data Privacy

| Aspek | Implementasi |
|-------|--------------|
| Inferensi AI | 100% di browser, tidak ada data ke server eksternal |
| Penyimpanan foto | Supabase Storage dengan RLS |
| Data medis | Encrypted at rest (Supabase) |
| Akses data | Row Level Security per user |

### 11.2 Security Measures

- ✅ RLS enabled on all tables
- ✅ Roles stored in separate `user_roles` table
- ✅ Admin check via server-side function `has_role()`
- ✅ JWT-based authentication
- ✅ Auto-confirm email disabled (production recommendation)

### 11.3 Batasan Penting

> ⚠️ **DISCLAIMER**
> 
> Aplikasi ini adalah **alat bantu screening**, BUKAN pengganti diagnosis medis.
> - Hasil AI bersifat probabilistik
> - Kualitas foto mempengaruhi akurasi
> - Selalu konsultasikan dengan tenaga kesehatan
> - Jika ada tanda bahaya, rujuk dalam 48 jam

---

## 12. Cara Menjalankan

### 12.1 Prerequisites

- Node.js 18+
- npm atau bun

### 12.2 Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### 12.3 Build Production

```bash
npm run build
npm run preview
```

### 12.4 Environment Variables

Buat file `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### 12.5 Model Files

Pastikan file model ada di `/public/models/`:
- `dfu_4class.onnx` (~10-50 MB)
- `unet_wound.onnx` (~10-50 MB)
- `calibration.json` (~1 KB)

---

## 13. API Reference

### 13.1 Supabase Client

```typescript
import { supabase } from "@/integrations/supabase/client";
```

### 13.2 Database Operations

**Insert Triage Record:**
```typescript
const { data, error } = await supabase
  .from('triage_records')
  .insert([record])
  .select()
  .single();
```

**Get User's Records:**
```typescript
const { data, error } = await supabase
  .from("triage_records")
  .select(`*, referrals(*)`)
  .eq("user_id", userId)
  .order("created_at", { ascending: false });
```

**Upload Photo:**
```typescript
const { data, error } = await supabase.storage
  .from('wound-photos')
  .upload(fileName, file);
```

### 13.3 AI Inference

```typescript
import { inferDFU, loadDFUModels } from "@/lib/dfu-onnx";

// Load models (once)
await loadDFUModels();

// Run inference
const result = await inferDFU(imageUrl, {
  hasScale: true,
  mmPerPx: 0.5
});
```

---

## 14. Lampiran Teknis

### 14.1 Dependencies Utama

```json
{
  "react": "^18.3.1",
  "react-router-dom": "^6.30.1",
  "@supabase/supabase-js": "^2.75.0",
  "@tanstack/react-query": "^5.83.0",
  "onnxruntime-web": "^1.23.0",
  "tailwindcss": "latest",
  "lucide-react": "^0.462.0"
}
```

### 14.2 Contoh Response `inferDFU()`

```json
{
  "infection": {
    "topIdx": 1,
    "probs": [0.1, 0.6, 0.2, 0.1],
    "labels": ["None", "Infection", "Ischaemia", "Both"],
    "pRaw": 0.6,
    "pPresent": 0.7
  },
  "ischaemia": {
    "prob": 0.3,
    "threshold": 0.5,
    "gated": false
  },
  "seg": {
    "areaPx": 15000,
    "areaFrac": 0.05,
    "areaCm2": 2.5
  },
  "img": {
    "width": 640,
    "height": 480,
    "totalPx": 307200
  },
  "calibration": {
    "ischaemia_threshold": 0.5,
    "infection_threshold": 0.5,
    "clf_input_size": 256
  },
  "model": {
    "sha256": "abc123...",
    "nearConstant": false,
    "preprocess": "EFFICIENTNET_TF",
    "quality": 0.4
  }
}
```

### 14.3 Peta Routing

| Route | Page | Access |
|-------|------|--------|
| `/` | Index (Triage) | Authenticated |
| `/auth` | Login/Register | Public |
| `/history` | User History | Authenticated |
| `/admin` | Admin Dashboard | Admin only |
| `*` | 404 Not Found | Public |

### 14.4 UI Component Map

```
shadcn/ui components used:
├── Button
├── Card, CardHeader, CardContent, CardTitle
├── Input
├── Label
├── RadioGroup, RadioGroupItem
├── Checkbox
├── Select, SelectContent, SelectItem
├── Textarea
├── Badge
├── Table, TableHeader, TableRow, TableCell
├── Collapsible
├── Dialog
├── Toast, Toaster
└── Tooltip
```

---

## Changelog

| Tanggal | Versi | Perubahan |
|---------|-------|-----------|
| 2025-12-03 | 1.0 | Initial documentation |

---

**Dokumen ini dibuat secara otomatis berdasarkan analisis source code proyek DERMA-DFU.ID.**
