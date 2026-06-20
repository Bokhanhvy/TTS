import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LangToggle } from "@/components/LangToggle";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { TTSPanel } from "@/components/tts/TTSPanel";
import { TranslatePanel } from "@/components/translate/TranslatePanel";
import { HistoryPanel } from "@/components/HistoryPanel";
import { UserMenu } from "@/components/UserMenu";
import { Sparkles, Mic2, Languages, History as HistoryIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bé Tun — Premium Text to Speech & Smart Bilingual Translation" },
      { name: "description", content: "Studio-grade AI voices in 13 languages and intelligent sentence-mapped translation, in one elegant workspace." },
      { property: "og:title", content: "Bé Tun — Voice & Translation Studio" },
      { property: "og:description", content: "Studio-grade AI voices and intelligent bilingual translation." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <I18nProvider>
      <IndexInner />
    </I18nProvider>
  );
}

function IndexInner() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 sm:px-6 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid place-items-center h-9 w-9 shrink-0 rounded-xl text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold leading-none truncate">Bé Tun</div>
              <div className="text-[11px] text-muted-foreground truncate">{t("app.tagline")}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <LangToggle />
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-3 sm:px-6 py-6 sm:py-8">
        <section className="mb-6 sm:mb-8 text-center max-w-3xl mx-auto">
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">
            {t("hero.title.a")}{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "var(--gradient-primary)" }}>
              {t("hero.title.b")}
            </span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground">{t("hero.sub")}</p>
        </section>

        <Tabs defaultValue="tts" className="w-full">
          <TabsList className="grid grid-cols-3 max-w-lg mx-auto h-11 p-1 w-full">
            <TabsTrigger value="tts" className="gap-2 data-[state=active]:shadow-sm">
              <Mic2 className="h-4 w-4" /> <span className="truncate">{t("tab.tts")}</span>
            </TabsTrigger>
            <TabsTrigger value="translate" className="gap-2 data-[state=active]:shadow-sm">
              <Languages className="h-4 w-4" /> <span className="truncate">{t("tab.translate")}</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 data-[state=active]:shadow-sm">
              <HistoryIcon className="h-4 w-4" /> <span className="truncate">History</span>
            </TabsTrigger>
          </TabsList>
          {/* forceMount keeps both panels in the DOM so user input, generated
              audio, translation results, and voice settings survive tab switches.
              Radix hides inactive panels via data-state; we hide with Tailwind. */}
          <TabsContent
            value="tts"
            forceMount
            className="mt-8 data-[state=inactive]:hidden"
          >
            <TTSPanel />
          </TabsContent>
          <TabsContent
            value="translate"
            forceMount
            className="mt-8 data-[state=inactive]:hidden"
          >
            <TranslatePanel />
          </TabsContent>
          <TabsContent value="history" className="mt-8">
            <HistoryPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
