# CHANGELOG — Audit Fix untuk Deploy (2026-07-22)

Perubahan yang dilakukan untuk menyelaraskan web dengan model ResNet50 hasil training BAB 5 skripsi Ferri Krisdiantoro. Beberapa perubahan bersifat **breaking** — model, preprocessing, dan threshold berubah total.

## ✅ Perubahan yang sudah diterapkan

### 1. Model Classifier: DenseNet121 → ResNet50

| Sebelum | Sesudah |
|---|---|
| `dfu_4class.onnx` (DenseNet121, 14.82 MB, producer: `functional_1/densenet121_1/...`) | `dfu_4class.onnx` (ResNet50, 48.30 MB, producer: `ResNet50_DFU_Classifier`) |

**File lama disimpan sebagai backup:** `public/models/dfu_4class_DENSENET_OLD.onnx` — bisa dihapus setelah verifikasi produksi.

**Model baru** berasal dari `D:\Kuliah\Skripsi\SKRIPSI\Revisi\BAB 5 - Hasil Training\dfu_artifacts\onnx_model.onnx` — output notebook `dfu_classification_resnet50.ipynb` (BAB 5 best config: LR 1e-3, Dropout 0.2, Unfreeze 60%).

### 2. Preprocessing: EfficientNet TF-style → ResNet50 Caffe-style

**File:** `src/lib/dfu-onnx.ts`

Sebelum (SALAH untuk model baru):
```ts
arr[j++] = out[i]     / 127.5 - 1.0; // R  (EfficientNet TF style)
arr[j++] = out[i + 1] / 127.5 - 1.0; // G
arr[j++] = out[i + 2] / 127.5 - 1.0; // B
```

Sesudah (matched dengan `tf.keras.applications.resnet50.preprocess_input` mode `'caffe'`):
```ts
arr[j++] = out[i + 2] - 103.939; // B  (swap RGB->BGR)
arr[j++] = out[i + 1] - 116.779; // G
arr[j++] = out[i]     - 123.68;  // R  (subtract ImageNet mean per channel)
```

Fungsi dinamai ulang: `makeClfInputEff` → `makeClfInputResNet50`.
Sanity check tensor range juga disesuaikan: `[-1, 1]` → `[-125, 152]` (rentang realistis pasca `-mean`).

Label preprocessing: `"EFFICIENTNET_TF"` → `"RESNET50_CAFFE"`.

### 3. Threshold biner (calibration.json)

Sebelum (asal tidak diketahui):
```json
{
  "ischaemia_threshold": 0.62,
  "infection_threshold": 0.57
}
```

Sesudah (dari Youden's J validation set BAB 5 best model):
```json
{
  "ischaemia_threshold": 0.5367,
  "infection_threshold": 0.2884
}
```

Nilai baru diambil dari `best_config_summary.json`. `test_metrics` juga ditambahkan sebagai audit trail (Accuracy 0.8427, Kappa 0.7440, AUC Inf 0.9255, AUC Isch 0.9851, Parity 100%).

**⚠ Dampak klinis:** Ischaemia threshold turun dari 0.62 → 0.5367 = lebih SENSITIF terhadap iskemia. Threshold Infection turun dari 0.57 → 0.2884 = SANGAT SENSITIF (banyak false positive infection, tapi mengurangi missed cases — sesuai preferensi klinis medis).

### 4. WASM ONNX Runtime: CDN → self-hosted

**File:** `src/lib/dfu-onnx.ts`

Sebelum (bergantung CDN, mati kalau versi 1.23.0 dihapus dari jsDelivr):
```ts
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.23.0/dist/";
```

Sesudah (pakai file lokal yang sudah di-copy oleh `vite-plugin-static-copy`):
```ts
ort.env.wasm.wasmPaths = "/ort/";
```

Bundle deploy akan lebih besar (~60 MB tambahan WASM), tapi self-hosted = tidak ada single-point-of-failure eksternal.

### 5. SPA Fallback (Vercel + Netlify)

Sebelum: refresh browser di `/auth`, `/history`, `/admin`, `/chat/:id` → **404** di static host.

Sesudah: tambah 3 file konfigurasi routing:

- `vercel.json` — semua path rewrite ke `/index.html` + cache header untuk model & WASM
- `netlify.toml` — build + redirect + header cache
- `public/_redirects` — Netlify legacy fallback

---

## ⚠️ Yang MASIH belum diperbaiki (rekomendasi tindak lanjut)

### A. Grad-CAM di web — TIDAK ADA implementasi

Web saat ini menampilkan **mask segmentasi U-Net** sebagai overlay merah (`DFUAnalyzer.tsx:101-134`, `Triage.tsx:386-394`), **bukan** Grad-CAM classifier.

ONNX Runtime Web tidak mendukung autograd/backward pass, sehingga Grad-CAM murni client-side tidak trivial. Tiga opsi ke depan:

1. **Precompute Grad-CAM di server** (Python) → upload PNG heatmap ke Supabase storage → tampilkan di UI. Paling praktis, tapi butuh backend endpoint.
2. **Score-CAM client-side** — export ulang ONNX dari notebook yang output-nya `[softmax, feature_map_conv5_block3_out]`, lalu implementasi Score-CAM forward-only di TypeScript (butuh N forward pass per gambar).
3. **Klarifikasi di tesis** — turunkan klaim jadi "rancangan target arsitektur", implementasi client-side masuk "saran pengembangan" BAB 6.

Opsi 3 paling aman untuk skripsi sekarang, kombinasi dengan opsi 1 untuk deploy produksi ke depan.

### B. Row-Level Security Supabase (KRITIS PRIVASI)

Migrasi awal `supabase/migrations/20251011174228_*.sql:44-70` memberi policy `USING (true) WITH CHECK (true)` pada:
- Table `triage_records`
- Table `referrals`
- Storage bucket `wound-photos` (juga di-set `public: true`)

**Konsekuensi:** siapa pun (bahkan tanpa login) berpotensi read/insert data pasien lain.

**Aksi wajib sebelum go-live:**
1. Verifikasi migrasi berikutnya (`20251013*`, `20251210*`) sudah `DROP POLICY` yang open dan mengganti dengan `USING (auth.uid() = user_id)`.
2. Ganti bucket `wound-photos` dari public → private. Pakai `.createSignedUrl(path, expiresIn)` untuk render foto di UI, bukan `.getPublicUrl()`.
3. Test dari akun user berbeda apakah bisa access data user lain.

### C. `DFUAnalyzer.tsx` dead code

Komponen `src/features/triage/DFUAnalyzer.tsx` tidak diimpor di App.tsx atau Index.tsx — dead 340 baris. Aksi: hapus atau tambahkan route eksplisit.

### D. README.md perlu update

Beberapa klaim di README kini tidak akurat:
- Line 108-114: "Custom EfficientNet-based CNN" → sekarang **ResNet50**
- Line 178: threshold ischaemia 62% → sekarang **53.67%**
- Line 402-403: URL repo tidak sinkron dengan folder
- Line 178+: dev port disebut 5173 padahal `vite.config.ts:10` set 8080
- Line 781+: Grad-CAM disebut "roadmap Q3-Q4 2026" → sesuaikan dengan strategi Grad-CAM yang dipilih (lihat poin A)

---

## 🔬 Verifikasi

Model + preprocessing baru sudah diuji parity:
- Input format: `[1, 256, 256, 3]` NHWC float32 ✅
- Output format: `[1, 4]` softmax ✅
- Softmax sum = 1 untuk semua input test ✅
- Output berubah sesuai variasi input (bukan constant output) ✅

**Rekomendasi lanjutan:** setelah deploy, uji dengan minimal 20 gambar test set dari `test_predictions.csv` — bandingkan argmax web ↔ Python. Target agreement ≥95%.

---

## 📋 Ringkasan file yang berubah

- `public/models/dfu_4class.onnx` (SWAP: DenseNet → ResNet50 48 MB)
- `public/models/dfu_4class_DENSENET_OLD.onnx` (BACKUP model lama)
- `public/models/calibration.json` (UPDATE: threshold + metadata)
- `src/lib/dfu-onnx.ts` (preprocessing + WASM path)
- `vercel.json` (BARU — SPA fallback + cache)
- `netlify.toml` (BARU — SPA fallback + cache)
- `public/_redirects` (BARU — Netlify legacy)
