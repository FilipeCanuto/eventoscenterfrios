import { useMemo, useState } from "react";
import { useEventPageViews, EventPageView } from "@/hooks/useEventPageViews";
import { Loader2, Download, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

type Props = { eventId: string };

function statusOf(v: EventPageView): { label: string; tone: "neutral" | "warm" | "hot" | "converted" } {
  if (v.converted_registration_id) return { label: "Convertido", tone: "converted" };
  if (v.form_abandoned_at) return { label: "Abandonou form", tone: "hot" };
  if (v.form_started_at) return { label: "Iniciou form", tone: "warm" };
  return { label: "Visitou", tone: "neutral" };
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function toCsv(rows: EventPageView[]): string {
  const headers = ["data", "status", "nome", "email", "whatsapp", "utm_source", "utm_medium", "utm_campaign", "referrer", "device"];
  const escape = (v: string | null | undefined) => {
    const s = (v ?? "").toString().replace(/"/g, '""');
    return `"${s}"`;
  };
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
    ].join(","));
  }
  return lines.join("\n");
}

const EventLeadsTable = ({ eventId }: Props) => {
  const { data, isLoading } = useEventPageViews(eventId);
  const [onlyWithEmail, setOnlyWithEmail] = useState(false);
  const [onlyAbandoned, setOnlyAbandoned] = useState(false);
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    let r = data || [];
    if (onlyWithEmail) r = r.filter((v) => !!v.partial_email);
    if (onlyAbandoned) r = r.filter((v) => !!v.form_abandoned_at && !v.converted_registration_id);
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((v) =>
        [v.partial_email, v.partial_name, v.partial_whatsapp, v.utm_source, v.utm_campaign]
          .some((f) => f?.toLowerCase().includes(q))
      );
    }
    return r;
  }, [data, onlyWithEmail, onlyAbandoned, search]);

  const stats = useMemo(() => {
    const all = data || [];
    const uniqueVisitors = new Set(all.map((v) => v.visitor_id)).size;
    const started = all.filter((v) => !!v.form_started_at).length;
    const abandoned = all.filter((v) => !!v.form_abandoned_at && !v.converted_registration_id).length;
    const converted = all.filter((v) => !!v.converted_registration_id).length;
    const conversionRate = uniqueVisitors > 0 ? (converted / uniqueVisitors) * 100 : 0;
    return { total: all.length, uniqueVisitors, started, abandoned, converted, conversionRate };
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

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Visitantes únicos", value: stats.uniqueVisitors },
          { label: "Iniciaram form", value: stats.started },
          { label: "Abandonaram", value: stats.abandoned },
          { label: "Conversão", value: `${stats.conversionRate.toFixed(1)}%` },
        ].map((m) => (
          <div key={m.label} className="bg-card rounded-xl p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">{m.label}</div>
            <div className="text-2xl font-display font-bold mt-1">{m.value}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="bg-card rounded-xl p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" /> Filtros:
        </div>
        <Button
          type="button"
          variant={onlyWithEmail ? "default" : "outline"}
          size="sm"
          className="rounded-full"
          onClick={() => setOnlyWithEmail((v) => !v)}
        >
          Só com e-mail
        </Button>
        <Button
          type="button"
          variant={onlyAbandoned ? "default" : "outline"}
          size="sm"
          className="rounded-full"
          onClick={() => setOnlyAbandoned((v) => !v)}
        >
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
                  <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Origem</th>
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
                    <tr key={r.id} className="border-t border-border/60">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.created_at)}</td>
                      <td className="px-4 py-3"><Badge variant={variant} className="rounded-full">{s.label}</Badge></td>
                      <td className="px-4 py-3">{r.partial_name || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3">{r.partial_email || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 hidden md:table-cell">{r.partial_whatsapp || <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                        {r.utm_source ? `${r.utm_source}${r.utm_campaign ? ` · ${r.utm_campaign}` : ""}` : (r.referrer ? new URL(r.referrer).hostname : "Direto")}
                      </td>
                    </tr>
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
