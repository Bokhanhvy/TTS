import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Play, Pause, Download, Sparkles, Loader2, History,
  Volume2, Mic, Wand2, X, Headphones, Search, Square,
  SkipBack, SkipForward, Gauge, Save, Trash2, Bookmark, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { LANGUAGES, buildVoicesForLanguage, avatarUrl, type Voice } from "@/lib/voices";
import { fetchPreviewAudio } from "@/lib/speech";
import { useI18n } from "@/lib/i18n";

const EMOTIONS = [
  "Neutral", "Friendly", "Warm", "Happy", "Excited",
  "Professional", "Emotional", "Inspirational", "Motivational",
  "Calm", "Serious", "Sad",
];

// Shared instruction builder — used by BOTH the preview ("nghe thử") calls and
// the final export ("generate") call, so the two always render the same
// voice for the same settings. Preview is the source of truth's *mirror*:
// generate is authoritative, preview simply calls the exact same backend.
function buildInstructions(opts: {
  emotion: string;
  naturalness: number;
  expressiveness: number;
  stability: number;
  pauseStrength: number;
  pitch: number;
  gender: "Male" | "Female";
  age: 20 | 30 | 50 | 60;
}) {
  const pitchDesc =
    opts.pitch >= 1.3 ? "noticeably higher-pitched" :
    opts.pitch >= 1.08 ? "slightly higher-pitched" :
    opts.pitch <= 0.75 ? "noticeably lower-pitched and deeper" :
    opts.pitch <= 0.92 ? "slightly lower-pitched and deeper" :
    "natural pitch";
  return `Speak in a ${opts.emotion.toLowerCase()} tone. Naturalness ${opts.naturalness}/100, expressiveness ${opts.expressiveness}/100, stability ${opts.stability}/100, pause strength ${opts.pauseStrength}/100. Use natural intonation, pauses, and emphasis like a human ${opts.gender.toLowerCase()} narrator in their ${opts.age}s, with a ${pitchDesc} voice.`;
}

type HistoryItem = {
  id: string;
  text: string;
  voice: Voice;
  language: string;
  url: string;
  createdAt: number;
  user: string;
};

export function TTSPanel() {
  const { t } = useI18n();
  const [text, setText] = useState("The future of building happens together. Tools and trends evolve, but collaboration endures.");
  const [langCode, setLangCode] = useState("en-US");
  const [genderFilter, setGenderFilter] = useState<"All" | "Female" | "Male">("All");
  const [ageFilter, setAgeFilter] = useState<"All" | 20 | 30 | 50 | 60>("All");
  const [selectedVoice, setSelectedVoice] = useState<Voice | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewingText, setPreviewingText] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [stability, setStability] = useState(75);
  const [emotionLevel, setEmotionLevel] = useState(70);
  const [expressiveness, setExpressiveness] = useState(80);
  const [naturalness, setNaturalness] = useState(90);
  const [pauseStrength, setPauseStrength] = useState(50);
  const [emotion, setEmotion] = useState("Friendly");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [result, setResult] = useState<HistoryItem | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyUser, setHistoryUser] = useState<string>("All");
  const [historyLang, setHistoryLang] = useState<string>("All");
  const [historyDate, setHistoryDate] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const previewingTextRef = useRef(false);
  const previewReqIdRef = useRef(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  // ---- Presets (A/B comparison) ----
  type Preset = {
    id: string; name: string;
    voiceId: string | null; langCode: string;
    speed: number; pitch: number; volume: number;
    emotion: string; emotionLevel: number; expressiveness: number;
    stability: number; naturalness: number; pauseStrength: number;
  };
  const [presets, setPresets] = useState<Preset[]>([]);
  const [presetName, setPresetName] = useState("");
  useEffect(() => {
    try {
      const raw = localStorage.getItem("tts.presets");
      if (raw) setPresets(JSON.parse(raw));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("tts.presets", JSON.stringify(presets)); } catch {}
  }, [presets]);

  const language = LANGUAGES.find((l) => l.code === langCode)!;
  const allVoices = useMemo(() => buildVoicesForLanguage(language), [langCode]);

  const voices = allVoices.filter((v) =>
    (genderFilter === "All" || v.gender === genderFilter) &&
    (ageFilter === "All" || v.age === ageFilter)
  );

  const charCount = text.length;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const estimatedSeconds = Math.max(1, Math.round((wordCount / 150) * 60 / speed));

  // Lazily create the single hidden <audio> element used for every preview
  // (voice-card preview AND script preview share one player, so starting one
  // always stops the other — same behavior as before, real audio now).
  const getPreviewAudio = () => {
    if (!previewAudioRef.current) {
      const a = new Audio();
      a.preload = "auto";
      previewAudioRef.current = a;
    }
    return previewAudioRef.current;
  };

  const stopPreview = useCallback(() => {
    previewAbortRef.current?.abort();
    previewAbortRef.current = null;
    const a = previewAudioRef.current;
    if (a) { a.pause(); a.onended = null; a.onerror = null; }
    previewReqIdRef.current++; // invalidate any in-flight request
    setPreviewingId(null);
    previewingTextRef.current = false;
    setPreviewingText(false);
    setPreviewLoading(false);
  }, []);

  useEffect(() => {
    // reset voice when language changes (also stop any in-flight preview,
    // since its snippet text/voice no longer matches the new language)
    stopPreview();
    setSelectedVoice(allVoices[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langCode]);

  // Core: play a real preview clip from the same engine generate() uses.
  const playRealPreview = useCallback(async (opts: {
    voice: Voice;
    snippetText: string;
    onDone: () => void;
  }) => {
    const reqId = ++previewReqIdRef.current;
    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const voiceIndex = parseInt(opts.voice.id.split("-").pop() ?? "0", 10);
      const instructions = buildInstructions({
        emotion, naturalness, expressiveness, stability, pauseStrength,
        pitch, gender: opts.voice.gender, age: opts.voice.age,
      });
      const url = await fetchPreviewAudio({
        text: opts.snippetText,
        gender: opts.voice.gender,
        voiceIndex,
        speed,
        instructions,
        signal: controller.signal,
      });
      if (reqId !== previewReqIdRef.current) return; // superseded — drop it
      const a = getPreviewAudio();
      a.src = url;
      a.volume = volume;
      a.playbackRate = 1; // speed is already baked in server-side via `speed`
      a.onended = () => { if (reqId === previewReqIdRef.current) opts.onDone(); };
      a.onerror = () => {
        if (reqId !== previewReqIdRef.current) return;
        setPreviewError(t("tts.previewFailed"));
        opts.onDone();
      };
      setPreviewLoading(false);
      await a.play();
    } catch (e) {
      if (reqId !== previewReqIdRef.current) return;
      setPreviewLoading(false);
      if ((e as Error).name === "AbortError") return; // superseded, silent
      setPreviewError((e as Error).message || t("tts.previewFailed"));
      opts.onDone();
    }
  }, [emotion, naturalness, expressiveness, stability, pauseStrength, pitch, speed, volume, t]);

  const previewVoice = (v: Voice) => {
    if (previewingId === v.id) {
      stopPreview();
      return;
    }
    stopPreview();
    setPreviewingId(v.id);
    playRealPreview({
      voice: v,
      snippetText: language.sample,
      onDone: () => setPreviewingId(null),
    });
  };

  const startTextPreview = useCallback(() => {
    if (!selectedVoice || !text.trim()) return;
    // First ~320 chars is plenty to judge the voice without re-rendering the
    // whole script on every slider tick.
    const snippet = text.trim().slice(0, 320);
    setPreviewingId(null);
    playRealPreview({
      voice: selectedVoice,
      snippetText: snippet,
      onDone: () => {
        if (previewingTextRef.current) {
          previewingTextRef.current = false;
          setPreviewingText(false);
        }
      },
    });
  }, [selectedVoice, text, playRealPreview]);

  const previewCurrentText = () => {
    if (previewingText) {
      stopPreview();
      return;
    }
    if (!selectedVoice || !text.trim()) {
      toast.error(t("tts.previewNeedsText"));
      return;
    }
    previewingTextRef.current = true;
    setPreviewingText(true);
    startTextPreview();
  };

  // Live parameter updates: while the script preview is playing, any settings
  // change (voice, speed, pitch, volume, emotion, expressiveness, etc.)
  // restarts the snippet against the real engine with the new params,
  // debounced so dragging a slider doesn't spam the API.
  useEffect(() => {
    if (!previewingText) return;
    const id = window.setTimeout(() => { startTextPreview(); }, 400);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed, pitch, volume, pauseStrength, expressiveness, emotion, naturalness, stability, selectedVoice?.id, previewingText]);

  // Volume changes apply instantly without a re-fetch, even mid-playback.
  useEffect(() => {
    const a = previewAudioRef.current;
    if (a) a.volume = volume;
  }, [volume]);

  // Stop any preview on unmount.
  useEffect(() => () => stopPreview(), [stopPreview]);

  const generate = async () => {
    if (!selectedVoice || !text.trim()) {
      toast.error("Please enter text and select a voice");
      return;
    }
    stopPreview();
    setGenerating(true);
    setProgress(0);
    setProgressLabel("Rendering audio…");
    // Smooth indeterminate-style progress capped at 90% until response arrives
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current);
    progressTimerRef.current = window.setInterval(() => {
      setProgress((p) => (p < 90 ? p + Math.max(1, (90 - p) * 0.06) : p));
    }, 200) as unknown as number;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const voiceIndex = parseInt(selectedVoice.id.split("-").pop() ?? "0", 10);
      const instructions = buildInstructions({
        emotion, naturalness, expressiveness, stability, pauseStrength,
        pitch, gender: selectedVoice.gender, age: selectedVoice.age,
      });
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          gender: selectedVoice.gender,
          voiceIndex,
          speed,
          instructions,
        }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const item: HistoryItem = {
        id: crypto.randomUUID(),
        text,
        voice: selectedVoice,
        language: language.label,
        url,
        createdAt: Date.now(),
        user: "bekhanhvy",
      };
      setProgress(100);
      setProgressLabel("Done");
      setResult(item);
      setHistory((h) => [item, ...h].slice(0, 100));
      toast.success("Audio generated");
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        toast.info("Generation cancelled");
      } else {
        toast.error("Generation failed: " + (e as Error).message);
      }
    } finally {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
      abortRef.current = null;
      setGenerating(false);
    }
  };

  const cancelGenerate = () => {
    abortRef.current?.abort();
  };

  const savePreset = () => {
    const name = presetName.trim() || `Preset ${presets.length + 1}`;
    const p: Preset = {
      id: crypto.randomUUID(), name,
      voiceId: selectedVoice?.id ?? null, langCode,
      speed, pitch, volume, emotion, emotionLevel,
      expressiveness, stability, naturalness, pauseStrength,
    };
    setPresets((arr) => [p, ...arr].slice(0, 12));
    setPresetName("");
    toast.success("Preset saved");
  };
  const applyPreset = (p: Preset) => {
    setLangCode(p.langCode);
    setSpeed(p.speed); setPitch(p.pitch); setVolume(p.volume);
    setEmotion(p.emotion); setEmotionLevel(p.emotionLevel);
    setExpressiveness(p.expressiveness); setStability(p.stability);
    setNaturalness(p.naturalness); setPauseStrength(p.pauseStrength);
    if (p.voiceId) {
      // try to select matching voice id (after language switch picks up)
      window.setTimeout(() => {
        const found = buildVoicesForLanguage(LANGUAGES.find((l) => l.code === p.langCode)!).find((v) => v.id === p.voiceId);
        if (found) setSelectedVoice(found);
      }, 0);
    }
    toast.success(`Applied: ${p.name}`);
  };
  const deletePreset = (id: string) => setPresets((arr) => arr.filter((p) => p.id !== id));

  const download = (item: HistoryItem, ext: "mp3" | "wav" | "m4a" = "mp3") => {
    const a = document.createElement("a");
    a.href = item.url;
    a.download = `${item.voice.name}-${Date.now()}.${ext}`;
    a.click();
  };

  const filteredHistory = history.filter((h) => {
    if (historySearch) {
      const q = historySearch.toLowerCase();
      if (
        !h.voice.name.toLowerCase().includes(q) &&
        !h.user.toLowerCase().includes(q) &&
        !h.language.toLowerCase().includes(q)
      )
        return false;
    }
    if (historyUser !== "All" && h.user !== historyUser) return false;
    if (historyLang !== "All" && h.language !== historyLang) return false;
    if (historyDate) {
      const d = new Date(h.createdAt).toISOString().slice(0, 10);
      if (d !== historyDate) return false;
    }
    return true;
  });

  const historyUsers = Array.from(new Set(history.map((h) => h.user)));
  const historyLangs = Array.from(new Set(history.map((h) => h.language)));

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
        {/* 1) Script */}
        <Card className="p-4 sm:p-5 border-border/60 shadow-[var(--shadow-elegant)]">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 mb-3 sm:flex sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <div className="rounded-md p-2 shrink-0" style={{ background: "var(--gradient-primary)" }}>
                <Mic className="h-4 w-4 text-primary-foreground" />
              </div>
              <h3 className="font-semibold truncate">{t("tts.script")}</h3>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-[11px] sm:text-xs text-muted-foreground">
              <span>{charCount} {t("tts.chars")}</span>
              <span>·</span>
              <span>{wordCount} {t("tts.words")}</span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">~{estimatedSeconds}s {t("tts.audio")}</span>
            </div>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("tts.placeholder")}
            className="h-[260px] sm:h-[300px] resize-none text-base leading-relaxed whitespace-pre-wrap break-words overflow-auto"
            spellCheck={false}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={previewCurrentText}
              disabled={(!selectedVoice || !text.trim()) || (previewLoading && !previewingText)}
            >
              {previewingText ? (
                previewLoading ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> {t("tts.loadingPreview")}</>
                ) : (
                  <><Pause className="h-3.5 w-3.5 mr-1.5" /> {t("tts.stopPreview")}</>
                )
              ) : (
                <><Headphones className="h-3.5 w-3.5 mr-1.5" /> {t("tts.preview")}</>
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                stopPreview();
                abortRef.current?.abort();
                setText("");
                setResult(null);
                setProgress(0);
                setProgressLabel("");
                setPreviewError(null);
                toast.success(t("tts.cleared") ?? "Cleared");
              }}
              disabled={generating}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {t("tts.clearAll") ?? "Clear all"}
            </Button>
            <span className="text-[11px] sm:text-xs text-muted-foreground">{t("tts.previewHint")}</span>
            {previewError && (
              <span className="flex items-center gap-1 text-[11px] sm:text-xs text-destructive">
                <AlertCircle className="h-3 w-3" /> {previewError}
              </span>
            )}
          </div>
        </Card>

        {/* 2) Output — directly below Script so the rendered result is the
            first thing you see after writing/previewing, matching the same
            engine used by the preview above. */}
        {(result || generating) && (
          <Card className="p-4 sm:p-5 border-border/60">
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">{t("tts.output")}</h3>
            </div>
            {generating && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> {progressLabel}
                  </span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} />
                <div className="flex justify-end">
                  <Button size="sm" variant="destructive" onClick={cancelGenerate}>
                    <X className="h-3.5 w-3.5 mr-1.5" /> {t("tts.cancelGen")}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  No audio plays during render. Press Play after the file is ready.
                </p>
              </div>
            )}
            {result && !generating && (
              <AdvancedPlayer
                item={result}
                initialVolume={volume}
                onDownload={(ext) => download(result, ext)}
              />
            )}
          </Card>
        )}

        {/* 3) Voice Settings — directly below Output as requested */}
        <Card className="p-4 sm:p-5 border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Wand2 className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">{t("tts.settings")}</h3>
          </div>

          {selectedVoice && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-border/60 p-3 bg-accent/20">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={avatarUrl(selectedVoice.avatarSeed)} />
                <AvatarFallback>{selectedVoice.name[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{selectedVoice.name}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {selectedVoice.gender} · {selectedVoice.age}s · {selectedVoice.accent}
                </div>
              </div>
            </div>
          )}

          <Tabs defaultValue="tone">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="tone">{t("tts.tone")}</TabsTrigger>
              <TabsTrigger value="advanced">{t("tts.advanced")}</TabsTrigger>
            </TabsList>
            <TabsContent value="tone" className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-muted-foreground">{t("tts.emotion")}</label>
                <Select value={emotion} onValueChange={setEmotion}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EMOTIONS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <SliderRow label={t("tts.speed")} value={speed} min={0.5} max={2} step={0.05} onChange={setSpeed} suffix="x" />
              <SliderRow label={t("tts.pitch")} value={pitch} min={0.5} max={1.8} step={0.05} onChange={setPitch} suffix="x" />
              <SliderRow label={t("tts.volume")} value={volume} min={0} max={1} step={0.05} onChange={setVolume} />
              <SliderRow label={t("tts.emotionIntensity")} value={emotionLevel} min={0} max={100} step={1} onChange={setEmotionLevel} />
              <SliderRow label={t("tts.expressiveness")} value={expressiveness} min={0} max={100} step={1} onChange={setExpressiveness} />
              <SliderRow label={t("tts.pauseStrength")} value={pauseStrength} min={0} max={100} step={1} onChange={setPauseStrength} />
            </TabsContent>
            <TabsContent value="advanced" className="mt-4 grid gap-4 sm:grid-cols-2">
              <SliderRow label={t("tts.stability")} value={stability} min={0} max={100} step={1} onChange={setStability} />
              <SliderRow label={t("tts.naturalness")} value={naturalness} min={0} max={100} step={1} onChange={setNaturalness} />
            </TabsContent>
          </Tabs>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={generate}
              disabled={generating || !selectedVoice || !text.trim()}
              className="flex-1 h-11 text-base font-semibold"
              style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
              {generating ? t("tts.rendering") : t("tts.generate")}
            </Button>
            {generating && (
              <Button onClick={cancelGenerate} variant="outline" className="sm:w-auto">
                <X className="h-4 w-4 mr-2" /> {t("tts.cancel")}
              </Button>
            )}
          </div>

          {/* Voice presets — A/B comparison */}
          <div className="mt-6 pt-5 border-t border-border/60">
            <div className="flex items-center gap-2 mb-3">
              <Bookmark className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">{t("tts.presets")}</h4>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder={t("tts.presetName")}
                className="h-9 sm:flex-1"
              />
              <Button size="sm" variant="outline" onClick={savePreset} className="h-9">
                <Save className="h-3.5 w-3.5 mr-1.5" /> {t("tts.savePreset")}
              </Button>
            </div>
            {presets.length === 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">{t("tts.noPreset")}</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {presets.map((p) => (
                  <div key={p.id} className="group flex items-center gap-1 rounded-full border border-border/60 bg-accent/30 pl-3 pr-1 py-1 text-xs">
                    <button onClick={() => applyPreset(p)} className="font-medium hover:text-primary truncate max-w-[140px]">{p.name}</button>
                    <button onClick={() => deletePreset(p.id)} className="rounded-full p-1 hover:bg-destructive/10 hover:text-destructive" aria-label="Delete">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* 4) Voice Library */}
        <Card className="p-4 sm:p-5 border-border/60">
          <div className="flex flex-col gap-4 mb-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-semibold">{t("tts.library")}</h3>
              <Badge variant="secondary" className="ml-2">{voices.length} {t("tts.voices")}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={langCode} onValueChange={setLangCode}>
                <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => (
                    <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={genderFilter} onValueChange={(v: any) => setGenderFilter(v)}>
                <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{t("tts.all")}</SelectItem>
                  <SelectItem value="Female">{t("tts.female")}</SelectItem>
                  <SelectItem value="Male">{t("tts.male")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={String(ageFilter)} onValueChange={(v) => setAgeFilter(v === "All" ? "All" : (parseInt(v) as 20 | 30 | 50 | 60))}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{t("tts.allAges")}</SelectItem>
                  <SelectItem value="20">20s</SelectItem>
                  <SelectItem value="30">30s</SelectItem>
                  <SelectItem value="50">50s</SelectItem>
                  <SelectItem value="60">60s</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 max-h-[520px] overflow-y-auto pr-1">
            {voices.map((v) => {
              const isSelected = selectedVoice?.id === v.id;
              const isPlaying = previewingId === v.id;
              const isLoadingThis = isPlaying && previewLoading;
              return (
                <motion.button
                  key={v.id}
                  whileHover={{ y: -2 }}
                  onClick={() => setSelectedVoice(v)}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    isSelected
                      ? "border-primary bg-accent/40 ring-1 ring-primary/30"
                      : "border-border/60 hover:bg-accent/30"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={avatarUrl(v.avatarSeed)} alt={v.name} />
                      <AvatarFallback>{v.name.slice(0, 2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium truncate">{v.name}</div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); previewVoice(v); }}
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:opacity-90 cursor-pointer"
                          aria-label="Preview voice"
                        >
                          {isLoadingThis ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isPlaying ? (
                            <Pause className="h-3.5 w-3.5" />
                          ) : (
                            <Play className="h-3.5 w-3.5" />
                          )}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {v.gender} · {v.age}s · {v.accent}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {v.styles.slice(0, 3).map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px] font-normal">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </Card>

        {history.length > 0 && (
          <Card className="p-4 sm:p-5 border-border/60">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <h3 className="font-semibold">{t("tts.history")}</h3>
                <Badge variant="secondary">{filteredHistory.length}</Badge>
              </div>
            </div>
            <div className="grid gap-2 mb-3 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder={t("tts.searchHistory")}
                  className="pl-7 h-9"
                />
              </div>
              <Select value={historyUser} onValueChange={setHistoryUser}>
                <SelectTrigger className="h-9"><SelectValue placeholder="User" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{t("tts.allUsers")}</SelectItem>
                  {historyUsers.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={historyLang} onValueChange={setHistoryLang}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Language" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">{t("tts.allLangs")}</SelectItem>
                  {historyLangs.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={historyDate}
                onChange={(e) => setHistoryDate(e.target.value)}
                className="h-9 md:col-span-4"
              />
            </div>
            <div className="divide-y divide-border/60 max-h-[360px] overflow-y-auto">
              {filteredHistory.map((h) => (
                <div key={h.id} className="flex items-center gap-2 py-2 text-sm">
                  <Avatar className="h-7 w-7 shrink-0"><AvatarImage src={avatarUrl(h.voice.avatarSeed)} /><AvatarFallback>{h.voice.name[0]}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-2 gap-y-0.5 items-center">
                    <span className="font-medium truncate">{h.user}</span>
                    <span className="truncate">{h.voice.name}</span>
                    <span className="truncate text-muted-foreground">{h.language}</span>
                    <span className="truncate text-muted-foreground tabular-nums">
                      {new Date(h.createdAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}
                    </span>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => setResult(h)} title="Open" className="shrink-0">
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => download(h)} title="Download" className="shrink-0">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {filteredHistory.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">{t("tts.noRecords")}</div>
              )}
            </div>
          </Card>
        )}
    </div>
  );
}

function AdvancedPlayer({
  item,
  initialVolume = 1,
  onDownload,
}: {
  item: HistoryItem;
  initialVolume?: number;
  onDownload: (ext: "mp3" | "wav" | "m4a") => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(initialVolume);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
  }, [item.id]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = volume;
  }, [volume, item.id]);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) { a.play(); setPlaying(true); }
    else { a.pause(); setPlaying(false); }
  };

  const stop = () => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    setPlaying(false);
  };

  const fmt = (s: number) =>
    !isFinite(s) ? "0:00" : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <audio
        ref={audioRef}
        src={item.url}
        onLoadedMetadata={(e) => setDuration((e.target as HTMLAudioElement).duration)}
        onTimeUpdate={(e) => setCurrent((e.target as HTMLAudioElement).currentTime)}
        onEnded={() => setPlaying(false)}
        hidden
      />
      <div className="flex items-center gap-2">
        <Button size="icon" variant="default" onClick={toggle} className="h-10 w-10 rounded-full">
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="outline" onClick={stop} className="h-9 w-9 rounded-full">
          <Square className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, current - 10); }} className="h-9 w-9">
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.min(duration, current + 10); }} className="h-9 w-9">
          <SkipForward className="h-4 w-4" />
        </Button>
        <div className="flex-1 flex items-center gap-2 text-xs tabular-nums">
          <span className="text-muted-foreground w-10 text-right">{fmt(current)}</span>
          <Slider
            value={[current]}
            min={0}
            max={duration || 1}
            step={0.1}
            onValueChange={([v]) => { if (audioRef.current) audioRef.current.currentTime = v; }}
            className="flex-1"
          />
          <span className="text-muted-foreground w-10">{fmt(duration)}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 min-w-[160px] flex-1">
          <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
          <Slider
            value={[volume * 100]}
            min={0}
            max={100}
            step={1}
            onValueChange={([v]) => { setVolume(v / 100); if (audioRef.current) audioRef.current.volume = v / 100; }}
          />
        </div>
        <div className="flex items-center gap-1">
          <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
          {[0.75, 1, 1.25, 1.5, 2].map((r) => (
            <Button
              key={r}
              size="sm"
              variant={rate === r ? "default" : "outline"}
              onClick={() => setRate(r)}
              className="h-7 px-2 text-xs"
            >
              {r}x
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">{item.voice.name}</span> · {item.language}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onDownload("mp3")}>
            <Download className="h-3.5 w-3.5 mr-1" /> MP3
          </Button>
          <Button size="sm" variant="outline" onClick={() => onDownload("wav")}>WAV</Button>
          <Button size="sm" variant="outline" onClick={() => onDownload("m4a")}>M4A</Button>
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label, value, min, max, step, onChange, suffix = "",
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">{value}{suffix}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={([v]) => onChange(v)} />
    </div>
  );
}