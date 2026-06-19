import { createFileRoute } from "@tanstack/react-router";

const FEMALE_VOICES = ["alloy", "coral", "sage", "shimmer", "marin"];
const MALE_VOICES = ["ash", "ballad", "echo", "verse", "cedar"];

function pickVoice(gender: string, index: number) {
  const pool = gender === "Male" ? MALE_VOICES : FEMALE_VOICES;
  return pool[Math.abs(index) % pool.length];
}

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
        let body: {
          text: string;
          gender?: string;
          voiceIndex?: number;
          voice?: string;
          speed?: number;
          instructions?: string;
        };
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (!body.text?.trim()) {
          return new Response(JSON.stringify({ error: "text is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const voice =
          body.voice ?? pickVoice(body.gender ?? "Female", body.voiceIndex ?? 0);

        try {
          const upstream = await fetch(
            "https://ai.gateway.lovable.dev/v1/audio/speech",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "openai/gpt-4o-mini-tts",
                input: body.text.slice(0, 4000),
                voice,
                response_format: "mp3",
                stream_format: "audio",
                speed: Math.max(0.5, Math.min(2, body.speed ?? 1)),
                instructions: body.instructions,
              }),
              signal: request.signal,
            }
          );

          if (!upstream.ok) {
            const errText = await upstream.text().catch(() => "");
            return new Response(
              JSON.stringify({
                error: `TTS failed: ${upstream.status}`,
                detail: errText.slice(0, 500),
              }),
              {
                status: upstream.status,
                headers: { "Content-Type": "application/json" },
              }
            );
          }

          return new Response(upstream.body, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store",
            },
          });
        } catch (err) {
          if (request.signal.aborted) {
            return new Response(null, { status: 499 });
          }
          return new Response(
            JSON.stringify({ error: (err as Error).message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          );
        }
      },
    },
  },
});