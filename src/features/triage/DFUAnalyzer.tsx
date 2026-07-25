// app/DFUAnalyzer.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { Ruler, X } from "lucide-react";

import {
  SEG_THRESHOLD, SEG_INPUT_SIZE,
  getImageDataFromImageElement, runSegmenter, countMaskPixels512,
  inferDFU, loadDFUModels, CLF_MODEL_SHA, CLF_MODEL_CHECK
} from "@/lib/dfu-onnx";

/** Simple downscale for preview */
async function makePreviewObjectURL(file: File, maxDim = 1600): Promise<string> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!; ctx.imageSmoothingEnabled = true; ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.9));
    return URL.createObjectURL(blob);
  } catch { return URL.createObjectURL(file); }
}

async function ensureModelReadyOnce() {
  const g = globalThis as any;
  if (!g.__dfuLoadP) g.__dfuLoadP = loadDFUModels();
  await g.__dfuLoadP;
}

export default function DFUAnalyzer() {
  const { t } = useLanguage();
  const [imgUrl, setImgUrl] = useState<string>();
  const imgRef = useRef<HTMLImageElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const [busy, setBusy] = useState(false);
  const [modelReady, setModelReady] = useState(false);

  // Kalibrasi ukuran (opsional)
  const [measuring, setMeasuring] = useState(false);
  const [pts, setPts] = useState<{x:number;y:number}[]>([]);
  const [pxDist, setPxDist] = useState<number | null>(null);
  const [realLen, setRealLen] = useState<number>(8.56); // cm default (kartu)
  const [unit, setUnit] = useState<"mm"|"cm">("cm");

  const [result, setResult] = useState<{
    clsName: string;
    clsPct: number | null;
    infPct: number | null;     // Infection-present  (0..100)
    iscPct: number | null;     // Ischaemia-present (0..100)
    pxArea: number;
    areaCm2?: number | null;
    areaPct?: number;          // % of photo
  }>();

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    makePreviewObjectURL(f, 1600).then((url)=>{
      setImgUrl(url);
      setResult(undefined);
      setPts([]); setPxDist(null);
    });
  }

  useEffect(()=>{
    // sync overlay size
    const img = imgRef.current, c = overlayRef.current;
    if (!img || !c) return;
    if (!img.naturalWidth) return;
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0,0,c.width,c.height);
  }, [imgUrl]);

  function onCanvasClick(ev: React.MouseEvent<HTMLCanvasElement>) {
    if (!measuring) return;
    const c = ev.currentTarget;
    const r = c.getBoundingClientRect();
    const x = (ev.clientX - r.left) * (c.width / r.width);
    const y = (ev.clientY - r.top)  * (c.height / r.height);
    const list = [...pts, {x,y}].slice(-2);
    setPts(list);
    if (list.length === 2) {
      const dx = list[1].x - list[0].x;
      const dy = list[1].y - list[0].y;
      setPxDist(Math.hypot(dx,dy));
      setMeasuring(false);
    }
  }

  function drawMask(
    seg: {H:number; W:number; probs: Float32Array},
    outW: number, outH: number, thr: number
  ) {
    const small = document.createElement("canvas");
    small.width = seg.W; small.height = seg.H;
    const sctx = small.getContext("2d")!;
    const id = sctx.createImageData(seg.W, seg.H);
    for (let i=0;i<seg.probs.length;i++){
      const p = seg.probs[i];
      const on = p >= thr ? 255 : 0;
      id.data[i*4+0] = 255; // R
      id.data[i*4+1] = 0;
      id.data[i*4+2] = 0;
      id.data[i*4+3] = on ? 90 : 0;
    }
    sctx.putImageData(id, 0, 0);

    const out = overlayRef.current!;
    const octx = out.getContext("2d")!;
    octx.clearRect(0,0,out.width,out.height);
    octx.imageSmoothingEnabled = true;
    octx.drawImage(small, 0, 0, seg.W, seg.H, 0, 0, outW, outH);

    // garis ukur jika ada 2 titik
    if (pts.length === 2) {
      octx.strokeStyle = "yellow";
      octx.lineWidth = 2;
      octx.beginPath();
      octx.moveTo(pts[0].x, pts[0].y);
      octx.lineTo(pts[1].x, pts[1].y);
      octx.stroke();
    }
  }

  const analyze = async () => {
    try {
      if (!imgRef.current || !imgUrl) return;
      setBusy(true);

      // pastikan model siap
      if (!modelReady) {
        await ensureModelReadyOnce();
        setModelReady(true);
        if (CLF_MODEL_CHECK?.ok) {
          const suffix = CLF_MODEL_CHECK.nearConstant ? " (near-constant outputs)" : "";
          toast?.message?.(t("Model siap: ", "Model ready: ") + (CLF_MODEL_SHA || "").slice(0, 8) + suffix);
        }
      }

      // 1) Segmentasi (untuk overlay & area)
      const imageData = getImageDataFromImageElement(imgRef.current);
      const seg = await runSegmenter(imageData);
      drawMask(seg, imageData.width, imageData.height, SEG_THRESHOLD);

      // 2) Area (px & cm² jika ada kalibrasi)
      const px512 = countMaskPixels512(seg, SEG_THRESHOLD);
      const pxScaled = Math.round(px512 * (imageData.width * imageData.height) / (SEG_INPUT_SIZE * SEG_INPUT_SIZE));
      let areaCm2: number | null = null;
      let areaPct: number | undefined = undefined;
      {
        const realMm = unit === "cm" ? (realLen * 10) : realLen;
        const mmPerPx = (pxDist && realMm > 0) ? (realMm / pxDist) : undefined;
        if (mmPerPx) areaCm2 = (pxScaled * mmPerPx * mmPerPx) / 100.0;
        areaPct = Math.round((pxScaled / (imageData.width*imageData.height)) * 1000) / 10;
      }

      // 3) Klasifikasi 4-kelas (pakai wrapper lengkap supaya konsisten)
      const out = await inferDFU(imgUrl, {
        hasScale: !!pxDist,
        mmPerPx: (() => {
          if (!pxDist || !Number.isFinite(realLen) || realLen <= 0) return undefined;
          const realMm = unit === "cm" ? (realLen * 10) : realLen;
          return realMm / pxDist;
        })(),
      });

      const labels = out.infection.labels ?? ["None","Infection","Ischaemia","Both"];
      const topIdx = out.infection.topIdx ?? -1;
      const pTop   = (topIdx >= 0 && Array.isArray(out.infection.probs)) ? out.infection.probs[topIdx] : null;

      // Percent line: “Infection 80% · Ischaemia 20%”
      const pInfPct = out.infection.pPresent != null ? Math.round(out.infection.pPresent * 100) : null;
      const pIscPct = out.ischaemia.prob     != null ? Math.round(out.ischaemia.prob * 100)     : null;

      setResult({
        clsName: labels[topIdx] ?? "-",
        clsPct: pTop != null ? Math.round(pTop * 100) : null,
        infPct: pInfPct,
        iscPct: pIscPct,
        pxArea: pxScaled,
        areaCm2: areaCm2 != null ? Math.round(areaCm2 * 100) / 100 : null,
        areaPct,
      });
    } catch (e:any) {
      console.error(e);
      toast?.error?.(e.message ?? "Inference error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <Card className="rounded-2xl">
        <CardHeader>
          <CardTitle>{t("Analisis Luka DFU", "DFU Wound Analysis")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col md:flex-row gap-6">
            {/* left: image + overlay */}
            <div className="relative max-w-[520px]">
              {imgUrl && (
                <>
                  <img
                    ref={imgRef}
                    src={imgUrl}
                    alt="preview"
                    className="border rounded-xl max-w-full"
                    onLoad={()=>{
                      const c = overlayRef.current;
                      const img = imgRef.current;
                      if (c && img) { c.width = img.naturalWidth; c.height = img.naturalHeight; }
                    }}
                  />
                  <canvas
                    ref={overlayRef}
                    className="absolute left-0 top-0 w-full h-full"
                    onClick={onCanvasClick}
                  />
                </>
              )}
            </div>

            {/* right: controls + results */}
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <Input type="file" accept="image/*" onChange={onFile}/>
                <Button disabled={!imgUrl || busy} onClick={analyze}>
                  {busy ? t("Memproses...", "Processing...") : t("Analisis", "Analyze")}
                </Button>
              </div>

              {/* Kalibrasi ukuran (opsional) */}
              <Card className="rounded-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t("Kalibrasi (opsional)", "Calibration (optional)")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm">
                    {t(
                      "Klik 'Ukur', pilih 2 titik pada penggaris/kartu skala di FOTO. Masukkan panjang nyata (mm/ cm).",
                      "Click 'Measure', pick 2 points on a ruler/scale card in the PHOTO. Enter real length (mm/ cm)."
                    )}
                  </p>
                  <div className="flex flex-wrap gap-2 items-center">
                    <Button variant={measuring ? "default" : "outline"} onClick={()=>setMeasuring(v=>!v)}>
                      <Ruler className="h-4 w-4 mr-2" />
                      {measuring ? t("Sedang mengukur...", "Measuring...") : t("Ukur pada foto", "Measure on photo")}
                    </Button>
                    <span className="text-sm opacity-70">
                      {t("Jarak piksel:", "Pixel distance:")}{" "}
                      <b>{pxDist?.toFixed(1) ?? "-"}</b> px
                    </span>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">{t("Panjang nyata", "Real length")}</Label>
                      <Input className="w-24" type="number" min={0} step="0.01"
                        value={realLen} onChange={e=>setRealLen(parseFloat(e.target.value || "0"))}/>
                      <select
                        className="border rounded-md px-2 py-1 text-sm"
                        value={unit}
                        onChange={e=>setUnit(e.target.value as "mm"|"cm")}
                      >
                        <option value="mm">mm</option>
                        <option value="cm">cm</option>
                      </select>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => { setPts([]); setPxDist(null); const c=overlayRef.current; c && c.getContext("2d")!.clearRect(0,0,c.width,c.height); }}
                      disabled={!pxDist}
                      className="rounded-xl"
                    >
                      <X className="h-4 w-4 mr-1" /> {t("Hapus ukuran", "Clear measurement")}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Hasil */}
              {result && (
                <Card className="rounded-xl">
                  <CardHeader><CardTitle className="text-base">{t("Hasil", "Results")}</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {/* Compact AI line */}
                    <div className="text-base font-medium">
                      {t("AI:", "AI:")}{" "}
                      <b>
                        {t("Infeksi", "Infection")} {result.infPct ?? "-"}% ·{" "}
                        {t("Iskemia", "Ischaemia")} {result.iscPct ?? "-"}%
                      </b>
                    </div>

                    {/* Detailed */}
                    <div>
                      {t("Kelas AI:", "AI class:")} <b>{result.clsName}</b>
                      {result.clsPct!=null ? <> ({result.clsPct}%)</> : null}
                    </div>
                    <div>{t("Luas luka (piksel):", "Wound area (pixels):")} <b>{result.pxArea}</b></div>
                    <div>
                      {t("Luas luka:", "Wound area:")}{" "}
                      <b>
                        {result.areaCm2 != null ? `${result.areaCm2} cm²` :
                         result.areaPct != null ? `~${result.areaPct}% ${t("dari foto", "of photo")}` : "—"}
                      </b>
                    </div>
                    <div className="pt-2 opacity-80">
                      <ul className="list-disc pl-5">
                        <li>
                          {t("Bantuan awal: cuci luka, balut steril, jangan tunda perawatan.",
                             "First-aid: clean wound, sterile dressing, do not delay care.")}
                        </li>
                        <li>
                          {t("Hasil ini bukan diagnosis medis. Konsultasikan dengan tenaga kesehatan.",
                             "This is not a medical diagnosis. Consult a healthcare professional.")}
                        </li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
