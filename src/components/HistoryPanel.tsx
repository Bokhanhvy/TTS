import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Trash2, Download, RefreshCw, LogIn, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { listTtsHistory, deleteTtsHistory } from "@/lib/tts-history.functions";
import { useNavigate } from "@tanstack/react-router";

type Item = Awaited<ReturnType<typeof listTtsHistory>>[number];

export function HistoryPanel() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listTtsHistory();
      setItems(data);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) refresh(); }, [user?.id]);

  if (authLoading) return null;
  if (!user) {
    return (
      <Card className="p-10 text-center max-w-md mx-auto">
        <p className="text-muted-foreground mb-4">Sign in to sync your audio history across devices.</p>
        <Button onClick={() => navigate({ to: "/auth" })}>
          <LogIn className="h-4 w-4 mr-2" /> Sign in
        </Button>
      </Card>
    );
  }

  const filtered = items.filter((h) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return h.text.toLowerCase().includes(s) || h.voice_name.toLowerCase().includes(s) || h.language.toLowerCase().includes(s);
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteTtsHistory({ data: { id } });
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search text, voice or language…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button variant="outline" onClick={refresh} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Refresh
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          {loading ? "Loading…" : "No history yet. Generate some audio to see it here."}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((h) => (
            <Card key={h.id} className="p-3 sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                    <Badge variant="secondary">{h.voice_name}</Badge>
                    <Badge variant="outline">{h.language}</Badge>
                    <span>{new Date(h.created_at).toLocaleString()}</span>
                    <span>· {h.char_count ?? h.text.length} chars</span>
                  </div>
                  <p className="text-sm line-clamp-2">{h.text}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {h.audio_url ? (
                    <audio controls src={h.audio_url} className="h-9 max-w-[260px]" />
                  ) : (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Volume2 className="h-3 w-3" /> no file</span>
                  )}
                  {h.audio_url && (
                    <Button size="icon" variant="ghost" asChild>
                      <a href={h.audio_url} download={`${h.voice_name}-${h.id}.mp3`}><Download className="h-4 w-4" /></a>
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => handleDelete(h.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}