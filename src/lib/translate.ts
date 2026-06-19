import { translateServerFn } from "./translate.functions";

export type SentencePair = { source: string; target: string };
export type TranslationResult = {
  translatedText: string;
  detectedLanguage: string;
  sentenceMappings: SentencePair[];
  durationMs: number;
};

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function translateText(
  text: string,
  targetLanguage = "vi",
): Promise<TranslationResult> {
  const start = performance.now();
  const result = await translateServerFn({ data: { text, targetLanguage } });
  return {
    translatedText: result.translatedText,
    detectedLanguage: result.detectedLanguage,
    sentenceMappings: result.sentenceMappings,
    durationMs: Math.round(performance.now() - start),
  };
}

export const LANG_NAME: Record<string, string> = {
  en: "English", fr: "French", de: "German", ja: "Japanese", ko: "Korean",
  zh: "Chinese", "zh-CN": "Chinese", es: "Spanish", pt: "Portuguese",
  it: "Italian", vi: "Vietnamese", ru: "Russian", th: "Thai", id: "Indonesian",
  auto: "Auto-detect",
};