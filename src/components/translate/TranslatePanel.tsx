import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Copy, Download, Loader2, Languages, Sparkles, Trash2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { translateText, type TranslationResult, LANG_NAME, splitSentences } from "@/lib/translate";
import { useI18n } from "@/lib/i18n";

const TARGETS = [
  { code: "vi", label: "Vietnamese" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh-CN", label: "Chinese" },
  { code: "es", label: "Spanish" },
];

export function TranslatePanel() {
  const { t } = useI18n();
  const [text, setText] = useState("The future of building happens together. Tools and trends evolve, but collaboration endures.");
  const [target, setTarget] = useState("vi");
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const reqIdRef = useRef(0);

  const charCount = text.length;
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const sourcePreview = useMemo(() => splitSentences(text), [text]);

  const handleTranslate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    const myReq = ++reqIdRef.current;
    try {
      const r = await translateText(text, target);
      if (myReq !== reqIdRef.current) return;
      setResult(r);
    } catch (e) {
      if (myReq !== reqIdRef.current) return;
      toast.error(e instanceof Error ? e.message : "Translation failed");
    } finally {
      if (myReq === reqIdRef.current) setLoading(false);
    }
  };

  // Auto-translate with debounce when text or target changes.
  useEffect(() => {
    if (!text.trim()) {
      setResult(null);
      return;
    }
    const t = setTimeout(() => { handleTranslate(); }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, target]);

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success("Copied");
  };

  const downloadTxt = () => {
    if (!result) return;
    const blob = new Blob([result.translatedText], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "translation.txt";
    a.click();
  };

  const downloadDocx = () => {
    if (!result) return;
    // Minimal HTML→.doc (Word opens it as docx-compatible)
    const html = `<html><body><h2>Source</h2><p>${text}</p><h2>Translation</h2><p>${result.translatedText}</p></body></html>`;
    const blob = new Blob([html], { type: "application/msword" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "translation.doc";
    a.click();
  };

  const sentences = result?.sentenceMappings ?? sourcePreview.map((s) => ({ source: s, target: "" }));

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">{t("tr.autoDetect")}</span>
          {result && (
            <Badge variant="secondary">{LANG_NAME[result.detectedLanguage] ?? result.detectedLanguage}</Badge>
          )}
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground mx-2" />
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TARGETS.map((t) => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setText(""); setResult(null); }}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> {t("tr.clear")}
          </Button>
          <Button
            onClick={handleTranslate}
            disabled={loading || !text.trim()}
            style={{ background: "var(--gradient-primary)", color: "var(--primary-foreground)" }}
          >
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {t("tr.translate")}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 border-border/60">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{t("tr.source")}</span>
            <span>{charCount} chars · {wordCount} words</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("tr.placeholder")}
            className="h-[260px] resize-none text-base leading-relaxed border-0 shadow-none focus-visible:ring-0 px-0 whitespace-pre-wrap break-words overflow-auto"
          />
        </Card>

        <Card className="p-4 border-border/60 bg-[var(--gradient-subtle)]">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
            <span>{t("tr.translation")}</span>
            <span>
              {result ? `${result.translatedText.length} chars · ${result.durationMs}ms` : "—"}
            </span>
          </div>
          <div className="h-[260px] overflow-auto text-base leading-relaxed whitespace-pre-wrap break-words">
            {result?.translatedText || <span className="text-muted-foreground">{t("tr.willAppear")}</span>}
          </div>
          {result && (
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copy(result.translatedText)}><Copy className="h-3.5 w-3.5 mr-1" /> Copy</Button>
              <Button size="sm" variant="outline" onClick={downloadTxt}><Download className="h-3.5 w-3.5 mr-1" /> TXT</Button>
              <Button size="sm" variant="outline" onClick={downloadDocx}><Download className="h-3.5 w-3.5 mr-1" /> DOCX</Button>
            </div>
          )}
        </Card>
      </div>

      {result && (
        <Card className="p-5 border-border/60">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">{t("tr.mapping")}</h3>
            <span className="text-xs text-muted-foreground ml-2">{t("tr.mappingHint")}</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="space-y-1.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Source</div>
              {sentences.map((s, i) => (
                <motion.div
                  key={`s-${i}`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => copy(s.source)}
                  animate={{
                    backgroundColor: hovered === i ? "color-mix(in oklab, var(--primary) 14%, transparent)" : "rgba(0,0,0,0)",
                  }}
                  className="cursor-pointer rounded-md px-3 py-2 text-sm leading-relaxed border border-transparent hover:border-primary/30 transition-colors"
                >
                  {s.source}
                </motion.div>
              ))}
            </div>
            <div className="space-y-1.5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Vietnamese</div>
              {sentences.map((s, i) => (
                <motion.div
                  key={`t-${i}`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => copy(s.target)}
                  animate={{
                    backgroundColor: hovered === i ? "color-mix(in oklab, var(--primary) 14%, transparent)" : "rgba(0,0,0,0)",
                  }}
                  className="cursor-pointer rounded-md px-3 py-2 text-sm leading-relaxed border border-transparent hover:border-primary/30 transition-colors"
                >
                  {s.target}
                </motion.div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}