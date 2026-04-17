import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, CalendarDays } from "lucide-react";
import { Logo } from "@/components/Logo";

const CheckIn = () => {
  const { registrationId } = useParams<{ registrationId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["check-in", registrationId],
    queryFn: async () => {
      if (!registrationId) return null;
      // PII-safe projection: never expose email/whatsapp/full form data
      // to anyone holding the registration UUID. Only show the lead name
      // and event metadata needed to validate entry.
      const { data, error } = await supabase
        .from("registrations")
        .select("id, status, lead_name, events(name, event_date, location_value, location_type)")
        .eq("id", registrationId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!registrationId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const valid = data && data.status !== "cancelled";
  const name = data?.lead_name || "Inscrito";

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo size="md" />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="p-8 text-center">
          {valid ? (
            <>
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12 text-success" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-2">Inscrição válida</h1>
              <p className="text-muted-foreground mb-6">Apresente este cartão na entrada do evento.</p>
              <div className="bg-muted/40 rounded-xl p-4 text-left space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Participante</p>
                  <p className="font-semibold">{name}</p>
                </div>
                {data.events?.name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Evento</p>
                    <p className="font-semibold flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" /> {data.events.name}
                    </p>
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-6">
                🎁 Válido para participação no sorteio de brindes.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-destructive" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-2">
                {data?.status === "cancelled" ? "Inscrição cancelada" : "Inscrição não encontrada"}
              </h1>
              <p className="text-muted-foreground">
                Este QR Code não é válido para entrada no evento. Procure a equipe organizadora.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default CheckIn;
