import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, Layout, Columns2, Monitor,
  Loader2, Sparkles, MapPin, Video, Globe, Upload, X, PartyPopper, ExternalLink, Eye, Copy, Info
} from "lucide-react";
import { useCreateEvent, useUpdateEvent, useEvent } from "@/hooks/useEvents";
import TemplatePreview from "@/components/TemplatePreview";
import { useBulkInsertFormFields, useFormFields } from "@/hooks/useFormFields";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";

const steps = [
  { number: 1, title: "Detalhes do Evento", subtitle: "Nome, data, local e descrição" },
  { number: 2, title: "Identidade Visual", subtitle: "Template, imagem de capa e estilo" },
  { number: 3, title: "Formulário de Inscrição", subtitle: "Campos que os participantes preencherão" },
];

const imageRecommendations: Record<string, { ratio: string; size: string; tip: string }> = {
  minimal: { ratio: "16:9", size: "1920 × 1080px", tip: "Um banner largo funciona melhor — aparece no topo de um layout de coluna única." },
  split: { ratio: "3:4 ou 4:5", size: "1200 × 1600px", tip: "Orientação retrato — preenche a metade esquerda da tela ao lado do formulário." },
  landing: { ratio: "16:9", size: "1920 × 1080px", tip: "Banner hero em largura total — use uma foto de impacto ou flyer da marca." },
};

const templates = [
  { id: "minimal", name: "Minimal", icon: Layout, description: "Layout limpo de coluna única com sua imagem como banner no topo" },
  { id: "split", name: "Tela Dividida", icon: Columns2, description: "Imagem à esquerda, formulário de inscrição à direita" },
  { id: "landing", name: "Landing Page", icon: Monitor, description: "Imagem hero em largura total com formulário abaixo" },
];

const defaultFields = [
  { label: "Nome Completo", field_type: "text", required: true, position: 0 },
  { label: "Endereço de E-mail", field_type: "email", required: true, position: 1 },
  { label: "Empresa", field_type: "text", required: false, position: 2 },
  { label: "Cargo", field_type: "text", required: false, position: 3 },
];

const popularTimezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "GMT / London" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/Berlin", label: "Central European (CET)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Tokyo", label: "Japan (JST)" },
  { value: "Australia/Sydney", label: "Australia Eastern (AEST)" },
];

const allTimezones = [
  ...popularTimezones,
  { value: "Pacific/Honolulu", label: "Hawaii (HST)" },
  { value: "America/Anchorage", label: "Alaska (AKST)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Shanghai", label: "China (CST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Seoul", label: "Seoul (KST)" },
  { value: "Pacific/Auckland", label: "New Zealand (NZST)" },
];

const CreateEvent = () => {
  const { id: editId } = useParams<{ id?: string }>();
  const isEditMode = !!editId;
  const { data: existingEvent, isLoading: eventLoading } = useEvent(isEditMode ? editId : undefined);
  const { data: existingFields, isLoading: fieldsLoading } = useFormFields(isEditMode ? editId : undefined);

  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [eventType, setEventType] = useState("webinar");
  const [description, setDescription] = useState("");
  const [locationType, setLocationType] = useState<"virtual" | "physical" | "hybrid">("virtual");
  const [locationValue, setLocationValue] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [ticketPrice, setTicketPrice] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [capacity, setCapacity] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("split");
  const [fields, setFields] = useState(defaultFields);
  const [enhancing, setEnhancing] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [colorMode, setColorMode] = useState<"light" | "dark">("light");
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const navigate = useNavigate();
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const bulkInsertFields = useBulkInsertFormFields();
  const { data: profile } = useProfile();

  // Pre-populate form in edit mode
  useEffect(() => {
    if (isEditMode && existingEvent && !initialized) {
      setName(existingEvent.name);
      setDescription(existingEvent.description || "");
      setEventType(existingEvent.event_type || "webinar");
      setTimezone(existingEvent.timezone || "America/New_York");
      setSelectedTemplate(existingEvent.template || "split");
      setColorMode((existingEvent as any).color_mode === "light" ? "light" : "dark");
      setRequiresApproval(existingEvent.requires_approval || false);
      setCapacity(existingEvent.capacity ? String(existingEvent.capacity) : "");

      if (existingEvent.ticket_price && Number(existingEvent.ticket_price) > 0) {
        setIsPaid(true);
        setTicketPrice(String(existingEvent.ticket_price));
      }

      if (existingEvent.event_date) {
        const d = new Date(existingEvent.event_date);
        setStartDate(d.toISOString().split("T")[0]);
        setStartTime(d.toTimeString().slice(0, 5));
      }
      if (existingEvent.event_end_date) {
        const d = new Date(existingEvent.event_end_date);
        setEndDate(d.toISOString().split("T")[0]);
        setEndTime(d.toTimeString().slice(0, 5));
      }

      const lt = (existingEvent.location_type as "virtual" | "physical" | "hybrid") || "virtual";
      setLocationType(lt);
      if (lt === "virtual") {
        setLocationValue(existingEvent.location_value || "");
      } else if (lt === "physical") {
        setLocationAddress(existingEvent.location_value || "");
      } else if (lt === "hybrid" && existingEvent.location_value) {
        const parts = existingEvent.location_value.split(" | ");
        setLocationValue(parts[0] || "");
        setLocationAddress(parts[1] || "");
      }

      setFlyerUrl(existingEvent.background_image_url || null);
      setInitialized(true);
    }
  }, [isEditMode, existingEvent, initialized]);

  useEffect(() => {
    if (isEditMode && existingFields && existingFields.length > 0 && initialized) {
      setFields(existingFields.map(f => ({
        label: f.label,
        field_type: f.field_type,
        required: f.required,
        position: f.position,
      })));
    }
  }, [isEditMode, existingFields, initialized]);

  const handleFlyerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `flyers/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("event-assets").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("event-assets").getPublicUrl(path);
      setFlyerUrl(urlData.publicUrl);
      toast.success("Imagem enviada!");
    } catch (err: any) {
      toast.error(err.message || "Falha no envio");
    } finally {
      setUploading(false);
    }
  };

  const handleEnhance = async () => {
    if (!description.trim()) {
      toast.error("Escreva uma descrição primeiro, depois melhore com IA");
      return;
    }
    setEnhancing(true);
    try {
      const { data, error } = await supabase.functions.invoke("enhance-description", {
        body: { description, event_name: name, event_type: eventType },
      });
      if (error) throw error;
      if (data?.enhanced) {
        setDescription(data.enhanced);
        toast.success("Descrição melhorada!");
      }
    } catch (err: any) {
      toast.error(err.message || "Falha ao melhorar descrição");
    } finally {
      setEnhancing(false);
    }
  };

  const buildEventDate = (date: string, time: string) => {
    if (!date) return undefined;
    return time ? `${date}T${time}:00` : `${date}T00:00:00`;
  };

  const getLocationValue = () => {
    if (locationType === "virtual") return locationValue || undefined;
    if (locationType === "physical") return locationAddress || undefined;
    if (locationType === "hybrid") {
      const parts = [locationValue, locationAddress].filter(Boolean);
      return parts.length ? parts.join(" | ") : undefined;
    }
    return undefined;
  };

  const handlePublish = async () => {
    if (!name.trim()) {
      toast.error("O nome do evento é obrigatório");
      return;
    }
    try {
      const eventData = {
        name,
        description: description || undefined,
        event_date: buildEventDate(startDate, startTime),
        event_end_date: buildEventDate(endDate, endTime),
        timezone,
        event_type: eventType,
        template: selectedTemplate,
        location_type: locationType,
        location_value: getLocationValue(),
        ticket_price: isPaid && ticketPrice ? parseFloat(ticketPrice) : undefined,
        requires_approval: requiresApproval,
        capacity: capacity ? parseInt(capacity) : undefined,
        background_image_url: flyerUrl || undefined,
        color_mode: colorMode,
      } as any;

      if (isEditMode && editId) {
        await updateEvent.mutateAsync({ id: editId, ...eventData } as any);
        const { data: oldFields } = await supabase.from("form_fields").select("id").eq("event_id", editId);
        if (oldFields && oldFields.length > 0) {
          await supabase.from("form_fields").delete().eq("event_id", editId);
        }
        if (fields.length > 0) {
          await bulkInsertFields.mutateAsync(fields.map(f => ({ ...f, event_id: editId })));
        }
        toast.success("Evento atualizado!");
        navigate(`/dashboard/events/${editId}`);
      } else {
        const event = await createEvent.mutateAsync(eventData);
        await bulkInsertFields.mutateAsync(fields.map(f => ({ ...f, event_id: event.id })));
        setCreatedEventId(event.id);
        setCreatedSlug(event.slug);
        setShowSuccess(true);
      }
    } catch (err: any) {
      toast.error(err.message || `Falha ao ${isEditMode ? "atualizar" : "criar"} evento`);
    }
  };

  const isPublishing = createEvent.isPending || updateEvent.isPending || bulkInsertFields.isPending;

  if (isEditMode && (eventLoading || fieldsLoading)) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  // ─── Success Screen ───
  if (showSuccess) {
    const regUrl = `${window.location.origin}/register/${createdSlug}`;
    return (
      <div className="max-w-xl mx-auto py-16">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center space-y-6"
        >
          <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center mx-auto">
            <PartyPopper className="w-10 h-10 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold mb-2">Seu evento está no ar! 🎉</h1>
            <p className="text-muted-foreground text-lg">
              <span className="font-semibold text-foreground">{name}</span> está pronto para receber inscrições.
            </p>
          </div>

          <Card className="text-left">
            <CardContent className="p-5 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">Link de Inscrição</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Input value={regUrl} readOnly className="text-sm bg-muted/50" />
                  <Button
                    variant="outline"
                    size="icon"
                    className="shrink-0"
                    onClick={() => { navigator.clipboard.writeText(regUrl); toast.success("Link copiado!"); }}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <p className="text-muted-foreground text-xs mb-0.5">Template</p>
                  <p className="font-medium capitalize">{selectedTemplate}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <p className="text-muted-foreground text-xs mb-0.5">Campos</p>
                  <p className="font-medium">{fields.length} campos</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <p className="text-muted-foreground text-xs mb-0.5">Local</p>
                  <p className="font-medium capitalize">{locationType}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/40 border border-border">
                  <p className="text-muted-foreground text-xs mb-0.5">Capacidade</p>
                  <p className="font-medium">{capacity || "Ilimitada"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Button className="bg-primary" onClick={() => navigate(`/dashboard/events/${createdEventId}`)}>
              <Eye className="w-4 h-4 mr-2" /> Ver Painel do Evento
            </Button>
            <Button variant="outline" asChild>
              <a href={regUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" /> Ver Página de Inscrição
              </a>
            </Button>
          </div>

          <Button variant="ghost" className="text-muted-foreground" onClick={() => navigate("/dashboard/events")}>
            ← Voltar para todos os eventos
          </Button>
        </motion.div>
      </div>
    );
  }

  // ─── Completeness helpers ───
  const step1Complete = name.trim().length > 0;
  const step2Complete = !!selectedTemplate;

  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" className="mb-0" onClick={() => navigate(isEditMode ? `/dashboard/events/${editId}` : "/dashboard/events")}>
        <ArrowLeft className="w-4 h-4 mr-2" /> {isEditMode ? "Back to Event" : "Back to Events"}
      </Button>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold">{isEditMode ? "Edit Event" : "Create Your Event"}</h1>
        <p className="text-muted-foreground mt-1">
          {isEditMode ? "Update your event details, template, and form fields." : "Three quick steps and you're live. Let's get started."}
        </p>
      </div>

      {/* ─── Progress Bar ─── */}
      <div className="space-y-3">
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />
        </div>

        {/* Step pills */}
        <div className="flex items-center gap-1 sm:gap-2">
          {steps.map((s) => {
            const isActive = s.number === step;
            const isDone = s.number < step;
            return (
              <button
                key={s.number}
                onClick={() => {
                  if (isDone) { setStep(s.number); window.scrollTo(0, 0); }
                }}
                disabled={!isDone && !isActive}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all flex-1 min-w-0 ${
                  isActive
                    ? "bg-primary/10 border border-primary/30"
                    : isDone
                    ? "bg-muted/50 border border-border cursor-pointer hover:bg-muted"
                    : "bg-transparent border border-transparent opacity-50"
                }`}
              >
                <div className={`w-7 h-7 min-w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isDone
                    ? "bg-green-500/20 text-green-400"
                    : isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {isDone ? <Check className="w-3.5 h-3.5" /> : s.number}
                </div>
                <div className="hidden sm:block min-w-0">
                  <p className={`text-xs font-semibold truncate ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{s.title}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.subtitle}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Step Content ─── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
        >
          {/* Step 1: Event Details */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Section: Basic Info */}
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-0.5">Informações Básicas</h3>
                    <p className="text-xs text-muted-foreground">Como se chama seu evento e de que tipo é?</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="event-name">Nome do Evento <span className="text-destructive">*</span></Label>
                    <Input id="event-name" placeholder="ex.: Lançamento de Produto 2026" value={name} onChange={e => setName(e.target.value)} className="text-base" />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Evento</Label>
                      <Select value={eventType} onValueChange={setEventType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="webinar">Webinar</SelectItem>
                          <SelectItem value="conference">Conference</SelectItem>
                          <SelectItem value="workshop">Workshop</SelectItem>
                          <SelectItem value="meetup">Meetup</SelectItem>
                          <SelectItem value="launch">Lançamento de Produto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Organização</Label>
                      <Input value={profile?.company || ""} disabled className="bg-muted/50" placeholder="Defina nas Configurações" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section: Date & Time */}
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-0.5">Data e Horário</h3>
                    <p className="text-xs text-muted-foreground">Quando seu evento começa e termina?</p>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data de Início</Label>
                      <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário de Início</Label>
                      <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data de Término</Label>
                      <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário de Término</Label>
                      <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Fuso horário</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__popular_header" disabled className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Populares</SelectItem>
                        {popularTimezones.map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                        <SelectItem value="__all_header" disabled className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-2">Todos os fusos</SelectItem>
                        {allTimezones.filter(tz => !popularTimezones.find(p => p.value === tz.value)).map(tz => (
                          <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {/* Section: Location */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-0.5">Local</h3>
                    <p className="text-xs text-muted-foreground">Onde seu evento vai acontecer?</p>
                  </div>
                   <div className="flex flex-wrap gap-2">
                    {([
                      { value: "virtual", label: "Virtual", icon: Video },
                      { value: "physical", label: "Presencial", icon: MapPin },
                      { value: "hybrid", label: "Hybrid", icon: Globe },
                    ] as const).map(opt => (
                      <Button
                        key={opt.value}
                        type="button"
                        variant={locationType === opt.value ? "default" : "outline"}
                        size="sm"
                        className={locationType === opt.value ? "bg-primary" : ""}
                        onClick={() => setLocationType(opt.value)}
                      >
                        <opt.icon className="w-4 h-4 mr-1" /> {opt.label}
                      </Button>
                    ))}
                  </div>
                  {(locationType === "virtual" || locationType === "hybrid") && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Link da Reunião (Zoom, Google Meet, etc.)</Label>
                      <Input placeholder="https://zoom.us/j/..." value={locationValue} onChange={e => setLocationValue(e.target.value)} />
                    </div>
                  )}
                  {(locationType === "physical" || locationType === "hybrid") && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Endereço</Label>
                      <Input placeholder="Rua Principal 123, Cidade, Estado" value={locationAddress} onChange={e => setLocationAddress(e.target.value)} />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Section: Description */}
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-display font-semibold text-base mb-0.5">Descrição</h3>
                      <p className="text-xs text-muted-foreground">Diga aos participantes o que esperar. Use IA para aprimorar.</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-primary h-7 text-xs"
                      onClick={handleEnhance}
                      disabled={enhancing || !description.trim()}
                    >
                      {enhancing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                      Melhorar com IA
                    </Button>
                  </div>
                  <Textarea placeholder="Descreva brevemente seu evento — o que os participantes vão aprender, fazer ou experimentar?" rows={4} value={description} onChange={e => setDescription(e.target.value)} />
                </CardContent>
              </Card>

              {/* Section: Advanced Options */}
              <Card>
                <CardContent className="p-6 space-y-5">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-0.5">Opções</h3>
                    <p className="text-xs text-muted-foreground">Ingressos, aprovações e capacidade. Tudo opcional.</p>
                  </div>

                  {/* Company Info */}
                  <div className="p-4 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-semibold">Info da Empresa</Label>
                      <Link to="/dashboard/settings" className="text-xs text-primary hover:underline">Editar nas Configurações</Link>
                    </div>
                    {profile?.company ? (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{profile.company}</p>
                        {(profile as any).company_description && (
                          <p className="text-xs text-muted-foreground">{(profile as any).company_description}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhuma info de empresa definida. Adicione nas Configurações.</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Evento Pago?</Label>
                    <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                  </div>
                  {isPaid && (
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Preço do Ingresso (R$)</Label>
                      <Input type="number" min="0" step="0.01" placeholder="0.00" value={ticketPrice} onChange={e => setTicketPrice(e.target.value)} />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Requer Aprovação</Label>
                      <p className="text-xs text-muted-foreground">Aprovar manualmente cada inscrição</p>
                    </div>
                    <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
                  </div>

                  <div className="space-y-2">
                    <Label>Capacidade</Label>
                    <Input type="number" min="1" placeholder="Deixe vazio para ilimitado" value={capacity} onChange={e => setCapacity(e.target.value)} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 2: Branding */}
          {step === 2 && (
            <div className="space-y-5">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-0.5">Imagem de Capa</h3>
                    <p className="text-xs text-muted-foreground">Envie um flyer ou banner para a página do evento.</p>
                  </div>

                  {/* Image size recommendation */}
                  {imageRecommendations[selectedTemplate] && (
                    <div className="flex gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-medium text-foreground">
                         Recomendado para {templates.find(t => t.id === selectedTemplate)?.name}:
                          <span className="text-primary ml-1">{imageRecommendations[selectedTemplate].size}</span>
                          <span className="text-muted-foreground ml-1">({imageRecommendations[selectedTemplate].ratio})</span>
                        </p>
                        <p className="text-muted-foreground">{imageRecommendations[selectedTemplate].tip}</p>
                      </div>
                    </div>
                  )}

                  {flyerUrl ? (
                    <div className="relative inline-block">
                      <img src={flyerUrl} alt="Flyer" className="max-h-40 rounded-lg border border-border object-cover" />
                      <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-6 w-6 rounded-full" onClick={() => setFlyerUrl(null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center h-32 rounded-lg border-2 border-dashed border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                      {uploading ? <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /> : (
                        <>
                          <Upload className="w-6 h-6 text-muted-foreground mb-1" />
                          <span className="text-sm text-muted-foreground">Clique para enviar imagem</span>
                          <span className="text-xs text-muted-foreground/60">PNG, JPG up to 5MB</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFlyerUpload} disabled={uploading} />
                    </label>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-0.5">Pré-visualização</h3>
                    <p className="text-xs text-muted-foreground">Assim ficará sua página de inscrição.</p>
                  </div>
                  <div className="flex justify-center">
                    <TemplatePreview
                      template={selectedTemplate}
                      eventName={name}
                      description={description}
                      startDate={startDate}
                      startTime={startTime}
                      locationType={locationType}
                      locationValue={locationValue}
                      locationAddress={locationAddress}
                      flyerUrl={flyerUrl}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-0.5">Escolha um Template</h3>
                    <p className="text-xs text-muted-foreground">Escolha o layout da sua página pública de inscrição.</p>
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map((t) => (
                      <div
                        key={t.id}
                        className={`cursor-pointer rounded-xl p-4 text-center transition-all hover:shadow-md border-2 ${
                          selectedTemplate === t.id
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:border-muted-foreground/30"
                        }`}
                        onClick={() => setSelectedTemplate(t.id)}
                      >
                        <div className={`w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center ${
                          selectedTemplate === t.id ? "bg-primary" : "bg-muted"
                        }`}>
                          <t.icon className={`w-6 h-6 ${selectedTemplate === t.id ? "text-primary-foreground" : "text-muted-foreground"}`} />
                        </div>
                        <h3 className="font-semibold text-sm mb-0.5">{t.name}</h3>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-0.5">Modo de Cor</h3>
                    <p className="text-xs text-muted-foreground">Tema claro ou escuro para sua página de inscrição.</p>
                  </div>
                  <div className="flex gap-2">
                    {(["light", "dark"] as const).map((mode) => (
                      <Button
                        key={mode}
                        type="button"
                        variant={colorMode === mode ? "default" : "outline"}
                        size="sm"
                        className={colorMode === mode ? "bg-primary" : ""}
                        onClick={() => setColorMode(mode)}
                      >
                        {mode === "light" ? "☀️ Claro" : "🌙 Escuro"}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Step 3: Form Fields */}
          {step === 3 && (
            <div className="space-y-5">
              <Card>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-display font-semibold text-base mb-0.5">Campos do Formulário de Inscrição</h3>
                    <p className="text-xs text-muted-foreground">Estes são os campos que os participantes preencherão ao se inscrever. Campos obrigatórios estão marcados.</p>
                  </div>
                  <div className="space-y-3">
                    {fields.map((field, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-8 rounded-full bg-primary/40" />
                          <div>
                            <p className="text-sm font-medium">{field.label}</p>
                            <p className="text-xs text-muted-foreground capitalize">{field.field_type}</p>
                          </div>
                        </div>
                        <Badge className={field.required ? "bg-primary text-primary-foreground text-xs" : "bg-muted text-muted-foreground border-0 text-xs"}>
                          {field.required ? "Obrigatório" : "Opcional"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Review summary */}
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="p-6 space-y-3">
                  <h3 className="font-display font-semibold text-base">Pronto para publicar?</h3>
                  <p className="text-sm text-muted-foreground">Veja o resumo do seu evento:</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Evento</p>
                      <p className="font-medium truncate">{name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Tipo</p>
                      <p className="font-medium capitalize">{eventType}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Data</p>
                      <p className="font-medium">{startDate || "Não definida"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Local</p>
                      <p className="font-medium capitalize">{locationType === "virtual" ? "Virtual" : locationType === "physical" ? "Presencial" : "Híbrido"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Template</p>
                      <p className="font-medium capitalize">{selectedTemplate}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Campos</p>
                      <p className="font-medium">{fields.length} campos ({fields.filter(f => f.required).length} obrigatórios)</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ─── Navigation Footer ─── */}
      <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2 pb-8">
        <Button variant="outline" className="w-full sm:w-auto" onClick={() => { if (step > 1) { setStep(step - 1); window.scrollTo(0, 0); } }} disabled={step === 1}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
        <div className="flex items-center gap-3">
          {step < 3 ? (
            <Button className="bg-primary w-full sm:w-auto" onClick={() => { setStep(step + 1); window.scrollTo(0, 0); }} disabled={step === 1 && !step1Complete}>
              Próximo: {steps[step]?.title} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button className="bg-primary px-6 w-full sm:w-auto" onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isEditMode ? "Salvando…" : "Publicando…"}</>
              ) : (
                <>{isEditMode ? "Salvar Alterações" : "Publicar Evento"} <Check className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateEvent;
