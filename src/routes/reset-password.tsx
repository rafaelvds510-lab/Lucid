import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion } from "framer-motion";
import { Sparkles, Loader2, Lock, Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  // O Supabase seta uma sessão temporária via hash fragment ao clicar no link
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasSession(true);
      }
      setChecking(false);
    });

    // Checar sessão existente também
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
      setChecking(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate({ to: "/app" }), 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao redefinir senha";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Fundo com gradiente sutil */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/3 left-1/3 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="w-full max-w-md rounded-3xl border border-border bg-card/80 backdrop-blur-xl p-8 shadow-elegant"
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="h-10 w-10 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-semibold">Lucid</span>
        </div>

        {checking ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !hasSession ? (
          /* Link inválido ou expirado */
          <div className="space-y-4">
            <h1 className="font-display text-3xl font-semibold">Link inválido</h1>
            <p className="text-sm text-muted-foreground">
              Este link de recuperação expirou ou já foi utilizado. Solicite um novo.
            </p>
            <button
              id="goto-forgot-btn"
              onClick={() => navigate({ to: "/auth" })}
              className="mt-4 w-full px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow text-sm"
            >
              Voltar para o login
            </button>
          </div>
        ) : done ? (
          /* Sucesso */
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4 py-4"
          >
            <CheckCircle className="h-14 w-14 text-primary mx-auto" />
            <h1 className="font-display text-2xl font-semibold">Senha redefinida!</h1>
            <p className="text-sm text-muted-foreground">
              Redirecionando para o seu painel…
            </p>
          </motion.div>
        ) : (
          /* Formulário de nova senha */
          <>
            <h1 className="font-display text-3xl font-semibold">Nova senha</h1>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              Escolha uma senha forte com pelo menos 8 caracteres.
            </p>

            <form onSubmit={onSubmit} className="space-y-3">
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="new-password-input"
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Nova senha"
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
                <button
                  type="button"
                  id="toggle-new-password-btn"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  tabIndex={-1}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  id="confirm-password-input"
                  type={showConfirm ? "text" : "password"}
                  required
                  placeholder="Confirmar nova senha"
                  minLength={8}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full pl-10 pr-11 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                />
                <button
                  type="button"
                  id="toggle-confirm-password-btn"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                  tabIndex={-1}
                  aria-label={showConfirm ? "Ocultar confirmação" : "Mostrar confirmação"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Indicador de força da senha */}
              {password.length > 0 && (
                <div className="flex gap-1 pt-0.5">
                  {[1, 2, 3, 4].map((level) => {
                    const strength =
                      password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[^A-Za-z0-9]/.test(password) ? 4
                      : password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
                      : password.length >= 8 ? 2
                      : 1;
                    return (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          level <= strength
                            ? strength === 1 ? "bg-destructive"
                              : strength === 2 ? "bg-yellow-500"
                              : strength === 3 ? "bg-green-500/80"
                              : "bg-primary"
                            : "bg-border"
                        }`}
                      />
                    );
                  })}
                </div>
              )}

              <button
                id="reset-password-submit-btn"
                type="submit"
                disabled={busy}
                className="w-full px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-1"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Redefinir senha
              </button>
            </form>
          </>
        )}
      </motion.div>
    </div>
  );
}
