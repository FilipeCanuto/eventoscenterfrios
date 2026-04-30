import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import RegistrationEmailsTab from "@/components/dashboard/RegistrationEmailsTab";
import RegistrationTemplatesTab from "@/components/dashboard/RegistrationTemplatesTab";
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
import {
  Trash2, CheckCircle, Mail, MessageCircle, User as UserIcon,
  Pencil, Send, Copy, RotateCcw, AlertTriangle, Check, X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  useCancelRegistration, useCheckInRegistration, useRevertCheckIn,
  useUpdateRegistration, useResendConfirmation, checkDuplicateEmailForEvent,
  Registration,
} from "@/hooks/useRegistrations";
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

const NAME_KEYS = ["Nome Completo", "Full Name", "Nome", "Name"];
const EMAIL_KEYS = ["Endereço de E-mail", "Endereço de Email", "E-mail", "Email Address", "Email"];
const WHATS_KEYS = ["WhatsApp", "Telefone", "Phone"];

function pickKey(data: Record<string, string>, keys: string[]): string | null {
  for (const k of keys) if (k in data) return k;
  return null;
}
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const onlyDigits = (s: string) => s.replace(/\D/g, "");

interface Props {
  registration: AnyReg | null;
  onClose: () => void;
}

export default function RegistrationDetailDialog({ registration, onClose }: Props) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [extraData, setExtraData] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const cancelMut = useCancelRegistration();
  const checkInMut = useCheckInRegistration();
  const revertMut = useRevertCheckIn();
  const updateMut = useUpdateRegistration();
  const resendMut = useResendConfirmation();

  const data = (registration?.data || {}) as Record<string, string>;
  const visibleData = Object.entries(data).filter(([k]) =>
    !k.startsWith("__") &&
    !NAME_KEYS.includes(k) &&
    !EMAIL_KEYS.includes(k) &&
    !WHATS_KEYS.includes(k)
  );

  // Reset state when registration changes / dialog opens
  useEffect(() => {
    if (!registration) return;
    setEditing(false);
    setDuplicateWarning(null);
    setName(getName(registration) === "—" ? "" : getName(registration));
    setEmail(getEmail(registration));
    setWhatsapp(getWhatsapp(registration));
    const ed: Record<string, string> = {};
    visibleData.forEach(([k, v]) => { ed[k] = String(v ?? ""); });
    setExtraData(ed);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registration?.id]);

  const tracking = registration ? getTracking(registration) : {};
  const eventName = (registration as any)?.events?.name as string | undefined;
  const confirmationSentAt = ((registration as any)?.tracking?.confirmation_email_sent_at as string) || null;

  const originalEmail = registration ? getEmail(registration) : "";
  const originalName = registration ? (getName(registration) === "—" ? "" : getName(registration)) : "";
  const originalWhats = registration ? getWhatsapp(registration) : "";

  const emailValid = !email || EMAIL_RE.test(email.trim());
  const whatsValid = !whatsapp || onlyDigits(whatsapp).length >= 10;
  const nameValid = name.trim().length > 0 || !originalName;

  const hasChanges =
    name.trim() !== originalName ||
    email.trim().toLowerCase() !== originalEmail.toLowerCase() ||
    onlyDigits(whatsapp) !== onlyDigits(originalWhats) ||
    visibleData.some(([k, v]) => (extraData[k] ?? "") !== String(v ?? ""));

  const canSave = editing && hasChanges && emailValid && whatsValid && nameValid && !updateMut.isPending;

  // Live duplicate-email check
  useEffect(() => {
    if (!registration || !editing || !email || !emailValid) { setDuplicateWarning(null); return; }
    if (email.trim().toLowerCase() === originalEmail.toLowerCase()) { setDuplicateWarning(null); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const count = await checkDuplicateEmailForEvent(registration.event_id, email, registration.id);
      if (cancelled) return;
      if (count >= 2) {
        setDuplicateWarning("Este e-mail já atingiu o limite de 2 inscrições neste evento.");
      } else if (count >= 1) {
        setDuplicateWarning("Atenção: este e-mail já está em outra inscrição ativa neste evento.");
      } else {
        setDuplicateWarning(null);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [editing, email, emailValid, originalEmail, registration?.event_id, registration?.id]);

  if (!registration) return null;

  const waLink = whatsapp ? `https://wa.me/${onlyDigits(whatsapp)}` : null;
  const mailLink = email ? `mailto:${email}` : null;

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

  const handleRevertCheckIn = async () => {
    try {
      await revertMut.mutateAsync(registration.id);
      toast.success("Check-in revertido");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao reverter check-in");
    }
  };

  const handleResend = async () => {
    try {
      const res: any = await resendMut.mutateAsync(registration.id);
      if (res?.error) throw new Error(res.error);
      toast.success("E-mail de confirmação reenviado");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível reenviar agora");
    }
  };

  const handleCopy = async () => {
    const text = [
      name && `Nome: ${name}`,
      email && `E-mail: ${email}`,
      whatsapp && `WhatsApp: ${whatsapp}`,
    ].filter(Boolean).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Dados copiados");
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const handleSave = async () => {
    if (duplicateWarning?.startsWith("Este e-mail já atingiu")) {
      toast.error(duplicateWarning);
      return;
    }
    try {
      // Build merged data with synced canonical keys when present in data
      const mergedDataPatch: Record<string, string> = { ...extraData };
      const nameKey = pickKey(data, NAME_KEYS);
      const emailKey = pickKey(data, EMAIL_KEYS);
      const whatsKey = pickKey(data, WHATS_KEYS);
      if (nameKey) mergedDataPatch[nameKey] = name.trim();
      if (emailKey) mergedDataPatch[emailKey] = email.trim();
      if (whatsKey) mergedDataPatch[whatsKey] = onlyDigits(whatsapp);

      const result = await updateMut.mutateAsync({
        id: registration.id,
        current: registration as Tables<"registrations">,
        edits: {
          lead_name: name.trim() || null,
          lead_email: email.trim().toLowerCase() || null,
          lead_whatsapp: onlyDigits(whatsapp) || null,
          data: mergedDataPatch,
        },
      });

      toast.success("Dados atualizados");
      setEditing(false);

      if (result.shouldSendConfirmation) {
        const emailToNotify = email.trim();
        if (emailToNotify && EMAIL_RE.test(emailToNotify)) {
          try {
            const res: any = await resendMut.mutateAsync(registration.id);
            if (res?.error) throw new Error(res.error);
            toast.success(result.emailChanged
              ? "E-mail enviado para o novo endereço"
              : "E-mail de confirmação enviado");
          } catch (e: any) {
            toast.warning("Dados salvos, mas o e-mail não foi enviado agora. Tente reenviar em instantes.");
          }
        }
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar alterações");
    }
  };

  const handleCancelEdit = () => {
    setName(originalName);
    setEmail(originalEmail);
    setWhatsapp(originalWhats);
    const ed: Record<string, string> = {};
    visibleData.forEach(([k, v]) => { ed[k] = String(v ?? ""); });
    setExtraData(ed);
    setDuplicateWarning(null);
    setEditing(false);
  };

  return (
    <>
      <Dialog open={!!registration} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center justify-between gap-3">
              <span>{editing ? "Editar participante" : "Detalhes do participante"}</span>
              <Badge className={`${statusStyle[registration.status] || ""} text-xs`}>
                {statusLabels[registration.status] || registration.status}
              </Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Visualize, edite ou gerencie os dados deste participante.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="dados" className="w-full">
            <TabsList className="grid grid-cols-3 w-full rounded-full h-9 mb-4">
              <TabsTrigger value="dados" className="rounded-full text-xs">Dados</TabsTrigger>
              <TabsTrigger value="emails" className="rounded-full text-xs">E-mails</TabsTrigger>
              <TabsTrigger value="templates" className="rounded-full text-xs">Templates</TabsTrigger>
            </TabsList>

            <TabsContent value="dados" className="space-y-5 mt-0">
            {/* E-mail status */}
            <div className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${confirmationSentAt ? "bg-success/10 text-success" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
              {confirmationSentAt ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>E-mail de confirmação enviado em {format(new Date(confirmationSentAt), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>E-mail de confirmação ainda não foi enviado.</span>
                </>
              )}
            </div>

            {/* Contato */}
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</h4>
                {!editing && registration.status !== "cancelled" && (
                  <Button variant="ghost" size="sm" className="h-7 rounded-full text-xs" onClick={() => setEditing(true)}>
                    <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                  </Button>
                )}
              </div>

              {editing ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome completo</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-full" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">E-mail</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`rounded-full ${!emailValid ? "border-destructive" : ""}`}
                    />
                    {!emailValid && <p className="text-xs text-destructive">E-mail inválido.</p>}
                    {duplicateWarning && (
                      <p className={`text-xs ${duplicateWarning.startsWith("Este e-mail já atingiu") ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>
                        {duplicateWarning}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">WhatsApp</Label>
                    <Input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="DDD + número"
                      className={`rounded-full ${!whatsValid ? "border-destructive" : ""}`}
                    />
                    {!whatsValid && <p className="text-xs text-destructive">Mínimo de 10 dígitos.</p>}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5 text-sm">
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{name || "—"}</span>
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
                  <div className="pt-2 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="h-7 rounded-full text-xs" onClick={handleCopy}>
                      <Copy className="w-3.5 h-3.5 mr-1" /> Copiar dados
                    </Button>
                    {email && registration.status !== "cancelled" && (
                      <Button
                        variant="outline" size="sm"
                        className="h-7 rounded-full text-xs"
                        onClick={handleResend}
                        disabled={resendMut.isPending}
                      >
                        <Send className="w-3.5 h-3.5 mr-1" />
                        {confirmationSentAt ? "Reenviar confirmação" : "Enviar confirmação"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Demais campos do formulário */}
            {visibleData.length > 0 && (
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados do formulário</h4>
                <div className="space-y-2.5 bg-muted/40 rounded-xl p-3">
                  {visibleData.map(([key, value]) => {
                    const stringValue = typeof value === "string" ? value : JSON.stringify(value);
                    const isDays = key === "Dias de Comparecimento" && stringValue.includes(",");
                    if (editing) {
                      return (
                        <div key={key} className="flex flex-col gap-1">
                          <Label className="text-xs text-muted-foreground">{key}</Label>
                          <Input
                            value={extraData[key] ?? ""}
                            onChange={(e) => setExtraData((prev) => ({ ...prev, [key]: e.target.value }))}
                            className="rounded-full bg-background"
                          />
                        </div>
                      );
                    }
                    return (
                      <div key={key} className="flex flex-col gap-0.5">
                        <span className="text-xs text-muted-foreground">{key}</span>
                        {isDays ? (
                          <div className="flex flex-wrap gap-1.5 mt-0.5">
                            {stringValue.split(", ").filter(Boolean).map((d) => (
                              <Badge key={d} variant="secondary" className="text-xs rounded-full">{d}</Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm break-words">{stringValue}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Origem */}
            {!editing && Object.keys(tracking).length > 0 && (
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
            {!editing && (
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
                  {(registration as any).checked_in_at && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Check-in em</span>
                      <span>{format(new Date((registration as any).checked_in_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  )}
                </div>
              </section>
            )}
            </TabsContent>

            <TabsContent value="emails" className="mt-0">
              <RegistrationEmailsTab
                registrationId={registration.id}
                recipientEmail={getEmail(registration)}
                status={registration.status}
              />
            </TabsContent>

            <TabsContent value="templates" className="mt-0">
              <RegistrationTemplatesTab registrationId={registration.id} />
            </TabsContent>
          </Tabs>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {editing ? (
              <>
                <Button variant="ghost" className="rounded-full" onClick={handleCancelEdit}>
                  <X className="w-4 h-4 mr-2" /> Cancelar edição
                </Button>
                <Button className="rounded-full" onClick={handleSave} disabled={!canSave}>
                  <Check className="w-4 h-4 mr-2" /> Salvar alterações
                </Button>
              </>
            ) : (
              <>
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
                {registration.status === "checked_in" && (
                  <Button
                    variant="outline"
                    className="rounded-full"
                    onClick={handleRevertCheckIn}
                    disabled={revertMut.isPending}
                  >
                    <RotateCcw className="w-4 h-4 mr-2" /> Reverter check-in
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
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar inscrição?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação cancela a inscrição de <strong>{name || "este participante"}</strong> e libera a vaga. O histórico será mantido.
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
