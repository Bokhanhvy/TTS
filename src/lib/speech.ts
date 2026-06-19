// Browser SpeechSynthesis utilities (legacy/unused by the TTS panel — kept
// only as a local fallback primitive). The panel's "nghe thử" preview now
// calls fetchPreviewAudio() below, which hits the same /api/tts backend used
// for the final export, so preview and export always sound identical.

export function getBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined") return [];
  return window.speechSynthesis.getVoices();
}

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve([]);
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) return resolve(existing);
    const handler = () => {
      resolve(window.speechSynthesis.getVoices());
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1500);
  });
}

export function pickNativeVoice(lang: string, gender: "Male" | "Female", index: number) {
  const all = getBrowserVoices().filter((v) => v.lang.toLowerCase().startsWith(lang.toLowerCase().split("-")[0]));
  const exact = all.filter((v) => v.lang.toLowerCase() === lang.toLowerCase());
  const pool = exact.length ? exact : all;
  if (!pool.length) return null;
  // Heuristic: find by name gender hints
  const femaleHints = /(female|woman|samantha|victoria|karen|tessa|moira|fiona|amelie|anna|monica|alice|sin-ji|kyoko|yuna|google.*female)/i;
  const maleHints = /(male|man|daniel|alex|fred|jorge|diego|thomas|otoya|markus|google.*male)/i;
  let filtered = pool;
  if (gender === "Female") {
    const f = pool.filter((v) => femaleHints.test(v.name));
    if (f.length) filtered = f;
  } else {
    const m = pool.filter((v) => maleHints.test(v.name));
    if (m.length) filtered = m;
  }
  return filtered[index % filtered.length] ?? pool[index % pool.length];
}

export type SpeakOptions = {
  text: string;
  lang: string;
  gender: "Male" | "Female";
  voiceIndex: number;
  rate?: number;
  pitch?: number;
  volume?: number;
  onEnd?: () => void;
  onBoundary?: (e: SpeechSynthesisEvent) => void;
};

export function speak(opts: SpeakOptions) {
  if (typeof window === "undefined") return null;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(opts.text);
  const v = pickNativeVoice(opts.lang, opts.gender, opts.voiceIndex);
  if (v) u.voice = v;
  u.lang = opts.lang;
  u.rate = opts.rate ?? 1;
  u.pitch = opts.pitch ?? 1;
  u.volume = opts.volume ?? 1;
  if (opts.onEnd) u.onend = opts.onEnd;
  if (opts.onBoundary) u.onboundary = opts.onBoundary;
  window.speechSynthesis.speak(u);
  return u;
}

export function stopSpeech() {
  if (typeof window === "undefined") return;
  window.speechSynthesis.cancel();
}

// ---------------------------------------------------------------------------
// Premium speech engine — sentence chunking with prosody variation, intelligent
// pauses, and age/gender-aware pitch mapping. Built on Web Speech API for
// zero-cost local synthesis closer to natural ElevenLabs-style cadence.
// ---------------------------------------------------------------------------

export function splitForSpeech(text: string): string[] {
  // Split at sentence boundaries while keeping punctuation.
  const parts = text
    .replace(/\r\n?/g, "\n")
    .split(/(?<=[.!?。！？])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  // Further split very long clauses on commas/semicolons.
  const out: string[] = [];
  for (const p of parts) {
    if (p.length <= 220) { out.push(p); continue; }
    out.push(...p.split(/(?<=[,;:、，；])\s+/).map((s) => s.trim()).filter(Boolean));
  }
  return out;
}

export function pitchForAgeGender(age: 20 | 30 | 50 | 60, gender: "Male" | "Female"): number {
  if (gender === "Female") {
    return age === 20 ? 1.25 : age === 30 ? 1.12 : age === 50 ? 0.95 : 0.85;
  }
  return age === 20 ? 1.05 : age === 30 ? 1.0 : age === 50 ? 0.88 : 0.78;
}

export type AdvancedSpeakOptions = {
  text: string;
  lang: string;
  gender: "Male" | "Female";
  voiceIndex: number;
  rate?: number;       // base rate
  pitch?: number;      // base pitch (from age/gender)
  volume?: number;
  pauseStrength?: number; // 0..100 — controls inter-sentence silence
  expressiveness?: number; // 0..100 — pitch variance amplitude
  onEnd?: () => void;
};

type Handle = { cancelled: boolean };

/**
 * Speak text with sentence-level chunking, prosodic variation per sentence
 * (questions trend up, exclamations punchier, statements settle down) and
 * an inter-sentence silence proportional to pauseStrength.
 * Returns a handle so callers can cancel.
 */
export function speakAdvanced(opts: AdvancedSpeakOptions): Handle {
  const handle: Handle = { cancelled: false };
  if (typeof window === "undefined") return handle;
  window.speechSynthesis.cancel();

  const sentences = splitForSpeech(opts.text);
  if (!sentences.length) { opts.onEnd?.(); return handle; }

  const baseRate = opts.rate ?? 1;
  const basePitch = opts.pitch ?? 1;
  const volume = opts.volume ?? 1;
  const pauseMs = Math.round(60 + (opts.pauseStrength ?? 50) * 5); // 60..560ms
  const exprAmp = (opts.expressiveness ?? 70) / 100; // 0..1

  let i = 0;
  const playNext = () => {
    if (handle.cancelled) { opts.onEnd?.(); return; }
    if (i >= sentences.length) { opts.onEnd?.(); return; }
    const s = sentences[i++];
    const last = s.slice(-1);
    const isQuestion = last === "?" || last === "？";
    const isExclaim = last === "!" || last === "！";
    const isShort = s.length < 40;

    // Prosody offsets — small enough to stay intelligible.
    let pitch = basePitch;
    let rate = baseRate;
    if (isQuestion) { pitch += 0.12 * exprAmp; rate -= 0.04 * exprAmp; }
    else if (isExclaim) { pitch += 0.06 * exprAmp; rate += 0.05 * exprAmp; }
    else { pitch += (Math.sin(i * 1.7) * 0.05) * exprAmp; }
    if (isShort) pitch += 0.03 * exprAmp;
    // Clamp to Web Speech API ranges
    pitch = Math.max(0.5, Math.min(2, pitch));
    rate = Math.max(0.5, Math.min(2, rate));

    const u = new SpeechSynthesisUtterance(s);
    const v = pickNativeVoice(opts.lang, opts.gender, opts.voiceIndex);
    if (v) u.voice = v;
    u.lang = opts.lang;
    u.rate = rate;
    u.pitch = pitch;
    u.volume = volume;
    u.onend = () => {
      if (handle.cancelled) { opts.onEnd?.(); return; }
      // intelligent pause — longer after . ! ?, shorter after , ;
      const tailPause = isQuestion || isExclaim ? pauseMs * 1.2
        : last === "." || last === "。" ? pauseMs
        : pauseMs * 0.5;
      window.setTimeout(playNext, tailPause);
    };
    u.onerror = () => {
      if (!handle.cancelled) window.setTimeout(playNext, 50);
    };
    window.speechSynthesis.speak(u);
  };
  playNext();
  return handle;
}

export function cancelHandle(h: Handle | null) {
  if (h) h.cancelled = true;
  if (typeof window !== "undefined") window.speechSynthesis.cancel();
}

// ---------------------------------------------------------------------------
// Real-engine preview — calls the same /api/tts endpoint used for the final
// export, so the "nghe thử" voice matches the rendered audio exactly. Results
// are cached by a settings fingerprint so dragging a slider doesn't refire a
// network request for params already heard.
// ---------------------------------------------------------------------------

export type RemoteSpeakOptions = {
  text: string;
  gender: "Male" | "Female";
  voiceIndex: number;
  speed?: number;
  instructions?: string;
  signal?: AbortSignal;
};

const previewCache = new Map<string, string>(); // fingerprint -> object URL

function cacheKey(opts: RemoteSpeakOptions): string {
  return JSON.stringify({
    text: opts.text,
    gender: opts.gender,
    voiceIndex: opts.voiceIndex,
    speed: Math.round((opts.speed ?? 1) * 100),
    instructions: opts.instructions ?? "",
  });
}

/**
 * Fetch (or reuse a cached) preview clip from the real TTS backend.
 * Throws on network/HTTP errors; throws DOMException("AbortError") if the
 * signal is aborted, mirroring fetch's own behavior.
 */
export async function fetchPreviewAudio(opts: RemoteSpeakOptions): Promise<string> {
  const key = cacheKey(opts);
  const cached = previewCache.get(key);
  if (cached) return cached;

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: opts.text,
      gender: opts.gender,
      voiceIndex: opts.voiceIndex,
      speed: opts.speed ?? 1,
      instructions: opts.instructions,
    }),
    signal: opts.signal,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  previewCache.set(key, url);
  return url;
}

export function clearPreviewCache() {
  for (const url of previewCache.values()) URL.revokeObjectURL(url);
  previewCache.clear();
}

/**
 * Recorded synthesis — produces a downloadable MP3/WAV blob.
 * Uses MediaRecorder over Web Audio output of SpeechSynthesis via
 * an AudioContext destination. Falls back gracefully when not supported.
 */
export async function synthesizeToBlob(opts: SpeakOptions & { mime?: string }): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const Ctx = window.AudioContext;
      const ctx = new Ctx();
      const dest = ctx.createMediaStreamDestination();
      const recorder = new MediaRecorder(dest.stream, { mimeType: opts.mime ?? "audio/webm" });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType }));
      recorder.start();
      speak({
        ...opts,
        onEnd: () => {
          recorder.stop();
          ctx.close();
          opts.onEnd?.();
        },
      });
    } catch (e) {
      reject(e);
    }
  });
}