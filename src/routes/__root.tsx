import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AuthProvider } from "@/lib/auth-context";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-display font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Página não encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A história que você procura não existe ou foi reescrita.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-gradient-primary px-5 py-2 text-sm font-medium text-primary-foreground shadow-glow hover:opacity-90 transition"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Lucid — Roleplay com IA" },
      {
        name: "description",
        content:
          "Crie personagens, viva histórias imersivas e converse com inteligência artificial em formato de roleplay narrativo.",
      },
      { property: "og:title", content: "Lucid — Roleplay com IA" },
      {
        property: "og:description",
        content: "Crie histórias fictícias com personagens vivos, gerados e interpretados por IA.",
      },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#0b0710" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Lucid" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Lucid — Roleplay com IA" },
      { name: "description", content: "converse com novos personagens" },
      { property: "og:description", content: "converse com novos personagens" },
      { name: "twitter:description", content: "converse com novos personagens" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Cmt6dJ4S60dV7twY4lrdlgmaoYk2/social-images/social-1777505154327-Lilith.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/Cmt6dJ4S60dV7twY4lrdlgmaoYk2/social-images/social-1777505154327-Lilith.webp" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/icon-180x180.png" },
      { rel: "apple-touch-icon", sizes: "152x152", href: "/icons/icon-152x152.png" },
      { rel: "apple-touch-icon", sizes: "120x120", href: "/icons/icon-120x120.png" },
      { rel: "apple-touch-icon", sizes: "76x76", href: "/icons/icon-76x76.png" },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cormorant+Garamond:wght@500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster position="top-center" theme="dark" richColors />
    </AuthProvider>
  );
}
