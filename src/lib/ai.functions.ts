import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------- Resilient Chat Completion Fetch Helper ----------
async function fetchChatCompletionResilient(body: any): Promise<Response> {
  const providers: { name: string; url: string; key: string; model: string }[] = [];

  if (process.env.GEMINI_API_KEY) {
    providers.push({
      name: "Gemini (AI Studio)",
      url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
      key: process.env.GEMINI_API_KEY,
      model: "gemini-2.5-flash",
    });
  }
  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: "Groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      key: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
    });
  }
  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: "OpenRouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      key: process.env.OPENROUTER_API_KEY,
      model: "google/gemini-2.5-flash",
    });
  }
  if (process.env.LOVABLE_API_KEY) {
    providers.push({
      name: "Lovable Gateway",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      key: process.env.LOVABLE_API_KEY,
      model: body.model || "google/gemini-3-flash-preview",
    });
  }

  if (providers.length === 0) {
    throw new Error("Nenhuma chave de IA configurada (.env). Defina GEMINI_API_KEY, GROQ_API_KEY ou OPENROUTER_API_KEY.");
  }

  let lastErrorMsg = "";
  for (const provider of providers) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.key}`,
      };
      if (provider.name === "OpenRouter") {
        headers["HTTP-Referer"] = "https://story-weaver-ai.local";
        headers["X-Title"] = "Story Weaver AI";
      }

      const requestBody = {
        ...body,
        model: provider.model,
      };

      const res = await fetch(provider.url, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      });

      if (res.ok) {
        return res;
      } else {
        lastErrorMsg = `Provedor ${provider.name} retornou status ${res.status}: ${await res.text().catch(() => "")}`;
      }
    } catch (err: any) {
      lastErrorMsg = `Provedor ${provider.name} falhou: ${err?.message || err}`;
    }
  }

  throw new Error(`Nenhum provedor de IA disponível. Último erro: ${lastErrorMsg}`);
}

// ---------- Generate avatar (returns data URL; client uploads to storage) ----------
export const generateAvatar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(100),
        description: z.string().min(1).max(2000),
        category: z.string().max(50).optional(),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const prompt = `Portrait of a fictional character named ${data.name}. ${
      data.category ? `Genre: ${data.category}. ` : ""
    }Description: ${data.description}. Cinematic lighting, expressive face, centered headshot, photorealistic, high detail, soft moody atmosphere.`;

    let dataUrl: string | null = null;
    let errorMsg: string | null = null;

    // 1. Tentar Imagen 3 via Google AI Studio
    if (process.env.GEMINI_API_KEY) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:generateImages?key=${process.env.GEMINI_API_KEY}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            numberOfImages: 1,
            outputMimeType: "image/jpeg",
            aspectRatio: "1:1",
          }),
        });

        if (res.ok) {
          const json = await res.json();
          const bytes = json?.generatedImages?.[0]?.image?.imageBytes;
          if (bytes) {
            dataUrl = `data:image/jpeg;base64,${bytes}`;
          }
        } else {
          console.warn("Imagen 3 API falhou:", res.status, await res.text().catch(() => ""));
        }
      } catch (e: any) {
        console.error("Exceção ao usar Imagen 3:", e);
      }
    }

    // 2. Fallback para Lovable Gateway
    if (!dataUrl && process.env.LOVABLE_API_KEY) {
      try {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [{ role: "user", content: prompt }],
            modalities: ["image", "text"],
          }),
        });

        if (res.ok) {
          const json = await res.json();
          dataUrl = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url as string | undefined;
        } else {
          console.warn("Lovable avatar gen falhou:", res.status);
        }
      } catch (e: any) {
        console.error("Exceção ao usar Lovable avatar:", e);
      }
    }

    if (!dataUrl) {
      return { dataUrl: null, error: "Falha ao gerar avatar. Verifique as chaves de API." };
    }
    return { dataUrl, error: null };
  });

// ---------- Generate response suggestions ----------
export const generateSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        storyId: z.string().uuid(),
      })
      .parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content")
      .eq("story_id", data.storyId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (!msgs || msgs.length === 0) return { suggestions: [] };

    const recent = msgs.reverse();
    const last = recent[recent.length - 1];
    if (last.role !== "assistant") return { suggestions: [] };

    let res: Response;
    try {
      res = await fetchChatCompletionResilient({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você sugere 3 respostas curtas (até 12 palavras) que o usuário poderia dar no roleplay. Variadas em tom: uma reativa/falada, uma de ação narrada em itálico (*ação*), uma pergunta. Em português, na primeira pessoa, sem aspas externas.",
          },
          ...recent.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_replies",
              description: "Retorna 3 sugestões de resposta para o usuário.",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: { type: "string" },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_replies" } },
      });
    } catch (e) {
      console.error("Erro ao gerar sugestões:", e);
      return { suggestions: [] };
    }

    if (!res.ok) return { suggestions: [] };
    const json = await res.json();
    try {
      const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = typeof args === "string" ? JSON.parse(args) : args;
      const out = (parsed?.suggestions as string[] | undefined) ?? [];
      return { suggestions: out.slice(0, 3) };
    } catch {
      return { suggestions: [] };
    }
  });

// ---------- Auto-generate story title ----------
export const generateStoryTitle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ storyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: msgs } = await supabase
      .from("messages")
      .select("role, content")
      .eq("story_id", data.storyId)
      .order("created_at", { ascending: true })
      .limit(8);

    if (!msgs || msgs.length < 3) return { title: null };

    let res: Response;
    try {
      res = await fetchChatCompletionResilient({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Crie um título curto (3-6 palavras) e evocativo em português para esta história de roleplay. Sem aspas, sem pontuação final.",
          },
          {
            role: "user",
            content: msgs.map((m) => `${m.role}: ${m.content}`).join("\n").slice(0, 3000),
          },
        ],
      });
    } catch (e) {
      console.error("Erro ao gerar título da história:", e);
      return { title: null };
    }

    if (!res.ok) return { title: null };
    const json = await res.json();
    const title = (json.choices?.[0]?.message?.content as string | undefined)?.trim().replace(/^["'*]+|["'*.]+$/g, "");
    if (!title) return { title: null };

    await supabase.from("stories").update({ title }).eq("id", data.storyId).eq("user_id", userId);
    return { title };
  });
