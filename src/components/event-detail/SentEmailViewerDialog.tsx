import { useEffect, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import EmailPreviewFrame from "./EmailPreviewFrame";
import { useRegistrationEmails } from "@/hooks/useRegistrationEmails";
import { renderEmail } from "@/hooks/useEmailTemplates";

const TYPE_LABEL: Record<string, string> = {
  confirmation: "Confirmação de inscrição",
  registration_confirmation: "Confirmação de inscrição",
  reminder_1d: "Lembrete — 1 dia antes",
  reminder_2h: "Lembrete — 2 horas antes",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  registrationId: string | null;
  recipientEmail: string | null;
  recipientName?: string | null;
}

export default function SentEmailViewerDialog({
  open, onOpenChange, registrationId, recipientEmail, recipientName,
}: Props) {
  const { data, isLoading } = useRegistrationEmails(open ? registrationId : null, recipientEmail);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ html: string; subject: string; loading: boolean; error: string | null; snapshot: boolean }>(
    { html: "", subject: "", loading: false, error: null, snapshot: false },
  );

  const logs = data?.log || [];

  useEffect(() => {
    if (!open) { setSelectedId(null); return; }
    if (!selectedId && logs.length > 0) setSelectedId(logs[0].id);
  }, [open, logs, selectedId]);

  useEffect(() => {
    if (!open || !selectedId) return;
    let cancelled = false;
    setPreview((p) => ({ ...p, loading: true, error: null }));
    renderEmail({ logId: selectedId })
      .then((res) => {
        if (cancelled) return;
        setPreview({ html: res.html, subject: res.subject, loading: false, error: null, snapshot: !!res.snapshot });
      })
      .catch((e) => {
        if (cancelled) return;
        const msg = String(e?.message || "");
        setPreview({
          html: "", subject: "", loading: false, snapshot: false,
          error: msg.includes("no_snapshot")
            ? "Este envio é anterior ao registro de cópias e não pode ser reconstruído."
            : "Não foi possível carregar o conteúdo deste e-mail.",
        });
      });
    return () => { cancelled = true; };
  }, [open, selectedId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            E-mails enviados {recipientName ? `— ${recipientName}` : ""}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum envio registrado para este inscrito.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {logs.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedId(l.id)}
                  className={`text-left rounded-xl px-3 py-2 text-xs transition-colors ${
                    selectedId === l.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-medium">
                    <Mail className="w-3.5 h-3.5" />
                    {TYPE_LABEL[l.email_type] || l.email_type}
                  </div>
                  <div className={selectedId === l.id ? "opacity-80" : "text-muted-foreground"}>
                    {format(new Date(l.created_at), "d MMM 'às' HH:mm", { locale: ptBR })} · {l.status}
                  </div>
                </button>
              ))}
            </div>

            {preview.snapshot && (
              <Badge className="bg-success/10 text-success rounded-full border-0 text-[10px]">
                Cópia exata entregue ao participante
              </Badge>
            )}
            {!preview.snapshot && !preview.error && !preview.loading && (
              <Badge className="bg-muted text-muted-foreground rounded-full border-0 text-[10px]">
                Reconstruído com o template atual
              </Badge>
            )}

            <EmailPreviewFrame
              html={preview.html}
              subject={preview.subject}
              loading={preview.loading}
              error={preview.error}
              height={560}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
