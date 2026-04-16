import { useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useCompanyBySlug,
  usePublicEventsByUser,
  usePublicRegistrationCounts,
} from "@/hooks/usePublicCompany";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  MapPin,
  Users,
  Globe,
  Mail,
  Linkedin,
  Instagram,
  Facebook,
  Youtube,
  Twitter,
  Github,
  BadgeCheck,
  ArrowRight,
  LayoutGrid,
  List,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type SocialLink = { platform: string; url: string };

const SOCIAL_ICON_MAP: Record<string, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  "Twitter / X": Twitter,
  Twitter: Twitter,
  X: Twitter,
  LinkedIn: Linkedin,
  Linkedin: Linkedin,
  Instagram: Instagram,
  Facebook: Facebook,
  YouTube: Youtube,
  Youtube: Youtube,
  TikTok: ExternalLink,
  GitHub: Github,
  Github: Github,
  Email: Mail,
};

const CompanyPage = () => {
  const { companySlug } = useParams<{ companySlug: string }>();
  const { data: company, isLoading, error } = useCompanyBySlug(companySlug);
  const { data: events } = usePublicEventsByUser(company?.id);
  const eventIds = useMemo(() => events?.map((e) => e.id) ?? [], [events]);
  const { data: regCounts } = usePublicRegistrationCounts(eventIds);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { upcomingEvents, pastEvents, totalParticipants } = useMemo(() => {
    const sorted = [...(events || [])].sort(
      (a, b) => new Date(a.event_date || 0).getTime() - new Date(b.event_date || 0).getTime()
    );
    const now = new Date();
    const upcoming = sorted.filter((e) => e.event_date && new Date(e.event_date) >= now);
    const past = sorted
      .filter((e) => !e.event_date || new Date(e.event_date) < now)
      .reverse();
    const total = Object.values(regCounts || {}).reduce((sum, n) => sum + (n || 0), 0);
    return { upcomingEvents: upcoming, pastEvents: past, totalParticipants: total };
  }, [events, regCounts]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
          <Skeleton className="h-[280px] w-full rounded-3xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div role="alert" className="text-center space-y-4 max-w-md">
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">
            Empresa não encontrada
          </h1>
          <p className="text-muted-foreground">
            Esta página de empresa não existe ou ainda não foi configurada.
          </p>
          <Link to="/">
            <Button variant="outline">Voltar ao início</Button>
          </Link>
        </div>
      </div>
    );
  }

  const socialLinks: SocialLink[] = Array.isArray(company.social_links)
    ? (company.social_links as any[]).filter((s) => s?.platform && s?.url)
    : [];

  const companyName = company.company || company.full_name || "Organização";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Skip link */}
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
      >
        Pular para o conteúdo
      </a>

      <main id="conteudo" className="flex-1">
        {/* ========== HERO ========== */}
        <section
          aria-labelledby="company-name"
          className="relative overflow-hidden border-b border-border/40"
        >
          {/* Decorative background */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background"
          />
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-primary/15 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-32 -left-20 w-[360px] h-[360px] rounded-full bg-primary/10 blur-3xl"
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 sm:pt-24 pb-12 sm:pb-16">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              {company.avatar_url ? (
                <img
                  src={company.avatar_url}
                  alt={`Logotipo de ${companyName}`}
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-2 border-background shadow-xl bg-card flex-shrink-0"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-card border-2 border-background shadow-xl flex items-center justify-center flex-shrink-0"
                >
                  <span className="text-3xl font-display font-bold text-primary">
                    {companyName.charAt(0)}
                  </span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                  <h1
                    id="company-name"
                    className="text-3xl sm:text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight"
                  >
                    {companyName}
                  </h1>
                  <Badge
                    variant="secondary"
                    className="gap-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15"
                  >
                    <BadgeCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    Organizador verificado
                  </Badge>
                </div>

                {company.company_description && (
                  <p className="text-base sm:text-lg text-foreground/80 max-w-3xl leading-relaxed mb-6">
                    {company.company_description}
                  </p>
                )}

                {/* Social + stats row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {company.website && (
                      <a
                        href={company.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Visitar nosso site (abre em nova aba)"
                        className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-card border border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        <Globe className="w-5 h-5" aria-hidden="true" />
                      </a>
                    )}
                    {socialLinks.map((s, i) => {
                      const Icon = SOCIAL_ICON_MAP[s.platform] || ExternalLink;
                      const href = s.platform === "Email" ? `mailto:${s.url}` : s.url;
                      const label =
                        s.platform === "Email"
                          ? `Enviar e-mail (${s.url})`
                          : `Visitar nosso ${s.platform} (abre em nova aba)`;
                      return (
                        <a
                          key={i}
                          href={href}
                          target={s.platform === "Email" ? undefined : "_blank"}
                          rel={s.platform === "Email" ? undefined : "noopener noreferrer"}
                          aria-label={label}
                          className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-card border border-border text-foreground hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                          <Icon className="w-5 h-5" aria-hidden="true" />
                        </a>
                      );
                    })}
                  </div>

                  {(events?.length ?? 0) > 0 && (
                    <dl className="flex items-center gap-6 text-sm">
                      <div className="flex flex-col">
                        <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                          Eventos
                        </dt>
                        <dd className="text-foreground font-display font-bold text-xl">
                          {events!.length}
                        </dd>
                      </div>
                      {totalParticipants > 0 && (
                        <div className="flex flex-col">
                          <dt className="text-muted-foreground text-xs uppercase tracking-wide">
                            Participantes
                          </dt>
                          <dd className="text-foreground font-display font-bold text-xl">
                            {totalParticipants}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========== STATS / VIEW TOGGLE ========== */}
        {(events?.length ?? 0) > 0 && (
          <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{upcomingEvents.length}</span>{" "}
                {upcomingEvents.length === 1 ? "próximo" : "próximos"} ·{" "}
                <span className="font-semibold text-foreground">{pastEvents.length}</span>{" "}
                {pastEvents.length === 1 ? "realizado" : "realizados"}
              </p>
              <div
                role="tablist"
                aria-label="Modo de visualização dos eventos"
                className="inline-flex rounded-full border border-border bg-card p-1"
              >
                <button
                  role="tab"
                  aria-pressed={viewMode === "grid"}
                  aria-label="Visualizar em grade"
                  onClick={() => setViewMode("grid")}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    viewMode === "grid"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                </button>
                <button
                  role="tab"
                  aria-pressed={viewMode === "list"}
                  aria-label="Visualizar em lista"
                  onClick={() => setViewMode("list")}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    viewMode === "list"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <List className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========== UPCOMING EVENTS ========== */}
        {upcomingEvents.length > 0 && (
          <section
            aria-labelledby="upcoming-heading"
            className="max-w-6xl mx-auto px-4 sm:px-6 mt-6"
          >
            <h2
              id="upcoming-heading"
              className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-5"
            >
              Próximos eventos
            </h2>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {upcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    regCount={regCounts?.[event.id]}
                    isPast={false}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingEvents.map((event) => (
                  <EventListItem
                    key={event.id}
                    event={event}
                    regCount={regCounts?.[event.id]}
                    isPast={false}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ========== PAST EVENTS ========== */}
        {pastEvents.length > 0 && (
          <section
            aria-labelledby="past-heading"
            className="max-w-6xl mx-auto px-4 sm:px-6 mt-12 pb-16"
          >
            <h2
              id="past-heading"
              className="text-2xl sm:text-3xl font-display font-bold text-foreground mb-5"
            >
              Eventos anteriores
            </h2>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {pastEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    regCount={regCounts?.[event.id]}
                    isPast
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {pastEvents.map((event) => (
                  <EventListItem
                    key={event.id}
                    event={event}
                    regCount={regCounts?.[event.id]}
                    isPast
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {(!events || events.length === 0) && (
          <div className="max-w-6xl mx-auto px-6 py-24 text-center">
            <div
              aria-hidden="true"
              className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6"
            >
              <Calendar className="w-10 h-10 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-display font-semibold text-foreground mb-2">
              Nenhum evento ainda
            </h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Volte em breve para ver os próximos eventos desta organização.
            </p>
          </div>
        )}
      </main>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-border/40 bg-card/30 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} {companyName}
          </p>
          <p className="text-muted-foreground">
            Página criada com{" "}
            <Link to="/" className="text-foreground font-medium hover:text-primary transition-colors">
              meuevento
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
};

/* ========== GRID CARD ========== */
function EventCard({
  event,
  regCount,
  isPast,
}: {
  event: any;
  regCount?: number;
  isPast: boolean;
}) {
  return (
    <article className="group relative h-full">
      <Card className="overflow-hidden h-full border border-border/60 hover:border-primary/40 hover:shadow-xl transition-all hover:-translate-y-1 rounded-2xl bg-card focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          {event.background_image_url ? (
            <img
              src={event.background_image_url}
              alt={`Capa do evento ${event.name}`}
              className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
                isPast ? "grayscale opacity-80" : ""
              }`}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Calendar className="w-12 h-12 text-muted-foreground/40" aria-hidden="true" />
            </div>
          )}

          {/* Date pill or "Realizado" badge */}
          {isPast ? (
            <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-background/95 backdrop-blur-sm text-xs font-semibold text-muted-foreground border border-border">
              Realizado
            </span>
          ) : (
            event.event_date && (
              <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-background/95 backdrop-blur-sm text-xs font-semibold text-primary border border-primary/20">
                {format(new Date(event.event_date), "d 'de' MMM", { locale: ptBR })}
              </span>
            )
          )}
        </div>

        <CardContent className="p-5 space-y-3">
          {event.event_date && !isPast && (
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {format(new Date(event.event_date), "EEE, d 'de' MMM · HH:mm", { locale: ptBR })}
            </p>
          )}
          <h3 className="font-display font-bold text-lg sm:text-xl text-foreground leading-tight line-clamp-2">
            <Link
              to={`/register/${event.slug}`}
              className="outline-none after:absolute after:inset-0 after:content-['']"
            >
              <span className="sr-only">
                {isPast ? "Ver detalhes de" : "Inscrever-se em"}{" "}
              </span>
              {event.name}
            </Link>
          </h3>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {event.location_value && (
              <span className="inline-flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{event.location_value}</span>
              </span>
            )}
            {regCount !== undefined && regCount > 0 && (
              <span className="inline-flex items-center gap-1.5 flex-shrink-0">
                <Users className="w-3.5 h-3.5" aria-hidden="true" />
                {regCount}
              </span>
            )}
          </div>
          <div className="pt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
            {isPast ? "Ver detalhes" : "Inscrever-se"}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </article>
  );
}

/* ========== LIST ITEM ========== */
function EventListItem({
  event,
  regCount,
  isPast,
}: {
  event: any;
  regCount?: number;
  isPast: boolean;
}) {
  const shortDesc = event.description
    ? event.description.replace(/[*#_~`>]/g, "").slice(0, 200)
    : "";

  return (
    <article className="group relative">
      <Card className="overflow-hidden border border-border/60 hover:border-primary/40 hover:shadow-lg transition-all rounded-2xl bg-card focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2">
        <div className="flex flex-col sm:flex-row">
          <div className="sm:w-56 sm:min-h-[160px] aspect-[16/10] sm:aspect-auto bg-muted flex-shrink-0 overflow-hidden relative">
            {event.background_image_url ? (
              <img
                src={event.background_image_url}
                alt={`Capa do evento ${event.name}`}
                className={`w-full h-full object-cover ${isPast ? "grayscale opacity-80" : ""}`}
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Calendar className="w-10 h-10 text-muted-foreground/40" aria-hidden="true" />
              </div>
            )}
            {isPast && (
              <span className="absolute top-3 left-3 inline-flex items-center px-2.5 py-1 rounded-full bg-background/95 backdrop-blur-sm text-xs font-semibold text-muted-foreground border border-border">
                Realizado
              </span>
            )}
          </div>
          <CardContent className="flex-1 p-5 flex flex-col justify-between gap-3">
            <div>
              {event.event_date && (
                <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1.5">
                  {format(new Date(event.event_date), "EEE, d 'de' MMM 'de' yyyy · HH:mm", {
                    locale: ptBR,
                  })}
                </p>
              )}
              <h3 className="font-display font-bold text-xl leading-tight mb-1.5 text-foreground">
                <Link
                  to={`/register/${event.slug}`}
                  className="outline-none after:absolute after:inset-0 after:content-['']"
                >
                  <span className="sr-only">
                    {isPast ? "Ver detalhes de" : "Inscrever-se em"}{" "}
                  </span>
                  {event.name}
                </Link>
              </h3>
              {shortDesc && (
                <p className="text-sm text-muted-foreground line-clamp-2">{shortDesc}</p>
              )}
            </div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {event.location_value && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" aria-hidden="true" />
                    {event.location_value}
                  </span>
                )}
                {regCount !== undefined && regCount > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" aria-hidden="true" />
                    {regCount} {regCount === 1 ? "participante" : "participantes"}
                  </span>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:gap-2.5 transition-all">
                {isPast ? "Ver detalhes" : "Inscrever-se"}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </span>
            </div>
          </CardContent>
        </div>
      </Card>
    </article>
  );
}

export default CompanyPage;
