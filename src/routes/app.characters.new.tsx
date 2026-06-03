import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Loader2, Wand2, Upload, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { generateAvatar } from "@/lib/ai.functions";

export const Route = createFileRoute("/app/characters/new")({
  component: NewCharacter,
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

function NewCharacter() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const genAvatarFn = useServerFn(generateAvatar);

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

  async function handleGenerate() {
    if (!name || !personality) {
      toast.error("Preencha o nome e a personalidade primeiro.");
      return;
    }
    setGenBusy(true);
    try {
      const res = await genAvatarFn({
        data: {
          name,
          description: `${personality}. ${backstory}`.slice(0, 1500),
          category,
        },
      });
      if (res.error || !res.dataUrl) {
        toast.error(res.error ?? "Falha ao gerar avatar");
        return;
      }
      // Upload to storage
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
      const { data: char, error } = await supabase
        .from("characters")
        .insert({
          user_id: user.id,
          name: name.trim(),
          category: category as never,
          personality: personality.trim(),
          speech_style: speech.trim(),
          backstory: backstory.trim(),
          scenario: scenario.trim(),
          greeting: greeting.trim(),
          avatar_url: avatarUrl,
        })
        .select()
        .single();
      if (error) throw error;

      // Auto-create first story and navigate to chat
      const { data: story, error: storyErr } = await supabase
        .from("stories")
        .insert({
          user_id: user.id,
          character_id: char.id,
          title: `História com ${char.name}`,
        })
        .select()
        .single();
      if (storyErr) throw storyErr;

      if (greeting.trim()) {
        await supabase.from("messages").insert({
          story_id: story.id,
          user_id: user.id,
          role: "assistant",
          content: greeting.trim(),
        });
      }

      navigate({ to: "/app/chat/$storyId", params: { storyId: story.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 px-6 py-8 md:py-12 max-w-3xl mx-auto w-full pb-24 md:pb-12">
      <button
        onClick={() => navigate({ to: "/app" })}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </button>
      <h1 className="font-display text-4xl font-semibold">Novo personagem</h1>
      <p className="text-muted-foreground mt-1">Quanto mais detalhes, mais vivo ele será.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        {/* Avatar */}
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
            <p className="text-xs text-muted-foreground">
              Sem avatar? Mostraremos as iniciais com um gradiente.
            </p>
          </div>
        </div>

        <Field label="Nome">
          <input
            required maxLength={50} value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Eira de Lumen"
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label="Categoria">
          <select
            value={category} onChange={(e) => setCategory(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
        </Field>

        <Field label="Personalidade" hint="Traços, defeitos, motivações.">
          <textarea
            required maxLength={1500} value={personality} onChange={(e) => setPersonality(e.target.value)}
            rows={3}
            placeholder="Ex: Curiosa, irônica, esconde a vulnerabilidade atrás de piadas..."
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>

        <Field label="Estilo de fala" hint="Formal, casual, poético, sarcástico…">
          <input
            maxLength={200} value={speech} onChange={(e) => setSpeech(e.target.value)}
            placeholder="Frases curtas e secas, com sotaque do interior."
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Field>

        <Field label="História de fundo">
          <textarea
            maxLength={2000} value={backstory} onChange={(e) => setBackstory(e.target.value)}
            rows={3}
            placeholder="De onde vem, o que perdeu, o que busca..."
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>

        <Field label="Cenário inicial" hint="Onde e quando começa a história.">
          <textarea
            maxLength={1000} value={scenario} onChange={(e) => setScenario(e.target.value)}
            rows={2}
            placeholder="Em uma taverna no porto, durante uma chuva pesada de outono..."
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>

        <Field label="Primeira mensagem" hint="A frase com que o personagem te recebe.">
          <textarea
            maxLength={1000} value={greeting} onChange={(e) => setGreeting(e.target.value)}
            rows={3}
            placeholder='*Ela ergue os olhos, surpresa.* "Você... finalmente apareceu."'
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </Field>

        <button
          type="submit" disabled={saving || !name || !personality}
          className="w-full px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-elegant disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Criar e iniciar história
        </button>
      </form>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-sm font-medium mb-1.5">
        {label} {hint && <span className="text-xs text-muted-foreground font-normal">— {hint}</span>}
      </div>
      {children}
    </label>
  );
}
