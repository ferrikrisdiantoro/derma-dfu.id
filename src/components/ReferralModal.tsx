import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DoctorList } from "@/components/DoctorList";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ReferralModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (facility: string, scheduledDate: string, consultationType: string) => void; // Kept for backward compatibility or non-tele types
  t: (id: string, en: string) => string;
}

type ModalStep = "details" | "doctor-selection";

export function ReferralModal({ open, onOpenChange, onSave, t }: ReferralModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<ModalStep>("details");

  const [facility, setFacility] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [consultationType, setConsultationType] = useState("");

  const isTele = consultationType === "teleconsultation";

  const handleSave = () => {
    if (isTele) {
      setStep("doctor-selection");
      return;
    }

    if (!facility || !scheduledDate || !consultationType) {
      return;
    }
    onSave(facility, scheduledDate, consultationType);
    resetForm();
  };

  const handleDoctorSelect = (doctorId: string) => {
    // For Teleconsultation, we basically create a referral with this doctor immediately
    // Since the onSave prop is generic, we might need to handle the DB saving here or pass the doctorId up.
    // The current onSave only accepts (facility, date, type).
    // Let's assume we use a "virtual" facility and date for now, OR we modify parent to handle this.
    // Ideally, we should handle the "Create Consultation" logic here or in the parent with the doctor ID.

    // Quick fix: Pass doctorId as facility (hacky) or we rely on the parent knowing what to do?
    // Better: Allow the parent to handle the doctor selection. But onSave signature is fixed in the interface.
    // Let's modify the onSave behavior or add a new handler? 
    // The user wants "direct to chat". 

    // Let's call a specific function to create the chat/referral if we can't change onSave easily without breaking Triage.tsx.
    // Actually, Triage.tsx defines saveReferral. We should probably update Triage.tsx to handle doctorId.
    // For now, let's treat "facility" as the Doctor ID if type is teleconsultation? 
    // No, that's messy.

    // We will update the logic in Triage.tsx later to accept an optional doctorId.
    // For now, let's assume we pass the doctor ID as part of the facility string with a prefix "DOCTOR:"? 
    // Or better, we just execute onSave with the specific details.

    onSave(`DOCTOR:${doctorId}`, new Date().toISOString(), "teleconsultation");
    resetForm();
    // Triage.tsx will need to parse this or we update Triage.tsx in the next step.
  };

  const resetForm = () => {
    setFacility("");
    setScheduledDate("");
    setConsultationType("");
    setStep("details");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); else onOpenChange(v); }}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "details" ? t("Jadwalkan Rujukan / Konsultasi", "Schedule Referral / Consultation") : t("Pilih Dokter", "Select Doctor")}
          </DialogTitle>
        </DialogHeader>

        {step === "details" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("Jenis Konsultasi", "Consultation Type")}</Label>
              <Select value={consultationType} onValueChange={setConsultationType}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder={t("Pilih jenis", "Select type")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teleconsultation">{t("Tele-konsultasi (Chat/Video)", "Tele-consultation (Chat/Video)")}</SelectItem>
                  <SelectItem value="video" disabled className="text-muted-foreground line-through">{t("Video call (Legacy)", "Video call (Legacy)")}</SelectItem>
                  <SelectItem value="inperson">{t("Datang ke Faskes (Rujukan)", "Visit Facility (Referral)")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!isTele && (
              <>
                <div className="space-y-2">
                  <Label>{t("Pilih Fasilitas", "Select Facility")}</Label>
                  <Select value={facility} onValueChange={setFacility}>
                    <SelectTrigger className="rounded-2xl">
                      <SelectValue placeholder={t("Pilih fasilitas", "Select facility")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rs1">{t("RS Umum Daerah - 5 km", "Regional General Hospital - 5 km")}</SelectItem>
                      <SelectItem value="rs2">{t("Klinik Diabetes Terpadu - 8 km", "Integrated Diabetes Clinic - 8 km")}</SelectItem>
                      <SelectItem value="rs3">{t("Puskesmas Kecamatan - 2 km", "District Health Center - 2 km")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("Tanggal & Waktu", "Date & Time")}</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="rounded-2xl"
                  />
                </div>
              </>
            )}

            {isTele && (
              <div className="p-3 bg-blue-50 text-blue-800 rounded-xl text-sm">
                {t("Anda akan diarahkan untuk memilih dokter dan memulai konsultasi.", "You will be directed to select a doctor and start consultation.")}
              </div>
            )}

            <Button
              onClick={handleSave}
              className="w-full rounded-2xl bg-primary text-primary-foreground"
              disabled={!consultationType || (!isTele && (!facility || !scheduledDate))}
            >
              {isTele ? t("Lanjut Pilih Dokter", "Proceed to Select Doctor") : t("Simpan Rujukan", "Save Referral")}
            </Button>
          </div>
        )}

        {step === "doctor-selection" && (
          <DoctorList
            onSelect={handleDoctorSelect}
            onCancel={() => setStep("details")}
            t={t}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
