import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Loader2, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useRegistrations, Registration, useRegistrationStats } from "@/hooks/useRegistrations";
import RegistrationDetailDialog from "@/components/dashboard/RegistrationDetailDialog";
import AttendeesFilters from "@/components/dashboard/AttendeesFilters";
import ExportMenu from "@/components/dashboard/ExportMenu";
import {
  AttendeesFilterState, EMPTY_FILTERS, applyFilters, computeOptions,
  describeFilters, getCompany, getDays, getSegment, getSource,
} from "@/lib/attendeesFilters";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const statusStyle: Record<string, string> = {
  registered: "bg-primary/10 text-primary border-0",
  checked_in: "bg-success/10 text-success border-0",
  cancelled: "bg-destructive/10 text-destructive border-0",
};

const statusLabels: Record<string, string> = {
  registered: "Inscrito",
  checked_in: "Check-in",
  cancelled: "Cancelado",
};

type SortColumn = "name" | "email" | "event" | "status" | "date" | "source";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 15;

const Attendees = () => {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [hideCancelled, setHideCancelled] = useState(true);
  const [filters, setFilters] = useState<AttendeesFilterState>(EMPTY_FILTERS);
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const { data: registrations, isLoading } = useRegistrations();
  const { data: stats } = useRegistrationStats();

  const eventOptions = useMemo(() => {
    const map = new Map<string, string>();
    registrations?.forEach(r => {
      if (r.events?.name && r.event_id) map.set(r.event_id, r.events.name);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [registrations]);

  // Opções calculadas a partir do escopo "evento selecionado", para evitar
  // mostrar segmentos/dias que não pertencem ao recorte atual.
  const scopedRegistrations = useMemo(() => {
    if (eventFilter === "all") return registrations || [];
    return (registrations || []).filter((r) => r.event_id === eventFilter);
  }, [registrations, eventFilter]);

  const filterOptions = useMemo(() => computeOptions(scopedRegistrations), [scopedRegistrations]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortColumn(col); setSortDir("asc"); }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const getValue = (r: any, col: SortColumn): string => {
    const data = r.data as Record<string, string>;
    switch (col) {
      case "name": return (r.lead_name || data["Nome Completo"] || data["Full Name"] || data["Name"] || "").toLowerCase();
      case "email": return (r.lead_email || data["Endereço de E-mail"] || data["Email Address"] || data["Email"] || "").toLowerCase();
      case "event": return ((r as any).events?.name || "").toLowerCase();
      case "status": return r.status;
      case "date": return r.created_at;
      case "source": return getSource(r).toLowerCase();
    }
  };

  const filtered = useMemo(() => {
    const items = applyFilters(registrations, filters, search, hideCancelled, {
      eventId: eventFilter === "all" ? null : eventFilter,
    });
    items.sort((a, b) => {
      const va = getValue(a, sortColumn);
      const vb = getValue(b, sortColumn);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return items;
  }, [registrations, filters, search, hideCancelled, eventFilter, sortColumn, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Métricas refletem o filtro atual (excluindo paginação)
  const metrics = useMemo(() => {
    const total = filtered.length;
    const checkedIn = filtered.filter((r: any) => r.checked_in_at || r.status === "checked_in").length;
    const cancelled = filtered.filter((r: any) => r.status === "cancelled").length;
    const sevenDaysAgo = subDays(new Date(), 7).getTime();
    const recent = filtered.filter((r: any) => new Date(r.created_at).getTime() >= sevenDaysAgo).length;
    const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
    return { total, checkedIn, cancelled, recent, checkedInPct: pct(checkedIn), cancelledPct: pct(cancelled) };
  }, [filtered]);

  const totalAll = stats?.registrations?.length ?? 0;

  const eventName = eventFilter === "all"
    ? null
    : (eventOptions.find(([id]) => id === eventFilter)?.[1] ?? null);

  const exportFilename = `participantes_${eventName ? eventName.toLowerCase().replace(/\s+/g, "-") : "todos"}_${format(new Date(), "yyyy-MM-dd")}`;
  const filtersDescription = describeFilters(filters, search, hideCancelled, eventName);

  const getRegData = (r: Registration) => r.data as Record<string, string>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Participantes</h1>
          <p className="text-muted-foreground">{"\n"}</p>
        </div>
        <ExportMenu
          items={filtered}
          filename={exportFilename}
          filtersDescription={filtersDescription}
          includeEvent
          size="default"
          label="Exportar"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-5">
          <p className="text-sm text-muted-foreground">{filtered.length === totalAll ? "Total de inscrições" : "Inscrições no filtro"}</p>
          <p className="text-2xl font-display font-bold mt-1">
            {metrics.total}
            {filtered.length !== totalAll && (
              <span className="text-sm font-normal text-muted-foreground ml-1">/ {totalAll}</span>
            )}
          </p>
        </div>
        <div className="bg-card rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Check-ins</p>
          <p className="text-2xl font-display font-bold mt-1">
            {metrics.checkedIn} <span className="text-sm font-normal text-muted-foreground">({metrics.checkedInPct}%)</span>
          </p>
        </div>
        <div className="bg-card rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Cancelamentos</p>
          <p className="text-2xl font-display font-bold mt-1">
            {metrics.cancelled} <span className="text-sm font-normal text-muted-foreground">({metrics.cancelledPct}%)</span>
          </p>
        </div>
        <div className="bg-card rounded-xl p-5">
          <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
          <p className="text-2xl font-display font-bold mt-1">{metrics.recent}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center flex-wrap">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Buscar participantes…" className="pl-10 rounded-full bg-card" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <Select value={eventFilter} onValueChange={v => { setEventFilter(v); setPage(0); }}>
          <SelectTrigger className="w-full sm:w-56 rounded-full bg-card">
            <SelectValue placeholder="Filtrar por evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            {eventOptions.map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AttendeesFilters
          value={filters}
          onChange={(v) => { setFilters(v); setPage(0); }}
          options={filterOptions}
        />
        <div className="flex items-center gap-2 sm:ml-auto px-2">
          <Switch id="hide-cancelled" checked={hideCancelled} onCheckedChange={(v) => { setHideCancelled(v); setPage(0); }} />
          <Label htmlFor="hide-cancelled" className="text-sm cursor-pointer">Ocultar canceladas</Label>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : paged.length > 0 ? (
        <>
          <div className="bg-card rounded-xl overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome <SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hidden sm:table-cell" onClick={() => handleSort("email")}>
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">E-mail <SortIcon col="email" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">WhatsApp</span>
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Empresa</span>
                  </TableHead>
                  <TableHead className="hidden xl:table-cell">
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Segmento</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort("event")}>
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evento <SortIcon col="event" /></span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dias</span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hidden lg:table-cell" onClick={() => handleSort("source")}>
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Origem <SortIcon col="source" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status <SortIcon col="status" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hidden lg:table-cell" onClick={() => handleSort("date")}>
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inscrição <SortIcon col="date" /></span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Check-in em</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r: any) => {
                  const data = getRegData(r);
                  const days = getDays(r);
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors border-0"
                      onClick={() => setSelectedRegistration(r)}
                    >
                      <TableCell className="font-medium">{r.lead_name || data["Nome Completo"] || data["Full Name"] || data["Name"] || "—"}</TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">{r.lead_email || data["Endereço de E-mail"] || data["Email Address"] || data["Email"] || "—"}</TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">{r.lead_whatsapp || data["WhatsApp"] || data["Telefone"] || "—"}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm">{getCompany(r) || "—"}</TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">{getSegment(r) || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.events?.name || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {days.length ? (
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {days.map((d) => {
                              const short = (d.match(/\d{2}\/\d{2}/) || [d])[0];
                              return (
                                <Badge key={d} variant="secondary" className="text-[10px] rounded-full px-2 py-0">
                                  {short}
                                </Badge>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant="outline" className="text-xs rounded-full capitalize">{getSource(r)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${statusStyle[r.status] || ""} text-xs`}>{statusLabels[r.status] || r.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell whitespace-nowrap">{format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell whitespace-nowrap">
                        {r.checked_in_at ? format(new Date(r.checked_in_at), "d MMM yyyy HH:mm", { locale: ptBR }) : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-20">
          <p className="text-muted-foreground">{search || eventFilter !== "all" ? "Nenhum participante encontrado." : "Nenhuma inscrição ainda."}</p>
        </div>
      )}

      <RegistrationDetailDialog
        registration={selectedRegistration}
        onClose={() => setSelectedRegistration(null)}
      />
    </div>
  );
};

export default Attendees;
