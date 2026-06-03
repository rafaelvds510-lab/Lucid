import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex-1 px-6 py-8 md:py-12 max-w-2xl mx-auto w-full pb-24 md:pb-12">
      <h1 className="font-display text-4xl font-semibold">Conta</h1>
      <div className="mt-8 rounded-2xl border border-border bg-card/50 p-5 space-y-4">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">E-mail</div>
          <div className="mt-1">{user?.email}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">ID</div>
          <div className="mt-1 text-xs font-mono text-muted-foreground truncate">{user?.id}</div>
        </div>
      </div>

      <button
        onClick={async () => { await signOut(); navigate({ to: "/" }); }}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border hover:bg-card transition text-sm"
      >
        <LogOut className="h-4 w-4" /> Sair da conta
      </button>

      <div className="mt-12 text-xs text-muted-foreground">
        Lucid utiliza modelos de IA com filtros de segurança nativos do provedor. Conteúdo extremamente
        explícito ou ilegal pode ser bloqueado pelo modelo independentemente do contexto narrativo.
      </div>
    </div>
  );
}
