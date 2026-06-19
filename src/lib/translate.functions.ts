import { createServerFn } from "@tanstack/react-start";

type TranslateInput = {
  text: string;
  targetLanguage: string;
  sourceLanguage?: string;
};

type SentencePair = { source: string; target: string };

type TranslateOutput = {
  translatedText: string;
  detectedLanguage: string;
  sentenceMappings: SentencePair[];
};

const LANG_LABEL: Record<string, string> = {
  vi: "Vietnamese (Vietnam)",
  en: "English",
  fr: "French",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  "zh-CN": "Simplified Chinese",
  zh: "Chinese",
  es: "Spanish",
  pt: "Portuguese",
  it: "Italian",
  ru: "Russian",
  th: "Thai",
  id: "Indonesian",
  auto: "auto-detected language",
};

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export const translateServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: TranslateInput) => {
    if (!input || typeof input.text !== "string" || !input.text.trim()) {
      throw new Error("text is required");
    }
    if (!input.targetLanguage) throw new Error("targetLanguage is required");
    return input;
  })
  .handler(async ({ data }): Promise<TranslateOutput> => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY is not configured");

    const sentences = splitSentences(data.text);
    const targetLabel = LANG_LABEL[data.targetLanguage] ?? data.targetLanguage;

    const system =
      `You are an elite professional translator. Translate the user's text into ${targetLabel}. ` +
      `Rules:\n` +
      `- Translate meaning, tone, and context — never word-for-word.\n` +
      `- Use natural, idiomatic, fluent phrasing native speakers actually use.\n` +
      `- Preserve formatting, line breaks, numbers, names, URLs, code, and punctuation.\n` +
      `- Do NOT add explanations, notes, quotes, or extra text.\n` +
      `- Return ONLY a JSON object: ` +
      `{"detectedLanguage":"<ISO code like en, vi, ja, zh>","sentences":["<sentence translation 1>","<sentence translation 2>", ...]}\n` +
      `- The "sentences" array MUST have exactly ${sentences.length} item(s), one per source sentence below, in the same order. ` +
      `If a source sentence has no real content, return an empty string in its place.`;

    const userPayload = JSON.stringify({
      target: targetLabel,
      source_sentences: sentences,
      full_text: data.text,
    });

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPayload },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      if (resp.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
      if (resp.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
      throw new Error(`Translation failed: ${resp.status} ${body}`);
    }

    const json = await resp.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "{}";

    let parsed: { detectedLanguage?: string; sentences?: string[] } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      // Try to recover JSON in case the model wrapped it.
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch { /* noop */ }
      }
    }

    const outSentences = Array.isArray(parsed.sentences) ? parsed.sentences : [];
    // Normalise to source length so UI mapping stays aligned.
    const mappings: SentencePair[] = sentences.map((s, i) => ({
      source: s,
      target: (outSentences[i] ?? "").toString().trim(),
    }));

    const translatedText = mappings.map((m) => m.target).filter(Boolean).join(" ");

    return {
      translatedText,
      detectedLanguage: (parsed.detectedLanguage ?? data.sourceLanguage ?? "auto").toString(),
      sentenceMappings: mappings,
    };
  });