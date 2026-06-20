import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SaveSchema = z.object({
  text: z.string().min(1).max(50000),
  voice_name: z.string(),
  voice_gender: z.string().optional(),
  voice_age: z.number().optional(),
  language: z.string(),
  language_code: z.string().optional(),
  duration_ms: z.number().optional(),
  settings: z.record(z.any()).default({}),
  audio_base64: z.string().min(1), // base64 mp3
  audio_mime: z.string().default("audio/mpeg"),
});

export const saveTtsHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof SaveSchema>) => SaveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const bytes = Uint8Array.from(atob(data.audio_base64), (c) => c.charCodeAt(0));
    const ext = data.audio_mime.includes("wav") ? "wav" : "mp3";
    const path = `${userId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("tts-audio")
      .upload(path, bytes, { contentType: data.audio_mime, upsert: false });
    if (upErr) throw new Error("Upload failed: " + upErr.message);

    const { data: row, error } = await supabase.from("tts_history").insert({
      user_id: userId,
      text: data.text,
      voice_name: data.voice_name,
      voice_gender: data.voice_gender,
      voice_age: data.voice_age,
      language: data.language,
      language_code: data.language_code,
      audio_path: path,
      audio_mime: data.audio_mime,
      duration_ms: data.duration_ms,
      char_count: data.text.length,
      settings: data.settings,
    }).select().single();
    if (error) throw new Error(error.message);
    return row;
  });

export const listTtsHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("tts_history")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    // sign URLs (1 hour)
    const items = await Promise.all((data ?? []).map(async (h) => {
      let url: string | null = null;
      if (h.audio_path) {
        const { data: s } = await supabase.storage.from("tts-audio").createSignedUrl(h.audio_path, 3600);
        url = s?.signedUrl ?? null;
      }
      return { ...h, audio_url: url };
    }));
    return items;
  });

export const deleteTtsHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("tts_history").select("audio_path").eq("id", data.id).eq("user_id", userId).maybeSingle();
    if (row?.audio_path) {
      await supabase.storage.from("tts-audio").remove([row.audio_path]);
    }
    const { error } = await supabase.from("tts_history").delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });