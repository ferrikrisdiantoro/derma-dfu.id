import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, History as HistoryIcon, BookOpen, Settings, Wifi, WifiOff, Shield, LogOut, LogIn, MessageCircle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface LayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (value: string) => void;
}

export function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    checkAuthStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkAuthStatus();
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      subscription.unsubscribe();
    };
  }, []);

  const checkAuthStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsLoggedIn(!!session);

    if (session) {
      const { data: roles } = await (supabase as any)
        .from("user_roles")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();
      setIsAdmin(!!roles);
    } else {
      setIsAdmin(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background hearts-decoration">
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="text-2xl font-bold text-heading hover:opacity-80 transition-opacity"
            >
              DERMA-DFU.ID
            </button>
            <div className="flex items-center gap-4">
              {!isOnline && (
                <div className="flex items-center gap-2 bg-warning/10 text-warning px-3 py-1 rounded-full text-sm">
                  <WifiOff className="h-4 w-4" />
                  <span>{t("Menunggu koneksi...", "Waiting for connection...")}</span>
                </div>
              )}

              {!isLoggedIn ? (
                <Button variant="outline" size="sm" onClick={() => navigate("/auth")}>
                  <LogIn className="h-4 w-4 mr-2" />
                  {t("Masuk", "Login")}
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="icon" onClick={() => navigate("/history")} className="mr-2">
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        {t("Akun", "Account")}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate("/history")}>
                        <HistoryIcon className="h-4 w-4 mr-2" />
                        {t("Riwayat", "History")}
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem onClick={() => navigate("/admin")}>
                          <Shield className="h-4 w-4 mr-2" />
                          Admin
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={handleLogout}>
                        <LogOut className="h-4 w-4 mr-2" />
                        {t("Keluar", "Logout")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-[73px] z-40 bg-card/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-auto bg-transparent">
              <TabsTrigger value="triage" className="min-touch-target flex flex-col items-center gap-1 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-2xl">
                <Camera className="h-5 w-5" />
                <span className="text-xs">{t("Triage", "Triage")}</span>
              </TabsTrigger>
              <TabsTrigger value="education" className="min-touch-target flex flex-col items-center gap-1 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-2xl">
                <BookOpen className="h-5 w-5" />
                <span className="text-xs">{t("Edukasi", "Education")}</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="min-touch-target flex flex-col items-center gap-1 data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground rounded-2xl">
                <Settings className="h-5 w-5" />
                <span className="text-xs">{t("Pengaturan", "Settings")}</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6">{children}</main>

      <footer className="sticky bottom-0 bg-warning/10 border-t border-warning/30 backdrop-blur">
        <div className="container mx-auto px-4 py-2">
          <p className="text-xs text-center text-body">
            {t("Aplikasi demo. Bukan pengganti dokter. Jika ada tanda bahaya, rujuk dalam 48 jam.", "Demo app. Not a substitute for a doctor. If danger signs present, refer within 48 hours.")}
          </p>
        </div>
      </footer>
    </div>
  );
}
