// app/triage.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Upload, AlertTriangle, CheckCircle, AlertCircle, Ruler, X } from "lucide-react";
import { toast } from "sonner";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ReferralModal } from "@/components/ReferralModal";
import { CameraCapture } from "@/components/CameraCapture";

// ONNX helpers (4-class already supported)
import { loadDFUModels, inferDFU } from "@/lib/dfu-onnx";
import { CLF_MODEL_SHA, CLF_MODEL_CHECK } from "@/lib/dfu-onnx";

// Supabase
import { supabase } from "@/integrations/supabase/client";

/* ===================== TRIAGE PARAMS (4-class) =====================
   Kelas: 0=None, 1=Infection, 2=Ischaemia, 3=Both
   - RED: tanda bahaya klinis / p(Ischaemia-present) ≥ ambang / AI top=Both
          / (ginjal berat/hemodialisis + infeksi terdeteksi kuat)
   - YELLOW: luka kecil & klinis aman (bila TIDAK gated) atau top=Inf/Isch
   - GREEN: lainnya (termasuk "gated" = area terlalu kecil)

   >>> PERUBAHAN BOBOT (HANYA KOMPONEN AI):
       W_ISC = 0.45, W_INF = 0.45, W_AREA = 0.10
       (aturan klinis & flag lain TETAP sama)
===================================================================== */

type TriageColor = "red" | "yellow" | "green";
const CLASS_IDX = { NONE: 0, INF: 1, ISCH: 2, BOTH: 3 } as const;

const ISCH_BORDER_BELOW = 0.02;

// Bobot skor ringkas (AI seimbang 4-kelas) — dipakai untuk internal score, tidak ditampilkan
const W_ISC = 0.45;
const W_INF = 0.45;
const W_AREA = 0.10;

interface TriageFormData {
  photo?: File;
  hasScaleCard: boolean;
  hasFever: boolean;
  hasSmellPus: boolean;
  hasSpreadingRedness: boolean;
  hasRestPain: boolean;
  hasFootPulse: boolean;
  woundDuration: string;
  woundLocation: string; // toes | midfoot | heel
  diabetesHistory: string;
  kidneyCondition: string; // none | mild | severe | hemodialysis
  abiValue: string;
  hasBlackColdSkin: boolean;
  notes: string;
}

/** Preview downscale */
async function makePreviewObjectURL(file: File, maxDim = 1280): Promise<string> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!; ctx.imageSmoothingEnabled = true; ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.85));
    return URL.createObjectURL(blob);
  } catch {
    return URL.createObjectURL(file);
  }
}

async function ensureModelReadyOnce() {
  const g = globalThis as any;
  if (!g.__dfuLoadP) g.__dfuLoadP = loadDFUModels();
  await g.__dfuLoadP;
}

export default function Triage() {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<TriageFormData>({
    hasScaleCard: false, hasFever: false, hasSmellPus: false, hasSpreadingRedness: false,
    hasRestPain: false, hasFootPulse: true, woundDuration: "", woundLocation: "",
    diabetesHistory: "", kidneyCondition: "none", abiValue: "", hasBlackColdSkin: false, notes: "",
  });

  const [preview, setPreview] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Auth & Database
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentTriageId, setCurrentTriageId] = useState<string | null>(null);

  // ===== Overlay & kalibrasi (klik 2 titik) =====
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [measuring, setMeasuring] = useState(false);
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const [pxDist, setPxDist] = useState<number | null>(null);

  // unit (mm/cm) dan nilai panjang nyata yang user isi
  const [unit, setUnit] = useState<"mm" | "cm">("cm");
  const [realLen, setRealLen] = useState<number>(8.56); // default: 8.56 cm = 85.6 mm (lebar kartu)

  // hasil/flag
  const [triageResult, setTriageResult] = useState<TriageColor | null>(null);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [modelReady, setModelReady] = useState(false);
  const [loading, setLoading] = useState(false);

  // Ringkasan publik yang ditampilkan (disederhanakan)
  const [publicSummary, setPublicSummary] = useState<{
    pInfPct?: number;
    pIscPct?: number;
    areaPx?: number;
    areaPct?: number;
    areaCm2?: number | null;
    why: string[];
    what: string[];
  } | null>(null);

  const inFlightRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [preview, blobUrl]);

  // Check auth on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUser(user);
    }
  };

  const saveTriageToDatabase = async (
    triageColor: TriageColor,
    aiData: any,
    summary: any
  ) => {
    try {
      // DEMO MODE: kalau belum login, skip DB save biar tetap bisa dipakai.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log("[demo] skip save to DB — user not logged in");
        return null;
      }

      let photoUrl = null;

      // Upload photo to storage
      if (formData.photo) {
        const fileExt = formData.photo.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('wound-photos')
          .upload(fileName, formData.photo);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          toast.error(t("Gagal mengunggah foto", "Failed to upload photo"));
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('wound-photos')
            .getPublicUrl(uploadData.path);
          photoUrl = publicUrl;
        }
      }

      // Prepare triage record
      const topIdx = aiData?.infection?.topIdx ?? null;
      const probs = Array.isArray(aiData?.infection?.probs) ? aiData.infection.probs : [];
      const topProb = topIdx !== null && probs[topIdx] !== undefined ? probs[topIdx] : null;

      const CLASS_LABELS = ["None", "Infection", "Ischaemia", "Both"];
      const topClassName = topIdx !== null && CLASS_LABELS[topIdx] ? CLASS_LABELS[topIdx] : null;

      const realMm = unit === "cm" ? (realLen * 10) : realLen;
      const mmPerPx = (pxDist && realMm > 0) ? (realMm / pxDist) : null;

      const record = {
        user_id: user.id,
        photo_url: photoUrl,
        has_scale_card: formData.hasScaleCard,
        triage_result: triageColor,

        // Clinical data
        has_fever: formData.hasFever,
        has_smell_pus: formData.hasSmellPus,
        has_spreading_redness: formData.hasSpreadingRedness,
        has_rest_pain: formData.hasRestPain,
        has_foot_pulse: formData.hasFootPulse,
        has_black_cold_skin: formData.hasBlackColdSkin,
        wound_duration: formData.woundDuration ? parseInt(formData.woundDuration) : null,
        wound_location: formData.woundLocation || null,
        diabetes_history: formData.diabetesHistory || null,
        kidney_condition: formData.kidneyCondition || null,
        abi_value: formData.abiValue ? parseFloat(formData.abiValue) : null,
        notes: formData.notes || null,

        // AI results (4-class model)
        infection_class: topIdx,
        infection_prob: aiData?.infection?.pRaw ?? null,
        infection_prob_present: aiData?.infection?.pPresent ?? null,
        ischaemia_prob: aiData?.ischaemia?.prob ?? null,
        top_class_name: topClassName,
        top_class_prob: topProb,

        // Wound measurements
        wound_area_px: summary?.areaPx ?? null,
        wound_area_pct: summary?.areaPct ?? null,
        wound_area_cm2: summary?.areaCm2 ?? null,
        calibration_mm_per_px: mmPerPx,
        model_gated: aiData?.ischaemia?.gated ?? false,

        // Summary
        ai_summary: JSON.stringify({
          why: summary?.why || [],
          what: summary?.what || [],
          pInfPct: summary?.pInfPct,
          pIscPct: summary?.pIscPct,
        }),
      };

      const { data, error } = await supabase
        .from('triage_records')
        .insert([record])
        .select()
        .single();

      if (error) {
        console.error('Database error:', error);
        toast.error(t("Gagal menyimpan hasil triase", "Failed to save triage result"));
        return null;
      }

      return data.id;
    } catch (error) {
      console.error('Save error:', error);
      toast.error(t("Terjadi kesalahan saat menyimpan", "An error occurred while saving"));
      return null;
    }
  };

  const saveReferral = async (facility: string, scheduledDate: string, consultationType: string) => {
    if (!currentTriageId) {
      toast.error(t("Tidak ada hasil triase untuk dirujuk", "No triage result to refer"));
      return;
    }

    try {
      let doctorId = null;
      let finalFacility = facility;

      // Parse doctor ID if teleconsultation
      if (consultationType === "teleconsultation" && facility.startsWith("DOCTOR:")) {
        doctorId = facility.replace("DOCTOR:", "");
        finalFacility = "Tele-konsultasi"; // Generic name for facility
      }

      const { data, error } = await supabase
        .from('referrals')
        .insert([{
          triage_id: currentTriageId,
          facility: finalFacility,
          scheduled_date: scheduledDate,
          consultation_type: consultationType,
          status: 'pending',
          doctor_id: doctorId // Add doctor_id to the insert payload
        }])
        .select()
        .single();

      if (error) {
        // Fallback for missing doctor_id column (Demo Mode)
        if (error.code === 'PGRST204' || error.message?.includes('doctor_id') || error.code === '23514') {
          console.warn("Database mismatch (Demo Mode), retrying with compatible values...", error);
          // Retry without doctor_id and force 'video' type to satisfy legacy check constraints
          const { data: retryData, error: retryError } = await supabase
            .from('referrals')
            .insert([{
              triage_id: currentTriageId,
              facility: finalFacility,
              scheduled_date: scheduledDate,
              consultation_type: 'video', // Fallback to 'video' for legacy DB support
              status: 'pending'
              // removed doctor_id
            }])
            .select()
            .single();

          if (retryError) {
            console.error('Referral error (fallback):', retryError);
            toast.error(t("Gagal menyimpan rujukan", "Failed to save referral"));
            return;
          }

          toast.success(t("Rujukan tersimpan (Mode Demo)", "Referral saved (Demo Mode)"));

          // Navigate to chat even though we saved as 'video' in DB
          if (consultationType === "teleconsultation" && retryData) {
            navigate(`/chat/${retryData.id}`);
          }
          setShowReferralModal(false);
          return;
        }

        console.error('Referral error:', error);
        toast.error(t("Gagal menyimpan rujukan", "Failed to save referral"));
      } else {
        toast.success(t("Rujukan berhasil disimpan", "Referral saved successfully"));
        setShowReferralModal(false);

        // If teleconsultation, redirect to chat immediately
        if (consultationType === "teleconsultation" && data) {
          navigate(`/chat/${data.id}`);
        }
      }
    } catch (error) {
      console.error('Save referral error:', error);
      toast.error(t("Terjadi kesalahan saat menyimpan rujukan", "An error occurred while saving referral"));
    }
  };


  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    processPhoto(file);
  };

  const handleCameraCapture = (file: File) => {
    processPhoto(file);
  };

  const processPhoto = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error(t("Ukuran file terlalu besar (maks 10MB)", "File too large (max 10MB)"));
      return;
    }
    setFormData((s) => ({ ...s, photo: file }));
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    const url = await makePreviewObjectURL(file, 1280);
    setBlobUrl(url); setPreview(url);
    setPts([]); setPxDist(null);
    toast.success(t("Foto berhasil diunggah", "Photo uploaded successfully"));
  };

  // ===== Sinkronkan overlay ke ukuran natural image =====
  useEffect(() => {
    const img = imgRef.current, c = overlayRef.current;
    if (!img || !c) return;
    const sync = () => {
      if (!img.naturalWidth) return;
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      drawOverlay();
    };
    if (img.complete) sync(); else img.onload = () => sync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview]);

  // Redraw setiap kali titik berubah
  useEffect(() => { drawOverlay(); }, [pts]);
  function drawOverlay() {
    const c = overlayRef.current; if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (pts.length >= 1) {
      ctx.strokeStyle = "yellow"; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y); if (pts.length === 2) ctx.lineTo(pts[1].x, pts[1].y);
      ctx.stroke();
    }
  }
  function onOverlayClick(ev: React.MouseEvent<HTMLCanvasElement>) {
    if (!measuring) return;
    const c = ev.currentTarget; const r = c.getBoundingClientRect();
    const x = (ev.clientX - r.left) * (c.width / r.width);
    const y = (ev.clientY - r.top) * (c.height / r.height);
    const list = [...pts, { x, y }].slice(-2);
    setPts(list);
    if (list.length === 2) {
      const dx = list[1].x - list[0].x, dy = list[1].y - list[0].y;
      setPxDist(Math.hypot(dx, dy));
      setMeasuring(false);
    }
  }

  // --- fallback sederhana kalau AI gagal ---
  const calculateTriageFallback = (): TriageColor => {
    const anyDanger =
      formData.hasFever || formData.hasSmellPus || formData.hasSpreadingRedness ||
      formData.hasRestPain || formData.hasBlackColdSkin || !formData.hasFootPulse ||
      formData.kidneyCondition === "hemodialysis";
    if (anyDanger) return "red";
    const duration = parseInt(formData.woundDuration);
    if (!Number.isNaN(duration) && duration <= 14) return "yellow";
    return "green";
  };

  // ======================= ANALISIS =======================
  const handleSubmit = async () => {
    // DEMO MODE — auth di-bypass supaya bisa dicoba tanpa login.
    // Data tetap coba disimpan; kalau gagal (belum login), abaikan.
    if (inFlightRef.current) { toast.message(t("Analisis sedang berjalan…", "Analysis is already running…")); return; }
    if (!formData.photo || !preview) { toast.error(t("Mohon unggah foto terlebih dahulu", "Please upload a photo first")); return; }

    setLoading(true); inFlightRef.current = true;

    try {
      if (!modelReady) {
        await ensureModelReadyOnce(); setModelReady(true);
        if (CLF_MODEL_CHECK?.ok) {
          const suffix = CLF_MODEL_CHECK.nearConstant ? " (near-constant outputs)" : "";
          toast.message(t("Model siap: ", "Model ready: ") + (CLF_MODEL_SHA || "").slice(0, 8) + suffix);
        }
      }

      // mm/px dari pengukuran (konversi cm -> mm bila perlu)
      const realMm = unit === "cm" ? (realLen * 10) : realLen;
      const mmPerPx = (pxDist && realMm > 0) ? (realMm / pxDist) : undefined;

      const out: any = await inferDFU(preview, { hasScale: formData.hasScaleCard, mmPerPx });

      // 4-class softmax
      const topIdx: number = out?.infection?.topIdx ?? -1;
      const probs: number[] = Array.isArray(out?.infection?.probs) ? out.infection.probs : [];
      const pTop: number | null = topIdx >= 0 && probs.length === 4 ? probs[topIdx] : null;

      const pInfOnly: number | null = typeof out?.infection?.pRaw === "number" ? out.infection.pRaw : null; // class=Infection
      const pInfPresent: number | null = typeof out?.infection?.pPresent === "number" ? out.infection.pPresent : null; // Infection-present
      const pIscPresent: number | null = typeof out?.ischaemia?.prob === "number" ? out.ischaemia.prob : null; // Ischaemia-present
      const gated: boolean = !!(out?.ischaemia?.gated);

      const thrIsc: number = typeof out?.calibration?.ischaemia_threshold === "number" ? out.calibration.ischaemia_threshold : 0.5;
      const thrInf: number = typeof out?.calibration?.infection_threshold === "number" ? out.calibration.infection_threshold : 0.5;

      const areaFrac: number = typeof out?.seg?.areaFrac === "number" ? out.seg.areaFrac : 0;
      const areaPx: number | undefined = typeof out?.seg?.areaPx === "number" ? out.seg.areaPx : undefined;
      const areaCm2: number | null | undefined = out?.seg?.areaCm2 ?? null;

      // ==== pohon keputusan ====
      const reasons: string[] = [];
      const actions: string[] = [];

      const dangerFlags = {
        fever: formData.hasFever,
        smell: formData.hasSmellPus,
        redSpread: formData.hasSpreadingRedness,
        restPain: formData.hasRestPain,
        noPulse: !formData.hasFootPulse,
        blackCold: formData.hasBlackColdSkin,
      };
      const anyDanger = Object.values(dangerFlags).some(Boolean);
      if (anyDanger) reasons.push(t("Ada tanda bahaya klinis", "Clinical danger sign(s) present"));

      if (pIscPresent !== null && pIscPresent >= thrIsc) reasons.push(t("Iskemia di atas ambang (present)", "Ischaemia above threshold (present)"));
      if (topIdx === CLASS_IDX.BOTH) reasons.push(t("AI: Infeksi + Iskemia (Both)", "AI: Infection + ischaemia (Both)"));

      const renalSevere = formData.kidneyCondition === "severe" || formData.kidneyCondition === "hemodialysis";
      const strongInfOnly =
        (pInfOnly ?? 0) >= thrInf || (topIdx === CLASS_IDX.INF && (pTop ?? 0) >= thrInf) || ((pInfPresent ?? 0) >= thrInf);
      if (renalSevere && strongInfOnly) reasons.push(t("Penyakit ginjal berat + infeksi", "Severe kidney disease + infection"));

      let result: TriageColor = reasons.length > 0 ? "red" : "green";

      const woundSmall = !gated && (areaFrac <= 0.03);
      const clinSafe = !formData.hasFever && formData.hasFootPulse && !formData.hasSmellPus;

      if (result !== "red") {
        if (gated) {
          result = "green";
        } else if (woundSmall && clinSafe) {
          result = "yellow";
        } else {
          const borderIsch = pIscPresent !== null && pIscPresent >= (thrIsc - ISCH_BORDER_BELOW) && pIscPresent < thrIsc;
          const mildClass = topIdx === CLASS_IDX.INF || topIdx === CLASS_IDX.ISCH;
          result = (borderIsch || mildClass) ? "yellow" : "green";
        }
      }

      // (Internal) skor ringkas — tidak ditampilkan, tapi kita hitung tetap kalau perlu ekstensi
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const scorePct = Math.round(
        100 *
        (
          W_ISC * (pIscPresent ?? 0) +
          W_INF * (pInfPresent ?? 0) +
          W_AREA * Math.max(0, Math.min(1, areaFrac / 0.07))
        ) / (W_ISC + W_INF + W_AREA)
      );

      // Alasan & aksi
      const why: string[] = [];
      if (reasons.length) why.push(...reasons);
      if (result === "yellow") {
        if (woundSmall) why.push(t("Luka kecil/ dangkal", "Small/ shallow wound"));
        if (clinSafe) why.push(t("Tidak demam, nadi teraba, tidak ada bau/nanah", "No fever, pulse present, no smell/pus"));
      }
      if (result === "green" && gated) {
        const pct = Math.round(areaFrac * 1000) / 10;
        why.push(t(`Luka tidak terdeteksi / area sangat kecil (~${pct}% dari foto)`, `No wound detected / area is very small (~${pct}% of photo)`));
      }
      if (why.length === 0) why.push(t("Tidak ada tanda bahaya jelas", "No clear danger signs"));

      if (result === "red") {
        actions.push(
          t("Segera ke fasilitas kesehatan (≤48 jam)", "Go to clinic/hospital within 48h"),
          t("Jangan menunda atau mengobati sendiri", "Do not delay or self-medicate")
        );
      } else if (result === "yellow") {
        actions.push(
          t("Tele-konsultasi ≤72 jam", "Tele-consult within 72h"),
          t("Pantau harian: bersihkan, balut steril, jaga gula darah", "Daily care: clean, sterile dressing, control glucose")
        );
      } else {
        actions.push(
          t("Edukasi harian: periksa kaki, alas kaki layak, kontrol gula", "Daily education: foot checks, proper footwear, glucose control")
        );
      }

      setTriageResult(result);
      const summaryData = {
        // Hanya angka yang ditampilkan ke publik:
        pInfPct: pInfPresent != null ? Math.round(pInfPresent * 100) : undefined,
        pIscPct: pIscPresent != null ? Math.round(pIscPresent * 100) : undefined,
        areaPx,
        areaPct: Math.round(areaFrac * 1000) / 10,
        areaCm2: areaCm2 ?? null,
        why,
        what: actions,
      };
      setPublicSummary(summaryData);

      // Save to database
      const triageId = await saveTriageToDatabase(result, out, summaryData);
      if (triageId) {
        setCurrentTriageId(triageId);
      }

      toast.success(
        result === "red"
          ? t("SEGERA KE FASKES (≤48 jam).", "GO TO CLINIC/HOSPITAL (≤48h).")
          : result === "yellow"
            ? t("KONSULTASI ≤72 jam. Perlu pemantauan.", "CONSULT ≤72h. Needs monitoring.")
            : t("RAWAT MANDIRI. Ikuti perawatan harian.", "SELF-CARE. Follow daily care.")
      );

      if (result !== "green") setShowReferralModal(true);
    } catch (e: any) {
      console.error("[Triage] inferDFU error:", e);
      toast.error(t(`Analisis AI gagal: ${e?.message || String(e)}`, `AI analysis failed: ${e?.message || String(e)}`));
      const result = calculateTriageFallback(); setTriageResult(result); setPublicSummary(null);
      if (result !== "green") setShowReferralModal(true);
    } finally {
      setLoading(false); inFlightRef.current = false;
    }
  };

  // ===================== UI Helpers =====================
  const getTriageColor = (result: TriageColor) => ({
    red: "bg-triage-red text-triage-red-foreground",
    yellow: "bg-triage-yellow text-triage-yellow-foreground",
    green: "bg-triage-green text-triage-green-foreground",
  }[result]);

  const getTriageIcon = (result: TriageColor) => ({
    red: <AlertTriangle className="h-6 w-6" />,
    yellow: <AlertCircle className="h-6 w-6" />,
    green: <CheckCircle className="h-6 w-6" />,
  }[result]);

  // ===================== RENDER =====================
  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* Status model */}
      <div className="flex items-center justify-end">
        <span
          className={`text-xs rounded-full px-2 py-1 ${modelReady ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
            : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            }`}
          title={CLF_MODEL_SHA ? `SHA: ${CLF_MODEL_SHA}` : undefined}
        >
          {modelReady ? t("AI siap", "AI ready") : t("AI belum siap (akan dimuat saat analisis)", "AI not ready (will load on analyze)")}
        </span>
      </div>

      {/* Upload */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle>{t("Unggah Foto Luka", "Upload Wound Photo")}</CardTitle>
          <CardDescription>
            {t("Ambil foto dari atas, jarak 30–40 cm, dengan pencahayaan yang baik", "Take photo from above, 30–40 cm distance, with good lighting")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4">
            {/* Hidden input for gallery */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
              disabled={loading}
            />
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => setShowCameraModal(true)}
                variant="outline"
                className="min-touch-target rounded-2xl"
                disabled={loading}
              >
                <Camera className="mr-2 h-5 w-5" />{t("Ambil Foto", "Take Photo")}
              </Button>
              <Button
                onClick={() => fileInputRef.current?.click()}
                variant="outline"
                className="min-touch-target rounded-2xl"
                disabled={loading}
              >
                <Upload className="mr-2 h-5 w-5" />{t("Unggah dari Galeri", "Upload from Gallery")}
              </Button>
            </div>

            {/* Preview + Overlay */}
            {preview && (
              <div className="relative rounded-2xl overflow-hidden border-2 border-border">
                <img
                  ref={imgRef}
                  src={preview}
                  alt="Preview"
                  className="w-full h-auto max-h-[70vh] select-none"
                  loading="lazy"
                  decoding="async"
                />
                <canvas
                  ref={overlayRef}
                  className="absolute inset-0 w-full h-full"
                  onClick={onOverlayClick}
                />
              </div>
            )}

            {/* Kalibrasi ukuran */}
            <div className="rounded-xl border p-3 space-y-3">
              <div className="flex items-center gap-2">
                <Ruler className="h-4 w-4 text-cta" />
                <span className="text-sm font-medium">
                  {t("Kalibrasi ukuran", "Size calibration (to show cm²)")}
                </span>
              </div>
              <p className="text-xs opacity-70">
                {t(
                  "Letakkan penggaris/kartu skala di FOTO, klik tombol di bawah dan pilih 2 titik pada tepi benda berskala. Bila penggaris cm, isi dalam cm.",
                  "Place a ruler/scale card in the PHOTO, click the button below and pick 2 points along its edge. If the ruler is in cm, enter cm."
                )}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant={measuring ? "default" : "outline"}
                  onClick={() => { setMeasuring((v) => !v); if (!measuring) { setPts([]); setPxDist(null); } }}
                  disabled={!preview || loading}
                  className="rounded-xl"
                >
                  {measuring ? t("Klik 2 titik pada penggaris/kartu…", "Click 2 points on ruler/card…") : t("Ukur pada foto", "Measure on photo")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setPts([]); setPxDist(null); drawOverlay(); }}
                  disabled={!pxDist || loading}
                  className="rounded-xl"
                >
                  <X className="h-4 w-4 mr-1" /> {t("Hapus ukuran", "Clear measurement")}
                </Button>

                <div className="flex items-center gap-2">
                  <Label className="text-sm">{t("Panjang nyata", "Real length")}</Label>
                  <Input
                    className="w-24 rounded-xl"
                    type="number"
                    min={0}
                    step="0.01"
                    value={Number.isFinite(realLen) ? realLen : 0}
                    onChange={(e) => setRealLen(parseFloat(e.target.value || "0"))}
                    disabled={loading}
                  />
                  <Select value={unit} onValueChange={(v) => setUnit(v as "mm" | "cm")}>
                    <SelectTrigger className="w-20 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mm">mm</SelectItem>
                      <SelectItem value="cm">cm</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-sm opacity-80">
                  {t("Jarak pada foto:", "Distance on photo:")} <b>{pxDist ? pxDist.toFixed(1) : "-"}</b> px
                </div>
                {pxDist && realLen > 0 && (
                  <div className="text-sm opacity-80">
                    {t("Skala:", "Scale:")}{" "}
                    <b>{((unit === "cm" ? realLen * 10 : realLen) / pxDist).toFixed(3)}</b>{" "}
                    mm/px
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="scaleCard"
                    checked={formData.hasScaleCard}
                    onCheckedChange={(checked) => setFormData({ ...formData, hasScaleCard: checked as boolean })}
                    disabled={loading}
                  />
                  <Label htmlFor="scaleCard" className="text-sm">
                    {t("Saya menaruh penggaris/kartu skala di foto", "I placed a ruler/scale card in the photo")}
                  </Label>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form klinis */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle>{t("Informasi Luka & Kesehatan", "Wound & Health Information")}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-semibold">
              {t("Tanda Bahaya (centang jika ada):", "Danger Signs (check if present):")}
            </Label>
            <div className="space-y-3">
              {[
                ["fever", "Demam", "Fever", "hasFever"],
                ["smellPus", "Bau tidak enak / nanah", "Bad smell / pus", "hasSmellPus"],
                ["redness", "Kemerahan menyebar", "Spreading redness", "hasSpreadingRedness"],
                ["restPain", "Nyeri saat istirahat", "Pain at rest", "hasRestPain"],
                ["blackSkin", "Kulit hitam / dingin", "Black / cold skin", "hasBlackColdSkin"],
              ].map(([id, idn, en, key]) => (
                <div className="flex items-center space-x-2" key={id}>
                  <Checkbox
                    id={id}
                    checked={(formData as any)[key]}
                    onCheckedChange={(checked) => setFormData({ ...formData, [key as any]: checked as boolean })}
                    disabled={loading}
                  />
                  <Label htmlFor={id}>{t(idn as string, en as string)}</Label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("Denyut nadi kaki teraba?", "Foot pulse palpable?")}</Label>
            <RadioGroup
              value={formData.hasFootPulse ? "yes" : "no"}
              onValueChange={(value) => setFormData({ ...formData, hasFootPulse: value === "yes" })}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="pulse-yes" disabled={loading} />
                <Label htmlFor="pulse-yes">{t("Ya", "Yes")}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="pulse-no" disabled={loading} />
                <Label htmlFor="pulse-no">{t("Tidak", "No")}</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">
              {t("Sudah berapa lama ada luka? (hari)", "How long has the wound been present? (days)")}
            </Label>
            <Input
              id="duration"
              type="number"
              value={formData.woundDuration}
              onChange={(e) => setFormData({ ...formData, woundDuration: e.target.value })}
              className="rounded-2xl"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="location">{t("Lokasi luka", "Wound location")}</Label>
            <Select value={formData.woundLocation} onValueChange={(value) => setFormData({ ...formData, woundLocation: value })}>
              <SelectTrigger className="rounded-2xl" disabled={loading}>
                <SelectValue placeholder={t("Pilih lokasi", "Select location")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="toes">{t("Jari kaki / ujung kaki", "Toes / forefoot")}</SelectItem>
                <SelectItem value="midfoot">{t("Tengah kaki", "Midfoot")}</SelectItem>
                <SelectItem value="heel">{t("Tumit", "Heel")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diabetes">{t("Riwayat diabetes & obat", "Diabetes history & medications")}</Label>
            <Textarea
              id="diabetes"
              value={formData.diabetesHistory}
              onChange={(e) => setFormData({ ...formData, diabetesHistory: e.target.value })}
              placeholder={t("Contoh: Diabetes 10 tahun, minum metformin", "Example: Diabetes 10 years, taking metformin")}
              className="rounded-2xl"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kidney">{t("Kondisi ginjal (Penyakit Ginjal Kronik)", "Kidney condition (Chronic Kidney Disease)")}</Label>
            <Select value={formData.kidneyCondition} onValueChange={(value) => setFormData({ ...formData, kidneyCondition: value })}>
              <SelectTrigger className="rounded-2xl" disabled={loading}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("Tidak ada", "None")}</SelectItem>
                <SelectItem value="mild">{t("Ringan-Sedang", "Mild-Moderate")}</SelectItem>
                <SelectItem value="severe">{t("Berat", "Severe")}</SelectItem>
                <SelectItem value="hemodialysis">{t("Cuci darah (hemodialisis)", "On hemodialysis")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Collapsible>
            <CollapsibleTrigger className="text-sm text-muted-foreground underline">
              {t("Informasi klinis tambahan (opsional)", "Additional clinical information (optional)")}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="abi">{t("Nilai ABI (Ankle-Brachial Index)", "ABI value (Ankle-Brachial Index)")}</Label>
                <Input
                  id="abi"
                  type="number"
                  step="0.01"
                  value={formData.abiValue}
                  onChange={(e) => setFormData({ ...formData, abiValue: e.target.value })}
                  className="rounded-2xl"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">{t("Catatan klinis", "Clinical notes")}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="rounded-2xl"
                  disabled={loading}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Hasil */}
      {triageResult && publicSummary && (
        <Card className={`rounded-2xl shadow-md ${getTriageColor(triageResult)}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {getTriageIcon(triageResult)}
              {t("Hasil Triage", "Triage Result")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-lg font-semibold">
              {triageResult === "red" && t("🔴 MERAH – RUJUK ≤48 JAM", "🔴 RED – REFER ≤48h")}
              {triageResult === "yellow" && t("🟡 KUNING – TELE-KONSULTASI ≤72 JAM", "🟡 YELLOW – TELE-CONSULT ≤72h")}
              {triageResult === "green" && t("🟢 HIJAU – EDUKASI HARIAN", "🟢 GREEN – DAILY EDUCATION")}
            </div>

            {/* Ringkasan publik – sederhana & tidak redundan */}
            <div className="text-base font-medium">
              {t("AI:", "AI:")}{" "}
              <b>
                {t("Infeksi", "Infection")} {publicSummary.pInfPct ?? "-"}% ·{" "}
                {t("Iskemia", "Ischaemia")} {publicSummary.pIscPct ?? "-"}%
              </b>
            </div>

            <div className="text-base">
              {t("Luas luka:", "Wound area:")}{" "}
              <b>
                {publicSummary.areaCm2 != null
                  ? `${publicSummary.areaCm2.toFixed(2)} cm²`
                  : publicSummary.areaPct != null
                    ? `~${publicSummary.areaPct}% ${t("dari foto", "of photo")}`
                    : "-"}
                {publicSummary.areaPx != null ? `  (~${publicSummary.areaPx} px)` : ""}
              </b>
            </div>

            <div className="bg-background/40 rounded-xl p-3">
              <div className="font-semibold mb-1">{t("Kenapa hasil ini?", "Why this result?")}</div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {publicSummary.why.map((w, i) => (<li key={i}>{w}</li>))}
              </ul>
            </div>

            <div className="bg-background/40 rounded-xl p-3">
              <div className="font-semibold mb-1">{t("Apa yang harus dilakukan", "What to do")}</div>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {publicSummary.what.map((w, i) => (<li key={i}>{w}</li>))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleSubmit}
        className="w-full min-touch-target rounded-2xl bg-cta text-cta-foreground hover:bg-cta/90"
        size="lg"
        disabled={loading || inFlightRef.current}
      >
        {loading || inFlightRef.current ? t("Menganalisis...", "Analyzing...") : t("Analisis & Tentukan Triage", "Analyze & Determine Triage")}
      </Button>

      {/* Camera Capture Modal */}
      <CameraCapture
        open={showCameraModal}
        onOpenChange={setShowCameraModal}
        onCapture={handleCameraCapture}
        t={t}
      />

      {/* Referral Modal */}
      <ReferralModal
        open={showReferralModal}
        onOpenChange={setShowReferralModal}
        onSave={saveReferral}
        t={t}
      />
    </div>
  );
}
