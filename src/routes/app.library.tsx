import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app/library")({
  component: LibraryPage,
});

type Story = {
  id: string;
  title: string;
  is_favorite: boolean;
  last_message_at: string;
  character: { id: string; name: string; avatar_url: string | null; category: string } | null;
};

function LibraryPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [q, setQ] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("stories")
      .select("id,title,is_favorite,last_message_at,character:characters(id,name,avatar_url,category)")
      .eq("user_id", user.id)
      .order("last_message_at", { ascending: false });
    setStories((data ?? []) as unknown as Story[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user]);

  async function toggleFavorite(s: Story) {
    const { error } = await supabase
      .from("stories")
      .update({ is_favorite: !s.is_favorite })
      .eq("id", s.id);
    if (error) toast.error(error.message);
    else setStories((prev) => prev.map((x) => (x.id === s.id ? { ...x, is_favorite: !x.is_favorite } : x)));
  }

  async function remove(s: Story) {
    if (!confirm(`Excluir "${s.title}"? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("stories").delete().eq("id", s.id);
    if (error) toast.error(error.message);
    else setStories((prev) => prev.filter((x) => x.id !== s.id));
  }

  const filtered = stories.filter((s) => {
    if (filter === "favorites" && !s.is_favorite) return false;
    if (q && !s.title.toLowerCase().includes(q.toLowerCase()) && !s.character?.name.toLowerCase().includes(q.toLowerCase()))
      return false;
    return true;
  });

  return (
    <div className="flex-1 px-6 py-8 md:py-12 max-w-4xl mx-auto w-full pb-24 md:pb-12">
      <h1 className="font-display text-4xl font-semibold">Biblioteca</h1>
      <p className="text-muted-foreground mt-1">Todas as suas histórias.</p>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por título ou personagem"
            className="w-full pl-10 pr-4 py-2.5 rounded-full bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "favorites"] as const).map((f) => (
            <button
              key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-sm transition ${
                filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "Todas" : "Favoritas"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="mt-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="mt-12 text-center text-muted-foreground text-sm">
          {stories.length === 0 ? (
            <>Nenhuma história ainda. <Link to="/app" className="text-primary">Comece uma agora.</Link></>
          ) : "Nada encontrado."}
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {filtered.map((s) => (
            <li
              key={s.id}
              className="group rounded-2xl border border-border bg-card/50 hover:bg-card transition p-4 flex items-center gap-4"
            >
              <button
                onClick={() => navigate({ to: "/app/chat/$storyId", params: { storyId: s.id } })}
                className="flex items-center gap-4 flex-1 text-left min-w-0"
              >
                {s.character && <CharacterAvatar name={s.character.name} url={s.character.avatar_url} size="md" />}
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{s.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {s.character?.name} · {formatDistanceToNow(new Date(s.last_message_at), { addSuffix: true, locale: ptBR })}
                  </div>
                </div>
              </button>
              <button onClick={() => toggleFavorite(s)} className="p-2 rounded-full hover:bg-secondary">
                <Heart className={`h-4 w-4 ${s.is_favorite ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              </button>
              <button onClick={() => remove(s)} className="p-2 rounded-full hover:bg-destructive/20">
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
