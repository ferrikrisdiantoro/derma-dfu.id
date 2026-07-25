import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, MessageCircle, Phone, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Doctor {
  id: string;
  full_name: string;
  specialization: string;
  experience_years: number;
  price: number;
  rating: number;
  is_online: boolean;
  photo_url?: string;
}

interface DoctorListProps {
  onSelect: (doctorId: string) => void;
  onCancel: () => void;
  t: (id: string, en: string) => string;
}

export function DoctorList({ onSelect, onCancel, t }: DoctorListProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      // Fetch doctors from 'doctors' table joined with 'profiles'
      // Note: Supabase JS join syntax might be 'doctors ( ..., profiles ( ... ) )'
      // But for simplicity, let's assume we fetch doctors and their profiles.
      // Or if the view/table structure allows, we query directly.
      // Since we just created the table 'doctors', let's query it.

      const { data, error } = await (supabase as any)
        .from('doctors')
        .select(`
          *,
          profiles:id (full_name)
        `);

      if (error) throw error;

      if (data) {
        setDoctors(data.map((d: any) => ({
          ...d,
          full_name: d.profiles?.full_name || "Doctor",
        })));
      }
    } catch (error: any) {
      console.error("Error fetching doctors:", error);

      // Mock Fallback
      if (error.code === 'PGRST205' || error.message?.includes('could not find the table')) {
        setDoctors([
          {
            id: 'mock-1',
            full_name: 'Dr. dr. Reza Y Purwoko, Sp.DVE., FINSDV., FAADV',
            specialization: 'Sp.DVE',
            experience_years: 15,
            price: 75000,
            rating: 5.0,
            is_online: true,
            photo_url: undefined
          },
          {
            id: 'mock-2',
            full_name: 'dr. Andrew Suprayogi, Sp.PD., M.M., FINASIM',
            specialization: 'Sp.PD',
            experience_years: 10,
            price: 50000,
            rating: 4.8,
            is_online: true,
            photo_url: undefined
          }
        ]);
        toast.warning(t("Menggunakan data demo", "Using demo data"));
      } else {
        toast.error(t("Gagal memuat daftar dokter", "Failed to load doctor list"));
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center">{t("Memuat...", "Loading...")}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg">{t("Pilih Dokter", "Select Doctor")}</h3>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t("Kembali", "Back")}
        </Button>
      </div>

      <div className="grid gap-3 max-h-[60vh] overflow-y-auto pr-1">
        {doctors.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground w-full col-span-1">
            {t("Belum ada dokter tersedia", "No doctors available yet")}
          </div>
        ) : (
          doctors.map((doctor) => (
            <Card key={doctor.id} className="cursor-pointer hover:border-cta transition-colors" onClick={() => onSelect(doctor.id)}>
              <CardContent className="p-4 flex items-center gap-4">
                <Avatar className="h-12 w-12 border">
                  <AvatarImage src={doctor.photo_url} />
                  <AvatarFallback>{doctor.full_name.substring(0, 2)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold truncate">{doctor.full_name}</h4>
                    <div className="flex items-center text-xs font-medium text-amber-500">
                      <Star className="h-3 w-3 mr-1 fill-amber-500" />
                      {doctor.rating > 0 ? doctor.rating : "New"}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{doctor.specialization}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{doctor.experience_years} {t("tahun", "years")} exp</span>
                    {doctor.is_online && (
                      <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 px-1 py-0 h-5">
                        {t("Online", "Online")}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-cta">
                    <MessageCircle className="h-5 w-5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
