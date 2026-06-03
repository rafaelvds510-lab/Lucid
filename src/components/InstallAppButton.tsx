import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppButton({ className = "" }: { className?: string }) {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS/.test(ua));

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return null;
  if (!deferred && !isIOS) return null;

  const handleClick = async () => {
    if (deferred) {
      await deferred.prompt();
      await deferred.userChoice;
      setDeferred(null);
      return;
    }
    if (isIOS) setShowIOSHint(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={
          "inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card/60 backdrop-blur text-sm font-medium hover:bg-card transition " +
          className
        }
      >
        <Download className="h-4 w-4" /> Instalar app
      </button>

      {showIOSHint && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-background/80 backdrop-blur p-4"
          onClick={() => setShowIOSHint(false)}
        >
          <div
            className="max-w-sm w-full rounded-2xl border border-border bg-card p-6 shadow-elegant"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display text-lg font-semibold">Instalar no iPhone</h3>
            <ol className="mt-3 text-sm text-muted-foreground space-y-2 list-decimal pl-4">
              <li>Toque no ícone de Compartilhar no Safari.</li>
              <li>Selecione “Adicionar à Tela de Início”.</li>
              <li>Confirme em “Adicionar”.</li>
            </ol>
            <button
              onClick={() => setShowIOSHint(false)}
              className="mt-5 w-full px-4 py-2 rounded-full bg-gradient-primary text-primary-foreground text-sm font-medium"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
}
