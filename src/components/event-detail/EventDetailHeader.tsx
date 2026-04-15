import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, ExternalLink, Copy, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

interface Props {
  event: Tables<"events">;
  onStatusChange: (status: "draft" | "live" | "past") => void;
  onDelete: () => void;
}

const statusColors: Record<string, string> = {
  live: "bg-success text-success-foreground",
  draft: "bg-muted text-muted-foreground",
  past: "bg-secondary/20 text-secondary",
};

const statusLabels: Record<string, string> = {
  live: "Ativo",
  draft: "Rascunho",
  past: "Encerrado",
};

export default function EventDetailHeader({ event, onStatusChange }: Props) {
  const navigate = useNavigate();

  const handleCopyLink = () => {
    const url = `${window.location.origin}/register/${event.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Link de inscrição copiado!");
  };

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <Button variant="ghost" size="icon" className="shrink-0 mt-0.5" onClick={() => navigate("/dashboard/events")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-display font-bold truncate">{event.name}</h1>
            <Badge className={`${statusColors[event.status]} border-0 shrink-0`}>{statusLabels[event.status] || event.status}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {event.event_date ? new Date(event.event_date).toLocaleDateString("pt-BR") : "Sem data"} · {event.event_type || "Evento"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          <Select value={event.status} onValueChange={(v) => onStatusChange(v as any)}>
            <SelectTrigger className="w-28 h-8 text-xs rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="live">Ativo</SelectItem>
              <SelectItem value="past">Encerrado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-8 text-xs rounded-full" onClick={handleCopyLink}>
            <Copy className="w-3 h-3 mr-1" /> Copiar link
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs rounded-full" asChild>
            <a href={`/register/${event.slug}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3 mr-1" /> Visualizar
            </a>
          </Button>
        </div>

        <div className="sm:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange("draft")}>
                Definir como Rascunho
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("live")}>
                Definir como Ativo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("past")}>
                Definir como Encerrado
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyLink}>
                <Copy className="w-3.5 h-3.5 mr-2" /> Copiar Link
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/register/${event.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-2" /> Visualizar
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
