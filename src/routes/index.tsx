import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, MessagesSquare, Drama, Wand2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { InstallAppButton } from "@/components/InstallAppButton";

const AGE_KEY = "lucid_age_confirmed";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [showGate, setShowGate] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(AGE_KEY)) setShowGate(true);
  }, []);

  const onConfirm = () => {
    localStorage.setItem(AGE_KEY, new Date().toISOString());
    setShowGate(false);
  };

  const onEnter = () => {
    if (loading) return;
    navigate({ to: user ? "/app" : "/auth" });
  };

  return (
    <div className="min-h-screen flex flex-col">
      {showGate && <AgeGate onConfirm={onConfirm} />}

      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-semibold tracking-tight">Lucid</span>
        </div>
        <div className="flex items-center gap-3">
          <InstallAppButton />
          <Link
            to="/auth"
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            Entrar
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center px-6 py-12">
        <div className="max-w-5xl mx-auto w-full grid md:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card/60 border border-border text-xs text-muted-foreground backdrop-blur">
              <Drama className="h-3.5 w-3.5" /> Roleplay narrativo com IA
            </span>
            <h1 className="mt-5 font-display text-5xl md:text-6xl leading-[1.05] font-semibold">
              Onde cada <span className="text-gradient">personagem</span> ganha vida.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground max-w-md">
              Crie protagonistas únicos, mergulhe em mundos imersivos e deixe a IA escrever
              histórias com você — sem roteiro, sem limites narrativos.
            </p>
            <div className="mt-8 flex gap-3">
              <button
                onClick={onEnter}
                className="px-6 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-elegant hover:scale-[1.02] active:scale-100 transition"
              >
                Começar a criar
              </button>
              <a
                href="#features"
                className="px-6 py-3 rounded-full border border-border bg-card/40 backdrop-blur hover:bg-card transition text-sm font-medium"
              >
                Como funciona
              </a>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Conteúdo destinado a maiores de 18 anos.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-gradient-primary blur-3xl opacity-30 rounded-full" />
            <div className="relative rounded-3xl border border-border bg-card/70 backdrop-blur p-5 shadow-elegant">
              <ChatPreview />
            </div>
          </motion.div>
        </div>
      </main>

      <section id="features" className="px-6 py-20 max-w-5xl mx-auto w-full grid md:grid-cols-3 gap-6">
        {[
          {
            icon: Wand2,
            title: "Personagens únicos",
            text: "Defina personalidade, estilo de fala, história e cenário. Gere avatares com IA.",
          },
          {
            icon: MessagesSquare,
            title: "Conversas vivas",
            text: "Respostas em tempo real, com memória da história e sugestões para guiar a narrativa.",
          },
          {
            icon: Drama,
            title: "Histórias salvas",
            text: "Continue de onde parou. Favorite, organize e reviva suas melhores cenas.",
          },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-border bg-card/50 p-6 backdrop-blur">
            <f.icon className="h-6 w-6 text-primary mb-3" />
            <h3 className="font-display text-xl font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground mt-2">{f.text}</p>
          </div>
        ))}
      </section>

      <footer className="px-6 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Lucid · Roleplay para maiores de 18 anos
      </footer>
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex gap-2 items-end">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-white text-xs font-display">
          E
        </div>
        <div className="bg-bubble-character text-bubble-character-foreground rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%]">
          <em className="text-muted-foreground">A chuva começa a cair sobre o telhado.</em>
          <div>"Você veio mesmo. Achei que tivesse desistido."</div>
        </div>
      </div>
      <div className="flex justify-end">
        <div className="bg-bubble-user text-bubble-user-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%]">
          Não desistiria. Não dessa vez.
        </div>
      </div>
      <div className="flex gap-2 items-end">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-purple-700 flex items-center justify-center text-white text-xs font-display">
          E
        </div>
        <div className="bg-bubble-character text-bubble-character-foreground rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%]">
          <em className="text-muted-foreground">Ela sorri pela primeira vez na noite.</em>
          <div>"Então me conta tudo, do começo."</div>
        </div>
      </div>
    </div>
  );
}

function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-elegant"
      >
        <h2 className="font-display text-2xl font-semibold">Conteúdo para maiores de 18</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Lucid é uma plataforma de roleplay narrativo que pode incluir temas adultos como
          romance, drama e violência ficcional. Ao continuar, você confirma ter 18 anos ou mais.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-full bg-gradient-primary text-primary-foreground font-medium"
          >
            Tenho 18+
          </button>
          <a
            href="https://www.google.com"
            className="flex-1 text-center px-4 py-2.5 rounded-full border border-border text-muted-foreground hover:text-foreground"
          >
            Sair
          </a>
        </div>
      </motion.div>
    </div>
  );
}
