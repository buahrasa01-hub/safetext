# SafeText — Is this message a scam?

Paste a suspicious SMS, WhatsApp or email message, and your own device tells
you if it is a scam — and why. Built for
[#BuildHybridAI 2026](https://firebasehybridaihackathon.devpost.com/).

**Live demo:** https://buahrasa01-hub.github.io/safetext/

## Why on-device?

A scam message may contain your personal data — account numbers, names,
addresses. SafeText checks it **on your device with Gemini Nano** whenever
possible, so the message never leaves the device. When Nano cannot do the
job, the same prompt runs in the cloud instead. That is the hybrid story:
**device first, cloud when needed.**

## How hybrid inference works

SafeText uses **Firebase AI Logic** (`firebase/ai`) with one
`GenerativeModel` in `InferenceMode.PREFER_ON_DEVICE`:

- **Text messages** → the hybrid model. `initializeDeviceModel()` is called
  on the Check button tap (a user gesture), then `generateContent()` runs
  on-device when Gemini Nano is available and falls back to cloud otherwise.
  The response's `inferenceSource` (`ON_DEVICE` / `IN_CLOUD`) is shown as a
  badge on every verdict, so you can see which path ran.
- **Low-confidence results** → the same prompt is run a second time through
  a `PREFER_IN_CLOUD` model as a second opinion. The higher-confidence
  verdict wins, and the card shows both when they differ.
- **Screenshots/photos** → always the cloud model. On-device multimodal
  needs a Chrome flag and is not guaranteed to be present, so the UI states
  this clearly instead of pretending otherwise.
- **Model status panel** → reads `LanguageModel.availability()` so the
  on-device state is visible, not a black box.

The classifier prompt is a single-turn, structured-JSON prompt with few-shot
examples in English and Indonesian. Output shape:

```json
{"verdict": "scam" | "suspicious" | "safe", "confidence": 0.0-1.0, "red_flags": ["..."], "advice": "..."}
```

## Run it

```bash
npm install
npm run dev      # local dev server
npm run build    # typecheck + production build (output: dist/)
```

Requires a Firebase project: copy the web app config into
`src/firebase-config.ts` (see the `TODO` in that file) and, in the Firebase
console, enable AI Logic with the Gemini Developer API backend and safelist
an App Check debug token. No billing is needed for text inference within
usage limits. Until the config is added, the app shows a clear
"Firebase not configured yet" state and classification stays disabled.

## Deploy

Pushing to `main` builds and deploys to GitHub Pages automatically
(`.github/workflows/deploy.yml`).

## Privacy

- On-device checks never leave the device.
- History is stored in `localStorage` on the device only — no account, no server.
- No analytics, no tracking.

## License

Apache-2.0. See [LICENSE](LICENSE).
