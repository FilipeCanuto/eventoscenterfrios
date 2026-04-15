import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Download, Loader2, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useRegistrations, Registration } from "@/hooks/useRegistrations";
import { useRegistrationStats } from "@/hooks/useRegistrations";
import { format } from "date-fns";
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

type SortColumn = "name" | "email" | "event" | "status" | "date";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 15;

const Attendees = () => {
  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
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

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDir("asc");
    }
    setPage(0);
  };

  const SortIcon = ({ col }: { col: SortColumn }) => {
    if (sortColumn !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const getValue = (r: any, col: SortColumn): string => {
    const data = r.data as Record<string, string>;
    switch (col) {
      case "name": return (data["Full Name"] || data["Name"] || "").toLowerCase();
      case "email": return (data["Email Address"] || data["Email"] || "").toLowerCase();
      case "event": return ((r as any).events?.name || "").toLowerCase();
      case "status": return r.status;
      case "date": return r.created_at;
    }
  };

  const filtered = useMemo(() => {
    let items = registrations?.filter(r => {
      if (eventFilter !== "all" && r.event_id !== eventFilter) return false;
      if (!search) return true;
      const data = r.data as Record<string, string>;
      const searchLower = search.toLowerCase();
      return (
        Object.values(data).some(v => typeof v === "string" && v.toLowerCase().includes(searchLower)) ||
        (r.events?.name || "").toLowerCase().includes(searchLower)
      );
    }) || [];

    items.sort((a, b) => {
      const va = getValue(a, sortColumn);
      const vb = getValue(b, sortColumn);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [registrations, search, eventFilter, sortColumn, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExportCSV = () => {
    if (!filtered?.length) return;
    const headers = ["Nome", "E-mail", "Evento", "Status", "Data"];
    const rows = filtered.map(r => {
      const data = r.data as Record<string, string>;
      return [
        data["Full Name"] || data["Name"] || "",
        data["Email Address"] || data["Email"] || "",
        (r as any).events?.name || "",
        statusLabels[r.status] || r.status,
        format(new Date(r.created_at), "d MMM yyyy", { locale: ptBR }),
      ];
    });
    const escapeCSV = (val: string): string => {
      const str = String(val ?? "");
      const safe = str.replace(/^([=+\-@])/, "'$1");
      if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) {
        return `"${safe.replace(/"/g, '""')}"`;
      }
      return safe;
    };
    const csv = [headers, ...rows].map(r => r.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `participantes${eventFilter !== "all" ? "-filtrado" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRegData = (r: Registration) => r.data as Record<string, string>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Participantes</h1>
          <p className="text-muted-foreground">Gerencie e exporte os dados dos seus participantes.</p>
        </div>
        <Button variant="outline" size="sm" className="w-full sm:w-auto rounded-full bg-card" onClick={handleExportCSV}>
          <Download className="w-4 h-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total de inscrições", value: stats.total ?? 0 },
            { label: "Check-in realizado", value: stats.registrations?.filter(r => r.status === "checked_in").length ?? 0 },
            { label: "Eventos ativos", value: stats.activeEvents ?? 0 },
          ].map((s) => (
            <div key={s.label} className="bg-card rounded-xl p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-display font-bold mt-1">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
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
                  <TableHead className="cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort("event")}>
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Evento <SortIcon col="event" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status <SortIcon col="status" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hidden lg:table-cell" onClick={() => handleSort("date")}>
                    <span className="flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Data <SortIcon col="date" /></span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r) => {
                  const data = getRegData(r);
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors border-0"
                      onClick={() => setSelectedRegistration(r)}
                    >
                      <TableCell className="font-medium">{data["Full Name"] || data["Name"] || "—"}</TableCell>
                      <TableCell className="text-muted-foreground hidden sm:table-cell">{data["Email Address"] || data["Email"] || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">{r.events?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge className={`${statusStyle[r.status] || ""} text-xs`}>{statusLabels[r.status] || r.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden lg:table-cell">{format(new Date(r.created_at), "d MMM yyyy", { locale: ptBR })}</TableCell>
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

      <Dialog open={!!selectedRegistration} onOpenChange={(open) => !open && setSelectedRegistration(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Detalhes do participante</DialogTitle>
          </DialogHeader>
          {selectedRegistration && (() => {
            const data = getRegData(selectedRegistration);
            return (
              <div className="space-y-4">
                <div className="space-y-3">
                  {Object.entries(data).map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground font-medium">{key}</span>
                      <span className="text-sm">{typeof value === "string" ? value : JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
                <div className="border-t border-border pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Evento</span>
                    <span className="text-sm">{selectedRegistration.events?.name || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Status</span>
                    <Badge className={`${statusStyle[selectedRegistration.status] || ""} text-xs`}>
                      {statusLabels[selectedRegistration.status] || selectedRegistration.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground font-medium">Inscrito em</span>
                    <span className="text-sm">{format(new Date(selectedRegistration.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Attendees;
