import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Search, MapPin, Users, Loader2, LogIn, Lock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { usePublicEvents, PublicEvent } from "@/hooks/usePublicEvents";
import { useAuth } from "@/contexts/AuthContext";
import { LeadCaptureDialog } from "@/components/public/LeadCaptureDialog";

const PublicEvents = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [search, setSearch] = useState("");
  const { data: events, isLoading } = usePublicEvents(search || undefined);

  const [leadOpen, setLeadOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<PublicEvent | null>(null);
  const [exitPrompted, setExitPrompted] = useState(false);
  const [leadCaptured, setLeadCaptured] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("public_lead_captured") === "1";
  });

  // Exit-intent prompt for unauthenticated visitors who haven't submitted a lead
  useEffect(() => {
    if (user || leadCaptured || exitPrompted) return;

    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) {
        setExitPrompted(true);
        setSelectedEvent(null);
        setLeadOpen(true);
      }
    };
    const timer = window.setTimeout(() => {
      if (!exitPrompted && !leadCaptured) {
        setExitPrompted(true);
        setSelectedEvent(null);
        setLeadOpen(true);
      }
    }, 45000); // fallback after 45s

    document.addEventListener("mouseleave", onMouseLeave);
    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
      window.clearTimeout(timer);
    };
  }, [user, leadCaptured, exitPrompted]);

  const handleLeadSuccess = () => {
    setLeadCaptured(true);
    try {
      localStorage.setItem("public_lead_captured", "1");
    } catch {}
  };

  const handleEventClick = (event: PublicEvent) => {
    if (user) {
      navigate(`/register/${event.slug}`);
      return;
    }
    setSelectedEvent(event);
    setLeadOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center">
            <Logo size="md" />
          </Link>
          <div className="flex items-center gap-2">
            {authLoading ? null : user ? (
              <Button asChild className="rounded-full">
                <Link to="/dashboard/events">Meu painel</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="rounded-full">
                  <Link to="/auth">
                    <LogIn className="w-4 h-4 mr-1.5" />
                    Entrar
                  </Link>
                </Button>
                <Button asChild className="rounded-full">
                  <Link to="/auth?mode=signup">Criar conta</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10">
        {/* Hero */}
        <section className="space-y-3 text-center sm:text-left">
          <h1 className="font-display font-bold text-4xl sm:text-5xl tracking-tight">
            Eventos abertos
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl">
            Descubra os próximos eventos. Faça login para se inscrever e garantir sua vaga.
          </p>
        </section>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar eventos…"
            className="pl-11 h-12 rounded-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Events grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : events && events.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <article
                key={event.id}
                className="group cursor-pointer"
                onClick={() => handleEventClick(event)}
              >
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden bg-muted mb-3">
                  {event.background_image_url ? (
                    <img
                      src={event.background_image_url}
                      alt={event.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <CalendarDays className="w-10 h-10 text-muted-foreground/30" />
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="bg-card text-foreground text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                      {event.ticket_price && event.ticket_price > 0
                        ? `R$${event.ticket_price}`
                        : "Grátis"}
                    </span>
                  </div>
                  {!user && (
                    <div className="absolute top-3 right-3">
                      <Badge className="bg-foreground/85 text-background border-0 backdrop-blur-sm rounded-full">
                        <Lock className="w-3 h-3 mr-1" /> Login
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {event.event_date
                      ? format(new Date(event.event_date), "EEE, d MMM · HH:mm", { locale: ptBR })
                      : "Em breve"}
                  </p>
                  <h3 className="font-display font-bold text-lg leading-snug group-hover:text-primary transition-colors">
                    {event.name}
                  </h3>
                  {event.location_value && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground pt-0.5">
                      <MapPin className="w-3 h-3" />
                      {event.location_value}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <CalendarDays className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum evento disponível</h3>
            <p className="text-muted-foreground">Volte em breve para conferir novidades.</p>
          </div>
        )}

        {/* CTA for non-logged users */}
        {!user && events && events.length > 0 && (
          <section className="bg-muted/40 rounded-2xl p-8 sm:p-10 text-center space-y-4">
            <h2 className="font-display font-bold text-2xl sm:text-3xl">
              Pronto para participar?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Crie sua conta gratuita para se inscrever nos eventos e receber novidades em primeira mão.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/auth?mode=signup">Criar conta grátis</Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="rounded-full"
                onClick={() => {
                  setSelectedEvent(null);
                  setLeadOpen(true);
                }}
              >
                Quero ser avisado
              </Button>
            </div>
          </section>
        )}
      </main>

      <LeadCaptureDialog
        open={leadOpen}
        onOpenChange={setLeadOpen}
        eventId={selectedEvent?.id}
        eventName={selectedEvent?.name}
        onSuccess={handleLeadSuccess}
      />
    </div>
  );
};

export default PublicEvents;
