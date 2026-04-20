import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import confetti from "canvas-confetti";

type CheckInResult = "success" | "already_checked_in" | "cancelled" | "not_found" | "error";

interface RegMeta {
  lead_name: string | null;
  events: { name: string | null; primary_color: string | null } | null;
}

const CheckIn = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<CheckInResult>("error");
  const [meta, setMeta] = useState<RegMeta | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!registrationId || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        // 1) Fetch minimal display info (PII-safe projection)
        const { data: regData } = await supabase
          .from("registrations")
          .select("lead_name, events(name, primary_color)")
          .eq("id", registrationId)
          .maybeSingle();
        setMeta(regData as RegMeta | null);

        // 2) Perform public check-in via SECURITY DEFINER RPC
        const { data, error } = await supabase.rpc("public_check_in", {
          p_registration_id: registrationId,
        });

        if (error) {
          console.error("public_check_in error", error);
          setResult("error");
        } else {
          setResult((data as CheckInResult) || "error");
        }
      } catch (e) {
        console.error(e);
        setResult("error");
      } finally {
        setLoading(false);
      }
    })();
  }, [registrationId]);

  // Fire confetti on success / already checked in
  useEffect(() => {
    if (loading) return;
    if (result !== "success" && result !== "already_checked_in") return;

    const brand = meta?.events?.primary_color || "#E11D74";
    const colors = [brand, "#ffffff", "#FFD166", "#06D6A0"];

    const burst = (origin: { x: number; y: number }, particleCount = 80) => {
      confetti({
        particleCount,
        spread: 75,
        startVelocity: 45,
        origin,
        colors,
        scalar: 1.1,
        ticks: 220,
      });
    };

    const t1 = setTimeout(() => burst({ x: 0.5, y: 0.4 }, 110), 200);
    const t2 = setTimeout(() => burst({ x: 0.15, y: 0.55 }, 70), 500);
    const t3 = setTimeout(() => burst({ x: 0.85, y: 0.55 }, 70), 800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [loading, result, meta]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const success = result === "success" || result === "already_checked_in";
  const eventName = meta?.events?.name || "";
  const name = meta?.lead_name || "Inscrito";

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo size="md" />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="p-8 text-center" role="status" aria-live="polite">
          {success ? (
            <>
              <div className="text-[96px] sm:text-[120px] leading-none select-none animate-in zoom-in-50 duration-500">
                ✅
              </div>
              <h1 className="text-4xl sm:text-5xl font-display font-bold mt-4 mb-3 tracking-tight">
                Checkin Realizado
              </h1>
              <p className="text-muted-foreground text-base mb-2">
                <span className="font-semibold text-foreground">{name}</span>
                {eventName ? <> está confirmado em <span className="font-semibold text-foreground">{eventName}</span>.</> : "."}
              </p>
              {result === "already_checked_in" && (
                <p className="text-xs text-muted-foreground mt-4">
                  Check-in já registrado anteriormente.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-6">
                🎁 Boa sorte no sorteio de brindes!
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-destructive" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-2">
                {result === "cancelled" ? "Inscrição cancelada" : "Inscrição não encontrada"}
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
