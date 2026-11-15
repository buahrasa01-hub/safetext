/**
 * Classifier prompts for SafeText.
 *
 * One shared prompt/code path for on-device and cloud: the same structured
 * JSON prompt is used by both, so the cloud path validates the on-device
 * path's logic. Short, single-turn, JSON-only output — the shape Gemini
 * Nano handles best.
 */

const OUTPUT_SPEC = `Respond with ONLY a JSON object, no other text, no markdown fences:
{"verdict": "scam" | "suspicious" | "safe", "confidence": 0.0-1.0, "red_flags": ["short reason", ...], "advice": "one short sentence telling the user what to do"}`;

const FEW_SHOT = `Examples:

Message: "URGENT: Your bank account will be closed today. Verify your identity now: http://secure-bank-verify.net/login"
{"verdict": "scam", "confidence": 0.95, "red_flags": ["creates false urgency", "link to a lookalike domain", "asks you to log in"], "advice": "Do not click the link or log in. Contact your bank through its official app."}

Message: "Selamat! Anda memenangkan hadiah Rp25.000.000 dari Telkomsel. Klaim sekarang: http://telkomsel-hadiah.xyz"
{"verdict": "scam", "confidence": 0.95, "red_flags": ["unexpected prize", "suspicious link", "pressures you to claim now"], "advice": "Jangan klik tautan itu. Hadiah resmi tidak pernah diminta lewat tautan acak."}

Message: "Hi Maya, your appointment with Dr. Chen is confirmed for Friday 10:30 AM. Reply C to cancel."
{"verdict": "safe", "confidence": 0.9, "red_flags": [], "advice": "No action needed. This looks like a normal appointment reminder."}

Message: "Halo, ini dari ekspedisi. Paket Anda tertahan karena alamat tidak lengkap. Balas YA untuk info lanjut."
{"verdict": "suspicious", "confidence": 0.55, "red_flags": ["vague sender", "asks you to reply"], "advice": "Do not reply yet. Check the tracking number on the courier's official site or app."}`;

export function buildClassifierPrompt(message: string): string {
  return `You are a scam-message classifier. Read the message below and judge whether it is a scam, suspicious, or safe. The message may be in English or Indonesian — answer in the same language as the message for the advice field.
${OUTPUT_SPEC}

${FEW_SHOT}

Message: ${JSON.stringify(message)}
`;
}

export function buildImageClassifierPrompt(): string {
  return `You are a scam-message classifier. The attached image is a screenshot or photo of a message (SMS, WhatsApp, or email). Read the text in the image and judge whether the message is a scam, suspicious, or safe. The message may be in English or Indonesian — answer in the same language as the message for the advice field.
${OUTPUT_SPEC}

${FEW_SHOT}
`;
}
