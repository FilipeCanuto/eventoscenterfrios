import { useMemo, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Ban, Clock, Send, Download, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  useEventEmailAudit,
  resendForRegistrations,
  EmailBucket,
  AuditRow,
} from "@/hooks/useEventEmailAudit";

interface Props {
  eventId: string;
  eventName: string;
}

const BUCKET_META: Record<EmailBucket, { label: string; cls: string; Icon: any }> = {
  delivered: { label: "Confirmado", cls: "bg-success/10 text-success", Icon: CheckCircle2 },
  failed:    { label: "Falhou",     cls: "bg-destructive/10 text-destructive", Icon: AlertTriangle },
  suppressed:{ label: "Suprimido",  cls: "bg-muted text-muted-foreground", Icon: Ban },
  never:     { label: "Nunca tentado", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-400", Icon: Clock },
};

const FILTERS: { key: EmailBucket | "pending" | "all"; label: string }[] = [
  { key: "pending", label: "Pendentes" },
  { key: "never", label: "Nunca tentado" },
  { key: "failed", label: "Falharam" },
  { key: "suppressed", label: "Suprimidos" },
  { key: "delivered", label: "Confirmados" },
  { key: "all", label: "Todos" },
];

export default function EventEmailAudit({ eventId, eventName }: Props) {
  const { data, isLoading, refetch, isFetching } = useEventEmailAudit(eventId);
  const qc = useQueryClient();
  const [filter, setFilter] = useState<typeof FILTERS[number]["key"]>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);

  const filtered = useMemo<AuditRow[]>(() => {
    if (!data) return [];
    if (filter === "all") return data.rows;
    if (filter === "pending") return data.rows.filter((r) => r.bucket === "never" || r.bucket === "failed");
    return data.rows.filter((r) => r.bucket === filter);
  }, [data, filter]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.registration_id));
  const reenviables = filtered.filter((r) => r.bucket !== "delivered" && r.bucket !== "suppressed");

  const toggle = (id: string) => {
    const n = new Set(selected);
    n.has(id) ? n.delete(id) : n.add(id);
    setSelected(n);
  };
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.registration_id)));
  };

  const handleResend = async (force: boolean = false) => {
    const ids = Array.from(selected).filter((id) => {
      const row = data?.rows.find((r) => r.registration_id === id);
      return row && row.bucket !== "delivered" && row.bucket !== "suppressed";
    });
    if (ids.length === 0) {
      toast.warning("Selecione ao menos um inscrito reenviável.");
      return;
    }
    setRunning(true);
    try {
      const res = await resendForRegistrations(ids, force);
      toast.success(
        `Reenvio concluído: ${res.sent} enviados, ${res.failed} falhas, ${res.skipped_delivered + res.skipped_suppressed + res.skipped_invalid} ignorados.`,
      );
      setSelected(new Set());
      await refetch();
      qc.invalidateQueries({ queryKey: ["registration-emails"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha ao reenviar.");
    } finally {
      setRunning(false);
    }
  };

  const handleResendAllPending = async () => {
    if (!data) return;
    const ids = data.rows
      .filter((r) => r.bucket === "never" || r.bucket === "failed")
      .map((r) => r.registration_id);
    if (ids.length === 0) {
      toast.info("Nenhum pendente para reenviar.");
      return;
    }
    if (!window.confirm(`Reenviar confirmação para ${ids.length} inscritos pendentes (forçando, ignora bloqueios de duplicidade)?`)) {
      return;
    }
    setRunning(true);
    try {
      const res = await resendForRegistrations(ids, true);
      toast.success(
        `Reenvio em massa: ${res.sent} enviados, ${res.failed} falhas, ${res.skipped_delivered + res.skipped_suppressed + res.skipped_invalid} ignorados.`,
      );
      await refetch();
      qc.invalidateQueries({ queryKey: ["registration-emails"] });
    } catch (e: any) {
      toast.error(e?.message || "Falha no reenvio em massa.");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = async (kind: "xlsx" | "csv") => {
    const headers = ["Nome", "E-mail", "WhatsApp", "Status", "Motivo", "Última tentativa", "Inscrito em"];
    const rows = filtered.map((r) => [
      r.lead_name || "",
      r.lead_email || "",
      r.lead_whatsapp || "",
      BUCKET_META[r.bucket].label,
      r.last_error || "",
      r.last_attempt_at ? format(new Date(r.last_attempt_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
      format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
    ]);
    const filename = `auditoria-emails_${eventName.toLowerCase().replace(/\s+/g, "-")}_${format(new Date(), "yyyy-MM-dd")}`;
    if (kind === "csv") {
      const escape = (v: any) => {
        const s = String(v ?? "").replace(/^([=+\-@])/, "'$1");
        return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      triggerDownload(blob, `${filename}.csv`);
    } else {
      const XLSX = await import("xlsx");
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      ws["!cols"] = headers.map((h, i) => ({
        wch: Math.min(40, Math.max(12, Math.max(h.length, ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length)) + 2)),
      }));
      XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      triggerDownload(blob, `${filename}.xlsx`);
    }
  };

  function triggerDownload(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) return null;

  const pct = data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-xl p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-display font-semibold">Auditoria de e-mails</h3>
            <p className="text-sm text-muted-foreground">
              Veja exatamente quem recebeu (ou não) o e-mail de confirmação e reenvie em massa.
            </p>
          </div>
          <Button
            variant="outline" size="sm" className="rounded-full h-9"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Inscritos" value={data.total} hint={`${pct}% confirmados`} />
          <Stat label="Confirmados" value={data.delivered} tone="success" />
          <Stat label="Nunca tentado" value={data.never} tone="warning" />
          <Stat label="Falharam" value={data.failed} tone="danger" />
          <Stat label="Suprimidos" value={data.suppressed} tone="muted" />
        </div>
      </div>

      <div className="bg-card rounded-xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.key;
              return (
                <Button
                  key={f.key} variant={active ? "default" : "outline"} size="sm"
                  className="rounded-full h-8 text-xs"
                  onClick={() => { setFilter(f.key); setSelected(new Set()); }}
                >
                  {f.label}
                </Button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline" size="sm" className="rounded-full h-8 text-xs"
              disabled={filtered.length === 0}
              onClick={() => handleExport("xlsx")}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> Excel
            </Button>
            <Button
              variant="outline" size="sm" className="rounded-full h-8 text-xs"
              disabled={filtered.length === 0}
              onClick={() => handleExport("csv")}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhum inscrito neste filtro.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                <span>Selecionar visíveis ({filtered.length})</span>
                {selected.size > 0 && <span>· {selected.size} marcados</span>}
              </div>
              <Button
                size="sm" className="rounded-full h-9"
                onClick={() => handleResend(false)}
                disabled={running || selected.size === 0}
              >
                {running ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                Reenviar selecionados
              </Button>
            </div>

            <div className="divide-y divide-border/40">
              {filtered.map((r) => {
                const meta = BUCKET_META[r.bucket];
                const Icon = meta.Icon;
                const checked = selected.has(r.registration_id);
                const reenviavel = r.bucket !== "delivered" && r.bucket !== "suppressed";
                return (
                  <div key={r.registration_id} className="py-3 flex items-center gap-3">
                    <Checkbox
                      checked={checked}
                      disabled={!reenviavel}
                      onCheckedChange={() => toggle(r.registration_id)}
                    />
                    <Icon className={`w-4 h-4 shrink-0 ${meta.cls.split(" ")[1]}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium truncate">{r.lead_name || "—"}</span>
                        <Badge className={`${meta.cls} text-[10px] rounded-full border-0`}>
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {r.lead_email || "(sem e-mail)"}
                        {r.last_error && <span className="ml-2 text-destructive/80">· {r.last_error}</span>}
                      </div>
                    </div>
                    <div className="text-[11px] text-muted-foreground whitespace-nowrap hidden sm:block">
                      {format(new Date(r.created_at), "d MMM", { locale: ptBR })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "success" | "warning" | "danger" | "muted" }) {
  const toneCls =
    tone === "success" ? "text-success"
    : tone === "warning" ? "text-amber-600 dark:text-amber-400"
    : tone === "danger" ? "text-destructive"
    : tone === "muted" ? "text-muted-foreground"
    : "";
  return (
    <div className="bg-muted/40 rounded-xl p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-display font-bold mt-1 ${toneCls}`}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
