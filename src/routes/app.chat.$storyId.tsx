import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Heart, RefreshCcw, Send, Sparkles, Trash2, Loader2, Pencil, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { generateSuggestions, generateStoryTitle } from "@/lib/ai.functions";
import { cn } from "@/lib/utils";
import type { UserPersona } from "@/components/CharacterDetailsDialog";

export const Route = createFileRoute("/app/chat/$storyId")({
  component: ChatPage,
});

type Msg = { id: string; role: "user" | "assistant"; content: string; created_at: string };
type Character = {
  id: string;
  name: string;
  avatar_url: string | null;
  category: string;
};

function ChatPage() {
  const { storyId } = Route.useParams();
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const suggestFn = useServerFn(generateSuggestions);
  const titleFn = useServerFn(generateStoryTitle);

  const [character, setCharacter] = useState<Character | null>(null);
  const [story, setStory] = useState<{ title: string; is_favorite: boolean } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [streamText, setStreamText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [userPersona, setUserPersona] = useState<UserPersona | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Load story
  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: s } = await supabase
        .from("stories")
        .select("title,is_favorite,character:characters(id,name,avatar_url,category)")
        .eq("id", storyId)
        .single();
      if (!s) { toast.error("História não encontrada"); navigate({ to: "/app" }); return; }
      setStory({ title: s.title, is_favorite: s.is_favorite });
      const char = s.character as never as Character;
      setCharacter(char);

      // Carregar persona do sessionStorage
      try {
        const saved = sessionStorage.getItem(`lucid_persona_${char.id}`);
        if (saved) setUserPersona(JSON.parse(saved) as UserPersona);
      } catch {}

      const { data: m } = await supabase
        .from("messages")
        .select("id,role,content,created_at")
        .eq("story_id", storyId)
        .in("role", ["user", "assistant"])
        .order("created_at", { ascending: true });
      setMessages((m ?? []) as Msg[]);
      setLoading(false);
    })();
  }, [storyId, user, navigate]);

  // Auto-suggest after assistant messages settle
  useEffect(() => {
    if (sending || messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    let cancelled = false;
    suggestFn({ data: { storyId } }).then((r) => {
      if (!cancelled) setSuggestions(r.suggestions ?? []);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [messages, sending, storyId, suggestFn]);

  // Scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streamText]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending || !session) return;
    setInput("");
    setSuggestions([]);
    setSending(true);

    const tempUser: Msg = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser]);

    // typing delay for realism
    await new Promise((r) => setTimeout(r, 350 + Math.random() * 350));

    abortRef.current?.abort();
    const ctl = new AbortController();
    abortRef.current = ctl;

    setStreamText("");
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          storyId,
          userMessage: trimmed,
          ...(userPersona ? { userPersona } : {}),
        }),
        signal: ctl.signal,
      });

      if (!resp.ok || !resp.body) {
        let msg = "Falha ao gerar resposta.";
        try { const j = await resp.json(); if (j?.error) msg = j.error; } catch {}
        toast.error(msg);
        setSending(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      let done = false;
      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(j);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) { full += c; setStreamText(full); }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Commit
      const newMsg: Msg = {
        id: `final-${Date.now()}`,
        role: "assistant",
        content: full,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, newMsg]);
      setStreamText("");

      // Auto-title after a few exchanges
      if (messages.length >= 3 && story?.title.startsWith("História com")) {
        titleFn({ data: { storyId } }).then((r) => {
          if (r.title) setStory((s) => (s ? { ...s, title: r.title! } : s));
        }).catch(() => {});
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toast.error(e instanceof Error ? e.message : "Erro de conexão");
      }
    } finally {
      setSending(false);
    }
  }

  async function regenerate() {
    if (sending || messages.length < 2) return;
    const last = messages[messages.length - 1];
    if (last.role !== "assistant") return;
    const prevUser = messages[messages.length - 2];
    if (prevUser.role !== "user") return;

    // delete last assistant from db (best effort) and local state
    if (!last.id.startsWith("tmp-") && !last.id.startsWith("final-")) {
      await supabase.from("messages").delete().eq("id", last.id);
    } else {
      // Remove the most recent assistant row from db too (the streamed-saved one)
      const { data: row } = await supabase
        .from("messages")
        .select("id")
        .eq("story_id", storyId)
        .eq("role", "assistant")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (row) await supabase.from("messages").delete().eq("id", row.id);
    }
    // Also delete the user message we'll re-send (was just inserted)
    if (!prevUser.id.startsWith("tmp-")) {
      await supabase.from("messages").delete().eq("id", prevUser.id);
    } else {
      const { data: row } = await supabase
        .from("messages")
        .select("id")
        .eq("story_id", storyId)
        .eq("role", "user")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (row) await supabase.from("messages").delete().eq("id", row.id);
    }

    setMessages((prev) => prev.slice(0, -2));
    await send(prevUser.content);
  }

  async function toggleFav() {
    if (!story) return;
    const next = !story.is_favorite;
    setStory({ ...story, is_favorite: next });
    await supabase.from("stories").update({ is_favorite: next }).eq("id", storyId);
  }

  async function deleteStory() {
    if (!confirm("Excluir esta história?")) return;
    await supabase.from("stories").delete().eq("id", storyId);
    navigate({ to: "/app/library" });
  }

  function startEdit(m: Msg) {
    if (m.id.startsWith("tmp-") || m.id.startsWith("stream") || m.id.startsWith("final-")) {
      toast.info("Aguarde a mensagem ser salva para editar.");
      return;
    }
    setEditingId(m.id);
    setEditText(m.content);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  async function saveEdit(m: Msg) {
    const newContent = editText.trim();
    if (!newContent || newContent === m.content) {
      cancelEdit();
      return;
    }
    const idx = messages.findIndex((x) => x.id === m.id);
    if (idx === -1) return cancelEdit();

    // Update in DB
    const { error } = await supabase
      .from("messages")
      .update({ content: newContent })
      .eq("id", m.id);
    if (error) {
      toast.error("Falha ao salvar edição");
      return;
    }

    // Delete all messages after this one so the AI regenerates from the corrected point
    const after = messages.slice(idx + 1);
    if (after.length > 0) {
      const ids = after.map((x) => x.id).filter((id) => !id.startsWith("tmp-") && !id.startsWith("final-"));
      if (ids.length > 0) {
        await supabase.from("messages").delete().in("id", ids);
      }
    }

    const updated: Msg = { ...m, content: newContent };
    const newList = [...messages.slice(0, idx), updated];
    setMessages(newList);
    cancelEdit();

    // If the edited message is from the user, regenerate the assistant reply
    if (m.role === "user") {
      // Send without re-inserting the user message — temporarily mimic by calling /api/chat directly
      await regenerateFromUser(newContent);
    } else {
      toast.success("Resposta editada. A IA usará isso como contexto.");
    }
  }

  async function regenerateFromUser(userMessage: string) {
    if (!session) return;
    setSending(true);
    setStreamText("");
    // The user message already exists in DB (we just updated it). We need the model to answer it.
    // The backend re-inserts the userMessage — so we delete it first then let backend re-insert.
    // Simpler: directly stream using a special flag — but our endpoint expects to insert.
    // Workaround: delete the user msg, call endpoint with userMessage (which re-inserts + answers).
    const last = messages[messages.length - 1];
    const lastUser = [...messages].reverse().find((x) => x.role === "user");
    if (lastUser && !lastUser.id.startsWith("tmp-") && !lastUser.id.startsWith("final-")) {
      await supabase.from("messages").delete().eq("id", lastUser.id);
      setMessages((prev) => prev.filter((x) => x.id !== lastUser.id));
    }
    void last;
    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          storyId,
          userMessage,
          ...(userPersona ? { userPersona } : {}),
        }),
      });
      if (!resp.ok || !resp.body) {
        toast.error("Falha ao regenerar");
        setSending(false);
        return;
      }
      // Add the edited user message back to UI immediately
      setMessages((prev) => [
        ...prev,
        { id: `tmp-${Date.now()}`, role: "user", content: userMessage, created_at: new Date().toISOString() },
      ]);
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") break;
          try {
            const parsed = JSON.parse(j);
            const c = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (c) { full += c; setStreamText(full); }
          } catch { /* ignore */ }
        }
      }
      setMessages((prev) => [
        ...prev,
        { id: `final-${Date.now()}`, role: "assistant", content: full, created_at: new Date().toISOString() },
      ]);
      setStreamText("");
    } finally {
      setSending(false);
    }
  }

  const allMessages = useMemo(() => {
    if (!streamText) return messages;
    return [
      ...messages,
      { id: "stream", role: "assistant" as const, content: streamText, created_at: new Date().toISOString() },
    ];
  }, [messages, streamText]);

  if (loading || !character) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col h-screen md:h-auto md:min-h-screen">
      {/* Wallpaper imersivo — foto do personagem como papel de parede */}
      {character.avatar_url && (
        <div className="pointer-events-none fixed inset-0 z-0">
          <img
            src={character.avatar_url}
            alt=""
            aria-hidden
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
          {/* Overlay gradiente sutil para legibilidade — preserva a imagem */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
        </div>
      )}
      {/* Fundo sólido quando não há avatar */}
      {!character.avatar_url && (
        <div className="fixed inset-0 z-0 bg-background" />
      )}

      {/* Header */}
      <header className="relative z-30 sticky top-0 backdrop-blur-md bg-black/50 border-b border-white/10 px-4 py-3 flex items-center gap-3">
        <Link to="/app" className="p-2 -ml-2 rounded-full hover:bg-white/10 text-white">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <CharacterAvatar name={character.name} url={character.avatar_url} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="font-display text-lg font-semibold truncate text-white">{character.name}</div>
          <div className="text-[10px] uppercase tracking-wider text-white/60 truncate">{story?.title}</div>
        </div>
        <button onClick={toggleFav} className="p-2 rounded-full hover:bg-white/10">
          <Heart className={cn("h-4 w-4", story?.is_favorite ? "fill-primary text-primary" : "text-white/70")} />
        </button>
        <button onClick={deleteStory} className="p-2 rounded-full hover:bg-red-500/20">
          <Trash2 className="h-4 w-4 text-white/60 hover:text-red-400" />
        </button>
      </header>

      {/* Messages */}
      <div className="relative z-10 flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <AnimatePresence initial={false}>
            {allMessages.map((m) => {
              const isEditing = editingId === m.id;
              return (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={cn(
                    "group flex gap-2 items-end",
                    m.role === "user" ? "justify-end" : "justify-start",
                  )}
                >
                  {m.role === "assistant" && (
                    <CharacterAvatar name={character.name} url={character.avatar_url} size="sm" />
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 max-w-[85%] text-[15px] leading-relaxed prose prose-invert prose-p:my-1 relative backdrop-blur-sm",
                      m.role === "user"
                        ? "bg-primary/80 text-primary-foreground rounded-br-sm shadow-lg"
                        : "bg-black/50 text-white rounded-bl-sm shadow-lg border border-white/10",
                    )}
                  >
                    {isEditing ? (
                      <div className="flex flex-col gap-2 min-w-[240px]">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={Math.min(8, Math.max(2, editText.split("\n").length))}
                          autoFocus
                          className="w-full bg-background/60 text-foreground rounded-lg p-2 text-sm outline-none ring-1 ring-border focus:ring-primary resize-none"
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={cancelEdit} className="p-1.5 rounded-md hover:bg-background/60" title="Cancelar">
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => saveEdit(m)} className="p-1.5 rounded-md bg-primary text-primary-foreground" title="Salvar">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        {m.role === "user" && (
                          <p className="text-[10px] text-muted-foreground">A IA vai regenerar a resposta a partir da edição.</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <ReactMarkdown
                          components={{
                            em: ({ children }) => (
                              <strong className="font-semibold text-primary not-italic">{children}</strong>
                            ),
                          }}
                        >
                          {m.content}
                        </ReactMarkdown>
                        {m.id !== "stream" && !sending && (
                          <button
                            onClick={() => startEdit(m)}
                            title="Editar mensagem"
                            className={cn(
                              "absolute -top-2 opacity-0 group-hover:opacity-100 transition p-1 rounded-full bg-card border border-border shadow-sm",
                              m.role === "user" ? "-left-2" : "-right-2",
                            )}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {sending && !streamText && (
            <div className="flex gap-2 items-end">
              <CharacterAvatar name={character.name} url={character.avatar_url} size="sm" />
              <div className="bg-bubble-character text-bubble-character-foreground rounded-2xl rounded-bl-sm px-4 py-3">
                <TypingDots />
              </div>
            </div>
          )}

          {messages.length === 0 && !sending && (
            <div className="text-center py-12">
              <Sparkles className="h-6 w-6 text-primary mx-auto mb-2" />
              <p className="text-sm text-white/70">
                Comece a conversa. Use *ações em itálico* para descrever o que você faz.
              </p>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && !sending && (
        <div className="relative z-10 px-4 pb-2 max-w-2xl mx-auto w-full">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {suggestions.map((s, i) => (
              <button
                key={i} onClick={() => send(s)}
                className="shrink-0 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur border border-white/20 text-xs text-white/80 hover:text-white hover:border-primary transition"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="relative z-20 sticky bottom-0 backdrop-blur-md bg-black/50 border-t border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2 items-end">
          <button
            onClick={regenerate}
            disabled={sending || messages.length < 2}
            title="Regenerar última resposta"
            className="p-2.5 rounded-full border border-white/20 bg-black/40 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Escreva sua mensagem… (Shift+Enter para nova linha)"
            className="flex-1 resize-none px-4 py-3 rounded-2xl bg-black/40 backdrop-blur border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary max-h-32 text-[15px]"
            maxLength={4000}
          />
          <button
            onClick={() => send(input)}
            disabled={sending || !input.trim()}
            className="p-3 rounded-full bg-gradient-primary text-primary-foreground shadow-glow disabled:opacity-40"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}
