import { useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";

const leadSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome").max(200),
  email: z.string().trim().email("E-mail inválido").max(255),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
});

interface LeadCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId?: string;
  eventName?: string;
  onSuccess?: () => void;
}

export function LeadCaptureDialog({ open, onOpenChange, eventId, eventName, onSuccess }: LeadCaptureDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = leadSchema.safeParse({ name, email, phone });
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      toast.error(first.message);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("leads").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone || null,
      event_id: eventId || null,
      source: eventId ? "event_interest" : "public_events_page",
      metadata: eventName ? { event_name: eventName } : {},
    });
    setSubmitting(false);

    if (error) {
      toast.error("Não foi possível enviar agora. Tente novamente.");
      return;
    }
    setDone(true);
    onSuccess?.();
    setTimeout(() => {
      setDone(false);
      setName("");
      setEmail("");
      setPhone("");
      onOpenChange(false);
    }, 1800);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        {done ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 mx-auto text-success" />
            <h3 className="font-display font-bold text-xl">Recebido!</h3>
            <p className="text-sm text-muted-foreground">
              Em breve entraremos em contato.
            </p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Quer saber mais?</DialogTitle>
              <DialogDescription>
                {eventName
                  ? `Deixe seu contato e te enviamos mais informações sobre "${eventName}".`
                  : "Deixe seu contato e te avisamos sobre novos eventos."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lead-name">Nome</Label>
                <Input
                  id="lead-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="h-11 rounded-full"
                  maxLength={200}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-email">E-mail</Label>
                <Input
                  id="lead-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="h-11 rounded-full"
                  maxLength={255}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lead-phone">Telefone (opcional)</Label>
                <Input
                  id="lead-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="h-11 rounded-full"
                  maxLength={50}
                />
              </div>
              <Button type="submit" disabled={submitting} className="w-full h-11 rounded-full">
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enviar"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
