import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Globe, Moon, Sun, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export default function Settings() {
  const { t, language, setLanguage } = useLanguage();
  const [isDark, setIsDark] = useState(false);

  const handleLanguageChange = (value: string) => {
    setLanguage(value as "id" | "en");
    toast.success(
      value === "id" 
        ? "Bahasa diubah ke Bahasa Indonesia" 
        : "Language changed to English"
    );
  };

  const handleThemeToggle = (checked: boolean) => {
    setIsDark(checked);
    document.documentElement.classList.toggle("dark", checked);
    toast.success(
      t(
        checked ? "Mode gelap diaktifkan" : "Mode terang diaktifkan",
        checked ? "Dark mode enabled" : "Light mode enabled"
      )
    );
  };

  const handleImportDemo = () => {
    toast.success(
      t(
        "Data demo berhasil diimpor (10 kasus contoh)",
        "Demo data imported successfully (10 sample cases)"
      )
    );
  };

  const handleResetApp = () => {
    localStorage.clear();
    toast.success(
      t(
        "Aplikasi berhasil direset. Refresh halaman untuk memulai ulang.",
        "App reset successfully. Refresh page to restart."
      )
    );
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-20">
      <h2 className="text-2xl font-bold">{t("Pengaturan", "Settings")}</h2>

      {/* Language Settings */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-cta" />
            {t("Bahasa / Language", "Language / Bahasa")}
          </CardTitle>
          <CardDescription>
            {t("Pilih bahasa tampilan aplikasi", "Select app display language")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup value={language} onValueChange={handleLanguageChange}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="id" id="lang-id" />
              <Label htmlFor="lang-id" className="cursor-pointer">
                🇮🇩 Bahasa Indonesia
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="en" id="lang-en" />
              <Label htmlFor="lang-en" className="cursor-pointer">
                🇬🇧 English
              </Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            {t("Tema Tampilan", "Display Theme")}
          </CardTitle>
          <CardDescription>
            {t("Pilih tema terang atau gelap", "Choose light or dark theme")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="theme-mode">
              {t("Mode Gelap", "Dark Mode")}
            </Label>
            <Switch
              id="theme-mode"
              checked={isDark}
              onCheckedChange={handleThemeToggle}
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle>{t("Manajemen Data", "Data Management")}</CardTitle>
          <CardDescription>
            {t("Impor data demo atau reset aplikasi", "Import demo data or reset app")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleImportDemo}
            variant="outline"
            className="w-full min-touch-target rounded-2xl"
          >
            <Upload className="mr-2 h-4 w-4" />
            {t("Impor Paket Demo", "Import Demo Pack")}
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                className="w-full min-touch-target rounded-2xl"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("Reset Aplikasi", "Reset App")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("Yakin ingin reset aplikasi?", "Are you sure you want to reset the app?")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t(
                    "Semua data lokal akan dihapus. Tindakan ini tidak dapat dibatalkan.",
                    "All local data will be deleted. This action cannot be undone."
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-2xl">
                  {t("Batal", "Cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleResetApp}
                  className="rounded-2xl bg-destructive text-destructive-foreground"
                >
                  {t("Reset", "Reset")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* About */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle>{t("Tentang Aplikasi", "About App")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>DERMA-DFU.ID</strong>
          </p>
          <p>
            {t(
              "Aplikasi triage AI untuk luka kaki diabetik dengan fitur tele-referral.",
              "AI triage app for diabetic foot wounds with tele-referral features."
            )}
          </p>
          <p className="text-muted-foreground">
            {t("Versi demo - Offline-first PWA", "Demo version - Offline-first PWA")}
          </p>
          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              {t(
                "Dibuat untuk meningkatkan akses perawatan luka kaki diabetik di daerah rural.",
                "Created to improve diabetic foot wound care access in rural areas."
              )}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
