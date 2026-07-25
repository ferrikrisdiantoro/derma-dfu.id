import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigate } from "react-router-dom";
import { MessageCircle, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function DoctorDashboard() {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [consultations, setConsultations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchConsultations();
    }, []);

    const fetchConsultations = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/auth');
            return;
        }

        // Fetch referrals assigned to this doctor
        const { data, error } = await supabase
            .from('referrals')
            .select('*, triage:triage_id(*, profiles:user_id(full_name))')
            .eq('doctor_id', user.id)
            .order('created_at', { ascending: false });

        if (!error && data) {
            setConsultations(data);
        }
        setLoading(false);
    };

    if (loading) return <div className="p-8 text-center">{t("Memuat...", "Loading...")}</div>;

    return (
        <div className="container py-8 max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold">{t("Dashboard Dokter", "Doctor Dashboard")}</h1>
                <Button variant="outline" onClick={() => navigate('/')}>{t("Beranda", "Home")}</Button>
            </div>

            <div className="grid gap-4">
                {consultations.length === 0 ? (
                    <Card>
                        <CardContent className="p-8 text-center text-muted-foreground">
                            {t("Belum ada konsultasi aktif", "No active consultations")}
                        </CardContent>
                    </Card>
                ) : (
                    consultations.map((c) => {
                        const patientName = c.triage?.profiles?.full_name || "Patient";
                        return (
                            <Card key={c.id} className="cursor-pointer hover:border-cta transition-colors" onClick={() => navigate(`/chat/${c.id}`)}>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="flex items-center gap-2">
                                        <User className="h-5 w-5 text-muted-foreground" />
                                        <CardTitle className="text-base font-semibold">
                                            {patientName}
                                        </CardTitle>
                                    </div>
                                    <Badge variant={c.status === 'pending' ? 'secondary' : 'default'}>
                                        {c.status}
                                    </Badge>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-sm text-muted-foreground mb-4">
                                        {new Date(c.created_at).toLocaleDateString()} - {c.consultation_type}
                                    </div>
                                    <Button size="sm" className="w-full gap-2">
                                        <MessageCircle className="h-4 w-4" />
                                        {t("Buka Chat", "Open Chat")}
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
