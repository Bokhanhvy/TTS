import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "en" ? "vi" : "en")}
      aria-label="Toggle language"
      className="gap-1.5"
    >
      <Languages className="h-4 w-4" />
      <span className="text-xs font-semibold tabular-nums">{lang.toUpperCase()}</span>
    </Button>
  );
}