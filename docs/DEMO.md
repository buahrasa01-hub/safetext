# SafeText — demo video script (≤ 3 minutes, English)

Target: show the product working on the web platform, and make the hybrid
on-device/cloud behaviour visible. Record in the VM's Chrome at 1280x720.

## Beats (rough timings)

| Time | What to show | Narration |
|---|---|---|
| 0:00–0:15 | App open on GitHub Pages. Header + tagline. | "SafeText answers one question: is this message a scam? And it answers it on your device, privately." |
| 0:15–0:35 | Model-status panel. | "It uses Gemini Nano on-device through Firebase AI Logic. The status panel shows whether Nano is available on this machine." |
| 0:35–1:15 | Tap the "Fake bank alert" sample, tap Check. Verdict card appears: SCAM, 95%, red flags, advice. Point at the badge. | "Paste a suspicious message. Nano classifies it into structured JSON — verdict, confidence, red flags, advice. The badge shows where it ran: on device." |
| 1:15–1:45 | Tap the Indonesian prize sample, tap Check. Verdict card: SCAM. | "It works in Indonesian too — scam texts are a daily problem there, and the message never leaves the device." |
| 1:45–2:20 | Tap the appointment-reminder sample. Verdict card: SAFE. Then upload a screenshot sample. | "A normal message gets a Safe verdict. And a screenshot goes to the cloud — the UI says so honestly, because on-device multimodal is not guaranteed." |
| 2:20–2:45 | History list; tap an entry to reload it. | "Checks are kept in this browser only. No account, no server." |
| 2:45–3:00 | Close on the repo + live URL. | "SafeText — device first, cloud when needed. Built with Firebase AI Logic for #BuildHybridAI 2026." |

## Notes

- If Nano does not run in the VM, the badge reads "Cloud" — say so on camera
  ("on this machine it falls back to cloud; on a Nano-ready Chrome it runs
  on-device") and do not fake the badge. Honesty beats a staged demo.
- Record the cloud-fallback path as the working product; the submission text
  states on-device runs where Nano is present.
- Narration: English. Use HeyGen Voice Turbo if re-recording voiceover
  (free until 30 Nov 2026).
