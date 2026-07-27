// Integração com o Make (Google Sheets) — dispara um POST a cada inscrição finalizada.
const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/vbqt6ioh65pgy5yv9n55624rq6bvno73";

export interface SheetsPayload {
  nome: string;
  whatsapp: string;
  email: string;
  segmento: string;
  vendedor?: string | null;
}

function agoraBR(): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Envia a inscrição para o webhook do Make (planilha do Google Sheets).
 * Fire-and-forget: nunca quebra o fluxo de inscrição.
 */
export async function enviarParaGoogleSheets(input: SheetsPayload): Promise<void> {
  const body = {
    data: agoraBR(),
    nome: input.nome || "",
    whatsapp: input.whatsapp || "",
    email: input.email || "",
    segmento: input.segmento || "",
    vendedor: input.vendedor?.trim() || "Orgânico",
    status: "Pendente",
  };

  try {
    await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    // Fallback quando o webhook não devolve cabeçalhos CORS
    try {
      await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(body),
        keepalive: true,
      });
    } catch (e) {
      console.warn("[make-webhook] falha ao enviar", e);
    }
  }
}
