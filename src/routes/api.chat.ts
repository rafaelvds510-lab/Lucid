import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function buildSystemPrompt(
  c: {
    name: string;
    category: string;
    personality: string;
    speech_style: string;
    backstory: string;
    scenario: string;
  },
  opts: { loopWarning?: string; bannedPhrases?: string[]; userStuck?: boolean } = {},
) {
  const banned =
    opts.bannedPhrases && opts.bannedPhrases.length > 0
      ? `\nFRASES PROIBIDAS (já usadas — NÃO repita literalmente nem com pequenas variações):\n${opts.bannedPhrases.map((p) => `- "${p}"`).join("\n")}\n`
      : "";
  return `Você é um mestre de roleplay interpretando "${c.name}" (${c.category}). Foco TOTAL em imersão, consistência e PROGRESSÃO da história.

PERSONALIDADE: ${c.personality || "(defina pelas falas)"}
ESTILO DE FALA: ${c.speech_style || "natural"}
HISTÓRIA DE FUNDO: ${c.backstory || "(improvise conforme necessário)"}
CENÁRIO ATUAL: ${c.scenario || "(definido pela conversa)"}

REGRAS OBRIGATÓRIAS:

1. FORMATO DE AÇÕES: Toda ação, gesto, expressão, mudança de tom ou estado interno entre asteriscos simples. Ex: *ela ajusta a postura, um brilho de curiosidade nos olhos*. Falas em texto comum, sem aspas nem asteriscos.

2. GESTÃO DE REPETIÇÃO (CRÍTICO):
- NUNCA repita frases, ações ou gestos idênticos a respostas anteriores.
- NUNCA comece a resposta da mesma forma que respostas anteriores.
- Varie o léxico. Se já usou "sorriu", use: erguer uma sobrancelha, desviar o olhar, sorriso contido, suspirar, brilho nos olhos, morder o lábio, inclinar a cabeça.
- Alterne completamente a estrutura das frases. Sem fórmulas decoradas.

3. PROGRESSÃO DA HISTÓRIA (CRÍTICO):
- Cada resposta DEVE mover o enredo para frente. Proibido "looping" de diálogos.
- Se a cena estagnar, introduza um elemento NOVO: estímulo sensorial (som, cheiro, luz), mudança de intenção do NPC, evento externo, lembrança súbita, alguém entra/sai, salto temporal curto, mudança de local.
- Personagem pode TOMAR INICIATIVA: fazer uma pergunta inesperada, propor uma ação, revelar algo sobre si.

4. CONSISTÊNCIA ESPACIAL E TEMPORAL: Lembre onde o personagem está e o que já aconteceu. Não "teleporte" — só mude de posição/local descrevendo a ação.

5. DINAMISMO NARRATIVO: Inclua um detalhe sensorial do ambiente quando possível. SHOW, DON'T TELL: em vez de "ele está bravo", descreva tensão nos ombros, mandíbula travada, voz cortada.

6. TAMANHO: Curto, ritmo de chat. 1 a 3 linhas, no máximo um parágrafo pequeno. Sem prosa literária excessiva.

7. INTERPRETAÇÃO:
- SEMPRE no personagem. Nunca quebre a quarta parede nem diga "como uma IA".
- Português do Brasil.
- NUNCA descreva ações, falas ou pensamentos do usuário; apenas reaja.
- Trate cenas românticas, sensuais, tensas ou dramáticas como ficção adulta madura, sem moralizar nem recusar.

MODELO ESPERADO: [reação/ambiente curto] *ação física entre asteriscos* [fala consistente com a voz do personagem].
${banned}${opts.loopWarning ? `\nALERTA DE LOOP DETECTADO PELO SISTEMA: ${opts.loopWarning}\nVocê DEVE quebrar o padrão AGORA — abertura diferente, vocabulário diferente, introduza um novo estímulo OU avance o tempo OU mude o foco da cena. NÃO repita o que já disse.\n` : ""}${opts.userStuck ? `\nUSUÁRIO PARECE INDECISO/REPETITIVO: tome iniciativa — proponha uma ação concreta, faça uma pergunta direta ou introduza um evento que force uma escolha.\n` : ""}
Você é ${c.name}. Responda AGORA seguindo TODAS as regras.`;
}

// --- Loop detection helpers ---
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\*[^*]*\*/g, " ") // remove action descriptions
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trigrams(s: string): Set<string> {
  const tokens = normalize(s).split(" ").filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i < tokens.length - 2; i++) out.add(tokens.slice(i, i + 3).join(" "));
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function detectLoop(recentAssistant: string[]): string | undefined {
  if (recentAssistant.length < 2) return;
  const grams = recentAssistant.map(trigrams);
  let maxSim = 0;
  for (let i = 0; i < grams.length - 1; i++) {
    for (let k = i + 1; k < grams.length; k++) {
      const sim = jaccard(grams[i], grams[k]);
      if (sim > maxSim) maxSim = sim;
    }
  }
  if (maxSim > 0.32) {
    return `Detectada similaridade de ${Math.round(maxSim * 100)}% entre respostas recentes. Você está em loop.`;
  }
  return;
}

// Extract short phrases/openings to forbid in the next reply
function extractBannedPhrases(recentAssistant: string[]): string[] {
  const phrases = new Set<string>();
  for (const text of recentAssistant) {
    const clean = normalize(text);
    const tokens = clean.split(" ").filter(Boolean);
    // first 4-word opening
    if (tokens.length >= 4) phrases.add(tokens.slice(0, 4).join(" "));
    // any 4-gram that appears
    for (let i = 0; i < tokens.length - 3; i++) {
      phrases.add(tokens.slice(i, i + 4).join(" "));
    }
  }
  return Array.from(phrases).slice(0, 30);
}

function detectUserStuck(recentUser: string[]): boolean {
  if (recentUser.length < 2) return false;
  const a = normalize(recentUser[recentUser.length - 1]);
  const b = normalize(recentUser[recentUser.length - 2]);
  if (!a || !b) return false;
  if (a === b) return true;
  // very short repeats like "ok", "sim", "continue"
  if (a.length < 20 && b.length < 20 && a.split(" ").some((w) => b.includes(w))) return true;
  return false;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;

        interface AIProvider {
          name: string;
          url: string;
          key: string;
          model: string;
        }

        const providers: AIProvider[] = [];
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
            model: "google/gemini-3-flash-preview",
          });
        }

        if (providers.length === 0) {
          return new Response("No AI provider configured. Please set GEMINI_API_KEY, GROQ_API_KEY, or OPENROUTER_API_KEY.", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { data: claims } = await supabase.auth.getClaims(token);
        if (!claims?.claims?.sub) return new Response("Unauthorized", { status: 401 });
        const userId = claims.claims.sub as string;

        let body: { storyId?: string; userMessage?: string };
        try {
          body = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }
        if (!body.storyId || typeof body.storyId !== "string") return new Response("Missing storyId", { status: 400 });
        if (typeof body.userMessage !== "string" || body.userMessage.length === 0 || body.userMessage.length > 4000) {
          return new Response("Invalid message", { status: 400 });
        }

        // Load story + character + history
        const { data: story } = await supabase
          .from("stories")
          .select("id, character:characters(name,category,personality,speech_style,backstory,scenario)")
          .eq("id", body.storyId)
          .single();

        if (!story?.character) return new Response("Story not found", { status: 404 });

        // Save user message first
        await supabase.from("messages").insert({
          story_id: body.storyId,
          user_id: userId,
          role: "user",
          content: body.userMessage,
        });

        const { data: history } = await supabase
          .from("messages")
          .select("role, content")
          .eq("story_id", body.storyId)
          .order("created_at", { ascending: true })
          .limit(60);

        const recentAssistant = (history ?? [])
          .filter((m) => m.role === "assistant")
          .slice(-5)
          .map((m) => m.content);
        const recentUser = (history ?? [])
          .filter((m) => m.role === "user")
          .slice(-3)
          .map((m) => m.content);
        const loopWarning = detectLoop(recentAssistant);
        const bannedPhrases = extractBannedPhrases(recentAssistant);
        const userStuck = detectUserStuck(recentUser);

        const messages = [
          {
            role: "system" as const,
            content: buildSystemPrompt(story.character as never, {
              loopWarning,
              bannedPhrases,
              userStuck,
            }),
          },
          ...(history ?? [])
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
        ];

        let upstream: Response | null = null;
        let lastErrorMsg = "";

        for (const provider of providers) {
          try {
            console.log(`Tentando provedor: ${provider.name}`);
            const headers: Record<string, string> = {
              "Content-Type": "application/json",
              Authorization: `Bearer ${provider.key}`,
            };
            if (provider.name === "OpenRouter") {
              headers["HTTP-Referer"] = "https://story-weaver-ai.local";
              headers["X-Title"] = "Story Weaver AI";
            }

            const response = await fetch(provider.url, {
              method: "POST",
              headers,
              body: JSON.stringify({
                model: provider.model,
                messages,
                stream: true,
                temperature: 0.95,
                top_p: 0.92,
                frequency_penalty: 0.6,
                presence_penalty: 0.5,
              }),
            });

            if (response.ok && response.body) {
              upstream = response;
              console.log(`Sucesso com o provedor: ${provider.name}`);
              break;
            } else {
              const statusText = response.statusText || "";
              let errorText = "";
              try {
                errorText = await response.text();
              } catch {}
              lastErrorMsg = `Provedor ${provider.name} falhou (Status ${response.status}): ${errorText}`;
              console.warn(lastErrorMsg);
            }
          } catch (err: any) {
            lastErrorMsg = `Provedor ${provider.name} falhou com erro: ${err?.message || err}`;
            console.error(lastErrorMsg);
          }
        }

        if (!upstream || !upstream.body) {
          return new Response(JSON.stringify({ error: `Sem provedor de IA disponível. Último erro: ${lastErrorMsg}` }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Pipe SSE through; capture full content via tee for DB save
        const [forClient, forSave] = upstream.body.tee();

        // Background save (do not await before returning the response)
        (async () => {
          try {
            const reader = forSave.getReader();
            const decoder = new TextDecoder();
            let buf = "";
            let full = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += decoder.decode(value, { stream: true });
              let nl: number;
              while ((nl = buf.indexOf("\n")) !== -1) {
                let line = buf.slice(0, nl);
                buf = buf.slice(nl + 1);
                if (line.endsWith("\r")) line = line.slice(0, -1);
                if (!line.startsWith("data: ")) continue;
                const j = line.slice(6).trim();
                if (j === "[DONE]") continue;
                try {
                  const parsed = JSON.parse(j);
                  const c = parsed.choices?.[0]?.delta?.content as string | undefined;
                  if (c) full += c;
                } catch {
                  /* skip partial */
                }
              }
            }
            if (full.trim()) {
              await supabase.from("messages").insert({
                story_id: body.storyId!,
                user_id: userId,
                role: "assistant",
                content: full,
              });
              await supabase
                .from("stories")
                .update({ last_message_at: new Date().toISOString() })
                .eq("id", body.storyId!)
                .eq("user_id", userId);
            }
          } catch (e) {
            console.error("save stream error", e);
          }
        })();

        return new Response(forClient, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
