import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  type GenerativeModel,
} from "firebase/ai";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config";
import { buildClassifierPrompt, buildImageClassifierPrompt } from "./prompts";
import { needsEscalation, parseVerdict, type Verdict } from "./verdict";

export class NotConfiguredError extends Error {
  constructor() {
    super(
      "Firebase is not configured yet. Add the real web config to src/firebase-config.ts.",
    );
    this.name = "NotConfiguredError";
  }
}

export type InferenceSource = "ON_DEVICE" | "IN_CLOUD" | "UNKNOWN";

export interface ClassificationResult {
  verdict: Verdict;
  source: InferenceSource;
  /** Present when the primary result was escalated to the cloud for a second opinion. */
  secondOpinion?: { verdict: Verdict; source: InferenceSource };
  escalated: boolean;
}

/** Chrome Prompt API global (Gemini Nano). Absent on browsers without it. */
declare const LanguageModel:
  | {
      availability: () => Promise<string>;
    }
  | undefined;

export type ModelStatus =
  | "available"
  | "downloading"
  | "downloadable"
  | "unavailable"
  | "unknown";

/** Reports the on-device model state for the status panel. Never throws. */
export async function getModelStatus(): Promise<ModelStatus> {
  try {
    if (typeof LanguageModel === "undefined") return "unavailable";
    const state = await LanguageModel.availability();
    if (
      state === "available" ||
      state === "downloading" ||
      state === "downloadable" ||
      state === "unavailable"
    ) {
      return state;
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

let app: FirebaseApp | null = null;
let deviceModel: GenerativeModel | null = null;
let cloudModel: GenerativeModel | null = null;

function ensureConfigured(): void {
  if (!isFirebaseConfigured()) throw new NotConfiguredError();
}

function getApp(): FirebaseApp {
  ensureConfigured();
  if (!app) {
    app = initializeApp({
      apiKey: firebaseConfig.apiKey,
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
      storageBucket: firebaseConfig.storageBucket,
      messagingSenderId: firebaseConfig.messagingSenderId,
      appId: firebaseConfig.appId,
    });
  }
  return app;
}

/**
 * Primary model: PREFER_ON_DEVICE — runs on Gemini Nano when available,
 * falls back to cloud otherwise. This is the hybrid-inference core.
 */
function getDeviceModel(): GenerativeModel {
  if (!deviceModel) {
    const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
    deviceModel = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
    });
  }
  return deviceModel;
}

/** Cloud model: PREFER_IN_CLOUD — used for image input and second opinions. */
function getCloudModel(): GenerativeModel {
  if (!cloudModel) {
    const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
    cloudModel = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_IN_CLOUD,
    });
  }
  return cloudModel;
}

/**
 * App Check wiring — STUB until the Firebase console step lands.
 *
 * App Check is REQUIRED by the hackathon rules; debug tokens are accepted
 * in submissions. Once the console step provides the debug token, this
 * function should set `self.FIREBASE_APPCHECK_DEBUG_TOKEN` and call
 * initializeAppCheck() with the project's provider, before any
 * generateContent() call. It is intentionally a no-op for now so the
 * scaffold builds and runs without a console project.
 */
export function initAppCheck(): void {
  // TODO (console step): wire App Check with the safelisted debug token.
  return;
}

export function getAppCheckStatus(): "pending" | "not-configured" {
  return isFirebaseConfigured() ? "pending" : "not-configured";
}

/**
 * Starts the on-device model download. Must be called from a user gesture
 * (the Check button). Never throws: if Nano is unavailable or the
 * download fails, PREFER_ON_DEVICE falls back to cloud at generate time.
 */
export async function prepareDeviceModel(
  onProgress?: (p: number) => void,
): Promise<void> {
  const model = getDeviceModel();
  try {
    await model.initializeDeviceModel((p: number) => onProgress?.(p));
  } catch (err) {
    console.warn("Device model init failed, will fall back to cloud:", err);
  }
}

function readInferenceSource(response: unknown): InferenceSource {
  const src = (response as { inferenceSource?: unknown } | null)
    ?.inferenceSource;
  return src === "ON_DEVICE" || src === "IN_CLOUD" ? src : "UNKNOWN";
}

async function runClassification(
  model: GenerativeModel,
  prompt: string,
): Promise<{ verdict: Verdict; source: InferenceSource }> {
  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const parsed = parseVerdict(raw);
  if (!parsed.ok) {
    throw new Error(`Could not parse model output as JSON: ${parsed.error}`);
  }
  return { verdict: parsed.verdict, source: readInferenceSource(result.response) };
}

/**
 * Classify a pasted message. Primary call runs on the hybrid model
 * (on-device when available, cloud fallback). Low-confidence results are
 * escalated: the same prompt is run a second time through the cloud model
 * as a second opinion, and the higher-confidence verdict wins.
 */
export async function classifyMessage(
  message: string,
): Promise<ClassificationResult> {
  const prompt = buildClassifierPrompt(message);
  const primary = await runClassification(getDeviceModel(), prompt);
  if (!needsEscalation(primary.verdict)) {
    return { verdict: primary.verdict, source: primary.source, escalated: false };
  }
  const second = await runClassification(getCloudModel(), prompt);
  const finalVerdict =
    second.verdict.confidence > primary.verdict.confidence
      ? second.verdict
      : primary.verdict;
  return {
    verdict: finalVerdict,
    source: primary.source,
    secondOpinion: { verdict: second.verdict, source: second.source },
    escalated: true,
  };
}

/**
 * Classify a screenshot/photo of a message. Image input goes straight to
 * the cloud model: on-device multimodal needs a Chrome flag and is not
 * guaranteed to be present, so the UI states clearly that images use cloud.
 */
export async function classifyImage(
  base64Data: string,
  mimeType: string,
): Promise<ClassificationResult> {
  const model = getCloudModel();
  const result = await model.generateContent([
    { text: buildImageClassifierPrompt() },
    { inlineData: { mimeType, data: base64Data } },
  ]);
  const raw = result.response.text();
  const parsed = parseVerdict(raw);
  if (!parsed.ok) {
    throw new Error(`Could not parse model output as JSON: ${parsed.error}`);
  }
  return {
    verdict: parsed.verdict,
    source: readInferenceSource(result.response),
    escalated: false,
  };
}
