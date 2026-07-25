import { ReactNode, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  BookOpen,
  Settings,
  Wifi,
  WifiOff,
  Sparkles,
  MessageCircle,
  History as HistoryIcon,
  ShieldCheck,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (value: string) => void;
}

const TABS = [
  { id: "triage", labelId: "Triage", labelEn: "Triage", icon: Camera },
  { id: "education", labelId: "Edukasi", labelEn: "Education", icon: BookOpen },
  { id: "settings", labelId: "Pengaturan", labelEn: "Settings", icon: Settings },
] as const;

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background bg-dots">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-surface/85 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between px-4 py-3 sm:py-4">
          {/* Logo */}
          <button
            onClick={() => navigate("/")}
            className="group flex items-center gap-2.5 transition-transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-base font-extrabold tracking-tight text-heading sm:text-lg">
                DERMA-DFU<span className="text-primary">.ID</span>
              </span>
              <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                AI Diabetic Foot Triage
              </span>
            </div>
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <div className="hidden items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-success sm:flex">
                <Wifi className="h-3.5 w-3.5" />
                <span>Online</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-medium text-warning-foreground">
                <WifiOff className="h-3.5 w-3.5" />
                <span>Offline</span>
              </div>
            )}

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/history")}
              className="rounded-full"
              aria-label="Riwayat"
              title={t("Riwayat", "History")}
            >
              <HistoryIcon className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Tabs (modern pill nav) */}
        <div className="container mx-auto px-4 pb-3">
          <nav
            className="relative flex items-center justify-between gap-1 rounded-full border border-border/80 bg-muted/50 p-1"
            role="tablist"
          >
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => onTabChange(tab.id)}
                  className={[
                    "relative flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2.5 text-sm font-semibold transition-all sm:px-6",
                    active
                      ? "bg-surface text-heading shadow-soft"
                      : "text-muted-foreground hover:text-heading",
                  ].join(" ")}
                >
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.5 : 2} />
                  <span className="whitespace-nowrap">{t(tab.labelId, tab.labelEn)}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* ============ MAIN ============ */}
      <main className="container mx-auto px-4 py-6 pb-24 sm:py-8">
        {children}
      </main>

      {/* ============ FOOTER (safety notice) ============ */}
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-warning/30 bg-warning-soft/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-center gap-2 px-4 py-2.5">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-warning-foreground/80" />
          <p className="text-center text-[11px] font-medium leading-tight text-warning-foreground sm:text-xs">
            {t(
              "Aplikasi demo. Bukan pengganti dokter. Jika ada tanda bahaya, rujuk dalam 48 jam.",
              "Demo app. Not a substitute for a doctor. If danger signs present, refer within 48 hours."
            )}
          </p>
        </div>
      </footer>
    </div>
  );
}
