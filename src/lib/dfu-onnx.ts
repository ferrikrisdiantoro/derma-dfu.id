// lib/dfu-onnx.ts
"use client";
import * as ort from "onnxruntime-web";

// ORT bootstrap pakai WASM SELF-HOSTED dari /ort/ (vite-plugin-static-copy).
// Sebelumnya pakai CDN — riskan mati kalau CDN putus atau versi dihapus.
if (typeof window !== "undefined") {
  // File .wasm sudah di-copy ke public/ort/ (vite-plugin-static-copy)
  ort.env.wasm.wasmPaths = "/ort/";

  // non-COI safe
  ort.env.wasm.proxy = false; // jangan worker-proxy
  ort.env.wasm.simd = false; // matikan SIMD
  ort.env.wasm.numThreads = 1; // single thread

  ort.env.debug = false;
}

/* ===================== Utils ===================== */
async function sha256(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ===================== Calibration (overridable) ===================== */
export let CLASS4_LABELS = ["None", "Infection", "Ischaemia", "Both"];

type CalibrationFile = {
  ischaemia_threshold?: number; // threshold utk p(Ischaemia-present)
  infection_threshold?: number; // threshold utk p(Infection-present)
  clf_input_size?: number;
  labels_4class?: string[];
};

export let ISCH_THRESHOLD = 0.5; // fallback aman, override di /models/calibration.json
export let INF_THRESHOLD = 0.5; // fallback aman
export let CLF_INPUT_SIZE = 256;

export const SEG_INPUT_SIZE = 512;
export const SEG_THRESHOLD = 0.5;
export const MIN_WOUND_FRAC = 0.01; // gate: abaikan prediksi bila area luka terlalu kecil

let calibPromise: Promise<void> | null = null;

export function loadCalibration() {
  if (!calibPromise) {
    calibPromise = (async () => {
      try {
        const res = await fetch("/models/calibration.json?v=1", { cache: "no-store" });
        if (!res.ok) return;
        const cfg: CalibrationFile = await res.json();
        if (typeof cfg.ischaemia_threshold === "number") ISCH_THRESHOLD = cfg.ischaemia_threshold;
        if (typeof cfg.infection_threshold === "number") INF_THRESHOLD = cfg.infection_threshold;
        if (typeof cfg.clf_input_size === "number") CLF_INPUT_SIZE = cfg.clf_input_size;
        if (Array.isArray(cfg.labels_4class) && cfg.labels_4class.length === 4) {
          CLASS4_LABELS = cfg.labels_4class.slice();
        }
        if (process.env.NODE_ENV !== "production") {
          console.log("[DFU] calibration loaded", { ISCH_THRESHOLD, INF_THRESHOLD, CLF_INPUT_SIZE, CLASS4_LABELS });
        }
      } catch {
        /* keep defaults */
      }
    })();
  }
  return calibPromise;
}

/* ===================== Model state ===================== */
export type ModelCheck = {
  ok: boolean;
  sha256: string;
  outputs: string[];
  inputName?: string;
  reason?: string;
  constant: boolean;
  nearConstant: boolean;
  maxDiff: number;
};
export let CLF_MODEL_SHA = "";
export let CLF_MODEL_CHECK: ModelCheck | null = null;

/* ===================== Lazy sessions ===================== */
let clfSessionPromise: Promise<ort.InferenceSession> | null = null;
let segSessionPromise: Promise<ort.InferenceSession> | null = null;

// Pakai model 4-class ONNX hasil export notebook
const CLF_ONNX_PATH = "/models/dfu_4class.onnx?v=1";
const SEG_ONNX_PATH = "/models/unet_wound.onnx?v=1";

export function loadClfSession() {
  if (!clfSessionPromise) {
    clfSessionPromise = (async () => {
      const resp = await fetch(CLF_ONNX_PATH, { cache: "no-store" });
      if (!resp.ok) throw new Error(`Failed to fetch ONNX (${resp.status})`);
      const bytes = await resp.arrayBuffer();
      CLF_MODEL_SHA = await sha256(bytes);
      const sess = await ort.InferenceSession.create(bytes, { executionProviders: ["wasm"] });

      if (process.env.NODE_ENV !== "production") {
        console.log("[DFU] CLF IO", sess.inputNames, sess.outputNames, "sha256:", CLF_MODEL_SHA);
      }

      if (process.env.NODE_ENV !== "production") {
        CLF_MODEL_CHECK = await validateClassifierSession(sess, bytes).catch((e) => ({
          ok: false,
          sha256: CLF_MODEL_SHA,
          outputs: [...sess.outputNames],
          inputName: sess.inputNames?.[0],
          reason: e?.message || String(e),
          constant: false,
          nearConstant: false,
          maxDiff: 0,
        }));
        if (!CLF_MODEL_CHECK?.ok) {
          console.error("[DFU] ONNX model check FAILED:", CLF_MODEL_CHECK);
          throw new Error(`ONNX model check failed: ${CLF_MODEL_CHECK?.reason || "unknown"}`);
        } else {
          console.log("[DFU] ONNX model check OK:", CLF_MODEL_CHECK);
        }
      } else {
        CLF_MODEL_CHECK = {
          ok: true,
          sha256: CLF_MODEL_SHA,
          outputs: [...sess.outputNames],
          inputName: sess.inputNames?.[0],
          reason: undefined,
          constant: false,
          nearConstant: false,
          maxDiff: 0,
        };
      }
      return sess;
    })();
  }
  return clfSessionPromise;
}

export function loadSegSession() {
  if (!segSessionPromise) {
    segSessionPromise = ort.InferenceSession.create(SEG_ONNX_PATH, {
      executionProviders: ["wasm"],
    }).then((sess) => {
      if (process.env.NODE_ENV !== "production") {
        console.log("[DFU] SEG IO", sess.inputNames, sess.outputNames);
      }
      return sess;
    });
  }
  return segSessionPromise;
}

/* ===================== Global ORT queue ===================== */
let ortRunChain: Promise<void> = Promise.resolve();
function queueOrt<T>(task: () => Promise<T>): Promise<T> {
  const run = () => task();
  const p = ortRunChain.then(run, run);
  ortRunChain = p.then(
    () => {},
    () => {},
  );
  return p;
}

/* ===================== Canvas helpers & preprocess ===================== */
export function getImageDataFromImageElement(img: HTMLImageElement) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, c.width, c.height);
}

function resizeRGBA(src: Uint8ClampedArray, srcW: number, srcH: number, dstW: number, dstH: number) {
  const inC = document.createElement("canvas");
  inC.width = srcW;
  inC.height = srcH;
  const imgData = new ImageData(srcW, srcH);
  imgData.data.set(src);
  inC.getContext("2d")!.putImageData(imgData, 0, 0);
  const outC = document.createElement("canvas");
  outC.width = dstW;
  outC.height = dstH;
  outC.getContext("2d")!.drawImage(inC, 0, 0, srcW, srcH, 0, 0, dstW, dstH);
  return outC.getContext("2d")!.getImageData(0, 0, dstW, dstH).data;
}

// ResNet50 Keras (mode='caffe') preprocessing:
//   1) Swap channel RGB -> BGR
//   2) Subtract ImageNet mean per-channel (BGR order): [103.939, 116.779, 123.68]
//   3) NO scaling to [0,1], NO shift to [-1,1]
// Ref: tf.keras.applications.resnet50.preprocess_input (default mode='caffe')
// Wajib match dengan notebook training (dfu_classification_resnet50.ipynb).
function makeClfInputResNet50(imageData: ImageData) {
  const W = CLF_INPUT_SIZE,
    H = CLF_INPUT_SIZE;
  const out = resizeRGBA(imageData.data, imageData.width, imageData.height, W, H);
  const arr = new Float32Array(W * H * 3);
  let j = 0;
  for (let i = 0; i < out.length; i += 4) {
    // Source RGBA: out[i]=R, out[i+1]=G, out[i+2]=B, out[i+3]=A
    // Target BGR (channel-swap) + mean subtract
    arr[j++] = out[i + 2] - 103.939; // B
    arr[j++] = out[i + 1] - 116.779; // G
    arr[j++] = out[i] - 123.68; // R
  }
  return new ort.Tensor("float32", arr, [1, H, W, 3]);
}

export function makeSegInputNHWC(imageData: ImageData) {
  const W = SEG_INPUT_SIZE,
    H = SEG_INPUT_SIZE;
  const out = resizeRGBA(imageData.data, imageData.width, imageData.height, W, H);
  const arr = new Float32Array(W * H * 3);
  let j = 0;
  for (let i = 0; i < out.length; i += 4) {
    arr[j++] = out[i] / 255;
    arr[j++] = out[i + 1] / 255;
    arr[j++] = out[i + 2] / 255;
  }
  return new ort.Tensor("float32", arr, [1, H, W, 3]);
}

/* ===================== Classifier (single 4-class softmax) ===================== */
function softmaxFromLogits(xs: Float32Array | number[]) {
  const m = Math.max(...(xs as number[]));
  const exps = (xs as number[]).map((v) => Math.exp((v as number) - m));
  const s = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / (s || 1));
}

type Clf4 = {
  topIdx: number; // 0..3
  probs4: number[]; // [None, Infection, Ischaemia, Both]
  pInfOnly: number; // probs4[1]
  pInfPresent: number; // probs4[1] + probs4[3]
  pIscPresent: number; // probs4[2] + probs4[3]
  preprocessUsed: "RESNET50_CAFFE";
  qualityScore: number;
  suspiciousConstant: boolean;
};

async function runClf4(session: ort.InferenceSession, input: ort.Tensor) {
  const out = await queueOrt(() => session.run({ [session.inputNames[0]]: input }));
  // pick an output that looks like 4-class
  let t = out["class_head"];
  if (!t) {
    t = out[session.outputNames[0]];
  }
  const vec = Array.from(t.data as Float32Array);
  let p4 = vec;
  // ensure softmax
  const isProb = Math.abs(p4.reduce((a, b) => a + b, 0) - 1) < 1e-3 && p4.every((p) => p >= 0 && p <= 1);
  if (!isProb) p4 = softmaxFromLogits(p4);

  if (p4.length !== 4) throw new Error(`Expected 4-class output, got length ${p4.length}`);

  const topIdx = p4.indexOf(Math.max(...p4));
  const pInfOnly = p4[1] ?? 0;
  const pInfPresent = (p4[1] ?? 0) + (p4[3] ?? 0);
  const pIscPresent = (p4[2] ?? 0) + (p4[3] ?? 0);

  return { p4, topIdx, pInfOnly, pInfPresent, pIscPresent };
}

export async function runClassifier(imageData: ImageData): Promise<Clf4> {
  const session = await loadClfSession();
  const { p4, topIdx, pInfOnly, pInfPresent, pIscPresent } = await runClf4(session, makeClfInputResNet50(imageData));

  return {
    topIdx,
    probs4: p4,
    pInfOnly,
    pInfPresent,
    pIscPresent,
    preprocessUsed: "RESNET50_CAFFE",
    qualityScore: Math.abs(pInfPresent - 0.5) + Math.abs(pIscPresent - 0.5),
    suspiciousConstant: false,
  };
}

/* ===================== Segmenter ===================== */
export type SegResult = { H: number; W: number; probs: Float32Array };

export async function runSegmenter(imageData: ImageData, outName?: string): Promise<SegResult> {
  const session = await loadSegSession();
  const feeds = { [session.inputNames[0]]: makeSegInputNHWC(imageData) };
  const out = await queueOrt(() => session.run(feeds));
  const name = outName ?? session.outputNames[0];
  const tensor = out[name] ?? out[session.outputNames[0]];
  const dims = tensor.dims as number[];
  let H = 0,
    W = 0;
  if (dims.length === 4) {
    if (dims[1] === 1 && dims[2] > 1 && dims[3] > 1) {
      H = dims[2];
      W = dims[3];
    } else {
      H = dims[1];
      W = dims[2];
    }
  } else if (dims.length === 3) {
    H = dims[0];
    W = dims[1];
  } else {
    const len = (tensor.data as Float32Array).length;
    const s = Math.round(Math.sqrt(len));
    H = s;
    W = s;
  }
  return { H, W, probs: tensor.data as Float32Array };
}

export function countMaskPixels512(seg: SegResult, thr = SEG_THRESHOLD) {
  let c = 0;
  const p = seg.probs;
  for (let i = 0; i < p.length; i++) if (p[i] >= thr) c++;
  return c;
}

/* ===================== Public load/infer wrappers ===================== */
export async function loadDFUModels(): Promise<void> {
  await Promise.all([loadCalibration(), loadClfSession(), loadSegSession()]);
}

type InferOpts = { hasScale?: boolean; segOutName?: string; mmPerPx?: number };

export type InferOutput = {
  infection: { topIdx: number; probs: number[]; labels: string[]; pRaw: number; pPresent: number };
  ischaemia: { prob: number; threshold: number; gated: boolean };
  seg: { areaPx: number; areaFrac: number; areaCm2: number | null };
  img: { width: number; height: number; totalPx: number };
  calibration: { ischaemia_threshold: number; infection_threshold: number; clf_input_size: number };
  model: { sha256: string; nearConstant: boolean; preprocess: "RESNET50_CAFFE"; quality: number };
};

export async function inferDFU(imageUrl: string, opts: InferOpts = {}): Promise<InferOutput> {
  await loadCalibration();

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.decoding = "async";
  img.src = imageUrl;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = (e) => rej(e);
  });
  const imageData = getImageDataFromImageElement(img);

  const clf = await runClassifier(imageData);
  const seg = await runSegmenter(imageData, opts.segOutName);

  const px512 = countMaskPixels512(seg, SEG_THRESHOLD);
  const scaledPx = Math.round((px512 * imageData.width * imageData.height) / (SEG_INPUT_SIZE * SEG_INPUT_SIZE));
  const totalPx = imageData.width * imageData.height;
  const areaFrac = totalPx > 0 ? scaledPx / totalPx : 0;

  // Gate: area kecil → abaikan classifier
  let gated = false;
  let topIdx = clf.topIdx;
  let probs = clf.probs4.slice();
  let pInfOnly = clf.pInfOnly;
  let pInfPresent = clf.pInfPresent;
  let pIscPresent = clf.pIscPresent;

  if (areaFrac < MIN_WOUND_FRAC) {
    gated = true;
    topIdx = 0;
    probs = [1, 0, 0, 0];
    pInfOnly = 0;
    pInfPresent = 0;
    pIscPresent = 0;
    if (process.env.NODE_ENV !== "production") {
      console.log("[DFU gate] area too small → ignore classifier", { areaFrac: +areaFrac.toFixed(4), MIN_WOUND_FRAC });
    }
  }

  // cm² jika ada skala (mm/px)
  let areaCm2: number | null = null;
  if (opts.mmPerPx && opts.mmPerPx > 0) areaCm2 = (scaledPx * opts.mmPerPx * opts.mmPerPx) / 100.0;

  return {
    infection: { topIdx, probs, labels: CLASS4_LABELS, pRaw: pInfOnly, pPresent: pInfPresent },
    ischaemia: { prob: pIscPresent, threshold: ISCH_THRESHOLD, gated },
    seg: { areaPx: scaledPx, areaFrac, areaCm2 },
    img: { width: imageData.width, height: imageData.height, totalPx },
    calibration: {
      ischaemia_threshold: ISCH_THRESHOLD,
      infection_threshold: INF_THRESHOLD,
      clf_input_size: CLF_INPUT_SIZE,
    },
    model: {
      sha256: CLF_MODEL_SHA,
      nearConstant: !!CLF_MODEL_CHECK?.nearConstant || clf.suspiciousConstant,
      preprocess: clf.preprocessUsed,
      quality: clf.qualityScore,
    },
  };
}

/* ===================== Session sanity check ===================== */
// Rentang input ResNet50 caffe: kira-kira [-124, 152] karena hasil
// mengurangi mean ImageNet [103.939, 116.779, 123.68] dari nilai piksel [0, 255].
function makeTensorFilledR50(val: number) {
  const H = CLF_INPUT_SIZE,
    W = CLF_INPUT_SIZE;
  const arr = new Float32Array(H * W * 3).fill(val);
  return new ort.Tensor("float32", arr, [1, H, W, 3]);
}
function makeTensorRandomR50(min = -125, max = 152) {
  const H = CLF_INPUT_SIZE,
    W = CLF_INPUT_SIZE;
  const arr = new Float32Array(H * W * 3);
  for (let i = 0; i < arr.length; i++) arr[i] = min + Math.random() * (max - min);
  return new ort.Tensor("float32", arr, [1, H, W, 3]);
}

async function validateClassifierSession(session: ort.InferenceSession, bytes?: ArrayBuffer) {
  const outNames = session.outputNames || [];
  const inNames = session.inputNames || [];
  const inputName = inNames[0];

  // Rentang test yang realistis untuk input ResNet50 caffe (setelah preprocess).
  const xs = [makeTensorFilledR50(-100), makeTensorFilledR50(100), makeTensorRandomR50(-125, 152)];
  const outs: number[][] = [];
  for (const x of xs) {
    // eslint-disable-next-line no-await-in-loop
    const out = await queueOrt(() => session.run({ [inputName]: x }));
    const first = out["class_head"] ?? out[outNames[0]];
    const vec = Array.from(first.data as Float32Array);
    outs.push(vec);
    if (vec.length !== 4) throw new Error(`Unexpected classifier length: ${vec.length} (want 4)`);
  }
  // constant / near-constant heuristic
  let maxDiff = 0;
  for (let a = 0; a < outs.length; a++)
    for (let b = a + 1; b < outs.length; b++) {
      for (let k = 0; k < 4; k++) maxDiff = Math.max(maxDiff, Math.abs(outs[a][k] - outs[b][k]));
    }
  const constant = maxDiff < 1e-8;
  const nearConstant = !constant && maxDiff < 1e-4;
  if (constant) throw new Error("Constant outputs suspected");

  return {
    ok: true,
    sha256: CLF_MODEL_SHA || (bytes ? await sha256(bytes) : ""),
    outputs: [...outNames],
    inputName,
    reason: undefined,
    constant,
    nearConstant,
    maxDiff,
  };
}
