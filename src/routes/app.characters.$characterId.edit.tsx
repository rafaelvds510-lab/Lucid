import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Wand2, Upload, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { generateAvatar } from "@/lib/ai.functions";

export const Route = createFileRoute("/app/characters/$characterId/edit")({
  component: EditCharacter,
});

const CATEGORIES = [
  { v: "romance", l: "Romance" },
  { v: "fantasy", l: "Fantasia" },
  { v: "action", l: "Ação" },
  { v: "mystery", l: "Mistério" },
  { v: "scifi", l: "Sci-Fi" },
  { v: "slice_of_life", l: "Slice of Life" },
  { v: "horror", l: "Terror" },
  { v: "other", l: "Outro" },
];

function EditCharacter() {
  const { characterId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const genAvatarFn = useServerFn(generateAvatar);

  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("romance");
  const [personality, setPersonality] = useState("");
  const [speech, setSpeech] = useState("");
  const [backstory, setBackstory] = useState("");
  const [scenario, setScenario] = useState("");
  const [greeting, setGreeting] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .eq("id", characterId)
        .single();
      if (error || !data) {
        toast.error("Personagem não encontrado");
        navigate({ to: "/app" });
        return;
      }
      setName(data.name);
      setCategory(data.category);
      setPersonality(data.personality ?? "");
      setSpeech(data.speech_style ?? "");
      setBackstory(data.backstory ?? "");
      setScenario(data.scenario ?? "");
      setGreeting(data.greeting ?? "");
      setAvatarUrl(data.avatar_url);
      setLoading(false);
    })();
  }, [characterId, user, navigate]);

  async function handleGenerate() {
    if (!name || !personality) {
      toast.error("Preencha o nome e a personalidade primeiro.");
      return;
    }
    setGenBusy(true);
    try {
      const res = await genAvatarFn({
        data: { name, description: `${personality}. ${backstory}`.slice(0, 1500), category },
      });
      if (res.error || !res.dataUrl) {
        toast.error(res.error ?? "Falha ao gerar avatar");
        return;
      }
      const blob = await (await fetch(res.dataUrl)).blob();
      const path = `${user!.id}/${crypto.randomUUID()}.png`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, blob, {
        contentType: "image/png",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(pub.publicUrl);
      toast.success("Avatar gerado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setGenBusy(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter até 5MB");
      return;
    }
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      toast.success("Imagem enviada");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no upload");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("characters")
        .update({
          name: name.trim(),
          category: category as never,
          personality: personality.trim(),
          speech_style: speech.trim(),
          backstory: backstory.trim(),
          scenario: scenario.trim(),
          greeting: greeting.trim(),
          avatar_url: avatarUrl,
        })
        .eq("id", characterId);
      if (error) throw error;
      toast.success("Personagem atualizado");
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando…
      </div>
    );
  }

  return (
    <div className="flex-1 px-6 py-8 md:py-12 max-w-3xl mx-auto w-full pb-24 md:pb-12">
      <button
        onClick={() => navigate({ to: "/app" })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h1 className="font-display text-4xl font-semibold">Editar personagem</h1>
      <p className="text-muted-foreground mt-1">Atualize os detalhes e salve.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <div className="rounded-2xl border border-border bg-card/50 p-5 flex items-center gap-5">
          <CharacterAvatar name={name || "?"} url={avatarUrl} size="xl" />
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={genBusy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-primary text-primary-foreground text-sm font-medium shadow-glow disabled:opacity-50"
              >
                {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Gerar com IA
              </button>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border hover:bg-card transition cursor-pointer text-sm">
                <Upload className="h-4 w-4" /> Enviar imagem
                <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              </label>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="text-xs text-muted-foreground hover:text-destructive"
                >
                  Remover
                </button>
              )}
            </div>
          </div>
        </div>

        <Field label="Nome">
          <input required maxLength={50} value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring" />
        </Field>

        <Field label="Categoria">
          <select value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring">
            {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </Field>

        <Field label="Personalidade">
          <textarea required maxLength={1500} value={personality} onChange={(e) => setPersonality(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </Field>

        <Field label="Estilo de fala">
          <input maxLength={200} value={speech} onChange={(e) => setSpeech(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring" />
        </Field>

        <Field label="História de fundo">
          <textarea maxLength={2000} value={backstory} onChange={(e) => setBackstory(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </Field>

        <Field label="Cenário inicial">
          <textarea maxLength={1000} value={scenario} onChange={(e) => setScenario(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </Field>

        <Field label="Primeira mensagem">
          <textarea maxLength={1000} value={greeting} onChange={(e) => setGreeting(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
        </Field>

        <button type="submit" disabled={saving || !name || !personality}
          className="w-full px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-elegant disabled:opacity-50 flex items-center justify-center gap-2">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar alterações
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium mb-1.5">{label}</div>
      {children}
    </label>
  );
}
