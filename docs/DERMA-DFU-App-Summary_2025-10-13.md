# DERMA-DFU.ID
## Aplikasi Triase Luka Kaki Diabetik Berbasis AI

---

**Versi:** 1.0  
**Tanggal:** 13 Oktober 2025  
**Penanggung Jawab:** Tim DERMA-DFU  
**Logo:** [INSERT LOGO PLACEHOLDER]

---

## Daftar Isi

1. [Ringkasan Eksekutif](#ringkasan-eksekutif)
2. [Fitur Utama](#fitur-utama)
3. [Alur Pengguna](#alur-pengguna)
4. [Logika Triage](#logika-triage)
5. [Output yang Ditampilkan ke Pasien](#output-yang-ditampilkan-ke-pasien)
6. [Arsitektur & Teknologi](#arsitektur--teknologi)
7. [Parameter & Kalibrasi](#parameter--kalibrasi)
8. [Privasi, Keamanan, & Batasan](#privasi-keamanan--batasan)
9. [Cara Menjalankan](#cara-menjalankan)
10. [Roadmap & Rekomendasi](#roadmap--rekomendasi)
11. [Lampiran Teknis](#lampiran-teknis)

---

## 1. Ringkasan Eksekutif

### Tujuan Aplikasi
DERMA-DFU.ID adalah aplikasi web berbasis kecerdasan buatan (AI) yang dirancang untuk membantu tenaga kesehatan dalam melakukan triase awal terhadap luka kaki diabetik (Diabetic Foot Ulcer/DFU). Aplikasi ini memberikan penilaian cepat terhadap tingkat keparahan luka berdasarkan analisis foto, data klinis pasien, dan model pembelajaran mesin.

### Pengguna Target
- **Perawat** di layanan kesehatan primer
- **Dokter umum** di klinik dan puskesmas
- **Tenaga kesehatan** yang menangani pasien diabetes
- **Pasien diabetes** (untuk monitoring mandiri dengan supervisi medis)

### Nilai Klinis Utama
1. **Triase Otomatis** – Mengklasifikasikan luka menjadi tiga prioritas (Merah/Kuning/Hijau)
2. **Deteksi Dini** – Mendeteksi tanda infeksi dan iskemia pada tahap awal
3. **Pengukuran Objektif** – Menghitung luas luka secara otomatis dengan kalibrasi ukuran
4. **Dukungan Keputusan** – Memberikan rekomendasi tindakan berbasis bukti
5. **Dokumentasi Digital** – Menyimpan riwayat lengkap untuk monitoring dan evaluasi

---

## 2. Fitur Utama

### 2.1 Pengambilan dan Analisis Foto Luka
- **Upload Foto** dari galeri atau **Kamera Langsung** via browser
- **Preview Real-time** dengan overlay segmentasi luka
- **Kompresi Otomatis** untuk optimalisasi bandwidth (maks 10MB)
- **Format Didukung:** JPG, PNG, WEBP

### 2.2 Kalibrasi Ukuran (Opsional)
- Pengguna dapat mengukur skala pada foto menggunakan **2 titik klik**
- Input **panjang sebenarnya** dalam cm atau mm
- Default: 8.56 cm (lebar kartu standar)
- Output: **Luas luka dalam cm²** (bila dikalibrasi) atau **persentase area foto**

### 2.3 Output Analisis Sederhana
Hasil ditampilkan dalam format yang mudah dipahami:

**[INSERT SCREENSHOT: Hasil Triage]**

- **AI:** Infeksi **XX%** · Iskemia **YY%**
- **Luas luka:** **AA.bb cm²** (atau % area foto)
- **Warna Triage:** Merah / Kuning / Hijau
- **Kenapa hasil ini?** (bullet point alasan)
- **Apa yang harus dilakukan?** (bullet point tindakan)

### 2.4 Form Klinis Komprehensif
- Tanda bahaya klinis (demam, bau/nanah, kemerahan menyebar, nyeri istirahat)
- Durasi luka (dalam hari)
- Lokasi luka (jari kaki / kaki tengah / tumit)
- Riwayat diabetes dan kondisi ginjal
- ABI (Ankle-Brachial Index) opsional
- Catatan tambahan

### 2.5 Sistem Rujukan Terintegrasi
- Rujukan otomatis untuk kasus **Merah** dan **Kuning**
- Pilihan tipe konsultasi: **Tatap Muka / Video / Telepon**
- Penjadwalan dan tracking status rujukan
- Notifikasi follow-up

### 2.6 Dashboard Monitoring
- **Indikator Kinerja:** Waktu ke rujukan, tingkat penyelesaian, kepatuhan foto
- **Distribusi Triage:** Grafik 30 hari terakhir
- **Aktivitas Terbaru:** Timeline 5 kasus terakhir
- **Ekspor Data** ke CSV untuk analisis lebih lanjut

---

## 3. Alur Pengguna

### Step-by-Step Workflow

**[INSERT DIAGRAM: Alur inferensi]**

1. **Login/Registrasi**
   - Pengguna login dengan email dan password
   - Autentikasi otomatis untuk melindungi data medis

2. **Upload/Ambil Foto Luka**
   - Pilih foto dari galeri ATAU
   - Ambil foto langsung dengan kamera perangkat
   - Preview muncul otomatis

3. **Kalibrasi Ukuran (Opsional)**
   - Klik tombol "Ukur pada Foto"
   - Klik 2 titik pada objek dengan ukuran diketahui (misal: kartu)
   - Input panjang sebenarnya (default 8.56 cm)
   - Sistem menghitung mm/pixel

4. **Isi Form Klinis**
   - Checklist tanda bahaya (demam, bau/nanah, dll.)
   - Input durasi luka, lokasi, riwayat diabetes
   - Kondisi ginjal dan ABI (bila tersedia)

5. **Analisis AI**
   - Klik tombol "Analisis"
   - Sistem memproses foto (3-10 detik)
   - Model AI mendeteksi:
     - Segmentasi area luka
     - Probabilitas infeksi
     - Probabilitas iskemia

6. **Hasil Triage**
   - Warna triage ditampilkan: **MERAH / KUNING / HIJAU**
   - Informasi lengkap:
     - Persentase infeksi dan iskemia
     - Luas luka (cm² atau % area foto)
     - Alasan hasil (3-5 bullet point)
     - Rekomendasi tindakan (3-5 bullet point)

7. **Tindak Lanjut**
   - **MERAH:** Modal rujukan otomatis muncul → pilih fasilitas & jadwal
   - **KUNING:** Opsi rujukan tersedia → bisa jadwalkan tele-konsultasi
   - **HIJAU:** Edukasi perawatan mandiri → simpan untuk monitoring

8. **Riwayat & Monitoring**
   - Semua hasil tersimpan di menu "Riwayat"
   - Dashboard untuk tenaga kesehatan: tracking KPI dan tren

---

## 4. Logika Triage

### 4.1 Model AI 4-Kelas

Sistem menggunakan model klasifikasi dengan **4 kelas output:**

| Kelas | Label | Deskripsi |
|-------|-------|-----------|
| 0 | **None** | Tidak ada infeksi atau iskemia |
| 1 | **Infection** | Hanya infeksi terdeteksi |
| 2 | **Ischaemia** | Hanya iskemia terdeteksi |
| 3 | **Both** | Infeksi DAN iskemia terdeteksi |

Output model berupa **probabilitas softmax** untuk keempat kelas, yang kemudian diproses untuk mendapatkan:
- **p(Infection-present)** = P(Infection) + P(Both)
- **p(Ischaemia-present)** = P(Ischaemia) + P(Both)

### 4.2 Kriteria Triase Merah-Kuning-Hijau

**Tabel Keputusan Triase:**

| Prioritas | Kriteria Utama | Contoh Keputusan |
|-----------|---------------|------------------|
| **MERAH** (Urgent) | • Tanda bahaya klinis (demam, bau/nanah, kemerahan menyebar, nyeri istirahat, kulit hitam/dingin, tidak ada denyut kaki)<br>• p(Ischaemia-present) ≥ threshold (default 0.62)<br>• AI top class = "Both"<br>• Ginjal berat/hemodialisis + infeksi kuat terdeteksi | Pasien dengan demam + nanah berbau → MERAH<br>Iskemia 75% → MERAH<br>Hemodialisis + infeksi 65% → MERAH |
| **KUNING** (Observation) | • Tidak ada kriteria Merah<br>• Luka baru (<14 hari) & area kecil & klinis aman<br>• AI top class = Infection atau Ischaemia (tanpa Both)<br>• Borderline iskemia (2-5% di bawah threshold) | Luka 7 hari, area 2%, tidak demam → KUNING<br>Iskemia 60% (borderline) → KUNING |
| **HIJAU** (Self-care) | • Tidak ada kriteria Merah atau Kuning<br>• Area luka sangat kecil (gated: <1% area foto)<br>• Klinis stabil tanpa komorbid berat | Area luka <1% → HIJAU<br>Luka kecil, pasien stabil → HIJAU |

### 4.3 Parameter Keputusan

**Bobot AI Internal (hanya untuk skor ringkas, tidak ditampilkan ke pasien):**
- W_ISCHAEMIA = 0.45
- W_INFECTION = 0.45
- W_AREA = 0.10

**Threshold Default:**
- ISCHAEMIA_THRESHOLD = 0.62 (dari calibration.json)
- INFECTION_THRESHOLD = 0.57 (dari calibration.json)
- MIN_WOUND_FRAC = 0.01 (1% dari total area foto)

### 4.4 Gating Mechanism

Bila **luas luka < 1%** dari total area foto:
- Sistem mengabaikan output classifier
- Otomatis set hasil = "None" (Kelas 0)
- Triage = **HIJAU**
- Alasan: Area terlalu kecil untuk analisis AI yang reliable

---

## 5. Output yang Ditampilkan ke Pasien

### 5.1 Hasil Utama (Non-Teknis)

**[INSERT SCREENSHOT: Upload & Preview]**

#### AI: Infeksi **XX%** · Iskemia **YY%**
- Angka persentase probabilitas infeksi dan iskemia
- Dihitung dari kombinasi kelas AI (lihat bagian 4.1)

#### Luas Luka: **AA.bb cm²**
- Bila dikalibrasi: luas dalam cm²
- Bila tidak dikalibrasi: persentase area foto (contoh: 3.2% dari foto)

### 5.2 Kenapa Hasil Ini?

Sistem memberikan 3-5 bullet point alasan, contoh:
- ✓ **Ada tanda bahaya klinis** (demam, bau/nanah)
- ✓ **Iskemia di atas ambang (present)** (62%)
- ✓ **AI: Infeksi + Iskemia (Both)** terdeteksi
- ✓ **Penyakit ginjal berat + infeksi** terdeteksi
- ✓ **Luka baru (<14 hari), area kecil** – observasi ketat

### 5.3 Apa yang Harus Dilakukan?

Rekomendasi tindakan disesuaikan dengan warna triage:

#### MERAH (Urgent):
- ⚠️ **Rujuk ke dokter spesialis/RS segera** (maksimal 24 jam)
- ⚠️ **Jangan tunda**, risiko komplikasi tinggi
- ⚠️ **Bawa hasil triage ini** saat konsultasi

#### KUNING (Observation):
- 📞 **Tele-konsultasi dengan dokter** dalam 3-7 hari
- 📋 **Monitor tanda infeksi** (demam, nanah, bau)
- 🩹 **Perawatan luka rutin** sesuai panduan
- 📸 **Foto ulang** setiap 3-5 hari

#### HIJAU (Self-care):
- ✅ **Perawatan mandiri** dengan panduan edukasi
- 🧴 **Jaga kebersihan luka** dan ganti perban teratur
- 🍎 **Kontrol gula darah** tetap stabil
- 📅 **Kontrol rutin** ke klinik sesuai jadwal
- 📸 **Foto ulang bila luka membesar** atau muncul gejala baru

---

## 6. Arsitektur & Teknologi

### 6.1 Stack Teknologi

**Frontend:**
- **React 18** dengan TypeScript
- **Vite** sebagai build tool
- **Tailwind CSS** untuk styling responsif
- **Shadcn/UI** untuk komponen UI konsisten
- **React Router** untuk navigasi multi-halaman

**Backend & Database:**
- **Lovable Cloud** (Supabase)
- **PostgreSQL** dengan Row Level Security (RLS)
- **Supabase Auth** untuk autentikasi user
- **Supabase Storage** untuk penyimpanan foto luka

**AI/ML:**
- **ONNX Runtime Web (WASM)** untuk inferensi di browser
- **Model Klasifikasi:** EfficientNet-based 4-class softmax
- **Model Segmentasi:** U-Net untuk deteksi area luka
- **Preprocessing:** TensorFlow-style normalization (x/127.5 - 1)

### 6.2 Komponen Utama

**Halaman:**
- `/` – Landing page dengan navigasi utama
- `/triage` – Form dan analisis DFU (komponen utama)
- `/dashboard` – KPI dan monitoring untuk tenaga kesehatan
- `/history` – Riwayat triage pasien
- `/education` – Materi edukasi perawatan luka
- `/auth` – Login dan registrasi
- `/admin` – Panel admin (role-based access)

**Komponen Kunci:**
- `DFUAnalyzer.tsx` – UI analyzer dengan canvas overlay
- `CameraCapture.tsx` – Integrasi kamera browser
- `ReferralModal.tsx` – Form rujukan
- `Layout.tsx` – Navigasi responsif dengan tab

**Library AI:**
- `src/lib/dfu-onnx.ts` – Wrapper ONNX Runtime (446 baris)
  - Fungsi: `inferDFU()`, `loadDFUModels()`, `runClassifier()`, `runSegmenter()`
  - Kalibrasi: `loadCalibration()` dari `/models/calibration.json`

### 6.3 Hosting WASM

**Opsi CDN untuk WASM (menghindari COOP/COEP):**
- jsDelivr: `https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/`
- unpkg: `https://unpkg.com/onnxruntime-web@1.23.0/dist/`

**Konfigurasi Non-SIMD, Single-Thread:**
```typescript
ort.env.wasm.proxy = false;
ort.env.wasm.simd = false;
ort.env.wasm.numThreads = 1;
```

### 6.4 Database Schema

**Tabel Utama:**
- `triage_records` – Data hasil triage + AI output
- `referrals` – Data rujukan dan follow-up
- `profiles` – Profil user tambahan
- `user_roles` – Role-based access control

**RLS Policies:**
- User hanya bisa CRUD data mereka sendiri
- Admin bisa view semua data (untuk monitoring)
- Orphaned records (user_id NULL) telah dihapus untuk keamanan

---

## 7. Parameter & Kalibrasi

### 7.1 Tabel Parameter Default

| Parameter | Nilai Default | Sumber | Deskripsi |
|-----------|---------------|--------|-----------|
| `CLASS4_LABELS` | `["None","Infection","Ischaemia","Both"]` | dfu-onnx.ts | Label kelas AI |
| `ISCH_THRESHOLD` | 0.62 | calibration.json | Ambang p(Ischaemia-present) |
| `INF_THRESHOLD` | 0.57 | calibration.json | Ambang p(Infection-present) |
| `CLF_INPUT_SIZE` | 256 | calibration.json | Ukuran input classifier (px) |
| `SEG_INPUT_SIZE` | 512 | dfu-onnx.ts | Ukuran input segmenter (px) |
| `SEG_THRESHOLD` | 0.5 | dfu-onnx.ts | Threshold segmentasi mask |
| `MIN_WOUND_FRAC` | 0.01 | dfu-onnx.ts | Gate: 1% area foto |
| `W_ISC` | 0.45 | Triage.tsx | Bobot skor iskemia (internal) |
| `W_INF` | 0.45 | Triage.tsx | Bobot skor infeksi (internal) |
| `W_AREA` | 0.10 | Triage.tsx | Bobot skor area (internal) |

### 7.2 File Kalibrasi

**Lokasi:** `/public/models/calibration.json`

**Contoh Isi:**
```json
{
  "ischaemia_threshold": 0.62,
  "infection_threshold": 0.57,
  "labels_4class": ["None","Infection","Ischaemia","Both"],
  "clf_input_size": 256
}
```

**Cara Menggunakan:**
1. Edit file `calibration.json` di folder `public/models/`
2. Sesuaikan threshold berdasarkan validasi klinis lokal
3. Deploy ulang aplikasi
4. Parameter akan dimuat otomatis saat startup

---

## 8. Privasi, Keamanan, & Batasan

### 8.1 Privasi Data

**Proses Lokal di Browser:**
- Model AI berjalan 100% di browser pengguna (WASM)
- Foto tidak dikirim ke server pihak ketiga untuk inferensi
- Hanya hasil akhir yang disimpan ke database (bila user login)

**Penyimpanan:**
- Foto luka disimpan di Supabase Storage (encrypted at rest)
- Database dilindungi dengan Row Level Security (RLS)
- User hanya bisa akses data mereka sendiri

### 8.2 Keamanan

**Autentikasi:**
- Email/password dengan auto-confirm signup
- Session-based authentication
- Logout otomatis setelah inaktif

**Row Level Security (RLS):**
- Policy INSERT: user hanya bisa insert data dengan user_id mereka
- Policy SELECT: user hanya bisa view data mereka, admin bisa view semua
- Policy UPDATE: user bisa update profil mereka
- Orphaned records (user_id NULL) telah dihapus

**Audit Trail:**
- Semua triage tercatat dengan timestamp
- Riwayat rujukan tersimpan untuk evaluasi

### 8.3 Batasan dan Disclaimer

**⚠️ PENTING: Rekomendasi Bukan Diagnosis**
- Hasil AI adalah **alat bantu**, bukan pengganti penilaian klinis dokter
- Keputusan akhir tetap di tangan tenaga kesehatan profesional
- Tidak dimaksudkan untuk digunakan tanpa supervisi medis

**Kualitas Foto:**
- Pencahayaan buruk dapat mempengaruhi akurasi
- Foto blur atau terpotong tidak dapat dianalisis dengan baik
- Rekomendasi: foto closeup dengan pencahayaan cukup, fokus tajam

**Akurasi Model:**
- Model dilatih dengan dataset spesifik (perlu validasi lokal)
- Threshold default mungkin perlu disesuaikan untuk populasi berbeda
- Gating mechanism mengabaikan luka sangat kecil (<1% area)

**Rujukan Klinis Wajib:**
- Semua kasus **MERAH** harus dirujuk dalam 24 jam
- Kasus **KUNING** perlu evaluasi dokter dalam 3-7 hari
- Kasus **HIJAU** tetap perlu monitoring rutin

---

## 9. Cara Menjalankan

### 9.1 Development

**Prerequisites:**
- Node.js v18+ atau Bun
- npm/yarn/bun package manager

**Install Dependencies:**
```bash
npm install
# atau
bun install
```

**Run Development Server:**
```bash
npm run dev
# atau
bun dev
```

Aplikasi berjalan di `http://localhost:5173`

### 9.2 Build Production

```bash
npm run build
# atau
bun build
```

Output di folder `dist/` siap di-deploy ke hosting statis.

### 9.3 Environment Variables

**File `.env` (auto-generated oleh Lovable Cloud):**
```
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[anon-key]
VITE_SUPABASE_PROJECT_ID=[project-id]
```

**⚠️ Jangan edit manual!** File ini dikelola otomatis oleh sistem.

### 9.4 Catatan WASM/CDN

**Model Files:**
- `public/models/dfu_4class.onnx` (~20-50 MB)
- `public/models/unet_wound.onnx` (~10-30 MB)
- `public/models/calibration.json` (<1 KB)

**WASM Files (via CDN):**
- `ort-wasm.wasm` (~5 MB) – loaded dari jsDelivr
- `ort-wasm-simd.wasm` (disabled untuk kompatibilitas)

**Optimisasi:**
- WASM files di-cache oleh browser
- Model ONNX di-cache dengan `cache-control`
- Foto di-compress sebelum upload (<10 MB)

---

## 10. Roadmap & Rekomendasi

### 10.1 Roadmap Jangka Pendek (3-6 bulan)

1. **Validasi Klinis Lokal**
   - Kumpulkan dataset lokal (min. 200 sampel)
   - Kalibrasi threshold berdasarkan sensitivitas/spesifisitas target
   - Update `calibration.json` dengan nilai optimal

2. **Audit Keamanan**
   - Penetration testing
   - HIPAA/ISO 27001 compliance check
   - Enkripsi end-to-end untuk foto sensitif

3. **Monitoring & Analytics**
   - Integrasi Google Analytics atau Plausible
   - Dashboard real-time untuk tim klinis
   - Alert otomatis untuk kasus kritis

4. **Internationalization (i18n)**
   - Terjemahan lengkap ke Bahasa Inggris
   - Dukungan bahasa daerah (Jawa, Sunda, dll.)
   - RTL support untuk bahasa Arab (ekspansi regional)

### 10.2 Roadmap Jangka Panjang (6-12 bulan)

1. **Optimisasi Model**
   - Quantization untuk model lebih kecil (<10 MB)
   - Model ensemble untuk akurasi lebih tinggi
   - Fine-tuning dengan data lokal

2. **Fitur Lanjutan**
   - **Foto Serial:** Tracking perubahan luka dari waktu ke waktu
   - **AI Assistant:** Chatbot untuk tanya jawab pasien
   - **Integrasi EMR:** Export data ke sistem rekam medis elektronik

3. **Mobile App**
   - React Native atau Progressive Web App (PWA)
   - Offline mode dengan sinkronisasi data
   - Push notification untuk follow-up

4. **Telemedicine Integration**
   - Video call langsung dengan dokter
   - Resep digital dan e-pharmacy
   - Payment gateway untuk konsultasi berbayar

### 10.3 Rekomendasi Implementasi

**Untuk Tenaga Kesehatan:**
- ✅ **Gunakan sebagai screening tool** untuk prioritas kasus
- ✅ **Validasi hasil AI** dengan pemeriksaan fisik
- ✅ **Monitor KPI** via dashboard untuk evaluasi program
- ✅ **Update kalibrasi** setiap 3-6 bulan berdasarkan outcome

**Untuk Administrator:**
- ✅ **Backup data** mingguan (Supabase auto-backup)
- ✅ **Review security logs** bulanan
- ✅ **Update dependency** untuk patch keamanan
- ✅ **Training ulang model** bila ada dataset baru signifikan

**Untuk Pasien:**
- ✅ **Konsultasi dokter** untuk interpretasi hasil
- ✅ **Foto berkala** untuk monitoring progres
- ✅ **Patuhi rekomendasi** tindakan dari sistem
- ✅ **Kontrol gula darah** sesuai target terapi

---

## 11. Lampiran Teknis

### 11.1 Skema Data Output `inferDFU()`

**Fungsi:** `inferDFU(imageUrl: string, opts?: InferOpts): Promise<InferOutput>`

**Output Interface:**
```typescript
{
  infection: {
    topIdx: number,          // 0=None, 1=Infection, 2=Ischaemia, 3=Both
    probs: number[],         // [p(None), p(Infection), p(Ischaemia), p(Both)]
    labels: string[],        // ["None","Infection","Ischaemia","Both"]
    pRaw: number,            // P(class=Infection)
    pPresent: number         // P(Infection-present) = P(Infection) + P(Both)
  },
  ischaemia: {
    prob: number,            // P(Ischaemia-present) = P(Ischaemia) + P(Both)
    threshold: number,       // Threshold dari calibration.json (default 0.62)
    gated: boolean           // True bila area luka < MIN_WOUND_FRAC
  },
  seg: {
    areaPx: number,          // Luas luka dalam pixel (scaled ke original image)
    areaFrac: number,        // Fraksi area luka terhadap total area foto
    areaCm2: number | null   // Luas dalam cm² (null bila tidak dikalibrasi)
  },
  img: {
    width: number,           // Lebar foto original (px)
    height: number,          // Tinggi foto original (px)
    totalPx: number          // Total pixel = width × height
  },
  calibration: {
    ischaemia_threshold: number,  // Threshold iskemia (dari calibration.json)
    infection_threshold: number,  // Threshold infeksi (dari calibration.json)
    clf_input_size: number        // Input size classifier (256)
  },
  model: {
    sha256: string,          // Hash SHA256 model ONNX untuk verifikasi
    nearConstant: boolean,   // Flag jika output model near-constant (QA check)
    preprocess: "EFFICIENTNET_TF",  // Metode preprocessing
    quality: number          // Internal quality score
  }
}
```

### 11.2 Peta Folder Penting

```
derma-dfu-app/
├── public/
│   └── models/
│       ├── dfu_4class.onnx          # Model klasifikasi 4-kelas
│       ├── unet_wound.onnx          # Model segmentasi U-Net
│       └── calibration.json         # Parameter kalibrasi
├── src/
│   ├── pages/
│   │   ├── Triage.tsx               # Halaman utama analisis DFU
│   │   ├── Dashboard.tsx            # KPI monitoring
│   │   ├── History.tsx              # Riwayat triage
│   │   ├── Education.tsx            # Materi edukasi
│   │   ├── Auth.tsx                 # Login/register
│   │   └── Admin.tsx                # Panel admin
│   ├── components/
│   │   ├── CameraCapture.tsx        # Komponen kamera
│   │   ├── ReferralModal.tsx        # Form rujukan
│   │   ├── Layout.tsx               # Navigasi utama
│   │   └── ui/                      # Shadcn UI components
│   ├── features/
│   │   └── triage/
│   │       └── DFUAnalyzer.tsx      # Analyzer dengan canvas overlay
│   ├── lib/
│   │   ├── dfu-onnx.ts              # Library ONNX Runtime (AI engine)
│   │   └── utils.ts                 # Helper functions
│   ├── contexts/
│   │   └── LanguageContext.tsx      # i18n (ID/EN)
│   └── integrations/
│       └── supabase/
│           ├── client.ts            # Supabase client (auto-generated)
│           └── types.ts             # Database types (auto-generated)
├── supabase/
│   ├── config.toml                  # Supabase config (auto-generated)
│   └── migrations/                  # Database migrations
└── docs/
    └── DERMA-DFU-App-Summary_2025-10-13.md  # Dokumen ini
```

### 11.3 Contoh File Kalibrasi

**File:** `public/models/calibration.json`

```json
{
  "ischaemia_threshold": 0.62,
  "infection_threshold": 0.57,
  "labels_4class": [
    "None",
    "Infection",
    "Ischaemia",
    "Both"
  ],
  "clf_input_size": 256
}
```

**Penjelasan:**
- `ischaemia_threshold`: Ambang batas untuk menentukan iskemia positif (default 62%)
- `infection_threshold`: Ambang batas untuk menentukan infeksi positif (default 57%)
- `labels_4class`: Label kelas sesuai urutan output model
- `clf_input_size`: Ukuran resize input untuk classifier (256x256px)

**Cara Update:**
1. Edit file dengan text editor
2. Sesuaikan threshold berdasarkan hasil validasi klinis
3. Simpan dan deploy ulang aplikasi
4. Test dengan dataset validasi untuk memastikan performa optimal

---

## Catatan Akhir

Dokumen ini merupakan **snapshot** dari aplikasi DERMA-DFU.ID pada tanggal **13 Oktober 2025**. Aplikasi ini terus berkembang dan diperbarui berdasarkan feedback klinis dan kebutuhan pengguna.

Untuk pertanyaan lebih lanjut atau dukungan teknis, silakan hubungi:
- **Email:** support@derma-dfu.id
- **GitHub:** github.com/derma-dfu/app
- **Dokumentasi:** docs.derma-dfu.id

---

**© 2025 DERMA-DFU Team. All rights reserved.**

---

## Placeholder untuk Gambar

Berikut adalah placeholder yang perlu diganti dengan gambar/diagram sebenarnya:

1. **[INSERT LOGO PLACEHOLDER]** – Logo aplikasi DERMA-DFU.ID
2. **[INSERT SCREENSHOT: Hasil Triage]** – Screenshot halaman hasil triage dengan warna dan rekomendasi
3. **[INSERT SCREENSHOT: Upload & Preview]** – Screenshot proses upload foto dan preview dengan overlay
4. **[INSERT DIAGRAM: Alur inferensi]** – Flowchart alur kerja dari upload foto hingga hasil triage

---

**Catatan Konversi ke .docx:**

Untuk mengkonversi Markdown ini ke format Microsoft Word (.docx), gunakan salah satu metode berikut:

1. **Pandoc (Recommended):**
   ```bash
   pandoc DERMA-DFU-App-Summary_2025-10-13.md -o DERMA-DFU-App-Summary_2025-10-13.docx
   ```

2. **Microsoft Word:**
   - Open Word → File → Open → pilih file .md ini
   - Word akan auto-convert Markdown ke format dokumen
   - Save As → .docx

3. **Online Converter:**
   - Cloudconvert.com
   - Markdowntoword.com

Setelah konversi, tambahkan:
- Cover page dengan logo
- Table of Contents otomatis (Insert → Table of Contents)
- Header/Footer dengan nama aplikasi & nomor halaman
- Ganti placeholder dengan gambar/diagram sebenarnya
- Format tabel agar lebih rapih dengan border dan shading