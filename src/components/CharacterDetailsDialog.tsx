import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, Pencil, Trash2, X, Loader2, ChevronRight, User } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
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

export type UserPersona = {
  name: string;
  age: string;
  description: string;
  proximity: string;
  appearance: string;
};

const PROXIMITY_OPTIONS = [
  { value: "desconhecido", label: "Desconhecido" },
  { value: "conhecido", label: "Conhecido" },
  { value: "amigo", label: "Amigo" },
  { value: "amante", label: "Amante" },
  { value: "rival", label: "Rival" },
  { value: "familia", label: "Família" },
];

type Props = {
  character: CharacterDetails | null;
  onClose: () => void;
  onDeleted?: (id: string) => void;
};

type Step = "details" | "persona";

export function CharacterDetailsDialog({ character, onClose, onDeleted }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>("details");
  const [persona, setPersona] = useState<UserPersona>(() => {
    if (!character) return { name: "", age: "", description: "", proximity: "desconhecido", appearance: "" };
    try {
      const saved = sessionStorage.getItem(`lucid_persona_${character.id}`);
      if (saved) return JSON.parse(saved) as UserPersona;
    } catch {}
    return { name: "", age: "", description: "", proximity: "desconhecido", appearance: "" };
  });

  if (!character) return null;

  function updatePersona(field: keyof UserPersona, value: string) {
    setPersona((prev) => ({ ...prev, [field]: value }));
  }

  async function start() {
    if (!user || !character) return;
    setBusy(true);

    // Salvar persona no sessionStorage
    try {
      sessionStorage.setItem(`lucid_persona_${character.id}`, JSON.stringify(persona));
    } catch {}

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
        {/* Header sempre visível */}
        <div className="relative p-6 pb-4 flex items-center gap-4 border-b border-border shrink-0">
          {character.avatar_url && (
            <div
              className="absolute inset-0 -z-0 overflow-hidden"
              aria-hidden
            >
              <img
                src={character.avatar_url}
                alt=""
                className="w-full h-full object-cover opacity-10 blur-md scale-110"
              />
            </div>
          )}
          <div className="relative z-10 flex items-center gap-4 w-full">
            <CharacterAvatar name={character.name} url={character.avatar_url} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="font-display text-2xl font-semibold truncate">{character.name}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{character.category}</div>
            </div>
            <button
              onClick={() => { setStep("details"); onClose(); }}
              className="p-2 rounded-full hover:bg-secondary"
              id="character-dialog-close-btn"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {step === "details" ? (
            /* ── Passo 1: Detalhes do personagem ── */
            <motion.div
              key="details"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="px-6 py-4 overflow-y-auto space-y-4 text-sm flex-1">
                {character.personality && <Section label="Personalidade" text={character.personality} />}
                {character.speech_style && <Section label="Estilo de fala" text={character.speech_style} />}
                {character.backstory && <Section label="História de fundo" text={character.backstory} />}
                {character.scenario && <Section label="Cenário inicial" text={character.scenario} />}
                {character.greeting && <Section label="Primeira mensagem" text={character.greeting} italic />}
              </div>

              <div className="p-4 border-t border-border flex flex-col sm:flex-row gap-2 bg-background/40 shrink-0">
                <button
                  id="start-persona-step-btn"
                  onClick={() => setStep("persona")}
                  disabled={busy}
                  className="flex-1 px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  Iniciar conversa
                  <ChevronRight className="h-4 w-4 ml-auto opacity-60" />
                </button>
                <button
                  onClick={edit}
                  disabled={busy}
                  className="px-4 py-3 rounded-full border border-border hover:bg-secondary inline-flex items-center justify-center gap-2 text-sm"
                  id="edit-character-btn"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button
                  onClick={remove}
                  disabled={busy}
                  className="px-4 py-3 rounded-full border border-border text-destructive hover:bg-destructive/10 inline-flex items-center justify-center gap-2 text-sm"
                  id="delete-character-btn"
                >
                  <Trash2 className="h-4 w-4" /> Excluir
                </button>
              </div>
            </motion.div>
          ) : (
            /* ── Passo 2: Persona do usuário ── */
            <motion.div
              key="persona"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Quem você interpreta nesta história?</span>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Essas informações são usadas para personalizar a narrativa. Todos os campos são opcionais.
                </p>

                <div className="space-y-3">
                  {/* Nome */}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1" htmlFor="persona-name-input">
                      Seu nome no roleplay
                    </label>
                    <input
                      id="persona-name-input"
                      type="text"
                      placeholder={`Como ${character.name} vai te chamar?`}
                      value={persona.name}
                      onChange={(e) => updatePersona("name", e.target.value)}
                      maxLength={60}
                      className="w-full px-3 py-2.5 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>

                  {/* Idade */}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1" htmlFor="persona-age-input">
                      Sua idade na história
                    </label>
                    <input
                      id="persona-age-input"
                      type="number"
                      placeholder="Ex: 25"
                      min={18}
                      max={120}
                      value={persona.age}
                      onChange={(e) => updatePersona("age", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>

                  {/* Proximidade */}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1" htmlFor="persona-proximity-select">
                      Relação com {character.name}
                    </label>
                    <select
                      id="persona-proximity-select"
                      value={persona.proximity}
                      onChange={(e) => updatePersona("proximity", e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    >
                      {PROXIMITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Aparência */}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1" htmlFor="persona-appearance-input">
                      Sua aparência
                    </label>
                    <textarea
                      id="persona-appearance-input"
                      placeholder="Descreva brevemente sua aparência física nesta história..."
                      value={persona.appearance}
                      onChange={(e) => updatePersona("appearance", e.target.value)}
                      maxLength={300}
                      rows={2}
                      className="w-full px-3 py-2.5 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
                    />
                  </div>

                  {/* Descrição */}
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wider block mb-1" htmlFor="persona-description-input">
                      Quem você é nesta história
                    </label>
                    <textarea
                      id="persona-description-input"
                      placeholder="Sua personalidade, contexto, motivações nesta narrativa..."
                      value={persona.description}
                      onChange={(e) => updatePersona("description", e.target.value)}
                      maxLength={500}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border flex gap-2 bg-background/40 shrink-0">
                <button
                  id="back-to-details-btn"
                  onClick={() => setStep("details")}
                  disabled={busy}
                  className="px-4 py-3 rounded-full border border-border hover:bg-secondary text-sm inline-flex items-center gap-2"
                >
                  Voltar
                </button>
                <button
                  id="confirm-start-story-btn"
                  onClick={start}
                  disabled={busy}
                  className="flex-1 px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  Entrar na história
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
