import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { Loader2, XCircle, Clock, Mail, UserPlus } from "lucide-react";
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
  | "register_form"
  | "choose_event_to_register"
  | "registering"
  | "error";

interface RpcResult {
  status: Status;
  name?: string | null;
  event_name?: string | null;
  primary_color?: string | null;
  events?: { id: string; name: string }[];
}

interface OpenEvent { id: string; name: string }

const CheckInRapido = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<RpcResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inscrição na hora
  const [regName, setRegName] = useState("");
  const [regWhatsapp, setRegWhatsapp] = useState("");
  const [openEvents, setOpenEvents] = useState<OpenEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const checkByEmail = async (eventId?: string) => {
    const value = email.trim();
    if (!value) return;
    setErrorMsg(null);
    setStatus("loading");
    try {
      const { data, error } = await supabase.rpc("public_check_in_by_email" as never, {
        p_email: value,
        p_event_id: eventId ?? null,
      } as never);
      if (error) {
        console.error(error);
        setErrorMsg(error.message || "Erro inesperado");
        setStatus("error");
        return;
      }
      const r = (data as RpcResult) || { status: "error" };
      setResult(r);
      setStatus(r.status);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Erro inesperado");
      setStatus("error");
    }
  };

  const startRegister = async () => {
    setErrorMsg(null);
    // Buscar eventos abertos para check-in agora
    const { data, error } = await supabase.rpc("public_get_open_events_for_checkin" as never);
    if (error) {
      console.error(error);
      setErrorMsg("Não foi possível listar os eventos abertos.");
      setStatus("error");
      return;
    }
    const events = (data as OpenEvent[]) || [];
    setOpenEvents(events);
    if (events.length === 0) {
      setErrorMsg("Nenhum evento aberto para inscrição agora.");
      setStatus("error");
      return;
    }
    if (events.length === 1) {
      setSelectedEventId(events[0].id);
      setStatus("register_form");
    } else {
      setStatus("choose_event_to_register");
    }
  };

  const submitRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEventId) return;
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = regName.trim();
    const cleanWhats = regWhatsapp.replace(/\D/g, "");
    if (!cleanName || !cleanEmail) {
      setErrorMsg("Preencha nome e e-mail.");
      return;
    }
    setErrorMsg(null);
    setStatus("registering");
    try {
      const payload: Record<string, string> = {
        "Nome Completo": cleanName,
        "Endereço de E-mail": cleanEmail,
      };
      if (cleanWhats) payload["WhatsApp"] = cleanWhats;

      const { error: regErr } = await supabase.rpc("register_for_event" as never, {
        p_event_id: selectedEventId,
        p_data: payload,
        p_tracking: { source: "checkin_rapido" },
      } as never);

      if (regErr) {
        console.error(regErr);
        const msg = regErr.message || "";
        if (msg.includes("WhatsApp number is already registered")) {
          setErrorMsg("Este WhatsApp já está inscrito. Use o e-mail correspondente para fazer check-in.");
        } else if (msg.includes("maximum number of registrations")) {
          setErrorMsg("Este e-mail atingiu o limite de inscrições.");
        } else if (msg.includes("full capacity") || msg.includes("limit reached")) {
          setErrorMsg("Evento lotado.");
        } else if (msg.includes("deadline has passed")) {
          setErrorMsg("Inscrições encerradas para este evento.");
        } else {
          setErrorMsg("Não foi possível concluir a inscrição. Procure a equipe na recepção.");
        }
        setStatus("register_form");
        return;
      }

      // Inscrição feita; faz check-in encadeado
      const { data, error } = await supabase.rpc("public_check_in_by_email" as never, {
        p_email: cleanEmail,
        p_event_id: selectedEventId,
      } as never);
      if (error) {
        console.error(error);
        setErrorMsg("Inscrição feita, mas o check-in falhou. Tente novamente.");
        setStatus("error");
        return;
      }
      const r = (data as RpcResult) || { status: "error" };
      setResult(r);
      setStatus(r.status);
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.message || "Erro inesperado");
      setStatus("error");
    }
  };

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setEmail("");
    setRegName("");
    setRegWhatsapp("");
    setSelectedEventId(null);
    setOpenEvents([]);
    setErrorMsg(null);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const success = status === "success" || status === "already_checked_in";
  useEffect(() => {
    if (!success) return;
    const brand = result?.primary_color || "#E11D74";
    const colors = [brand, "#ffffff", "#FFD166", "#06D6A0"];
    const burst = (origin: { x: number; y: number }, particleCount = 80) => {
      try { confetti({ particleCount, spread: 75, startVelocity: 45, origin, colors, scalar: 1.1, ticks: 220 }); } catch {}
    };
    const t1 = setTimeout(() => burst({ x: 0.5, y: 0.4 }, 110), 200);
    const t2 = setTimeout(() => burst({ x: 0.15, y: 0.55 }, 70), 500);
    const t3 = setTimeout(() => burst({ x: 0.85, y: 0.55 }, 70), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [success, result]);

  const brand = result?.primary_color || undefined;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8"><Logo size="md" /></div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="p-8 text-center" role="status" aria-live="polite">
          {status === "idle" || status === "loading" || status === "invalid_email" || status === "not_found" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <Mail className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-3xl font-display font-bold mb-2 tracking-tight">Check-in rápido</h1>
              <p className="text-muted-foreground text-sm mb-6">Digite o e-mail usado na sua inscrição</p>
              <form onSubmit={(e) => { e.preventDefault(); checkByEmail(); }} className="space-y-3">
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
                <Button type="submit" size="lg" className="w-full" disabled={status === "loading" || !email.trim()}>
                  {status === "loading" ? (<><Loader2 className="w-4 h-4 animate-spin" /> Verificando…</>) : "Fazer check-in"}
                </Button>
              </form>

              {status === "invalid_email" && (
                <p className="text-sm text-destructive mt-4">E-mail inválido. Verifique e tente novamente.</p>
              )}
              {status === "not_found" && (
                <div className="mt-6 space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Não encontramos sua inscrição com este e-mail.
                  </p>
                  <Button onClick={startRegister} variant="outline" size="lg" className="w-full">
                    <UserPlus className="w-4 h-4 mr-2" /> Inscrever-me agora
                  </Button>
                </div>
              )}
            </>
          ) : status === "error" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-destructive" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-2">Algo deu errado</h1>
              <p className="text-muted-foreground text-sm">{errorMsg || "Tente novamente em alguns segundos."}</p>
              <Button variant="outline" className="mt-6" onClick={reset}>Tentar novamente</Button>
            </>
          ) : status === "multiple_events" ? (
            <>
              <h1 className="text-2xl font-display font-bold mb-2">Em qual evento?</h1>
              <p className="text-muted-foreground text-sm mb-6">Encontramos sua inscrição em mais de um evento. Selecione:</p>
              <div className="space-y-2">
                {(result?.events || []).map((e) => (
                  <Button key={e.id} variant="outline" className="w-full justify-center" onClick={() => checkByEmail(e.id)}>
                    {e.name}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" className="mt-4" onClick={reset}>Tentar outro e-mail</Button>
            </>
          ) : status === "choose_event_to_register" ? (
            <>
              <h1 className="text-2xl font-display font-bold mb-2">Em qual evento?</h1>
              <p className="text-muted-foreground text-sm mb-6">Selecione o evento para se inscrever agora:</p>
              <div className="space-y-2">
                {openEvents.map((e) => (
                  <Button key={e.id} variant="outline" className="w-full justify-center"
                    onClick={() => { setSelectedEventId(e.id); setStatus("register_form"); }}>
                    {e.name}
                  </Button>
                ))}
              </div>
              <Button variant="ghost" className="mt-4" onClick={reset}>Cancelar</Button>
            </>
          ) : status === "register_form" || status === "registering" ? (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                <UserPlus className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-1 tracking-tight">Inscrição na hora</h1>
              <p className="text-muted-foreground text-sm mb-6">Preencha seus dados para entrar no evento</p>
              <form onSubmit={submitRegister} className="space-y-3 text-left">
                <div>
                  <Label htmlFor="reg-name" className="text-xs">Nome completo</Label>
                  <Input id="reg-name" value={regName} onChange={(e) => setRegName(e.target.value)}
                    className="h-12 rounded-full mt-1" required disabled={status === "registering"} />
                </div>
                <div>
                  <Label htmlFor="reg-email" className="text-xs">E-mail</Label>
                  <Input id="reg-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-full mt-1" required disabled={status === "registering"} />
                </div>
                <div>
                  <Label htmlFor="reg-whats" className="text-xs">WhatsApp (opcional)</Label>
                  <Input id="reg-whats" inputMode="tel" value={regWhatsapp} onChange={(e) => setRegWhatsapp(e.target.value)}
                    className="h-12 rounded-full mt-1" placeholder="(11) 99999-9999" disabled={status === "registering"} />
                </div>
                {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
                <Button type="submit" size="lg" className="w-full" disabled={status === "registering"}>
                  {status === "registering" ? (<><Loader2 className="w-4 h-4 animate-spin" /> Inscrevendo…</>) : "Inscrever e fazer check-in"}
                </Button>
                <Button type="button" variant="ghost" className="w-full" onClick={reset} disabled={status === "registering"}>
                  Voltar
                </Button>
              </form>
            </>
          ) : success ? (
            <>
              <div className="text-[96px] sm:text-[120px] leading-none select-none animate-in zoom-in-50 duration-500">✅</div>
              <h1 className="text-4xl sm:text-5xl font-display font-bold mt-4 mb-3 tracking-tight"
                style={brand ? { color: brand } : undefined}>
                Check-in Realizado
              </h1>
              <p className="text-muted-foreground text-base mb-2">
                Aproveite o evento, <span className="font-semibold text-foreground">{result?.name || regName || "Inscrito"}</span>!
              </p>
              {result?.event_name && (
                <p className="text-sm text-muted-foreground">
                  Você está confirmado em <span className="font-semibold text-foreground">{result.event_name}</span>.
                </p>
              )}
              {status === "already_checked_in" && (
                <p className="text-xs text-muted-foreground mt-4">Check-in já registrado anteriormente.</p>
              )}
              <p className="text-xs text-muted-foreground mt-6">🎁 Boa sorte no sorteio de brindes!</p>
              <Button variant="outline" className="mt-6" onClick={reset}>Próximo participante</Button>
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
              <Button variant="outline" className="mt-6" onClick={reset}>Tentar outro e-mail</Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
};

export default CheckInRapido;
