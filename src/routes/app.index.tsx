import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Sparkles, MessageCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { CharacterDetailsDialog, type CharacterDetails } from "@/components/CharacterDetailsDialog";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

type Character = {
  id: string;
  name: string;
  category: string;
  avatar_url: string | null;
  greeting: string;
  personality: string;
  speech_style: string;
  backstory: string;
  scenario: string;
};

type Story = {
  id: string;
  title: string;
  last_message_at: string;
  is_favorite: boolean;
  character: { id: string; name: string; category: string; avatar_url: string | null } | null;
};

function AppHome() {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CharacterDetails | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: chars }, { data: stos }] = await Promise.all([
        supabase
          .from("characters")
          .select("id,name,category,avatar_url,greeting,personality,speech_style,backstory,scenario")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("stories")
          .select("id,title,last_message_at,is_favorite,character:characters(id,name,category,avatar_url)")
          .eq("user_id", user.id)
          .order("last_message_at", { ascending: false })
          .limit(6),
      ]);
      setCharacters((chars ?? []) as Character[]);
      setStories((stos ?? []) as unknown as Story[]);
      setLoading(false);
    })();
  }, [user]);

  function handleDeleted(id: string) {
    setCharacters((prev) => prev.filter((c) => c.id !== id));
    setStories((prev) => prev.filter((s) => s.character?.id !== id));
  }

  return (
    <div className="flex-1 px-6 py-8 md:py-12 max-w-5xl mx-auto w-full pb-24 md:pb-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl font-semibold">Suas histórias</h1>
        <p className="text-muted-foreground mt-1">Escolha um personagem ou continue uma cena.</p>
      </motion.div>

      {loading ? (
        <div className="mt-12 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {stories.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Continuar</h2>
              <div className="mt-4 grid sm:grid-cols-2 gap-3">
                {stories.map((s) => (
                  <Link
                    key={s.id}
                    to="/app/chat/$storyId"
                    params={{ storyId: s.id }}
                    className="group rounded-2xl border border-border bg-card/50 hover:bg-card transition p-4 flex items-center gap-3"
                  >
                    {s.character && <CharacterAvatar name={s.character.name} url={s.character.avatar_url} size="md" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{s.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(s.last_message_at), { addSuffix: true, locale: ptBR })}
                      </div>
                    </div>
                    <MessageCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          <section className="mt-10">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personagens</h2>
              <Link
                to="/app/characters/new"
                className="text-xs text-primary hover:text-primary-glow flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Novo
              </Link>
            </div>

            {characters.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {characters.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="group rounded-2xl border border-border bg-card/50 hover:bg-card transition p-4 flex flex-col items-center text-center"
                  >
                    <CharacterAvatar name={c.name} url={c.avatar_url} size="lg" />
                    <div className="mt-3 font-display text-lg font-semibold truncate w-full">{c.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{c.category}</div>
                    <div className="mt-3 text-xs text-primary opacity-0 group-hover:opacity-100 transition">
                      Ver detalhes →
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <CharacterDetailsDialog
        character={selected}
        onClose={() => setSelected(null)}
        onDeleted={handleDeleted}
      />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-6 rounded-3xl border border-dashed border-border p-10 text-center">
      <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-primary shadow-glow flex items-center justify-center">
        <Sparkles className="h-7 w-7 text-primary-foreground" />
      </div>
      <h3 className="mt-4 font-display text-2xl font-semibold">Crie seu primeiro personagem</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        Defina personalidade, cenário e estilo. Em segundos você terá alguém pronto para conversar.
      </p>
      <Link
        to="/app/characters/new"
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow"
      >
        <Plus className="h-4 w-4" /> Criar personagem
      </Link>
    </div>
  );
}
