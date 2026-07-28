// Integração com o Make (Google Sheets).
// A URL do webhook fica somente no servidor (edge function `sheets-forward`),
// nunca no bundle do navegador.
import { supabase } from "@/integrations/supabase/client";

export interface SheetsPayload {
  nome: string;
  whatsapp: string;
  email: string;
  segmento: string;
  vendedor?: string | null;
}

/**
 * Envia a inscrição para a planilha via edge function.
 * Fire-and-forget: nunca quebra o fluxo de inscrição.
 */
export async function enviarParaGoogleSheets(input: SheetsPayload): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("sheets-forward", {
      body: {
        nome: input.nome || "",
        whatsapp: input.whatsapp || "",
        email: input.email || "",
        segmento: input.segmento || "",
        vendedor: input.vendedor?.trim() || "Orgânico",
        status: "Pendente",
      },
    });
    if (error) {
      console.warn("[sheets-forward] falha ao enviar");
    }
  } catch {
    console.warn("[sheets-forward] falha ao enviar");
  }
}
