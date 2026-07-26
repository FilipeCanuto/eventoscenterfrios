import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listEventsTool from "./tools/list-events";
import getEventStatsTool from "./tools/get-event-stats";
import listRegistrationsTool from "./tools/list-registrations";
import checkInRegistrationTool from "./tools/check-in-registration";

// The OAuth issuer must be the direct Supabase host, built from the project ref
// (inlined by Vite at build time so the module stays import-safe).
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "centerfrios-eventos-mcp",
  title: "Centerfrios Eventos",
  version: "0.1.0",
  instructions:
    "Ferramentas para a plataforma de eventos Centerfrios. Use `list_events` para encontrar eventos, `get_event_stats` para o resumo de inscrições e presenças, `list_registrations` para consultar inscritos (busca por nome, e-mail ou WhatsApp) e `check_in_registration` para registrar a presença de um inscrito. Todas as ações são executadas como o usuário conectado.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listEventsTool, getEventStatsTool, listRegistrationsTool, checkInRegistrationTool],
});
