import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [loading, user, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/app`,
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Bem-vindo.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao autenticar");
    } finally {
      setBusy(false);
    }
  }

  async function onGoogle() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/app`,
      });
      if (result.error) throw new Error(String(result.error));
      if (result.redirected) return;
      navigate({ to: "/app" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro no Google");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-border bg-card/80 backdrop-blur p-8 shadow-elegant"
      >
        <div className="flex items-center gap-2 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-semibold">Lucid</span>
        </div>

        <h1 className="font-display text-3xl font-semibold">
          {mode === "signin" ? "Bem-vindo de volta" : "Crie sua conta"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {mode === "signin"
            ? "Continue suas histórias de onde parou."
            : "Comece a criar personagens em segundos."}
        </p>

        <button
          onClick={onGoogle}
          disabled={busy}
          className="mt-6 w-full px-4 py-3 rounded-full border border-border bg-background hover:bg-card transition flex items-center justify-center gap-2 text-sm font-medium disabled:opacity-50"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M5.27 9.76A7.08 7.08 0 0 1 12 5.04c1.84 0 3.5.65 4.81 1.91l3.45-3.45A11.94 11.94 0 0 0 12 .76C7.4.76 3.42 3.4 1.46 7.27z"/><path fill="#34A853" d="M16.04 18.01A7.07 7.07 0 0 1 12 19.07a7.08 7.08 0 0 1-6.71-4.78l-3.81 2.94C3.46 21.27 7.42 23.92 12 23.92c2.93 0 5.74-1.04 7.93-2.99z"/><path fill="#4A90E2" d="M19.93 20.93a11.95 11.95 0 0 0 3.66-9.06c0-.76-.07-1.49-.18-2.2H12v4.18h6.51a5.57 5.57 0 0 1-2.47 3.66z"/><path fill="#FBBC05" d="M5.29 14.29A7.07 7.07 0 0 1 4.93 12c0-.79.13-1.54.34-2.24L1.46 6.82A11.93 11.93 0 0 0 .08 12c0 1.93.46 3.76 1.38 5.18z"/></svg>
          Continuar com Google
        </button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex-1 h-px bg-border" /> ou e-mail <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={onSubmit} className="space-y-3">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Nome de exibição"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring"
            />
          )}
          <input
            type="email"
            required
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            required
            placeholder="Senha (mínimo 8 caracteres)"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin" ? "Entrar" : "Criar conta"}
          </button>
        </form>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 text-sm text-muted-foreground hover:text-foreground w-full text-center"
        >
          {mode === "signin" ? "Não tem conta? Cadastre-se" : "Já tem conta? Entrar"}
        </button>
      </motion.div>
    </div>
  );
}
