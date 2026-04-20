import { useMemo, useState } from "react";
import { useEventPageViews, EventPageView } from "@/hooks/useEventPageViews";
import { Loader2, Download, Filter, Smartphone, Tablet, Monitor, Copy, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { toast } from "sonner";

type Props = { eventId: string };

function statusOf(v: EventPageView): { label: string; tone: "neutral" | "warm" | "hot" | "converted" } {
  if (v.converted_registration_id) return { label: "Convertido", tone: "converted" };
  if (v.form_abandoned_at) return { label: "Abandonou form", tone: "hot" };
  if (v.form_started_at) return { label: "Iniciou form", tone: "warm" };
  return { label: "Visitou", tone: "neutral" };
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function deviceIcon(device: string | null | undefined) {
  const d = (device || "").toLowerCase();
  if (d.includes("mobile")) return <Smartphone className="w-3.5 h-3.5" />;
  if (d.includes("tablet")) return <Tablet className="w-3.5 h-3.5" />;
  return <Monitor className="w-3.5 h-3.5" />;
}

function timeOnForm(v: EventPageView): string {
  if (!v.form_started_at) return "—";
  const end = v.form_abandoned_at || v.updated_at;
  if (!end) return "—";
  const diff = (new Date(end).getTime() - new Date(v.form_started_at).getTime()) / 1000;
  if (diff < 0 || isNaN(diff)) return "—";
  if (diff < 60) return `${Math.round(diff)}s`;
  if (diff < 3600) return `${Math.round(diff / 60)}min`;
  return `${(diff / 3600).toFixed(1)}h`;
}

function toCsv(rows: EventPageView[]): string {
  const headers = ["data", "status", "nome", "email", "whatsapp", "utm_source", "utm_medium", "utm_campaign", "referrer", "device", "tempo_no_form"];
  const escape = (v: string | null | undefined) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
  const lines = [headers.join(",")];
  for (const r of rows) {
    const s = statusOf(r);
    lines.push([
      escape(fmtDate(r.created_at)),
      escape(s.label),
      escape(r.partial_name),
      escape(r.partial_email),
      escape(r.partial_whatsapp),
      escape(r.utm_source),
      escape(r.utm_medium),
      escape(r.utm_campaign),
      escape(r.referrer),
      escape(r.device_type),
      escape(timeOnForm(r)),
    ].join(","));
  }
  return lines.join("\n");
}

const EventLeadsTable = ({ eventId }: Props) => {
  const { data, isLoading } = useEventPageViews(eventId);
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [onlyWithWhatsapp, setOnlyWithWhatsapp] = useState(false);
  const [onlyAbandoned, setOnlyAbandoned] = useState(false);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    let r = data || [];
    if (onlyWithEmail) r = r.filter((v) => !!v.partial_email);
    if (onlyWithWhatsapp) r = r.filter((v) => !!v.partial_whatsapp);
    if (onlyAbandoned) r = r.filter((v) => !!v.form_abandoned_at && !v.converted_registration_id);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((v) =>
        [v.partial_email, v.partial_name, v.partial_whatsapp, v.utm_source, v.utm_campaign]
          .some((f) => f?.toLowerCase().includes(q))
      );
    }
    return r;
  }, [data, onlyWithEmail, onlyWithWhatsapp, onlyAbandoned, search]);

  const stats = useMemo(() => {
    const all = data || [];
    const uniqueVisitors = new Set(all.map((v) => v.visitor_id)).size;
    const started = all.filter((v) => !!v.form_started_at).length;
    const abandoned = all.filter((v) => !!v.form_abandoned_at && !v.converted_registration_id).length;
    const converted = all.filter((v) => !!v.converted_registration_id).length;
    const hotLeads = all.filter((v) => !!v.partial_email && !v.converted_registration_id).length;
    const conversionRate = uniqueVisitors > 0 ? (converted / uniqueVisitors) * 100 : 0;
    return { total: all.length, uniqueVisitors, started, abandoned, converted, hotLeads, conversionRate };
  }, [data]);

  const handleExport = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = (r: EventPageView) => {
    const parts = [r.partial_name, r.partial_email, r.partial_whatsapp].filter(Boolean).join(" | ");
    if (!parts) {
      toast.error("Nada para copiar");
      return;
    }
    navigator.clipboard.writeText(parts);
    toast.success("Contato copiado");
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Visitantes únicos", value: stats.uniqueVisitors },
          { label: "Iniciaram form", value: stats.started },
          { label: "Abandonaram", value: stats.abandoned },
          { label: "Leads quentes", value: stats.hotLeads, hot: true },
          { label: "Conversão", value: `${stats.conversionRate.toFixed(1)}%` },
        ].map((m: any) => (
          <div key={m.label} className="bg-card rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              {m.hot && <Flame className="w-3 h-3 text-destructive" />}
              {m.label}
            </div>
            <div className="text-2xl font-display font-bold mt-1">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-card rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" /> Filtros:
        </div>
        <Button type="button" variant={onlyWithEmail ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setOnlyWithEmail((v) => !v)}>
          Só com e-mail
        </Button>
        <Button type="button" variant={onlyWithWhatsapp ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setOnlyWithWhatsapp((v) => !v)}>
          Só com WhatsApp
        </Button>
        <Button type="button" variant={onlyAbandoned ? "default" : "outline"} size="sm" className="rounded-full" onClick={() => setOnlyAbandoned((v) => !v)}>
          Só abandonos
        </Button>
        <Input
          placeholder="Buscar por nome, e-mail, UTM…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-full max-w-xs"
        />
        <div className="sm:ml-auto">
          <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-card rounded-xl overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum lead encontrado com os filtros atuais.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Quando</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Nome</th>
                  <th className="text-left px-4 py-3 font-medium">E-mail</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">WhatsApp</th>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Device</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Tempo</th>
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Origem</th>
                  <th className="text-right px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = statusOf(r);
                  const variant: any =
                    s.tone === "converted" ? "default" :
                    s.tone === "hot" ? "destructive" :
                    s.tone === "warm" ? "secondary" : "outline";
                  return (
                    <HoverCard key={r.id} openDelay={300}>
                      <HoverCardTrigger asChild>
                        <tr className="border-t border-border/60">
                          <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</td>
                          <td className="px-4 py-3"><Badge variant={variant} className="rounded-full">{s.label}</Badge></td>
                          <td className="px-4 py-3">{r.partial_name || <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3">{r.partial_email || <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3 hidden md:table-cell">{r.partial_whatsapp || <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground capitalize">
                              {deviceIcon(r.device_type)}
                              <span className="text-xs">{r.device_type || "desktop"}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">{timeOnForm(r)}</td>
                          <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                            {r.utm_source ? `${r.utm_source}${r.utm_campaign ? ` · ${r.utm_campaign}` : ""}` : (r.referrer ? (() => { try { return new URL(r.referrer!).hostname; } catch { return "Direto"; } })() : "Direto")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full"
                              title="Copiar contato"
                              onClick={() => handleCopy(r)}
                              disabled={!r.partial_email && !r.partial_whatsapp && !r.partial_name}
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                          </td>
                        </tr>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 text-xs space-y-1.5" align="start">
                        <div className="font-semibold text-sm mb-2">Detalhes da sessão</div>
                        {r.landing_url && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-muted-foreground">Landing</span>
                            <span className="break-all">{r.landing_url}</span>
                          </div>
                        )}
                        {r.referrer && (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-muted-foreground">Referrer</span>
                            <span className="break-all">{r.referrer}</span>
                          </div>
                        )}
                        {r.utm_term && (
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">utm_term</span><span>{r.utm_term}</span></div>
                        )}
                        {r.utm_content && (
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">utm_content</span><span>{r.utm_content}</span></div>
                        )}
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Primeira visita</span><span>{fmtDate(r.created_at)}</span></div>
                        <div className="flex justify-between gap-2"><span className="text-muted-foreground">Última atividade</span><span>{fmtDate(r.updated_at)}</span></div>
                        {r.form_started_at && (
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Form iniciado</span><span>{fmtDate(r.form_started_at)}</span></div>
                        )}
                        {r.form_abandoned_at && (
                          <div className="flex justify-between gap-2"><span className="text-muted-foreground">Form abandonado</span><span>{fmtDate(r.form_abandoned_at)}</span></div>
                        )}
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventLeadsTable;
