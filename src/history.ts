/** Check history kept in localStorage — no account, no server. */

import type { VerdictLabel } from "./verdict";

export interface HistoryEntry {
  id: string;
  text: string;
  verdict: VerdictLabel;
  confidence: number;
  source: string;
  ts: number;
}

const KEY = "safetext-history-v1";
const MAX_ENTRIES = 30;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is HistoryEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as HistoryEntry).id === "string" &&
        typeof (e as HistoryEntry).text === "string",
    );
  } catch {
    return [];
  }
}

export function addHistory(
  entry: Omit<HistoryEntry, "id" | "ts">,
): HistoryEntry[] {
  const list = loadHistory();
  const full: HistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
  };
  list.unshift(full);
  const trimmed = list.slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // Storage full or blocked — history is best-effort.
  }
  return trimmed;
}

export function clearHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
