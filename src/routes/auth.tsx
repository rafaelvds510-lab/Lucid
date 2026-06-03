import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Loader2, Mail, Lock, User, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { KEEP_SIGNED_IN_KEY } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function getAuthErrorMessage(message: string): string {
  if (message.includes("Invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("Email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("User already registered")) return "Este e-mail já está cadastrado.";
  if (message.includes("Password should be at least")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (message.includes("Unable to validate email address")) return "E-mail inválido.";
  if (message.includes("Email rate limit exceeded")) return "Muitos envios. Tente novamente em alguns minutos.";
  if (message.toLowerCase().includes("network")) return "Erro de conexão. Verifique sua internet.";
  return message;
}

function AuthPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [loading, user, navigate]);

  // Sincronizar preferência de persistência no localStorage
  function handleKeepSignedIn(value: boolean) {
    setKeepSignedIn(value);
    if (value) {
      localStorage.setItem(KEEP_SIGNED_IN_KEY, "true");
    } else {
      localStorage.removeItem(KEEP_SIGNED_IN_KEY);
    }
  }

  async function onSubmitAuth(e: FormEvent) {
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
        toast.success("Conta criada! Verifique seu e-mail para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        // Invalidar cache remoto para forçar refetch dos dados do usuário
        await router.invalidate();
        navigate({ to: "/app" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao autenticar";
      toast.error(getAuthErrorMessage(msg));
    } finally {
      setBusy(false);
    }
  }

  async function onForgotPassword(e: FormEvent) {
    e.preventDefault();
    if (!email) { toast.error("Informe seu e-mail para continuar."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
      toast.success("E-mail de recuperação enviado!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao enviar e-mail";
      toast.error(getAuthErrorMessage(msg));
    } finally {
      setBusy(false);
    }
  }

  const isSignIn = mode === "signin";
  const isForgot = mode === "forgot";

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      {/* Fundo com gradiente animado sutil */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-500/8 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
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

          {/* Tela: Esqueceu a senha */}
          {isForgot ? (
            <>
              <button
                onClick={() => { setMode("signin"); setForgotSent(false); }}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition"
                id="back-to-signin-btn"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Voltar para login
              </button>

              <h1 className="font-display text-3xl font-semibold">Recuperar senha</h1>

              {forgotSent ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-primary/10 border border-primary/20 p-4">
                    <p className="text-sm text-primary font-medium">E-mail enviado ✓</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Verifique sua caixa de entrada em <span className="text-foreground">{email}</span> e clique no link para redefinir sua senha.
                    </p>
                  </div>
                  <button
                    onClick={() => setForgotSent(false)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                    id="resend-forgot-btn"
                  >
                    Não recebeu? Tentar novamente
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground mt-1 mb-5">
                    Informe seu e-mail e enviaremos um link para redefinir sua senha.
                  </p>
                  <form onSubmit={onForgotPassword} className="space-y-3">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <input
                        id="forgot-email-input"
                        type="email"
                        required
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        maxLength={255}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                      />
                    </div>
                    <button
                      id="forgot-submit-btn"
                      type="submit"
                      disabled={busy}
                      className="w-full px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                    >
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                      Enviar link de recuperação
                    </button>
                  </form>
                </>
              )}
            </>
          ) : (
            /* Telas: Login e Cadastro */
            <>
              <h1 className="font-display text-3xl font-semibold">
                {isSignIn ? "Bem-vindo de volta" : "Crie sua conta"}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isSignIn
                  ? "Continue suas histórias de onde parou."
                  : "Comece a criar personagens em segundos."}
              </p>

              <form onSubmit={onSubmitAuth} className="mt-6 space-y-3">
                {!isSignIn && (
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <input
                      id="signup-name-input"
                      type="text"
                      placeholder="Nome de exibição"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={50}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="auth-email-input"
                    type="email"
                    required
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="auth-password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    placeholder={isSignIn ? "Sua senha" : "Senha (mínimo 8 caracteres)"}
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 rounded-xl bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring text-sm"
                  />
                  <button
                    type="button"
                    id="toggle-password-visibility-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    tabIndex={-1}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Linha: Manter-me conectado + Esqueceu a senha */}
                {isSignIn && (
                  <div className="flex items-center justify-between pt-0.5">
                    <label htmlFor="keep-signed-in-checkbox" className="flex items-center gap-2 cursor-pointer select-none">
                      <div
                        onClick={() => handleKeepSignedIn(!keepSignedIn)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition cursor-pointer ${
                          keepSignedIn
                            ? "bg-primary border-primary"
                            : "border-border bg-input hover:border-primary/60"
                        }`}
                        role="checkbox"
                        aria-checked={keepSignedIn}
                        id="keep-signed-in-checkbox"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === " " && handleKeepSignedIn(!keepSignedIn)}
                      >
                        {keepSignedIn && (
                          <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 10 8" fill="none">
                            <path d="M1 4l2.5 2.5L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">Manter-me conectado</span>
                    </label>

                    <button
                      type="button"
                      id="forgot-password-link-btn"
                      onClick={() => { setMode("forgot"); setForgotSent(false); }}
                      className="text-xs text-muted-foreground hover:text-primary transition"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                )}

                <button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={busy}
                  className="w-full px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground font-medium shadow-glow disabled:opacity-50 flex items-center justify-center gap-2 text-sm mt-1"
                >
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSignIn ? "Entrar" : "Criar conta"}
                </button>
              </form>

              <button
                id="toggle-auth-mode-btn"
                onClick={() => setMode(isSignIn ? "signup" : "signin")}
                className="mt-5 text-sm text-muted-foreground hover:text-foreground w-full text-center transition"
              >
                {isSignIn ? "Não tem conta? " : "Já tem conta? "}
                <span className="text-primary font-medium">
                  {isSignIn ? "Cadastre-se" : "Entrar"}
                </span>
              </button>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
