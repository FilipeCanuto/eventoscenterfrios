import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { Trash2, CheckCircle, ExternalLink, Mail, MessageCircle, User as UserIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useCancelRegistration, useCheckInRegistration, Registration } from "@/hooks/useRegistrations";
import type { Tables } from "@/integrations/supabase/types";

type AnyReg = Registration | (Tables<"registrations"> & { events?: { name: string } | null });

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

function getName(r: AnyReg): string {
  const data = (r.data || {}) as Record<string, string>;
  return (r as any).lead_name || data["Nome Completo"] || data["Full Name"] || data["Nome"] || data["Name"] || "—";
}
function getEmail(r: AnyReg): string {
  const data = (r.data || {}) as Record<string, string>;
  return (r as any).lead_email || data["Endereço de E-mail"] || data["E-mail"] || data["Email Address"] || data["Email"] || "";
}
function getWhatsapp(r: AnyReg): string {
  const data = (r.data || {}) as Record<string, string>;
  return (r as any).lead_whatsapp || data["WhatsApp"] || data["Telefone"] || data["Phone"] || "";
}

function getTracking(r: AnyReg): Record<string, string> {
  const t = (r as any).tracking || {};
  const data = (r.data || {}) as Record<string, string>;
  const merged: Record<string, string> = {};
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "referrer", "device_type", "landing_page"].forEach((k) => {
    const v = t[k] || data[`__${k}`] || "";
    if (v) merged[k] = v as string;
  });
  return merged;
}

interface Props {
  registration: AnyReg | null;
  onClose: () => void;
}

export default function RegistrationDetailDialog({ registration, onClose }: Props) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancelMut = useCancelRegistration();
  const checkInMut = useCheckInRegistration();

  if (!registration) return null;

  const data = (registration.data || {}) as Record<string, string>;
  const name = getName(registration);
  const email = getEmail(registration);
  const whatsapp = getWhatsapp(registration);
  const tracking = getTracking(registration);
  const eventName = (registration as any).events?.name as string | undefined;

  const visibleData = Object.entries(data).filter(([k]) => !k.startsWith("__"));

  const handleCancel = async () => {
    try {
      await cancelMut.mutateAsync(registration.id);
      toast.success("Inscrição cancelada");
      setConfirmCancel(false);
      onClose();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao cancelar");
    }
  };

  const handleCheckIn = async () => {
    try {
      await checkInMut.mutateAsync(registration.id);
      toast.success("Check-in realizado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao marcar check-in");
    }
  };

  const waLink = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, "")}` : null;
  const mailLink = email ? `mailto:${email}` : null;

  return (
    <>
      <Dialog open={!!registration} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center justify-between gap-3">
              <span>Detalhes do participante</span>
              <Badge className={`${statusStyle[registration.status] || ""} text-xs`}>
                {statusLabels[registration.status] || registration.status}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Contato */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{name}</span>
                </div>
                {email && (
                  <a href={mailLink!} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <Mail className="w-4 h-4" />
                    <span>{email}</span>
                  </a>
                )}
                {whatsapp && (
                  <a href={waLink!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="w-4 h-4" />
                    <span>{whatsapp}</span>
                  </a>
                )}
              </div>
            </section>

            {/* Dados do form */}
            {visibleData.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados do formulário</h4>
                <div className="space-y-2.5 bg-muted/40 rounded-xl p-3">
                  {visibleData.map(([key, value]) => (
                    <div key={key} className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">{key}</span>
                      <span className="text-sm break-words">{typeof value === "string" ? value : JSON.stringify(value)}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Origem */}
            {Object.keys(tracking).length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Origem</h4>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  {Object.entries(tracking).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs text-muted-foreground">{k}</span>
                      <span className="text-sm truncate" title={v}>{v}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Linha do tempo */}
            <section className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Linha do tempo</h4>
              <div className="space-y-1.5 text-sm">
                {eventName && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Evento</span>
                    <span className="font-medium">{eventName}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Inscrito em</span>
                  <span>{format(new Date(registration.created_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {registration.status === "registered" && (
              <Button
                variant="outline"
                className="rounded-full"
                onClick={handleCheckIn}
                disabled={checkInMut.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Marcar check-in
              </Button>
            )}
            {registration.status !== "cancelled" && (
              <Button
                variant="destructive"
                className="rounded-full"
                onClick={() => setConfirmCancel(true)}
                disabled={cancelMut.isPending}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Cancelar inscrição
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar inscrição?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação cancela a inscrição de <strong>{name}</strong> e libera a vaga. O histórico será mantido.
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
    </>
  );
}
