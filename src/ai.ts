import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  CustomProvider,
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
} from "firebase/app-check";
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
 * Cloud model for both the hybrid fallback and the cloud-only path.
 *
 * The firebase/ai v12 SDK ignores a top-level `model` when a hybrid
 * mode is set — the model must go in `inCloudParams` (proven by reading
 * the installed SDK: getGenerativeModel() falls back to
 * DEFAULT_HYBRID_IN_CLOUD_MODEL = 'gemini-2.5-flash-lite' when
 * inCloudParams is absent). That model is retired for new users: the
 * Firebase console playground on this project (safetext-e13d1) rejects
 * gemini-2.5-flash-lite and accepts gemini-3.5-flash-lite, so this is
 * the model that must be named explicitly.
 */
const CLOUD_MODEL = "gemini-3.5-flash-lite";

/**
 * Primary model: PREFER_ON_DEVICE — runs on Gemini Nano when available,
 * falls back to cloud otherwise. This is the hybrid-inference core.
 */
function getDeviceModel(): GenerativeModel {
  if (!deviceModel) {
    const ai = getAI(getApp(), { backend: new GoogleAIBackend() });
    deviceModel = getGenerativeModel(ai, {
      mode: InferenceMode.PREFER_ON_DEVICE,
      inCloudParams: { model: CLOUD_MODEL },
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
      inCloudParams: { model: CLOUD_MODEL },
    });
  }
  return cloudModel;
}

export type AppCheckState =
  | "active-debug"
  | "active-enterprise"
  | "skipped"
  | "not-configured";

let appCheckState: AppCheckState = "not-configured";

/**
 * App Check wiring.
 *
 * Firebase AI Logic on safetext-2 is "Basic — Enforced", so cloud calls
 * are REJECTED with 401 unless a valid App Check token is attached. Two
 * providers, in priority order:
 *
 * - Local dev: if VITE_APPCHECK_DEBUG_TOKEN is set (gitignored .env.local,
 *   NEVER committed, NEVER baked into production builds), the token is
 *   installed as `FIREBASE_APPCHECK_DEBUG_TOKEN` and initializeAppCheck()
 *   activates the debug provider with it. The CustomProvider below is
 *   never consulted while debug mode is on — the SDK exchanges the debug
 *   token instead.
 * - Production (GitHub Pages): reCAPTCHA Enterprise (Fraud Defense),
 *   registered 2026-11-15 for safetext-web-2; its public site key lives in
 *   firebase-config.ts. reCAPTCHA v3 Classic is deprecated and cannot be
 *   registered — Enterprise is its official replacement. The SDK loads the
 *   Enterprise script and mints a token per session automatically.
 * - Neither configured: App Check is skipped gracefully and AI calls will
 *   fail with 401 while enforcement is on (do not ship in that state).
 *
 * Must run before any generateContent() call.
 */
export function initAppCheck(): void {
  if (!isFirebaseConfigured()) {
    appCheckState = "not-configured";
    return;
  }
  const debugToken =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.VITE_APPCHECK_DEBUG_TOKEN as string | undefined)
      : undefined;
  if (debugToken) {
    (
      globalThis as unknown as Record<string, unknown>
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    initializeAppCheck(getApp(), {
      provider: new CustomProvider({
        getToken: () =>
          Promise.resolve({
            token: "app-check-debug",
            expireTimeMillis: Date.now() + 3_600_000,
          }),
      }),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckState = "active-debug";
    return;
  }
  const enterpriseSiteKey = firebaseConfig.recaptchaEnterpriseSiteKey;
  if (enterpriseSiteKey) {
    initializeAppCheck(getApp(), {
      provider: new ReCaptchaEnterpriseProvider(enterpriseSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
    appCheckState = "active-enterprise";
    return;
  }
  appCheckState = "skipped";
}

export function getAppCheckStatus(): AppCheckState {
  return appCheckState;
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
