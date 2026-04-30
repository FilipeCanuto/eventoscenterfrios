import { useState, useMemo, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Download, Loader2, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, Trash2, CheckCircle, MailWarning } from "lucide-react";
import { fetchPendingConfirmations, runBackfillConfirmations } from "@/hooks/useRegistrationEmails";
import { useRegistrationsByEvent, useCancelRegistration, useCheckInRegistration } from "@/hooks/useRegistrations";
import RegistrationDetailDialog from "@/components/dashboard/RegistrationDetailDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
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

type SortColumn = "name" | "email" | "status" | "date" | "source";
type SortDir = "asc" | "desc";

function getSource(r: any): string {
  const t = (r.tracking || {}) as Record<string, string>;
  const data = (r.data || {}) as Record<string, string>;
  return (t.utm_source || data.__utm_source || "direto").toString();
}

const PAGE_SIZE = 15;

export default function EventAttendeesTable({ eventId }: { eventId: string }) {
  const [search, setSearch] = useState("");
  const [hideCancelled, setHideCancelled] = useState(true);
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const { data: registrations, isLoading } = useRegistrationsByEvent(eventId);
  const cancelMut = useCancelRegistration();
  const checkInMut = useCheckInRegistration();
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [confirmBackfill, setConfirmBackfill] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchPendingConfirmations(eventId)
      .then((res) => { if (!cancelled) setPendingCount(res.pending); })
      .catch(() => { if (!cancelled) setPendingCount(null); });
    return () => { cancelled = true; };
  }, [eventId, registrations?.length]);

  const handleBackfill = async () => {
    setBackfilling(true);
    setConfirmBackfill(false);
    try {
      const res = await runBackfillConfirmations(eventId);
      const parts: string[] = [];
      if (res.sent) parts.push(`${res.sent} enviados`);
      if (res.skipped_delivered) parts.push(`${res.skipped_delivered} já entregues no Resend`);
      if (res.skipped_suppressed) parts.push(`${res.skipped_suppressed} bloqueados`);
      if (res.failed) parts.push(`${res.failed} falharam`);
      toast.success(`Reenvio concluído: ${parts.join(", ") || "nada a fazer"}`);
      const refreshed = await fetchPendingConfirmations(eventId);
      setPendingCount(refreshed.pending);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reenviar");
    } finally {
      setBackfilling(false);
    }
  };

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
      case "name": return (r.lead_name || data["Full Name"] || data["Name"] || "").toLowerCase();
      case "email": return (r.lead_email || data["Email Address"] || data["Email"] || "").toLowerCase();
      case "status": return r.status;
      case "date": return r.created_at;
      case "source": return getSource(r).toLowerCase();
    }
  };

  const filtered = useMemo(() => {
    let items = registrations?.filter(r => {
      if (hideCancelled && r.status === "cancelled") return false;
      if (!search) return true;
      const data = r.data as Record<string, string>;
      return Object.values(data).some(v => typeof v === "string" && v.toLowerCase().includes(search.toLowerCase()));
    }) || [];

    items.sort((a, b) => {
      const va = getValue(a, sortColumn);
      const vb = getValue(b, sortColumn);
      const cmp = va < vb ? -1 : va > vb ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return items;
  }, [registrations, search, hideCancelled, sortColumn, sortDir]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleExportCSV = () => {
    if (!filtered?.length) return;
    const headers = ["Nome", "E-mail", "WhatsApp", "Status", "Origem", "Dias", "Inscrição", "Check-in em"];
    const rows = filtered.map((r: any) => {
      const data = r.data as Record<string, string>;
      return [
        r.lead_name || data["Full Name"] || data["Name"] || "",
        r.lead_email || data["Email Address"] || data["Email"] || "",
        r.lead_whatsapp || data["WhatsApp"] || data["Telefone"] || "",
        statusLabels[r.status] || r.status,
        getSource(r),
        data["Dias de Comparecimento"] || "",
        format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: ptBR }),
        r.checked_in_at ? format(new Date(r.checked_in_at), "d MMM yyyy HH:mm", { locale: ptBR }) : "",
      ];
    });
    const escapeCSV = (val: string): string => {
      const str = String(val ?? "");
      const safe = str.replace(/^([=+\-@])/, "'$1");
      if (safe.includes(',') || safe.includes('"') || safe.includes('\n')) return `"${safe.replace(/"/g, '""')}"`;
      return safe;
    };
    const csv = [headers, ...rows].map(r => r.map(escapeCSV).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "participantes.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCancel = async () => {
    if (!confirmCancelId) return;
    try {
      await cancelMut.mutateAsync(confirmCancelId);
      toast.success("Inscrição cancelada");
      setConfirmCancelId(null);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cancelar");
    }
  };

  const handleCheckIn = async (id: string) => {
    try {
      await checkInMut.mutateAsync(id);
      toast.success("Check-in realizado");
    } catch (e: any) {
      toast.error(e?.message || "Erro");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-lg font-display font-semibold">
          Participantes {filtered.length > 0 && <span className="text-muted-foreground font-normal text-sm">({filtered.length})</span>}
        </h3>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Buscar…" className="pl-9 h-8 text-sm rounded-full" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <div className="flex items-center gap-1.5">
            <Switch id="hide-cancelled-evt" checked={hideCancelled} onCheckedChange={(v) => { setHideCancelled(v); setPage(0); }} />
            <Label htmlFor="hide-cancelled-evt" className="text-xs cursor-pointer">Ocultar canceladas</Label>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs shrink-0 rounded-full" onClick={handleExportCSV}>
            <Download className="w-3.5 h-3.5 mr-1" /> Exportar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : paged.length > 0 ? (
        <>
          <div className="rounded-xl overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("name")}>
                    <span className="flex items-center">Nome <SortIcon col="name" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("email")}>
                    <span className="flex items-center">E-mail <SortIcon col="email" /></span>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">WhatsApp</TableHead>
                  <TableHead className="cursor-pointer select-none hidden md:table-cell" onClick={() => handleSort("source")}>
                    <span className="flex items-center">Origem <SortIcon col="source" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Dias</TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("status")}>
                    <span className="flex items-center">Status <SortIcon col="status" /></span>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none" onClick={() => handleSort("date")}>
                    <span className="flex items-center">Inscrição <SortIcon col="date" /></span>
                  </TableHead>
                  <TableHead className="hidden md:table-cell">Check-in em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((r: any) => {
                  const data = r.data as Record<string, string>;
                  const source = getSource(r);
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelected(r)}>
                      <TableCell className="font-medium">{r.lead_name || data["Full Name"] || data["Name"] || "—"}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{r.lead_email || data["Email Address"] || data["Email"] || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{r.lead_whatsapp || data["WhatsApp"] || data["Telefone"] || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs rounded-full capitalize">{source}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {data["Dias de Comparecimento"] ? (
                          <div className="flex flex-wrap gap-1 max-w-[160px]">
                            {data["Dias de Comparecimento"].split(", ").filter(Boolean).map((d) => {
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
                      <TableCell>
                        <Badge className={`${statusStyle[r.status] || ""} text-xs`}>{statusLabels[r.status] || r.status.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm whitespace-nowrap">{format(new Date(r.created_at), "d MMM HH:mm", { locale: ptBR })}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground whitespace-nowrap">
                        {r.checked_in_at ? format(new Date(r.checked_in_at), "d MMM HH:mm", { locale: ptBR }) : <span className="text-muted-foreground/50">—</span>}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          {r.status === "registered" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-success hover:text-success hover:bg-success/10"
                              title="Marcar check-in"
                              onClick={() => handleCheckIn(r.id)}
                              disabled={checkInMut.isPending}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                          )}
                          {r.status !== "cancelled" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Cancelar inscrição"
                              onClick={() => setConfirmCancelId(r.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
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
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
                <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-10 text-muted-foreground text-sm">
          {search ? "Nenhum participante encontrado." : "Nenhuma inscrição ainda."}
        </div>
      )}

      <RegistrationDetailDialog registration={selected} onClose={() => setSelected(null)} />

      <AlertDialog open={!!confirmCancelId} onOpenChange={(o) => !o && setConfirmCancelId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar inscrição?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação cancela a inscrição e libera a vaga. O histórico será mantido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
