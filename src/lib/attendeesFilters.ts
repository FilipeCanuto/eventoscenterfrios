// Tipagem e utilitários compartilhados entre a página global de Participantes
// e a tabela embutida em cada evento.
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export interface AttendeesFilterState {
  dateFrom: string | null; // ISO date (yyyy-MM-dd)
  dateTo: string | null;
  status: string[]; // ["registered","checked_in","cancelled"]
  sources: string[];
  days: string[];
  segments: string[];
  company: string;
  checkInOnly: "any" | "with" | "without";
}

export const EMPTY_FILTERS: AttendeesFilterState = {
  dateFrom: null,
  dateTo: null,
  status: [],
  sources: [],
  days: [],
  segments: [],
  company: "",
  checkInOnly: "any",
};

export function activeFilterCount(f: AttendeesFilterState): number {
  let n = 0;
  if (f.dateFrom || f.dateTo) n++;
  if (f.status.length) n++;
  if (f.sources.length) n++;
  if (f.days.length) n++;
  if (f.segments.length) n++;
  if (f.company.trim()) n++;
  if (f.checkInOnly !== "any") n++;
  return n;
}

export function getSource(r: any): string {
  const t = (r?.tracking || {}) as Record<string, string>;
  const data = (r?.data || {}) as Record<string, string>;
  return (t.utm_source || data.__utm_source || "direto").toString();
}

export function getRegField(r: any, ...keys: string[]): string {
  const data = (r?.data || {}) as Record<string, string>;
  for (const k of keys) {
    if (data[k]) return data[k];
  }
  return "";
}

export function getDays(r: any): string[] {
  const raw = getRegField(r, "Dias de Comparecimento");
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function getSegment(r: any): string {
  return getRegField(r, "Segmento de atuação", "Segmento");
}

export function getCompany(r: any): string {
  return getRegField(r, "Empresa", "Empresa/Organização");
}

export interface FilterOptions {
  sources: string[];
  days: string[];
  segments: string[];
}

export function computeOptions(items: any[] | undefined): FilterOptions {
  const sources = new Set<string>();
  const days = new Set<string>();
  const segments = new Set<string>();
  (items || []).forEach((r) => {
    sources.add(getSource(r));
    getDays(r).forEach((d) => days.add(d));
    const seg = getSegment(r);
    if (seg) segments.add(seg);
  });
  return {
    sources: Array.from(sources).sort(),
    days: Array.from(days).sort(),
    segments: Array.from(segments).sort(),
  };
}

export function applyFilters(
  items: any[] | undefined,
  filters: AttendeesFilterState,
  search: string,
  hideCancelled: boolean,
  extra?: { eventId?: string | null }
): any[] {
  if (!items) return [];
  const s = search.trim().toLowerCase();
  const company = filters.company.trim().toLowerCase();
  const fromMs = filters.dateFrom ? new Date(filters.dateFrom + "T00:00:00").getTime() : null;
  const toMs = filters.dateTo ? new Date(filters.dateTo + "T23:59:59").getTime() : null;
  return items.filter((r: any) => {
    if (hideCancelled && r.status === "cancelled") return false;
    if (extra?.eventId && r.event_id !== extra.eventId) return false;
    if (filters.status.length && !filters.status.includes(r.status)) return false;
    if (filters.sources.length && !filters.sources.includes(getSource(r))) return false;
    if (filters.segments.length) {
      const seg = getSegment(r);
      if (!filters.segments.includes(seg)) return false;
    }
    if (filters.days.length) {
      const ds = getDays(r);
      const ok = filters.days.some((d) => ds.includes(d));
      if (!ok) return false;
    }
    if (company) {
      const c = getCompany(r).toLowerCase();
      if (!c.includes(company)) return false;
    }
    if (filters.checkInOnly === "with" && !r.checked_in_at) return false;
    if (filters.checkInOnly === "without" && r.checked_in_at) return false;
    if (fromMs || toMs) {
      const ms = new Date(r.created_at).getTime();
      if (fromMs && ms < fromMs) return false;
      if (toMs && ms > toMs) return false;
    }
    if (s) {
      const data = (r.data || {}) as Record<string, string>;
      const haystack = [
        r.lead_name, r.lead_email, r.lead_whatsapp,
        ...Object.values(data),
        (r.events?.name || ""),
      ].filter(Boolean).map((v: any) => String(v).toLowerCase()).join(" \u0001 ");
      if (!haystack.includes(s)) return false;
    }
    return true;
  });
}

export const STATUS_LABELS: Record<string, string> = {
  registered: "Inscrito",
  checked_in: "Check-in",
  cancelled: "Cancelado",
};

export interface ExportRowOptions {
  includeEvent?: boolean;
}

function buildExportRows(items: any[], opts: ExportRowOptions) {
  const headers = [
    "Nome", "E-mail", "WhatsApp", "Empresa", "Segmento",
    ...(opts.includeEvent ? ["Evento"] : []),
    "Origem", "Dias de comparecimento", "Status",
    "Data de inscrição", "Data de check-in",
  ];
  const rows = items.map((r: any) => {
    const data = (r.data || {}) as Record<string, string>;
    return [
      r.lead_name || data["Nome Completo"] || data["Full Name"] || data["Name"] || "",
      r.lead_email || data["Endereço de E-mail"] || data["Email Address"] || data["Email"] || "",
      r.lead_whatsapp || data["WhatsApp"] || data["Telefone"] || "",
      getCompany(r),
      getSegment(r),
      ...(opts.includeEvent ? [r.events?.name || ""] : []),
      getSource(r),
      getDays(r).join(", "),
      STATUS_LABELS[r.status] || r.status,
      r.created_at ? format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
      r.checked_in_at ? format(new Date(r.checked_in_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
    ];
  });
  return { headers, rows };
}

export function exportToCsv(items: any[], filename: string, opts: ExportRowOptions = {}) {
  const { headers, rows } = buildExportRows(items, opts);
  const escape = (v: any) => {
    const str = String(v ?? "");
    const safe = str.replace(/^([=+\-@])/, "'$1");
    if (safe.includes(",") || safe.includes('"') || safe.includes("\n")) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, filename.endsWith(".csv") ? filename : `${filename}.csv`);
}

export async function exportToXlsx(
  items: any[],
  filename: string,
  filtersDescription: string[],
  opts: ExportRowOptions = {}
) {
  const XLSX = await import("xlsx");
  const { headers, rows } = buildExportRows(items, opts);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  // Larguras automáticas (proxy simples)
  ws["!cols"] = headers.map((h, i) => {
    const maxLen = Math.max(
      h.length,
      ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length),
    );
    return { wch: Math.min(40, Math.max(10, maxLen + 2)) };
  });
  XLSX.utils.book_append_sheet(wb, ws, "Participantes");

  const meta = [
    ["Exportado em", format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })],
    ["Total de linhas", String(items.length)],
    [],
    ["Filtros aplicados"],
    ...(filtersDescription.length ? filtersDescription.map((f) => [f]) : [["(nenhum)"]]),
  ];
  const wsMeta = XLSX.utils.aoa_to_sheet(meta);
  wsMeta["!cols"] = [{ wch: 28 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, "Filtros aplicados");

  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  triggerDownload(blob, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function describeFilters(
  f: AttendeesFilterState,
  search: string,
  hideCancelled: boolean,
  eventName?: string | null
): string[] {
  const out: string[] = [];
  if (eventName) out.push(`Evento: ${eventName}`);
  if (search.trim()) out.push(`Busca: ${search.trim()}`);
  if (hideCancelled) out.push("Ocultar canceladas: sim");
  if (f.dateFrom || f.dateTo) {
    out.push(`Período de inscrição: ${f.dateFrom || "—"} a ${f.dateTo || "—"}`);
  }
  if (f.status.length) {
    out.push(`Status: ${f.status.map((s) => STATUS_LABELS[s] || s).join(", ")}`);
  }
  if (f.sources.length) out.push(`Origem: ${f.sources.join(", ")}`);
  if (f.days.length) out.push(`Dias: ${f.days.join(", ")}`);
  if (f.segments.length) out.push(`Segmento: ${f.segments.join(", ")}`);
  if (f.company.trim()) out.push(`Empresa contém: ${f.company.trim()}`);
  if (f.checkInOnly === "with") out.push("Apenas com check-in");
  if (f.checkInOnly === "without") out.push("Apenas sem check-in");
  return out;
}
