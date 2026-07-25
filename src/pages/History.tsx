import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, MessageCircle } from "lucide-react";
import { LanguageProvider } from "@/contexts/LanguageContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface TriageRecord {
  id: string;
  created_at: string;
  triage_result: string;
  wound_location: string | null;
  diabetes_history: string | null;
  infection_class: number | null;
  wound_area_cm2: number | null;
  photo_url: string | null;
  referrals: Array<{
    id: string;
    facility: string | null;
    status: string | null;
    consultation_type: string | null;
  }>;
}

function HistoryContent() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<TriageRecord[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  useEffect(() => {
    checkAuthAndLoadHistory();
  }, []);

  const checkAuthAndLoadHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("triage_records")
        .select(`
          *,
          referrals(*)
        `)
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRecords(data || []);
    } catch (error: any) {
      console.error("Error loading history:", error);
      toast({
        title: "Error",
        description: "Gagal memuat riwayat triage",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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

  return (
    <div className="min-h-screen bg-background">
      {/* History Navbar */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b border-border shadow-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate("/")}
              className="text-2xl font-bold text-heading hover:opacity-80 transition-opacity"
            >
              DERMA-DFU.ID - Riwayat
            </button>
            <div className="flex items-center gap-4">
              <Button variant="outline" size="sm" onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali
              </Button>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Keluar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Riwayat Triage</h1>
          <p className="text-muted-foreground">Lihat semua hasil triage Anda</p>
        </div>

        {records.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="text-muted-foreground">Belum ada riwayat triage</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Data Triage Anda</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Hasil Triage</TableHead>
                    <TableHead>Lokasi Luka</TableHead>
                    <TableHead>Infeksi</TableHead>
                    <TableHead>Luas Luka</TableHead>
                    <TableHead>Status Rujukan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {records.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>
                        {new Date(record.created_at).toLocaleDateString()}
                      </TableCell>
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
                        {record.referrals?.[0] &&
                          (record.referrals[0].consultation_type === 'teleconsultation' || record.referrals[0].consultation_type === 'video') && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="ml-2 gap-1"
                              onClick={() => navigate(`/chat/${record.referrals[0].id}`)}
                            >
                              <MessageCircle className="h-3 w-3" />
                              Chat
                            </Button>
                          )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default function History() {
  return (
    <LanguageProvider>
      <HistoryContent />
    </LanguageProvider>
  );
}
