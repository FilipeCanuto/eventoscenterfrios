import { useEffect, useRef, useState } from "react";
import { Loader2, Download, FileText, Image as ImageIcon, FileCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchEmailPreview } from "@/hooks/useRegistrationEmails";
import { toast } from "sonner";

const TEMPLATES: { type: string; label: string; description: string }[] = [
  { type: "confirmation", label: "Confirmação de inscrição", description: "Enviado imediatamente após a inscrição." },
  { type: "reminder_1d", label: "Lembrete — 1 dia antes", description: "Contagem regressiva e QR Code." },
  { type: "reminder_2h", label: "Lembrete — 2 horas antes", description: "QR Code grande para check-in." },
];

interface Props {
  registrationId: string;
}

interface PreviewState {
  html: string;
  subject: string;
  loading: boolean;
  error: string | null;
}

export default function RegistrationTemplatesTab({ registrationId }: Props) {
  const [active, setActive] = useState<string>(TEMPLATES[0].type);
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({});
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const current = previews[active];

  useEffect(() => {
    if (previews[active]) return;
    let cancelled = false;
    setPreviews((p) => ({ ...p, [active]: { html: "", subject: "", loading: true, error: null } }));
    fetchEmailPreview(registrationId, active)
      .then((res) => {
        if (cancelled) return;
        setPreviews((p) => ({
          ...p,
          [active]: { html: res.html, subject: res.subject, loading: false, error: null },
        }));
      })
      .catch((e) => {
        if (cancelled) return;
        setPreviews((p) => ({
          ...p,
          [active]: { html: "", subject: "", loading: false, error: e?.message || "Erro ao carregar prévia" },
        }));
      });
    return () => { cancelled = true; };
  }, [active, registrationId]);

  // Inject HTML into iframe srcDoc when it changes
  const srcDoc = current?.html || "";

  const downloadHtml = () => {
    if (!current?.html) return;
    const blob = new Blob([current.html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${active}.html`; a.click();
    URL.revokeObjectURL(url);
  };

  async function captureCanvas(): Promise<HTMLCanvasElement> {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) throw new Error("Prévia ainda não carregou");
    const html2canvas = (await import("html2canvas")).default;
    return html2canvas(iframe.contentDocument.body, {
      scale: 3,
      backgroundColor: "#f6f6f7",
      useCORS: true,
      windowWidth: 700,
      logging: false,
    });
  }

  const downloadPng = async () => {
    try {
      setDownloading("png");
      const canvas = await captureCanvas();
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `${active}.png`; a.click();
        URL.revokeObjectURL(url);
      }, "image/png", 1);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar PNG");
    } finally {
      setDownloading(null);
    }
  };

  const downloadPdf = async () => {
    try {
      setDownloading("pdf");
      const canvas = await captureCanvas();
      const { jsPDF } = await import("jspdf");
      const imgData = canvas.toDataURL("image/png", 1);
      const pdf = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = canvas.width / canvas.height;
      let imgWidth = pageWidth - 40;
      let imgHeight = imgWidth / ratio;
      if (imgHeight > pageHeight - 40) {
        imgHeight = pageHeight - 40;
        imgWidth = imgHeight * ratio;
      }
      const x = (pageWidth - imgWidth) / 2;
      pdf.addImage(imgData, "PNG", x, 20, imgWidth, imgHeight, undefined, "FAST");
      pdf.save(`${active}.pdf`);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível gerar PDF");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {TEMPLATES.map((t) => (
          <button
            key={t.type}
            onClick={() => setActive(t.type)}
            className={`text-xs rounded-full px-3 py-1.5 transition-colors ${
              active === t.type
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="text-xs text-muted-foreground">
        {TEMPLATES.find((t) => t.type === active)?.description}
        {current?.subject && (
          <div className="mt-1">
            <span className="font-medium text-foreground">Assunto:</span> {current.subject}
          </div>
        )}
      </div>

      <div className="rounded-xl overflow-hidden bg-muted/40 border border-border/40">
        {current?.loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : current?.error ? (
          <div className="text-sm text-destructive p-6 text-center">{current.error}</div>
        ) : (
          <iframe
            ref={iframeRef}
            title={`Prévia ${active}`}
            srcDoc={srcDoc}
            sandbox="allow-same-origin"
            className="w-full bg-[#f6f6f7]"
            style={{ height: 560, border: 0 }}
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm" variant="outline" className="rounded-full text-xs h-9"
          onClick={downloadPng} disabled={!current?.html || downloading !== null}
        >
          {downloading === "png" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 mr-1" />}
          PNG (alta resolução)
        </Button>
        <Button
          size="sm" variant="outline" className="rounded-full text-xs h-9"
          onClick={downloadPdf} disabled={!current?.html || downloading !== null}
        >
          {downloading === "pdf" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 mr-1" />}
          PDF
        </Button>
        <Button
          size="sm" variant="outline" className="rounded-full text-xs h-9"
          onClick={downloadHtml} disabled={!current?.html}
        >
          <FileCode className="w-3.5 h-3.5 mr-1" />
          HTML
        </Button>
      </div>
    </div>
  );
}
