import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2, Trash2 } from "lucide-react";
import { useEvent, useUpdateEvent, useDeleteEvent } from "@/hooks/useEvents";
import { useFormFields, useAddFormField, useDeleteFormField } from "@/hooks/useFormFields";
import { toast } from "sonner";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import TemplatePreview from "@/components/TemplatePreview";
import EventDetailHeader from "@/components/event-detail/EventDetailHeader";
import EventQuickInfo from "@/components/event-detail/EventQuickInfo";
import EventAttendeesTable from "@/components/event-detail/EventAttendeesTable";
import EventQRCode from "@/components/event-detail/EventQRCode";
import RegistrationLinkBlock from "@/components/event-detail/RegistrationLinkBlock";
import EventLeadsTable from "@/components/event-detail/EventLeadsTable";

const EventDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: event, isLoading } = useEvent(id);
  const { data: formFields } = useFormFields(id);
  const updateEvent = useUpdateEvent();
  const deleteEvent = useDeleteEvent();
  const addField = useAddFormField();
  const deleteField = useDeleteFormField();
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");
  const [newFieldOptions, setNewFieldOptions] = useState("");

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  if (!event) {
    return <div className="text-center py-20"><p className="text-muted-foreground">Evento não encontrado.</p></div>;
  }

  const handleStatusChange = async (status: "draft" | "live" | "past") => {
    const statusLabels: Record<string, string> = { draft: "rascunho", live: "ativo", past: "encerrado" };
    await updateEvent.mutateAsync({ id: event.id, status });
    toast.success(`Evento agora está ${statusLabels[status]}`);
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja excluir este evento?")) return;
    await deleteEvent.mutateAsync(event.id);
    toast.success("Evento excluído");
    navigate("/dashboard/events");
  };

  const handleUpdate = (fields: any) => {
    updateEvent.mutate({ id: event.id, ...fields });
  };

  const handleAddField = async () => {
    if (!newFieldLabel.trim()) return;
    let options: string[] | null = null;
    if (newFieldType === "select" || newFieldType === "multiselect") {
      options = newFieldOptions.split("\n").map(o => o.trim()).filter(Boolean);
      if (options.length < 2) {
        toast.error("Adicione pelo menos 2 opções (uma por linha).");
        return;
      }
    }
    await addField.mutateAsync({
      event_id: event.id,
      label: newFieldLabel,
      field_type: newFieldType,
      required: false,
      position: (formFields?.length ?? 0),
      ...(options ? { options } as any : {}),
    });
    setNewFieldLabel("");
    setNewFieldOptions("");
    toast.success("Campo adicionado");
  };

  return (
    <div className="space-y-6">
      <EventDetailHeader event={event} onStatusChange={handleStatusChange} onDelete={handleDelete} />
      <EventQuickInfo event={event} onUpdate={handleUpdate} />
      <RegistrationLinkBlock slug={event.slug} eventName={event.name} />

      <Tabs defaultValue="branding">
        <TabsList className="bg-muted rounded-full p-1 w-full sm:w-auto">
          <TabsTrigger value="branding" className="flex-1 sm:flex-initial rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm">Identidade visual</TabsTrigger>
          <TabsTrigger value="form" className="flex-1 sm:flex-initial rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm">Formulário</TabsTrigger>
          <TabsTrigger value="leads" className="flex-1 sm:flex-initial rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm">Leads</TabsTrigger>
          <TabsTrigger value="settings" className="flex-1 sm:flex-initial rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-5 space-y-5">
          <div className="bg-card rounded-xl p-5 sm:p-6 space-y-4">
            <h3 className="font-display font-semibold">Personalização da marca</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cor principal</Label>
                <div className="flex gap-2">
                  <input type="color" defaultValue={event.primary_color || "#7C3AED"} className="w-10 h-10 rounded-xl border border-border cursor-pointer" onChange={e => handleUpdate({ primary_color: e.target.value })} />
                  <Input defaultValue={event.primary_color || "#7C3AED"} readOnly className="rounded-full" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Template</Label>
                <Select defaultValue={event.template || "split"} onValueChange={v => handleUpdate({ template: v })}>
                  <SelectTrigger className="rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="split">Tela dividida</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                    <SelectItem value="landing">Landing page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Modo de cor</Label>
              <div className="flex gap-2">
                {(["light", "dark"] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    variant={(event as any).color_mode === mode || (!((event as any).color_mode) && mode === "light") ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => handleUpdate({ color_mode: mode })}
                  >
                    {mode === "light" ? "☀️ Claro" : "🌙 Escuro"}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-card rounded-xl p-5 sm:p-6">
              <Label className="mb-3 block">Pré-visualização</Label>
              <div className="flex justify-center">
                <TemplatePreview
                  template={event.template || "split"}
                  eventName={event.name}
                  description={event.description || ""}
                  startDate={event.event_date ? new Date(event.event_date).toISOString().split("T")[0] : ""}
                  startTime={event.event_date ? new Date(event.event_date).toTimeString().slice(0, 5) : ""}
                  locationType={(event.location_type as "virtual" | "physical" | "hybrid") || "virtual"}
                  locationValue={event.location_value || ""}
                  locationAddress=""
                  flyerUrl={event.background_image_url}
                />
              </div>
            </div>
            <EventQRCode
              registrationUrl={`${window.location.origin}/register/${event.slug}`}
              eventName={event.name}
            />
          </div>
        </TabsContent>

        <TabsContent value="form" className="mt-5">
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="bg-card rounded-xl p-5 sm:p-6 space-y-4">
              <h3 className="font-display font-semibold">Campos do formulário</h3>
              {formFields?.map((field) => (
                <div key={field.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{field.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">({field.field_type})</span>
                    {(field.field_type === "select" || field.field_type === "multiselect") && Array.isArray((field as any).options) && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        Opções: {((field as any).options as string[]).join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-xs rounded-full">{field.required ? "Obrigatório" : "Opcional"}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteField.mutate({ id: field.id, eventId: event.id })}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input placeholder="Nome do campo" value={newFieldLabel} onChange={e => setNewFieldLabel(e.target.value)} className="flex-1 rounded-full" />
                  <Select value={newFieldType} onValueChange={setNewFieldType}>
                    <SelectTrigger className="w-full sm:w-32 rounded-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="email">E-mail</SelectItem>
                      <SelectItem value="tel">Telefone</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                  <SelectItem value="select">Lista (dropdown)</SelectItem>
                      <SelectItem value="multiselect">Caixas de seleção</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={handleAddField} className="rounded-full">Adicionar</Button>
                </div>
                {(newFieldType === "select" || newFieldType === "multiselect") && (
                  <Textarea
                    placeholder="Opções (uma por linha)&#10;Ex.:&#10;Supermercado&#10;Açougue&#10;Restaurante"
                    value={newFieldOptions}
                    onChange={e => setNewFieldOptions(e.target.value)}
                    className="rounded-xl min-h-[100px]"
                  />
                )}
              </div>
            </div>
            <div className="bg-muted/30 rounded-xl p-5 sm:p-6">
              <h3 className="font-display font-semibold mb-4">Pré-visualização</h3>
              <div className="bg-card rounded-xl p-4 sm:p-6 space-y-4">
                <h4 className="text-lg font-semibold">{event.name}</h4>
                <p className="text-sm text-muted-foreground">{event.description || "Sem descrição"}</p>
                {formFields?.map((f) => (
                  <div key={f.id} className="space-y-1">
                    <Label className="text-xs">{f.label}{f.required && " *"}</Label>
                    <Input placeholder={f.placeholder || f.label} disabled className="bg-muted/50 rounded-full" />
                  </div>
                ))}
                <Button className="w-full rounded-full" disabled>Inscrever-se</Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leads" className="mt-5">
          <EventLeadsTable eventId={event.id} />
        </TabsContent>

        <TabsContent value="settings" className="mt-5">
          <div className="bg-card rounded-xl p-5 sm:p-6 space-y-4">
            <h3 className="font-display font-semibold">Configurações do evento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Limite de inscrições</Label>
                <Input type="number" placeholder="Ilimitado" defaultValue={event.registration_limit ?? ""} onBlur={e => handleUpdate({ registration_limit: e.target.value ? parseInt(e.target.value) : null })} className="rounded-full" />
              </div>
              <div className="space-y-2">
                <Label>Prazo de inscrição</Label>
                <Input type="date" defaultValue={event.registration_deadline?.split("T")[0] || ""} onBlur={e => handleUpdate({ registration_deadline: e.target.value || null })} className="rounded-full" />
              </div>
            </div>
            <Button variant="destructive" size="sm" className="mt-4 rounded-full" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Excluir evento
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <EventAttendeesTable eventId={event.id} eventName={event.name} />
    </div>
  );
};

export default EventDetail;
