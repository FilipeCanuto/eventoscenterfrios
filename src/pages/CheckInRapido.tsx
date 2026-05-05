import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Loader2, XCircle, Clock, Mail } from "lucide-react";
import confetti from "canvas-confetti";

type Status =
  | "idle"
  | "loading"
  | "success"
  | "already_checked_in"
  | "not_found"
  | "outside_window"
  | "invalid_email"
  | "multiple_events"
  | "error";

interface RpcResult {
  status: Status;
  name?: string | null;
  event_name?: string | null;
  primary_color?: string | null;
  events?: { id: string; name: string }[];
}

const CheckInRapido = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<RpcResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (eventId?: string) => {
    const value = email.trim();
    if (!value) return;
    setStatus("loading");
    try {
      const { data, error } = await supabase.rpc("public_check_in_by_email" as never, {
        p_email: value,
        p_event_id: eventId ?? null,
      } as never);
      if (error) {
        console.error(error);
        setStatus("error");
        return;
      }
      const r = (data as RpcResult) || { status: "error" };
      setResult(r);
      setStatus(r.status);
    } catch (e) {
      console.error(e);
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setEmail("");
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Confetti on success
  const success = status === "success" || status === "already_checked_in";
  useEffect(() => {
    if (!success) return;
    const brand = result?.primary_color || "#E11D74";
    const colors = [brand, "#ffffff", "#FFD166", "#06D6A0"];
    const burst = (origin: { x: number; y: number }, particleCount = 80) => {
      try {
        confetti({ particleCount, spread: 75, startVelocity: 45, origin, colors, scalar: 1.1, ticks: 220 });
      } catch {}
    };
    const t1 = setTimeout(() => burst({ x: 0.5, y: 0.4 }, 110), 200);
    const t2 = setTimeout(() => burst({ x: 0.15, y: 0.55 }, 70), 500);
    const t3 = setTimeout(() => burst({ x: 0.85, y: 0.55 }, 70), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [success, result]);

  const brand = result?.primary_color || undefined;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo size="md" />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="p-8 text-center" role="status" aria-live="polite">
          {status === "idle" || status === "loading" || status === "invalid_email" || status === "error" || status === "not_found" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-display font-bold mb-2 tracking-tight">Check-in rápido</h1>
              <p className="text-muted-foreground text-sm mb-6">
                Digite o e-mail usado na sua inscrição
              </p>
              <form
                onSubmit={(e) => { e.preventDefault(); submit(); }}
                className="space-y-3"
              >
                <Input
                  ref={inputRef}
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-base text-center rounded-full"
                  disabled={status === "loading"}
                  required
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={status === "loading" || !email.trim()}
                >
                  {status === "loading" ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</>
                  ) : (
                    "Fazer check-in"
                  )}
                </Button>
              </form>

              {status === "invalid_email" && (
                <p className="text-sm text-destructive mt-4">E-mail inválido. Verifique e tente novamente.</p>
              )}
              {status === "not_found" && (
                <p className="text-sm text-destructive mt-4">
                  Não encontramos sua inscrição. Verifique o e-mail ou procure a equipe na recepção.
                </p>
              )}
              {status === "error" && (
                <p className="text-sm text-destructive mt-4">
                  Algo deu errado. Tente novamente em alguns segundos.
                </p>
              )}
            </>
          ) : status === "multiple_events" ? (
            <>
              <h1 className="text-2xl font-display font-bold mb-2">Em qual evento?</h1>
              <p className="text-muted-foreground text-sm mb-6">
                Encontramos sua inscrição em mais de um evento. Selecione:
              </p>
              <div className="space-y-2">
                {(result?.events || []).map((e) => (
                  <Button
                    key={e.id}
                    variant="outline"
                    className="w-full justify-center"
                    onClick={() => submit(e.id)}
                  >
                    {e.name}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" className="mt-4" onClick={reset}>
                Tentar outro e-mail
              </Button>
            </>
          ) : success ? (
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
                Aproveite o evento, <span className="font-semibold text-foreground">{result?.name || "Inscrito"}</span>!
              </p>
              {result?.event_name && (
                <p className="text-sm text-muted-foreground">
                  Você está confirmado em <span className="font-semibold text-foreground">{result.event_name}</span>.
                </p>
              )}
              {status === "already_checked_in" && (
                <p className="text-xs text-muted-foreground mt-4">
                  Check-in já registrado anteriormente.
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-6">
                🎁 Boa sorte no sorteio de brindes!
              </p>
              <Button variant="outline" className="mt-6" onClick={reset}>
                Próximo participante
              </Button>
            </>
          ) : status === "outside_window" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-6">
                <Clock className="w-12 h-12 text-warning" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-2">Check-in indisponível</h1>
              <p className="text-muted-foreground">
                Nenhum evento está aberto para check-in agora. Volte mais perto do horário do evento.
              </p>
              <Button variant="outline" className="mt-6" onClick={reset}>
                Tentar outro e-mail
              </Button>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-destructive" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-2">Não foi possível</h1>
              <p className="text-muted-foreground">Procure a equipe organizadora na recepção.</p>
              <Button variant="outline" className="mt-6" onClick={reset}>
                Tentar outro e-mail
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default CheckInRapido;
