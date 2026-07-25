import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Search, UserPlus, Check, X } from "lucide-react";

interface Profile {
    id: string;
    full_name: string | null;
    created_at: string;
}

interface Doctor extends Profile {
    specialization: string;
    experience_years: number;
    is_online: boolean;
}

export function AdminDoctors({ t }: { t: (id: string, en: string) => string }) {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [promoteOpen, setPromoteOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);

    // Promotion Form
    const [specialization, setSpecialization] = useState("");
    const [experience, setExperience] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Fetch Doctors
            const { data: doctorsData, error: docError } = await (supabase as any)
                .from('doctors')
                .select('*, profiles:id(full_name, created_at)');

            if (docError) throw docError;

            // Fetch All Users (Profiles) that are NOT doctors
            // This requires fetching all profiles and filtering, or a complex join.
            // Simpler: Fetch all profiles, then filter client side against doctors list.
            const { data: profilesData, error: profError } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            if (profError) throw profError;

            const doctorIds = new Set((doctorsData as any[])?.map(d => d.id));
            const nonDoctors = profilesData?.filter(p => !doctorIds.has(p.id)) || [];

            setDoctors((doctorsData as any[])?.map(d => ({
                ...d,
                full_name: d.profiles?.full_name,
                created_at: d.profiles?.created_at
            })) || []);

            setUsers(nonDoctors);

        } catch (error: any) {
            console.error("Error fetching data:", error);

            // Fallback to Mock Data if table is missing or DB error
            if (error.code === 'PGRST205' || error.message?.includes('could not find the table')) {
                toast.warning(t("Mode Offline/Demo", "Offline/Demo Mode"), {
                    description: t("Database belum update, menggunakan data dummy", "Database not updated, using dummy data")
                });

                setDoctors([
                    {
                        id: 'mock-doc-1',
                        full_name: 'Dr. dr. Reza Y Purwoko, Sp.DVE., FINSDV., FAADV',
                        created_at: new Date().toISOString(),
                        specialization: 'Sp.DVE',
                        experience_years: 15,
                        is_online: true
                    },
                    {
                        id: 'mock-doc-2',
                        full_name: 'dr. Andrew Suprayogi, Sp.PD., M.M., FINASIM',
                        created_at: new Date().toISOString(),
                        specialization: 'Sp.PD',
                        experience_years: 10,
                        is_online: true
                    }
                ] as any);

                setUsers([
                    { id: 'mock-user-1', full_name: 'Jane Doe', created_at: new Date().toISOString() },
                    { id: 'mock-user-2', full_name: 'John Smith', created_at: new Date().toISOString() }
                ]);
            } else {
                toast.error(t("Gagal memuat data", "Failed to load data"));
            }
        } finally {
            setLoading(false);
        }
    };

    const handlePromote = async () => {
        if (!selectedUser || !specialization || !experience) return;

        try {
            // 1. Add 'doctor' role to user_roles
            const { error: roleError } = await (supabase as any)
                .from('user_roles')
                .insert({ user_id: selectedUser.id, role: 'doctor' });

            if (roleError) {
                // Ignore duplicate error if any, but ideally we check first
                if (!roleError.message.includes('duplicate')) throw roleError;
            }

            // 2. Create entry in doctors table
            const { error: docError } = await (supabase as any)
                .from('doctors')
                .insert({
                    id: selectedUser.id,
                    specialization,
                    experience_years: parseInt(experience),
                    is_online: false
                });

            if (docError) throw docError;

            toast.success(t("Berhasil menjadikan dokter", "Successfully promoted to doctor"));
            setPromoteOpen(false);
            fetchData(); // Refresh lists

            // Reset form
            setSpecialization("");
            setExperience("");
            setSelectedUser(null);

        } catch (error: any) {
            console.error("Error promoting user:", error);
            toast.error(t("Gagal memproses", "Failed to process"));
        }
    };

    const handleRemoveDoctor = async (doctorId: string) => {
        if (!confirm(t("Yakin ingin menghapus akses dokter ini?", "Are you sure you want to remove this doctor access?"))) return;

        try {
            // Delete from doctors table (cascade should handle references if strictly set, but let's see)
            const { error } = await (supabase as any).from('doctors').delete().eq('id', doctorId);
            if (error) throw error;

            // Ideally remove role too
            await (supabase as any).from('user_roles').delete().eq('user_id', doctorId).eq('role', 'doctor');

            toast.success(t("Akses dokter dicabut", "Doctor access revoked"));
            fetchData();
        } catch (error: any) {
            console.error("Error removing doctor:", error);
            toast.error(t("Gagal menghapus", "Failed to remove"));
        }
    };

    return (
        <div className="space-y-8">
            {/* Doctors List */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">{t("Daftar Dokter", "Doctor List")}</h2>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("Nama", "Name")}</TableHead>
                                <TableHead>{t("Spesialisasi", "Specialization")}</TableHead>
                                <TableHead>{t("Pengalaman", "Experience")}</TableHead>
                                <TableHead>{t("Status", "Status")}</TableHead>
                                <TableHead className="text-right">{t("Aksi", "Action")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {doctors.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">{t("Belum ada dokter", "No doctors yet")}</TableCell>
                                </TableRow>
                            ) : (
                                doctors.map((doc) => (
                                    <TableRow key={doc.id}>
                                        <TableCell className="font-medium">{doc.full_name || "N/A"}</TableCell>
                                        <TableCell>{doc.specialization}</TableCell>
                                        <TableCell>{doc.experience_years} {t("tahun", "years")}</TableCell>
                                        <TableCell>
                                            <Badge variant={doc.is_online ? "default" : "secondary"}>
                                                {doc.is_online ? "Online" : "Offline"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => handleRemoveDoctor(doc.id)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Users List (Candidates) */}
            <div className="space-y-4">
                <h2 className="text-xl font-semibold">{t("Daftar Pengguna (Kandidat)", "User List (Candidates)")}</h2>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t("Nama / Email", "Name / Email")}</TableHead>
                                <TableHead>{t("Bergabung", "Joined")}</TableHead>
                                <TableHead className="text-right">{t("Aksi", "Action")}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {users.slice(0, 10).map((user) => (
                                <TableRow key={user.id}>
                                    <TableCell>{user.full_name || "Unnamed User"}</TableCell>
                                    <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                                    <TableCell className="text-right">
                                        <Button size="sm" variant="outline" onClick={() => { setSelectedUser(user); setPromoteOpen(true); }}>
                                            <UserPlus className="h-4 w-4 mr-2" />
                                            {t("Jadikan Dokter", "Promote to Doctor")}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {users.length === 0 && (
                                <TableRow><TableCell colSpan={3} className="text-center py-4">{t("Tidak ada user lain", "No other users")}</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                <p className="text-xs text-muted-foreground">* {t("Menampilkan 10 user terbaru", "Showing latest 10 users")}</p>
            </div>

            {/* Promotion Modal */}
            <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t("Promosikan User ke Dokter", "Promote User to Doctor")}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>{t("Nama User", "User Name")}</Label>
                            <Input value={selectedUser?.full_name || ""} disabled />
                        </div>
                        <div className="space-y-2">
                            <Label>{t("Spesialisasi", "Specialization")}</Label>
                            <Input
                                placeholder="Ex: Dermatologist, GP"
                                value={specialization}
                                onChange={(e) => setSpecialization(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>{t("Pengalaman (Tahun)", "Experience (Years)")}</Label>
                            <Input
                                type="number"
                                placeholder="Ex: 5"
                                value={experience}
                                onChange={(e) => setExperience(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPromoteOpen(false)}>{t("Batal", "Cancel")}</Button>
                        <Button onClick={handlePromote} disabled={!specialization || !experience}>{t("Simpan", "Save")}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
