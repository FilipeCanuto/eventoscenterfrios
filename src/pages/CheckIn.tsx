import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { XCircle, Loader2, Clock } from "lucide-react";
import { Logo } from "@/components/Logo";
import confetti from "canvas-confetti";

type CheckInResult = "success" | "already_checked_in" | "cancelled" | "not_found" | "outside_window" | "error";

interface RegMeta {
  lead_name: string | null;
  events: { name: string | null; primary_color: string | null; event_date: string | null; timezone: string | null } | null;
}

const CheckIn = () => {
  const { registrationId } = useParams<{ registrationId: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<CheckInResult>("error");
  const [meta, setMeta] = useState<RegMeta | null>(null);
  const [windowStart, setWindowStart] = useState<string | null>(null);
  const ranRef = useRef(false);

  useEffect(() => {
    if (!registrationId || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const { data: regData } = await supabase
          .from("registrations")
          .select("lead_name, events(name, primary_color, event_date, timezone)")
          .eq("id", registrationId)
          .maybeSingle();
        setMeta(regData as RegMeta | null);

        const { data, error } = await supabase.rpc("public_check_in", {
          p_registration_id: registrationId,
        });

        if (error) {
          console.error("public_check_in error", error);
          setResult("error");
        } else {
          const r = (data as CheckInResult) || "error";
          setResult(r);
          if (r === "outside_window") {
            const { data: w } = await supabase.rpc("get_check_in_window", { p_registration_id: registrationId });
            const row = Array.isArray(w) ? w[0] : w;
            if (row?.window_start) setWindowStart(row.window_start as string);
          }
        }
      } catch (e) {
        console.error(e);
        setResult("error");
      } finally {
        setLoading(false);
      }
    })();
  }, [registrationId]);

  useEffect(() => {
    if (loading) return;
    if (result !== "success" && result !== "already_checked_in") return;

    const brand = meta?.events?.primary_color || "#E11D74";
    const colors = [brand, "#ffffff", "#FFD166", "#06D6A0"];

    const burst = (origin: { x: number; y: number }, particleCount = 80) => {
      try {
        confetti({
          particleCount,
          spread: 75,
          startVelocity: 45,
          origin,
          colors,
          scalar: 1.1,
          ticks: 220,
        });
      } catch (err) {
        // Em alguns in-app browsers (WhatsApp/Instagram) ou devices com canvas
        // restrito o confetti pode lançar — falhar silenciosamente preserva a UI.
        // eslint-disable-next-line no-console
        console.warn("[confetti] skipped", err);
      }
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
  const brand = meta?.events?.primary_color || undefined;

  const formatWhen = (iso: string) => {
    try {
      const tz = meta?.events?.timezone || "America/Sao_Paulo";
      const d = new Date(iso);
      const date = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit", month: "long", year: "numeric", timeZone: tz,
      }).format(d);
      const time = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit", minute: "2-digit", timeZone: tz,
      }).format(d);
      return `${date} às ${time}`;
    } catch { return iso; }
  };

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
              <h1
                className="text-4xl sm:text-5xl font-display font-bold mt-4 mb-3 tracking-tight"
                style={brand ? { color: brand } : undefined}
              >
                Check-in Realizado
              </h1>
              <p className="text-muted-foreground text-base mb-2">
                Aproveite o evento, <span className="font-semibold text-foreground">{name}</span>!
              </p>
              {eventName && (
                <p className="text-sm text-muted-foreground">
                  Você está confirmado em <span className="font-semibold text-foreground">{eventName}</span>.
                </p>
              )}
              {result === "already_checked_in" && (
                <p className="text-xs text-muted-foreground mt-4">
                  Check-in já registrado anteriormente.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-6">
                🎁 Boa sorte no sorteio de brindes!
              </p>
            </>
          ) : result === "outside_window" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-12 h-12 text-warning" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-2">Check-in indisponível</h1>
              <p className="text-muted-foreground">
                {windowStart
                  ? <>O check-in estará disponível a partir de <span className="font-semibold text-foreground">{formatWhen(windowStart)}</span>.</>
                  : "Volte mais perto do horário do evento para fazer o check-in."}
              </p>
              <p className="text-xs text-muted-foreground mt-6">
                Guarde este QR Code — ele será usado no dia do evento.
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
