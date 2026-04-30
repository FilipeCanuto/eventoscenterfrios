import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv, exportToXlsx } from "@/lib/attendeesFilters";

interface Props {
  items: any[];
  filename: string;
  filtersDescription: string[];
  includeEvent?: boolean;
  size?: "sm" | "default";
  className?: string;
  label?: string;
}

export default function ExportMenu({
  items, filename, filtersDescription, includeEvent, size = "sm", className, label = "Exportar",
}: Props) {
  const [busy, setBusy] = useState(false);

  const handleXlsx = async () => {
    if (!items.length) {
      toast.error("Não há dados para exportar com os filtros atuais.");
      return;
    }
    setBusy(true);
    try {
      await exportToXlsx(items, filename, filtersDescription, { includeEvent });
      toast.success("Planilha gerada");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar planilha");
    } finally {
      setBusy(false);
    }
  };

  const handleCsv = () => {
    if (!items.length) {
      toast.error("Não há dados para exportar com os filtros atuais.");
      return;
    }
    exportToCsv(items, filename, { includeEvent });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={className || (size === "sm" ? "h-8 text-xs shrink-0 rounded-full bg-card" : "rounded-full bg-card")}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
          ) : (
            <Download className={size === "sm" ? "w-3.5 h-3.5 mr-1" : "w-4 h-4 mr-2"} />
          )}
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="rounded-2xl">
        <DropdownMenuItem onClick={handleXlsx} className="cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 mr-2" /> Planilha Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCsv} className="cursor-pointer">
          <FileText className="w-4 h-4 mr-2" /> CSV (.csv)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
