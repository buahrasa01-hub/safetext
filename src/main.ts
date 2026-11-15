import "./style.css";
import {
  classifyImage,
  classifyMessage,
  getAppCheckStatus,
  getModelStatus,
  initAppCheck,
  NotConfiguredError,
  prepareDeviceModel,
  type ClassificationResult,
  type ModelStatus,
} from "./ai";
import { isFirebaseConfigured } from "./firebase-config";
import {
  addHistory,
  clearHistory,
  loadHistory,
  type HistoryEntry,
} from "./history";
import type { Verdict } from "./verdict";

interface Sample {
  id: string;
  lang: string;
  label: string;
  text: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element #${id}`);
  return node as T;
}

function verdictWord(v: Verdict["verdict"]): string {
  return v === "scam" ? "Scam" : v === "suspicious" ? "Suspicious" : "Safe";
}

function sourceBadge(source: string): string {
  if (source === "ON_DEVICE")
    return `<span class="badge on-device">On device</span>`;
  if (source === "IN_CLOUD")
    return `<span class="badge cloud">Cloud</span>`;
  return `<span class="badge unknown">Source unknown</span>`;
}

function verdictCardHtml(r: ClassificationResult, inputText: string): string {
  const v = r.verdict;
  const pct = Math.round(v.confidence * 100);
  const flags =
    v.red_flags.length > 0
      ? `<ul class="flags">${v.red_flags.map((f) => `<li>${escapeHtml(f)}</li>`).join("")}</ul>`
      : `<p class="muted">No red flags found.</p>`;
  const second =
    r.escalated && r.secondOpinion
      ? `<div class="second-opinion">
          <h3>Second opinion (cloud)</h3>
          <p>The first result was uncertain, so the same message was checked again in the cloud:
          <strong>${verdictWord(r.secondOpinion.verdict.verdict)}</strong>
          (${Math.round(r.secondOpinion.verdict.confidence * 100)}% confidence)
          ${sourceBadge(r.secondOpinion.source)}</p>
        </div>`
      : "";
  return `
    <div class="verdict-head verdict-${v.verdict}">
      <span class="verdict-word">${verdictWord(v.verdict)}</span>
      ${sourceBadge(r.source)}
    </div>
    <div class="confidence">
      <div class="confidence-bar"><span style="width:${pct}%"></span></div>
      <span class="confidence-num">${pct}% confidence</span>
    </div>
    <blockquote class="checked-text">${escapeHtml(inputText)}</blockquote>
    <h3>Why</h3>
    ${flags}
    <h3>What to do</h3>
    <p>${escapeHtml(v.advice || "No specific advice.")}</p>
    ${second}
  `;
}

function historyItemHtml(e: HistoryEntry): string {
  const when = new Date(e.ts).toLocaleString();
  const excerpt =
    e.text.length > 80 ? `${e.text.slice(0, 80)}…` : e.text;
  return `<li>
    <button class="history-item" data-id="${escapeHtml(e.id)}" data-text="${escapeHtml(e.text)}">
      <span class="history-verdict verdict-${e.verdict}">${verdictWord(e.verdict)}</span>
      <span class="history-text">${escapeHtml(excerpt)}</span>
      <span class="history-meta">${Math.round(e.confidence * 100)}% · ${escapeHtml(e.source)} · ${escapeHtml(when)}</span>
    </button>
  </li>`;
}

function renderHistory(): void {
  const list = el<HTMLUListElement>("history-list");
  const empty = el<HTMLElement>("history-empty");
  const entries = loadHistory();
  list.innerHTML = entries.map(historyItemHtml).join("");
  empty.hidden = entries.length > 0;
}

function modelStatusText(status: ModelStatus): string {
  switch (status) {
    case "available":
      return "✅ Gemini Nano is available on this device — checks run on-device.";
    case "downloading":
      return "⬇️ Gemini Nano is downloading… checks use the cloud until it is ready.";
    case "downloadable":
      return "📥 Gemini Nano can be downloaded on this device.";
    case "unavailable":
      return "⚠️ Gemini Nano is not available on this device — checks run in the cloud.";
    default:
      return "Could not detect the on-device model — checks run in the cloud if needed.";
  }
}

function appCheckText(): string {
  const status = getAppCheckStatus();
  if (status === "active-debug")
    return "App Check: active (debug token — local dev build).";
  if (status === "active-enterprise")
    return "App Check: active (reCAPTCHA Enterprise).";
  if (status === "skipped")
    return "App Check: not configured — cloud checks fail while AI Logic enforcement is on.";
  return "App Check: pending Firebase setup.";
}

async function loadSamples(): Promise<void> {
  const box = el<HTMLElement>("samples");
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}samples.json`);
    if (!res.ok) return;
    const samples = (await res.json()) as Sample[];
    box.innerHTML = samples
      .map(
        (s) =>
          `<button class="chip" data-text="${escapeHtml(s.text)}">${escapeHtml(s.label)} (${escapeHtml(s.lang)})</button>`,
      )
      .join("");
    box.addEventListener("click", (ev) => {
      const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>(".chip");
      if (!btn) return;
      el<HTMLTextAreaElement>("msg").value = btn.dataset.text ?? "";
      el<HTMLTextAreaElement>("msg").focus();
    });
  } catch {
    box.hidden = true;
  }
}

function main(): void {
  const configured = isFirebaseConfigured();
  initAppCheck();

  el<HTMLElement>("app").innerHTML = `
    <header class="app-header">
      <div class="brand">
        <span class="logo" aria-hidden="true">🛡️</span>
        <div>
          <h1>SafeText</h1>
          <p class="tagline">Is this message a scam? Your device decides — privately.</p>
        </div>
      </div>
    </header>
    <main class="container">
      <section id="config-notice" class="notice warn" ${configured ? "hidden" : ""}>
        <strong>Firebase not configured yet.</strong>
        Classification is disabled until the real Firebase web config is added
        to <code>src/firebase-config.ts</code>. Everything else on this page works.
      </section>
      <section class="card">
        <label for="msg">Paste the suspicious message</label>
        <textarea id="msg" rows="6" placeholder="Paste an SMS, WhatsApp or email message here…"></textarea>
        <div id="samples" class="chips" aria-label="Try a sample message"></div>
        <div class="actions">
          <button id="check-btn" class="primary">Check this message</button>
          <label class="upload" for="image-input">📷 Check a screenshot</label>
          <input id="image-input" type="file" accept="image/jpeg,image/png" hidden />
        </div>
        <p class="hint">Text is checked on your device when Gemini Nano is available, otherwise in the cloud. Screenshots are always checked in the cloud.</p>
        <p id="status" class="status" role="status"></p>
      </section>
      <section id="result" class="card result" hidden></section>
      <section class="card">
        <h2>On-device model</h2>
        <p id="model-status">Detecting…</p>
        <p id="appcheck-status" class="muted">${escapeHtml(appCheckText())}</p>
      </section>
      <section class="card">
        <div class="history-head">
          <h2>History</h2>
          <button id="clear-history" class="link-btn">Clear</button>
        </div>
        <ul id="history-list" class="history"></ul>
        <p id="history-empty" class="muted">No checks yet — past checks are kept on this device only.</p>
      </section>
      <footer class="footer">
        <p>SafeText — #BuildHybridAI 2026. Hybrid inference: Gemini Nano on-device when available, Firebase AI Logic cloud fallback. Messages checked on-device never leave your device. History stays in this browser.</p>
      </footer>
    </main>
  `;

  const checkBtn = el<HTMLButtonElement>("check-btn");
  const imageInput = el<HTMLInputElement>("image-input");
  const statusEl = el<HTMLElement>("status");
  const resultEl = el<HTMLElement>("result");
  let busy = false;

  if (!configured) {
    checkBtn.disabled = true;
    checkBtn.title = "Disabled until Firebase is configured";
    imageInput.disabled = true;
  }

  const setBusy = (b: boolean): void => {
    busy = b;
    checkBtn.disabled = b || !configured;
    imageInput.disabled = b || !configured;
  };

  const showResult = (r: ClassificationResult, inputText: string): void => {
    resultEl.innerHTML = verdictCardHtml(r, inputText);
    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const handleError = (err: unknown): void => {
    const msg =
      err instanceof NotConfiguredError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    statusEl.textContent = `Something went wrong: ${msg}`;
  };

  checkBtn.addEventListener("click", async () => {
    if (busy) return;
    const text = el<HTMLTextAreaElement>("msg").value.trim();
    if (!text) {
      statusEl.textContent = "Paste a message first, or tap a sample.";
      return;
    }
    setBusy(true);
    resultEl.hidden = true;
    statusEl.textContent = "Preparing on-device model…";
    try {
      await prepareDeviceModel((p) => {
        statusEl.textContent = `Downloading on-device model… ${Math.round(p * 100)}%`;
      });
      statusEl.textContent = "Checking…";
      const result = await classifyMessage(text);
      addHistory({
        text,
        verdict: result.verdict.verdict,
        confidence: result.verdict.confidence,
        source: result.source,
      });
      renderHistory();
      showResult(result, text);
      statusEl.textContent = result.escalated
        ? "Done — low confidence, so a cloud second opinion was requested."
        : "Done.";
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  });

  imageInput.addEventListener("change", async () => {
    if (busy) return;
    const file = imageInput.files?.[0];
    imageInput.value = "";
    if (!file) return;
    if (file.type !== "image/jpeg" && file.type !== "image/png") {
      statusEl.textContent = "Only JPEG or PNG screenshots are supported.";
      return;
    }
    setBusy(true);
    resultEl.hidden = true;
    statusEl.textContent = "Reading screenshot… (images are checked in the cloud)";
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read the image file."));
        reader.readAsDataURL(file);
      });
      const base64 = dataUrl.split(",")[1] ?? "";
      const result = await classifyImage(base64, file.type);
      addHistory({
        text: `[screenshot: ${file.name}]`,
        verdict: result.verdict.verdict,
        confidence: result.verdict.confidence,
        source: result.source,
      });
      renderHistory();
      showResult(result, `[Screenshot: ${file.name}]`);
      statusEl.textContent = "Done — image input is checked in the cloud.";
    } catch (err) {
      handleError(err);
    } finally {
      setBusy(false);
    }
  });

  el<HTMLButtonElement>("clear-history").addEventListener("click", () => {
    clearHistory();
    renderHistory();
  });

  el<HTMLUListElement>("history-list").addEventListener("click", (ev) => {
    const btn = (ev.target as HTMLElement).closest<HTMLButtonElement>(
      ".history-item",
    );
    if (!btn) return;
    el<HTMLTextAreaElement>("msg").value = btn.dataset.text ?? "";
    el<HTMLTextAreaElement>("msg").focus();
  });

  renderHistory();
  void loadSamples();
  void getModelStatus().then((s) => {
    el<HTMLElement>("model-status").textContent = modelStatusText(s);
  });
}

main();
