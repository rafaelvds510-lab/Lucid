import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Sparkles, Home, Users, Library as LibraryIcon, LogOut, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">
        Carregando…
      </div>
    );
  }

  const inChat = path.startsWith("/app/chat/");

  const nav = [
    { to: "/app", label: "Início", icon: Home, exact: true },
    { to: "/app/characters/new", label: "Criar personagem", icon: Users, exact: false },
    { to: "/app/library", label: "Biblioteca", icon: LibraryIcon, exact: false },
    { to: "/app/settings", label: "Conta", icon: SettingsIcon, exact: false },
  ];

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-card/40 backdrop-blur p-5",
          inChat && "lg:flex"
        )}
      >
        <Link to="/app" className="flex items-center gap-2 mb-8">
          <div className="h-9 w-9 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-semibold">Lucid</span>
        </Link>

        <nav className="flex-1 space-y-1">
          {nav.map((n) => {
            const active = n.exact ? path === n.to : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={async () => {
            await signOut();
            navigate({ to: "/" });
          }}
          className="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </aside>

      <main className="flex-1 min-w-0 flex flex-col">
        <Outlet />
        {/* Mobile bottom nav (hide in chat to avoid covering input) */}
        {!inChat && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur flex justify-around py-2">
            {nav.slice(0, 4).map((n) => {
              const active = n.exact ? path === n.to : path.startsWith(n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px]",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <n.icon className="h-5 w-5" />
                  {n.label.split(" ")[0]}
                </Link>
              );
            })}
          </nav>
        )}
      </main>
    </div>
  );
}
