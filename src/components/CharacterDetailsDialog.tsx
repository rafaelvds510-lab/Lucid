import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, Pencil, Trash2, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CharacterAvatar } from "@/components/CharacterAvatar";

export type CharacterDetails = {
  id: string;
  name: string;
  category: string;
  avatar_url: string | null;
  greeting?: string | null;
  personality?: string | null;
  backstory?: string | null;
  scenario?: string | null;
  speech_style?: string | null;
};

type Props = {
  character: CharacterDetails | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
};

export function CharacterDetailsDialog({ character, onClose, onDeleted }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (!character) return null;

  async function start() {
    if (!user || !character) return;
    setBusy(true);
    try {
      const { data: story, error } = await supabase
        .from("stories")
        .insert({
          user_id: user.id,
          character_id: character.id,
          title: `História com ${character.name}`,
        })
        .select()
        .single();
      if (error) throw error;
      if (character.greeting?.trim()) {
        await supabase.from("messages").insert({
          story_id: story.id,
          user_id: user.id,
          role: "assistant",
          content: character.greeting,
        });
      }
      navigate({ to: "/app/chat/$storyId", params: { storyId: story.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar");
      setBusy(false);
    }
  }

  async function remove() {
    if (!character) return;
    if (!confirm(`Excluir "${character.name}"? Todas as histórias e mensagens deste personagem serão removidas. Esta ação não pode ser desfeita.`))
      return;
    setBusy(true);
    try {
      // Delete stories (cascade messages if FK set; otherwise delete manually)
      const { data: stories } = await supabase
        .from("stories")
        .select("id")
        .eq("character_id", character.id);
      if (stories && stories.length > 0) {
        const ids = stories.map((s) => s.id);
        await supabase.from("messages").delete().in("story_id", ids);
        await supabase.from("stories").delete().in("id", ids);
      }
      const { error } = await supabase.from("characters").delete().eq("id", character.id);
      if (error) throw error;
      toast.success("Personagem excluído");
      onDeleted?.(character.id);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir");
    } finally {
      setBusy(false);
    }
  }

  function edit() {
    navigate({ to: "/app/characters/$characterId/edit", params: { characterId: character!.id } });
  }

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-elegant overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="relative p-6 pb-4 flex items-center gap-4 border-b border-border">
          <CharacterAvatar name={character.name} url={character.avatar_url} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-2xl font-semibold truncate">{character.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{character.category}</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-secondary">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto space-y-4 text-sm">
          {character.personality && <Section label="Personalidade" text={character.personality} />}
          {character.speech_style && <Section label="Estilo de fala" text={character.speech_style} />}
          {character.backstory && <Section label="História de fundo" text={character.backstory} />}
          {character.scenario && <Section label="Cenário inicial" text={character.scenario} />}
          {character.greeting && <Section label="Primeira mensagem" text={character.greeting} italic />}
        </div>

        <div className="p-4 border-t border-border flex flex-col sm:flex-row gap-2 bg-background/40">
          <button
            onClick={start}
            disabled={busy}
            className="flex-1 px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
            Iniciar conversa
          </button>
          <button
            onClick={edit}
            disabled={busy}
            className="px-4 py-3 rounded-full border border-border hover:bg-secondary inline-flex items-center justify-center gap-2 text-sm"
          >
            <Pencil className="h-4 w-4" /> Editar
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="px-4 py-3 rounded-full border border-border text-destructive hover:bg-destructive/10 inline-flex items-center justify-center gap-2 text-sm"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, text, italic }: { label: string; text: string; italic?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <p className={italic ? "italic text-muted-foreground whitespace-pre-wrap" : "whitespace-pre-wrap"}>{text}</p>
    </div>
  );
}
