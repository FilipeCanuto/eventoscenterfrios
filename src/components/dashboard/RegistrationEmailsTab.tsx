import { useMemo } from "react";
import { Loader2, AlertTriangle, Send, Clock, Check, X, Ban } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRegistrationEmails, EmailLogRow, ScheduledEmailRow } from "@/hooks/useRegistrationEmails";
import { useResendConfirmation } from "@/hooks/useRegistrations";
import { toast } from "sonner";

const TYPE_LABEL: Record<string, string> = {
  confirmation: "Confirmação de inscrição",
  registration_confirmation: "Confirmação de inscrição",
  reminder_7d: "Lembrete — 7 dias antes (descontinuado)",
  reminder_1d: "Lembrete — 1 dia antes",
  reminder_2h: "Lembrete — 2 horas antes",
};

const STATUS_STYLE: Record<string, string> = {
  sent: "bg-success/10 text-success",
  delivered: "bg-success/10 text-success",
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  failed: "bg-destructive/10 text-destructive",
  suppressed: "bg-muted text-muted-foreground",
  skipped: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregue",
  pending: "Programado",
  failed: "Falhou",
  suppressed: "Bloqueado",
  skipped: "Pulado",
  cancelled: "Cancelado",
};

interface UnifiedRow {
  key: string;
  type: string;
  status: string;
  when: Date;
  whenLabel: string;
  meta?: string | null;
  error?: string | null;
  source: "log" | "scheduled";
}

function unify(log: EmailLogRow[], scheduled: ScheduledEmailRow[]): UnifiedRow[] {
  const rows: UnifiedRow[] = [];
  for (const l of log) {
    rows.push({
      key: `log-${l.id}`,
      type: l.email_type,
      status: l.status,
      when: new Date(l.created_at),
      whenLabel: format(new Date(l.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR }),
      meta: l.recipient_email,
      error: l.error_message,
      source: "log",
    });
  }
  for (const s of scheduled) {
    // Não duplica linhas de lembretes já enviados (já aparecem no log)
    if (s.status === "sent" && log.some((l) => l.email_type === s.email_type && l.status === "sent")) continue;
    rows.push({
      key: `sch-${s.id}`,
      type: s.email_type,
      status: s.status,
      when: new Date(s.send_at),
      whenLabel: format(new Date(s.send_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR }),
      meta: s.attempts > 0 ? `Tentativas: ${s.attempts}` : null,
      error: s.error,
      source: "scheduled",
    });
  }
  return rows.sort((a, b) => b.when.getTime() - a.when.getTime());
}

interface Props {
  registrationId: string;
  recipientEmail: string;
  status: string;
}

export default function RegistrationEmailsTab({ registrationId, recipientEmail, status }: Props) {
  const { data, isLoading, refetch } = useRegistrationEmails(registrationId, recipientEmail);
  const resendMut = useResendConfirmation();

  const rows = useMemo(() => unify(data?.log || [], data?.scheduled || []), [data]);

  const confirmationLogs = (data?.log || []).filter(
    (l) => l.email_type === "confirmation" || l.email_type === "registration_confirmation",
  );
  const lastConfirmation = confirmationLogs[0]; // já vem ordenado por created_at desc
  const hasConfirmationSent = confirmationLogs.some((l) => l.status === "sent" || l.status === "delivered");
  const lastFailed = !hasConfirmationSent && lastConfirmation && lastConfirmation.status === "failed"
    ? lastConfirmation : null;
  const isSuppressed = !!data?.suppressed;
  const neverTried = !hasConfirmationSent && !lastFailed && !isSuppressed && confirmationLogs.length === 0;

  const handleResend = async () => {
    try {
      const res: any = await resendMut.mutateAsync(registrationId);
      if (res?.error) throw new Error(res.error);
      if (res?.suppressed) {
        toast.warning("E-mail bloqueado por supressão prévia.");
      } else if (res?.skipped) {
        toast.warning("Em cooldown. Tente novamente em alguns minutos.");
      } else {
        toast.success("E-mail de confirmação reenviado.");
      }
      refetch();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível reenviar agora.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data?.suppressed && (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 text-destructive px-3 py-2.5 text-xs">
          <Ban className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <strong>E-mail na lista de bloqueio.</strong> Motivo: {data.suppressed.reason}.
            <br />Novos envios automáticos serão pulados para proteger sua reputação de remetente.
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          {rows.length === 0 ? "Nenhum e-mail registrado ainda." : `${rows.length} eventos de e-mail`}
        </div>
        {recipientEmail && status !== "cancelled" && (
          <Button
            size="sm" variant="outline"
            className="h-8 rounded-full text-xs"
            onClick={handleResend}
            disabled={resendMut.isPending}
          >
            {resendMut.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
            {hasConfirmationSent ? "Reenviar confirmação" : "Enviar confirmação"}
          </Button>
        )}
      </div>

      {hasConfirmationSent && lastConfirmation && (
        <div className="flex items-start gap-2 rounded-xl bg-success/10 text-success px-3 py-2 text-xs">
          <Check className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Confirmação registrada como enviada em{" "}
            {format(new Date(lastConfirmation.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}.
          </span>
        </div>
      )}

      {neverTried && rows.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-2 text-xs">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>Nenhuma tentativa de envio registrada.</strong> Esta inscrição é provavelmente
            anterior à reativação do envio. Use “Enviar confirmação” para disparar agora.
          </span>
        </div>
      )}

      {lastFailed && (
        <div className="flex items-start gap-2 rounded-xl bg-destructive/10 text-destructive px-3 py-2 text-xs">
          <X className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            <strong>A última tentativa falhou.</strong>{" "}
            {lastFailed.error_message ? `Motivo: ${lastFailed.error_message}. ` : ""}
            Verifique se o e-mail está correto antes de reenviar.
          </span>
        </div>
      )}

      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="rounded-xl bg-muted/40 p-3 space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 min-w-0">
                {r.source === "scheduled" && r.status === "pending" ? (
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                ) : r.status === "sent" || r.status === "delivered" ? (
                  <Check className="w-4 h-4 text-success shrink-0" />
                ) : r.status === "failed" ? (
                  <X className="w-4 h-4 text-destructive shrink-0" />
                ) : (
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
                <span className="text-sm font-medium truncate">{TYPE_LABEL[r.type] || r.type}</span>
              </div>
              <Badge className={`${STATUS_STYLE[r.status] || "bg-muted text-muted-foreground"} text-[10px] rounded-full border-0`}>
                {STATUS_LABEL[r.status] || r.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
              <span>
                {r.source === "scheduled" && r.status === "pending" ? "Programado para " : "Em "}
                {r.whenLabel}
              </span>
              {r.meta && <span className="truncate">{r.meta}</span>}
            </div>
            {r.error && (
              <div className="text-[11px] text-destructive/90 bg-destructive/5 rounded-lg px-2 py-1 mt-1 break-words">
                {r.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
