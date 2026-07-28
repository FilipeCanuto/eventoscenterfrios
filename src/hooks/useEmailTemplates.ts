import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TemplateType = "confirmation" | "reminder_1d" | "reminder_2h";

export const TEMPLATE_META: { type: TemplateType; label: string; description: string }[] = [
  { type: "confirmation", label: "Confirmação de inscrição", description: "Enviado imediatamente após a inscrição." },
  { type: "reminder_1d", label: "Lembrete — 1 dia antes", description: "Contagem regressiva e QR Code." },
  { type: "reminder_2h", label: "Lembrete — 2 horas antes", description: "QR Code grande para check-in." },
];

export const DEFAULT_TEMPLATES: Record<TemplateType, { subject: string; body: string }> = {
  confirmation: {
    subject: "Inscrição confirmada — {{evento}}",
    body: [
      "<p>Olá, {{nome}}!</p>",
      "<p>Recebemos a sua inscrição em <strong>{{evento}}</strong>. Guarde este e-mail — ele é a sua confirmação.</p>",
      "<p><strong>Quando:</strong> {{data}} às {{horario}}<br/><strong>Local:</strong> {{local}}</p>",
      "{{qr_code}}",
      "<p>Adicione o evento à sua agenda e fique de olho nesta caixa de entrada — enviaremos lembretes próximos da data.</p>",
    ].join("\n"),
  },
  reminder_1d: {
    subject: "Amanhã é o dia! Tudo pronto para {{evento}}?",
    body: [
      "<p>Olá, {{nome}}!</p>",
      "<p><strong>Amanhã é o dia!</strong> Tudo pronto para <strong>{{evento}}</strong>?</p>",
      "<p><strong>Quando:</strong> {{data}} às {{horario}}<br/><strong>Local:</strong> {{local}}</p>",
      "{{qr_code}}",
    ].join("\n"),
  },
  reminder_2h: {
    subject: "Começa em 2h — seu QR Code está pronto para o check-in",
    body: [
      "<p>Olá, {{nome}}!</p>",
      "<p><strong>Começa em ~2 horas!</strong> Seu QR Code está pronto — basta apresentar este e-mail na entrada.</p>",
      "<p><strong>Local:</strong> {{local}}</p>",
      "{{qr_code}}",
      "<p>Chegue com alguns minutos de antecedência para fazer o check-in com tranquilidade.</p>",
    ].join("\n"),
  },
};

export const TEMPLATE_TAGS: { tag: string; label: string }[] = [
  { tag: "{{nome}}", label: "Nome do participante" },
  { tag: "{{evento}}", label: "Nome do evento" },
  { tag: "{{data}}", label: "Data" },
  { tag: "{{horario}}", label: "Horário" },
  { tag: "{{local}}", label: "Local" },
  { tag: "{{qr_code}}", label: "QR Code / ingresso" },
  { tag: "{{vendedor}}", label: "Vendedor responsável" },
];

export interface EmailTemplateRow {
  id: string;
  event_id: string;
  template_type: string;
  subject: string;
  body: string;
  enabled: boolean;
}

export function useEmailTemplates(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["email-templates", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<Record<string, EmailTemplateRow>> => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("id, event_id, template_type, subject, body, enabled")
        .eq("event_id", eventId!);
      if (error) throw error;
      const map: Record<string, EmailTemplateRow> = {};
      for (const row of (data || []) as any[]) map[row.template_type] = row;
      return map;
    },
  });
}

export function useSaveEmailTemplate(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { templateType: TemplateType; subject: string; body: string }) => {
      const { error } = await supabase
        .from("email_templates")
        .upsert(
          {
            event_id: eventId,
            template_type: input.templateType as any,
            subject: input.subject,
            body: input.body,
            enabled: true,
          },
          { onConflict: "event_id,template_type" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates", eventId] }),
  });
}

export function useResetEmailTemplate(eventId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateType: TemplateType) => {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("event_id", eventId)
        .eq("template_type", templateType as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-templates", eventId] }),
  });
}

export interface RenderedEmail {
  ok: boolean;
  snapshot?: boolean;
  subject: string;
  html: string;
  text?: string;
}

export async function renderEmail(payload: {
  registrationId?: string;
  eventId?: string;
  logId?: string;
  templateType?: TemplateType;
  draftSubject?: string;
  draftBody?: string;
}): Promise<RenderedEmail> {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const { data, error } = await supabase.functions.invoke("render-email-preview", {
    body: { ...payload, origin },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as RenderedEmail;
}

export async function sendTestEmail(payload: {
  eventId: string;
  templateType: TemplateType;
  subject: string;
  bodyHtml: string;
}) {
  const { data, error } = await supabase.functions.invoke("send-test-email", { body: payload });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as { ok: boolean; sentTo: string };
}
