import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertTriangle, Camera, Heart, ExternalLink } from "lucide-react";

export default function Education() {
  const { t } = useLanguage();

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      <h2 className="text-2xl font-bold">
        {t("Panduan & Edukasi", "Guides & Education")}
      </h2>

      {/* Photo Guide */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-cta" />
            {t("Cara Mengambil Foto yang Baik", "How to Take a Good Photo")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal list-inside space-y-2 text-sm">
            <li>{t("Cuci tangan dan kaki dengan bersih", "Clean hands and feet thoroughly")}</li>
            <li>{t("Ambil foto dari atas, jarak 30-40 cm", "Take photo from above, 30-40 cm distance")}</li>
            <li>{t("Pastikan pencahayaan cukup terang", "Ensure adequate lighting")}</li>
            <li>
              {t(
                "Letakkan penggaris atau kartu pengukur di samping luka",
                "Place a ruler or scale card next to the wound"
              )}
            </li>
            <li>{t("Foto harus fokus dan tidak buram", "Photo should be in focus, not blurry")}</li>
            <li>
              {t(
                "Ambil beberapa sudut jika perlu (atas, samping)",
                "Take multiple angles if needed (top, side)"
              )}
            </li>
          </ol>
        </CardContent>
      </Card>

      {/* Danger Signs */}
      <Card className="rounded-2xl shadow-md border-2 border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            {t("Tanda Bahaya - Segera Rujuk!", "Danger Signs - Refer Immediately!")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
              <span>{t("Demam tinggi (>38°C)", "High fever (>38°C)")}</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
              <span>{t("Bau tidak enak atau ada nanah banyak", "Bad smell or excessive pus")}</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
              <span>{t("Kemerahan menyebar ke kaki atau betis", "Redness spreading to leg or calf")}</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
              <span>{t("Nyeri hebat saat istirahat", "Severe pain at rest")}</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
              <span>{t("Denyut nadi kaki tidak teraba", "Foot pulse not palpable")}</span>
            </li>
            <li className="flex items-start gap-2">
              <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
              <span>{t("Kulit hitam atau sangat dingin", "Black or very cold skin")}</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Decision Tree */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle>
            {t("Pohon Keputusan Triage", "Triage Decision Tree")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="bg-triage-red/20 border-2 border-triage-red rounded-xl p-4">
              <div className="font-bold text-triage-red mb-2">🔴 MERAH - RUJUK ≤48 JAM</div>
              <ul className="text-sm space-y-1 ml-4">
                <li>• {t("Demam ATAU Bau/nanah ATAU", "Fever OR Smell/pus OR")}</li>
                <li>• {t("Kemerahan menyebar ATAU Tidak ada nadi ATAU", "Spreading redness OR No pulse OR")}</li>
                <li>• {t("Nyeri istirahat ATAU Kulit hitam/dingin ATAU", "Rest pain OR Black/cold skin OR")}</li>
                <li>• {t("Gangguan ginjal berat dengan infeksi", "Severe kidney disease with infection")}</li>
              </ul>
            </div>

            <div className="bg-triage-yellow/20 border-2 border-triage-yellow rounded-xl p-4">
              <div className="font-bold text-triage-yellow mb-2">🟡 KUNING - TELE-KONSULTASI ≤72 JAM</div>
              <ul className="text-sm space-y-1 ml-4">
                <li>• {t("Luka dangkal ≤2 cm", "Shallow wound ≤2 cm")}</li>
                <li>• {t("Tidak demam, nadi ada", "No fever, pulse present")}</li>
                <li>• {t("Tidak ada bau/nanah", "No smell/pus")}</li>
              </ul>
            </div>

            <div className="bg-triage-green/20 border-2 border-triage-green rounded-xl p-4">
              <div className="font-bold text-triage-green mb-2">🟢 HIJAU - EDUKASI HARIAN</div>
              <ul className="text-sm space-y-1 ml-4">
                <li>• {t("Pre-ulcer / kapalan", "Pre-ulcer / callus")}</li>
                <li>• {t("Tidak ada infeksi atau iskemia", "No infection or ischemia")}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* First Aid & Daily Care */}
      <Accordion type="single" collapsible className="space-y-4">
        <AccordionItem value="firstaid" className="border rounded-2xl px-4 bg-card shadow-md">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold">
              {t("Pertolongan Pertama", "First Aid")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm pt-4">
            <p>• {t("Cuci luka dengan air mengalir dan sabun lembut", "Wash wound with running water and mild soap")}</p>
            <p>• {t("Keringkan dengan kain bersih (jangan digosok)", "Dry with clean cloth (don't rub)")}</p>
            <p>• {t("Tutup dengan kasa steril", "Cover with sterile gauze")}</p>
            <p>• {t("Jangan menggunakan alkohol atau betadine langsung", "Don't use alcohol or betadine directly")}</p>
            <p>• {t("Segera hubungi tenaga kesehatan", "Contact healthcare provider immediately")}</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="dailycare" className="border rounded-2xl px-4 bg-card shadow-md">
          <AccordionTrigger className="hover:no-underline">
            <span className="font-semibold flex items-center gap-2">
              <Heart className="h-4 w-4 text-decoration-pink" />
              {t("Perawatan Harian", "Daily Care")}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm pt-4">
            <p>• {t("Periksa kaki setiap hari", "Check feet daily")}</p>
            <p>• {t("Jaga gula darah tetap terkontrol", "Keep blood sugar controlled")}</p>
            <p>• {t("Gunakan sepatu yang pas dan nyaman", "Wear well-fitting, comfortable shoes")}</p>
            <p>• {t("Jangan berjalan tanpa alas kaki", "Never walk barefoot")}</p>
            <p>• {t("Potong kuku dengan hati-hati", "Trim nails carefully")}</p>
            <p>• {t("Gunakan pelembab untuk kulit kering", "Use moisturizer for dry skin")}</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Trusted Resources */}
      <Card className="rounded-2xl shadow-md">
        <CardHeader>
          <CardTitle>
            {t("Sumber Terpercaya", "Trusted Resources")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li>
              <a
                href="https://iwgdfguidelines.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                IWGDF Guidelines
              </a>
            </li>
            <li>
              <a
                href="https://www.idsociety.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                IDSA Guidelines
              </a>
            </li>
            <li>
              <a
                href="https://dermnetnz.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                DermNet NZ
              </a>
            </li>
            <li>
              <a
                href="https://www.medetec.co.uk/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-cta hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Medetec
              </a>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
