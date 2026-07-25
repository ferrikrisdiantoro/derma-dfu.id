import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Clock, CheckCircle, Camera, Video, Activity, ArrowLeft, LogOut } from "lucide-react";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AdminDoctors } from "@/components/AdminDoctors";

interface TriageStats {
  avgTimeToReferral: number;
  referralCompletion: number;
  photoAdherence: number;
  televisitCompletion: number;
  redCount: number;
  yellowCount: number;
  greenCount: number;
}

interface TriageRecord {
  id: string;
  created_at: string;
  triage_result: string;
  wound_location: string | null;
  diabetes_history: string | null;
  infection_class: number | null;
  wound_area_cm2: number | null;
  user_id: string | null;
  referrals: Array<{
    id: string;
    facility: string | null;
    status: string | null;
    consultation_type: string | null;
    scheduled_date: string | null;
  }>;
}

function AdminContent() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'doctors'>('dashboard');
  const [stats, setStats] = useState<TriageStats>({
    avgTimeToReferral: 0,
    referralCompletion: 0,
    photoAdherence: 0,
    televisitCompletion: 0,
    redCount: 0,
    yellowCount: 0,
    greenCount: 0,
  });
  const [triageRecords, setTriageRecords] = useState<TriageRecord[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  useEffect(() => {
    checkAdminAndLoadData();
  }, []);

  const checkAdminAndLoadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      // Check if user is admin
      const { data: roles, error: roleError } = await (supabase as any)
        .from("user_roles")
        .select("*")
        .eq("user_id", session.user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (roleError || !roles) {
        toast({
          title: "Akses Ditolak",
          description: "Anda tidak memiliki akses ke halaman admin",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await loadDashboardData();
    } catch (error: any) {
      console.error("Error checking admin:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const loadDashboardData = async () => {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Fetch all triage records with referrals
      const { data: triageData, error: triageError } = await supabase
        .from("triage_records")
        .select(`
          *,
          referrals(*)
        `)
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (triageError) throw triageError;

      setTriageRecords(triageData || []);

      // Calculate statistics
      const redCount = triageData?.filter(r => r.triage_result === "red").length || 0;
      const yellowCount = triageData?.filter(r => r.triage_result === "yellow").length || 0;
      const greenCount = triageData?.filter(r => r.triage_result === "green").length || 0;

      const withPhotos = triageData?.filter(r => r.photo_url).length || 0;
      const photoAdherence = triageData?.length ? (withPhotos / triageData.length) * 100 : 0;

      // Fetch referrals
      const { data: referralsData } = await supabase
        .from("referrals")
        .select("*, triage_records!inner(created_at)")
        .gte("triage_records.created_at", thirtyDaysAgo.toISOString());

      const completedReferrals = referralsData?.filter(r => r.completed_at).length || 0;
      const referralCompletion = referralsData?.length ? (completedReferrals / referralsData.length) * 100 : 0;

      const televisitReferrals = referralsData?.filter(r => r.consultation_type === "telemedicine").length || 0;
      const completedTelevisits = referralsData?.filter(
        r => r.consultation_type === "telemedicine" && r.completed_at
      ).length || 0;
      const televisitCompletion = televisitReferrals ? (completedTelevisits / televisitReferrals) * 100 : 0;

      const referralsWithTime = referralsData?.filter(
        r => r.completed_at && r.created_at
      ) || [];

      const avgTime = referralsWithTime.length
        ? referralsWithTime.reduce((acc, r) => {
          const diff = new Date(r.completed_at!).getTime() - new Date(r.created_at).getTime();
          return acc + diff / (1000 * 60 * 60 * 24);
        }, 0) / referralsWithTime.length
        : 0;

      setStats({
        avgTimeToReferral: avgTime,
        referralCompletion,
        photoAdherence,
        televisitCompletion,
        redCount,
        yellowCount,
        greenCount,
      });
    } catch (error: any) {
      console.error("Error loading dashboard:", error);
      toast({
        title: "Error",
        description: "Gagal memuat data dashboard",
        variant: "destructive",
      });
    }
  };

  const exportData = async () => {
    try {
      const { data, error } = await supabase
        .from("triage_records")
        .select(`
          *,
          referrals(*)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const csv = [
        ["Date", "Patient ID", "Triage Result", "Location", "Diabetes History", "Infection Class", "Wound Area", "Referral Status"],
        ...(data || []).map(record => [
          new Date(record.created_at).toLocaleDateString(),
          record.user_id?.slice(0, 8) || "N/A",
          record.triage_result,
          record.wound_location || "N/A",
          record.diabetes_history || "N/A",
          record.infection_class?.toString() || "N/A",
          record.wound_area_cm2?.toString() || "N/A",
          record.referrals?.[0]?.status || "No referral",
        ])
      ].map(row => row.join(",")).join("\n");

      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `triage-data-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();

      toast({
        title: "Export berhasil",
        description: "Data telah diexport ke CSV",
      });
    } catch (error: any) {
      console.error("Error exporting:", error);
      toast({
        title: "Error",
        description: "Gagal export data",
        variant: "destructive",
      });
    }
  };

  const getTriageColor = (result: string) => {
    switch (result) {
      case "red": return "destructive";
      case "yellow": return "default";
      case "green": return "secondary";
      default: return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  const metrics = [
    {
      title: t("Waktu ke Rujukan", "Time to Referral"),
      value: `${stats.avgTimeToReferral.toFixed(1)} ${t("hari", "days")}`,
      icon: Clock,
      description: t("Rata-rata waktu dari triage ke rujukan", "Average time from triage to referral"),
    },
    {
      title: t("Penyelesaian Rujukan", "Referral Completion"),
      value: `${stats.referralCompletion.toFixed(0)}%`,
      icon: CheckCircle,
      description: t("Persentase rujukan yang diselesaikan", "Percentage of completed referrals"),
    },
    {
      title: t("Kepatuhan Foto", "Photo Adherence"),
      value: `${stats.photoAdherence.toFixed(0)}%`,
      icon: Camera,
      description: t("Persentase triage dengan foto", "Percentage of triage with photos"),
    },
    {
      title: t("Penyelesaian Tele-visit", "Tele-visit Completion"),
      value: `${stats.televisitCompletion.toFixed(0)}%`,
      icon: Video,
      description: t("Persentase tele-visit yang diselesaikan", "Percentage of completed tele-visits"),
    },
  ];

  const triageDistribution = [
    { label: t("Risiko Tinggi", "High Risk"), value: stats.redCount, color: "bg-red-500" },
    { label: t("Risiko Sedang", "Moderate Risk"), value: stats.yellowCount, color: "bg-yellow-500" },
    { label: t("Risiko Rendah", "Low Risk"), value: stats.greenCount, color: "bg-green-500" },
  ];

  const totalCases = stats.redCount + stats.yellowCount + stats.greenCount;

  return (
    <div className="min-h-screen bg-background">
      {/* Admin Navbar */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="text-2xl font-bold text-heading hover:opacity-80 transition-opacity"
            >
              DERMA-DFU.ID - Admin
            </button>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("Kembali", "Back")}
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                {t("Keluar", "Logout")}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">{t("Dashboard", "Dashboard")}</h1>
            <p className="text-muted-foreground">{t("Halaman Admin Derma-Bantu", "Derma-Bantu Admin Page")}</p>
          </div>
          <Button onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            {t("Export Data", "Export Data")}
          </Button>
        </div>

        <div className="space-y-6">
          {/* Simple Tabs via State */}
          <div className="flex space-x-2 border-b">
            <Button
              variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('dashboard')}
              className="rounded-b-none"
            >
              Dashboard
            </Button>
            <Button
              variant={activeTab === 'doctors' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('doctors')}
              className="rounded-b-none"
            >
              {t("Manajemen Dokter", "Manage Doctors")}
            </Button>
          </div>

          {activeTab === 'dashboard' && (
            <div className="space-y-6 animation-fade-in">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {metrics.map((metric) => (
                  <Card key={metric.title}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        {metric.title}
                      </CardTitle>
                      <metric.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{metric.value}</div>
                      <p className="text-xs text-muted-foreground">
                        {metric.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("Distribusi Triage", "Triage Distribution")}</CardTitle>
                    <CardDescription>{t("Pembagian hasil triage berdasarkan risiko", "Breakdown of triage results by risk")}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {triageDistribution.map((item) => (
                      <div key={item.label} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{item.label}</span>
                          <span className="text-sm text-muted-foreground">
                            {item.value} ({totalCases > 0 ? ((item.value / totalCases) * 100).toFixed(0) : 0}%)
                          </span>
                        </div>
                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.color}`}
                            style={{
                              width: totalCases > 0 ? `${(item.value / totalCases) * 100}%` : "0%",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t("Aktivitas Terbaru", "Recent Activity")}</CardTitle>
                    <CardDescription>{t("5 triage terbaru", "Latest 5 triage records")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {triageRecords.slice(0, 5).map((record) => (
                        <div key={record.id} className="flex items-center space-x-4">
                          <Activity className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-medium leading-none">
                              Patient ID: {record.user_id?.slice(0, 8)} - {record.triage_result.toUpperCase()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(record.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Data Triage Pasien</CardTitle>
                  <CardDescription>Semua data triage dan rujukan</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Pasien</TableHead>
                        <TableHead>Hasil Triage</TableHead>
                        <TableHead>Lokasi Luka</TableHead>
                        <TableHead>Infeksi</TableHead>
                        <TableHead>Luas Luka</TableHead>
                        <TableHead>Status Rujukan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {triageRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            {new Date(record.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{record.user_id?.slice(0, 8) || "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={getTriageColor(record.triage_result)}>
                              {record.triage_result.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell>{record.wound_location || "N/A"}</TableCell>
                          <TableCell>
                            {record.infection_class ? `Class ${record.infection_class}` : "N/A"}
                          </TableCell>
                          <TableCell>
                            {record.wound_area_cm2 ? `${record.wound_area_cm2} cm²` : "N/A"}
                          </TableCell>
                          <TableCell>
                            {record.referrals?.[0]?.status || "Belum dirujuk"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'doctors' && (
            <AdminDoctors t={t} />
          )}
        </div>
      </div>
    </div>
  );
}

export default function Admin() {
  return (
    <LanguageProvider>
      <AdminContent />
    </LanguageProvider>
  );
}
