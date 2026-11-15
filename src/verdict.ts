/**
 * Structured verdict parsing + cloud-escalation rule.
 *
 * The model is instructed to reply with JSON only, but small models often
 * wrap it in markdown fences or add stray text — so parsing is defensive:
 * strip fences, take the first {...} block, validate every field, and
 * fall back to safe defaults instead of crashing.
 */

export type VerdictLabel = "scam" | "suspicious" | "safe";

export interface Verdict {
  verdict: VerdictLabel;
  /** 0..1 */
  confidence: number;
  red_flags: string[];
  advice: string;
}

export type ParseResult =
  | { ok: true; verdict: Verdict }
  | { ok: false; error: string };

const LABELS: VerdictLabel[] = ["scam", "suspicious", "safe"];

function clampConfidence(n: unknown): number {
  if (typeof n !== "number" || Number.isNaN(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

export function parseVerdict(text: string): ParseResult {
  const cleaned = text
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, error: "no JSON object found in model output" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch (err) {
    return {
      ok: false,
      error: `invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, error: "parsed output is not an object" };
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.verdict !== "string" || !LABELS.includes(obj.verdict as VerdictLabel)) {
    return { ok: false, error: `invalid verdict: ${String(obj.verdict)}` };
  }
  const redFlags = Array.isArray(obj.red_flags)
    ? obj.red_flags.filter((f): f is string => typeof f === "string")
    : [];
  return {
    ok: true,
    verdict: {
      verdict: obj.verdict as VerdictLabel,
      confidence: clampConfidence(obj.confidence),
      red_flags: redFlags,
      advice: typeof obj.advice === "string" ? obj.advice : "",
    },
  };
}

/**
 * Escalate to a cloud second opinion when the primary result is shaky:
 * low confidence overall, or a "suspicious" call made with low confidence.
 */
export function needsEscalation(v: Verdict): boolean {
  if (v.confidence < 0.6) return true;
  if (v.verdict === "suspicious" && v.confidence < 0.75) return true;
  return false;
}
