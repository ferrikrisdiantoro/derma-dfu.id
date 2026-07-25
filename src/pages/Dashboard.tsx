import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, Camera, Video, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TriageStats {
  avgTimeToReferral: number;
  referralCompletion: number;
  photoAdherence: number;
  televisitCompletion: number;
  distribution: {
    red: number;
    yellow: number;
    green: number;
  };
}

interface RecentActivity {
  id: string;
  triage_result: string;
  created_at: string;
  has_smell_pus: boolean;
  has_fever: boolean;
  wound_location: string | null;
}

export default function Dashboard() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<TriageStats>({
    avgTimeToReferral: 0,
    referralCompletion: 0,
    photoAdherence: 0,
    televisitCompletion: 0,
    distribution: { red: 0, yellow: 0, green: 0 },
  });
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Ambil data 30 hari terakhir
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Query triage records
      const { data: triageData, error: triageError } = await supabase
        .from("triage_records")
        .select("*")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false });

      if (triageError) throw triageError;

      // Query referrals
      const { data: referralData, error: referralError } = await supabase
        .from("referrals")
        .select("*, triage_records!inner(created_at)")
        .gte("triage_records.created_at", thirtyDaysAgo.toISOString());

      if (referralError) throw referralError;

      // Hitung distribusi triage
      const distribution = {
        red: triageData?.filter((t) => t.triage_result === "red").length || 0,
        yellow: triageData?.filter((t) => t.triage_result === "yellow").length || 0,
        green: triageData?.filter((t) => t.triage_result === "green").length || 0,
      };

      // Hitung waktu rata-rata ke rujukan (dalam jam)
      let totalHoursToReferral = 0;
      let referralsWithSchedule = 0;
      referralData?.forEach((ref: any) => {
        if (ref.scheduled_date) {
          const triageTime = new Date(ref.triage_records.created_at).getTime();
          const scheduledTime = new Date(ref.scheduled_date).getTime();
          const hoursDiff = (scheduledTime - triageTime) / (1000 * 60 * 60);
          if (hoursDiff >= 0) {
            totalHoursToReferral += hoursDiff;
            referralsWithSchedule++;
          }
        }
      });
      const avgTimeToReferral = referralsWithSchedule > 0 
        ? Math.round(totalHoursToReferral / referralsWithSchedule) 
        : 0;

      // Hitung rujukan selesai (%)
      const completedReferrals = referralData?.filter((r) => r.status === "completed").length || 0;
      const totalReferrals = referralData?.length || 0;
      const referralCompletion = totalReferrals > 0 
        ? Math.round((completedReferrals / totalReferrals) * 100) 
        : 0;

      // Hitung kepatuhan foto (%)
      const withPhoto = triageData?.filter((t) => t.photo_url).length || 0;
      const totalTriage = triageData?.length || 0;
      const photoAdherence = totalTriage > 0 
        ? Math.round((withPhoto / totalTriage) * 100) 
        : 0;

      // Hitung tele-visit selesai (untuk referral video/phone)
      const teleReferrals = referralData?.filter(
        (r) => r.consultation_type === "video" || r.consultation_type === "phone"
      ) || [];
      const completedTele = teleReferrals.filter((r) => r.status === "completed").length;
      const televisitCompletion = teleReferrals.length > 0 
        ? Math.round((completedTele / teleReferrals.length) * 100) 
        : 0;

      setStats({
        avgTimeToReferral,
        referralCompletion,
        photoAdherence,
        televisitCompletion,
        distribution,
      });

      // Ambil 5 aktivitas terbaru
      setRecentActivities(triageData?.slice(0, 5) || []);
    } catch (error: any) {
      console.error("Error loading dashboard:", error);
      toast.error(t("Gagal memuat data dashboard", "Failed to load dashboard data"));
    } finally {
      setLoading(false);
    }
  };

  const exportData = async () => {
    try {
      const { data, error } = await supabase
        .from("triage_records")
        .select("*, referrals(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Convert to CSV
      const csv = [
        ["ID", "Tanggal", "Hasil Triage", "Durasi Luka", "Lokasi", "Demam", "Bau/Nanah", "Foto URL"],
        ...(data || []).map((record) => [
          record.id,
          new Date(record.created_at).toLocaleString("id-ID"),
          record.triage_result.toUpperCase(),
          record.wound_duration || "-",
          record.wound_location || "-",
          record.has_fever ? "Ya" : "Tidak",
          record.has_smell_pus ? "Ya" : "Tidak",
          record.photo_url || "-",
        ]),
      ]
        .map((row) => row.join(","))
        .join("\n");

      // Download CSV
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `triage-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(t("Data berhasil diekspor", "Data exported successfully"));
    } catch (error: any) {
      console.error("Error exporting data:", error);
      toast.error(t("Gagal mengekspor data", "Failed to export data"));
    }
  };

  const metrics = [
    {
      title: t("Waktu ke Rujukan", "Time to Referral"),
      value: stats.avgTimeToReferral.toString(),
      unit: t("jam (rata-rata)", "hours (average)"),
      icon: <Clock className="h-5 w-5" />,
      color: "text-cta",
    },
    {
      title: t("Rujukan Selesai", "Referral Completion"),
      value: stats.referralCompletion.toString(),
      unit: "%",
      icon: <CheckCircle className="h-5 w-5" />,
      color: "text-primary",
    },
    {
      title: t("Kepatuhan Foto", "Photo Adherence"),
      value: stats.photoAdherence.toString(),
      unit: "%",
      icon: <Camera className="h-5 w-5" />,
      color: "text-accent",
    },
    {
      title: t("Tele-visit Selesai", "Tele-visit Completion"),
      value: stats.televisitCompletion.toString(),
      unit: "%",
      icon: <Video className="h-5 w-5" />,
      color: "text-primary",
    },
  ];

  const triageDistribution = [
    { 
      level: "RED", 
      count: stats.distribution.red, 
      color: "bg-triage-red" 
    },
    { 
      level: "YELLOW", 
      count: stats.distribution.yellow, 
      color: "bg-triage-yellow" 
    },
    { 
      level: "GREEN", 
      count: stats.distribution.green, 
      color: "bg-triage-green" 
    },
  ];

  const totalCases = stats.distribution.red + stats.distribution.yellow + stats.distribution.green;

  const getActivityDescription = (activity: RecentActivity) => {
    if (activity.triage_result === "red") {
      if (activity.has_fever || activity.has_smell_pus) {
        return t("Pasien dengan infeksi berat", "Patient with severe infection");
      }
      return t("Rujukan mendesak", "Urgent referral");
    }
    if (activity.triage_result === "yellow") {
      return t("Tele-konsultasi dijadwalkan", "Tele-consult scheduled");
    }
    return t("Edukasi diberikan", "Education provided");
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} ${t("hari lalu", "days ago")}`;
    }
    return `${diffHours} ${t("jam lalu", "hours ago")}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">{t("Memuat data...", "Loading data...")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t("Indikator Kinerja", "Performance Indicators")}</h2>
        <Button onClick={exportData} variant="outline" className="rounded-2xl min-touch-target">
          <Download className="mr-2 h-4 w-4" />
          {t("Ekspor Data", "Export Data")}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index} className="rounded-2xl shadow-md">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
              <div className={metric.color}>{metric.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{metric.unit}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Triage Distribution */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle>{t("Distribusi Triage (30 hari terakhir)", "Triage Distribution (Last 30 days)")}</CardTitle>
        </CardHeader>
        <CardContent>
          {totalCases === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("Belum ada data triage", "No triage data yet")}
            </p>
          ) : (
            <div className="space-y-4">
              {triageDistribution.map((item) => (
                <div key={item.level} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{item.level}</span>
                    <span className="text-sm text-muted-foreground">
                      {item.count} {t("kasus", "cases")}
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-3">
                    <div
                      className={`${item.color} h-3 rounded-full transition-all`}
                      style={{
                        width: `${totalCases > 0 ? (item.count / totalCases) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle>{t("Aktivitas Terbaru", "Recent Activity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivities.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("Belum ada aktivitas", "No activities yet")}
            </p>
          ) : (
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-center gap-4 p-3 bg-secondary rounded-xl">
                  <div 
                    className={`w-2 h-12 rounded-full ${
                      activity.triage_result === "red" 
                        ? "bg-triage-red" 
                        : activity.triage_result === "yellow" 
                        ? "bg-triage-yellow" 
                        : "bg-triage-green"
                    }`} 
                  />
                  <div className="flex-1">
                    <p className="font-medium">{getActivityDescription(activity)}</p>
                    <p className="text-sm text-muted-foreground">
                      {activity.wound_location 
                        ? t(`Lokasi: ${activity.wound_location}`, `Location: ${activity.wound_location}`) 
                        : ""} - {getTimeAgo(activity.created_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
