import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle2, XCircle, Clock, Camera, Loader2, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type ScanStatus =
  | "success"
  | "already_checked_in"
  | "cancelled"
  | "not_found"
  | "outside_window"
  | "error";

type ScanResult = {
  status: ScanStatus;
  name?: string | null;
  event_name?: string | null;
};

const READER_ID = "qr-reader";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function extrairId(texto: string): string | null {
  return texto.match(UUID_RE)?.[0] ?? null;
}

const LABELS: Record<ScanStatus, { titulo: string; detalhe: string }> = {
  success: { titulo: "Check-in realizado", detalhe: "Presença registrada com sucesso." },
  already_checked_in: { titulo: "Já fez check-in", detalhe: "Esta inscrição já estava confirmada." },
  cancelled: { titulo: "Inscrição cancelada", detalhe: "Procure a equipe organizadora." },
  not_found: { titulo: "QR Code inválido", detalhe: "Nenhuma inscrição encontrada para este código." },
  outside_window: { titulo: "Fora do horário", detalhe: "O check-in ainda não está liberado para este evento." },
  error: { titulo: "Erro na leitura", detalhe: "Tente novamente em instantes." },
};

export default function CheckInScanner() {
  const [ativo, setAtivo] = useState(false);
  const [iniciando, setIniciando] = useState(false);
  const [erroCamera, setErroCamera] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [resultado, setResultado] = useState<ScanResult | null>(null);
  const [totalLidos, setTotalLidos] = useState(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const ultimoRef = useRef<{ id: string; at: number } | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    document.title = "Check-in por QR Code";
  }, []);

  const processar = useCallback(async (texto: string) => {
    const id = extrairId(texto);
    if (!id) {
      setResultado({ status: "not_found" });
      return;
    }
    const agora = Date.now();
    if (ultimoRef.current && ultimoRef.current.id === id && agora - ultimoRef.current.at < 5000) {
      return;
    }
    ultimoRef.current = { id, at: agora };

    setProcessando(true);
    try {
      const { data, error } = await supabase.rpc("public_check_in_scan" as never, {
        p_registration_id: id,
      } as never);
      if (error) throw error;
      const r = (data as unknown as ScanResult) ?? { status: "error" as const };
      setResultado(r);
      if (r.status === "success") {
        setTotalLidos((n) => n + 1);
        try {
          navigator.vibrate?.(120);
        } catch {
          /* ignore */
        }
      }
    } catch (e) {
      console.error("[checkin] erro", e);
      setResultado({ status: "error" });
    } finally {
      setProcessando(false);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setResultado(null), 2800);
    }
  }, []);

  const iniciar = useCallback(async () => {
    setErroCamera(null);
    setIniciando(true);
    try {
      const scanner = new Html5Qrcode(READER_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (texto) => {
          void processar(texto);
        },
        () => {
          /* leituras sem sucesso são normais */
        },
      );
      setAtivo(true);
    } catch (e) {
      console.error("[checkin] câmera", e);
      setErroCamera(
        "Não foi possível acessar a câmera. Verifique a permissão do navegador e tente novamente.",
      );
    } finally {
      setIniciando(false);
    }
  }, [processar]);

  const parar = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    setAtivo(false);
    if (!scanner) return;
    try {
      await scanner.stop();
      scanner.clear();
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      }
    };
  }, []);

  const sucesso = resultado?.status === "success";
  const aviso = resultado?.status === "already_checked_in" || resultado?.status === "outside_window";

  return (
    <main className="min-h-screen bg-[#12151C] text-white">
      <header className="sticky top-0 z-40 bg-[#12151C]/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-md flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#E6B012]">Center Frios</p>
            <h1 className="text-sm font-semibold truncate">Check-in por QR Code</h1>
          </div>
          <span className="text-xs text-white/50 shrink-0">{totalLidos} check-ins</span>
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 py-6 space-y-5">
        <div className="relative rounded-3xl overflow-hidden bg-black/40 ring-1 ring-white/10 aspect-square">
          <div id={READER_ID} className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />

          {!ativo && !iniciando && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[#E6B012]/15 flex items-center justify-center">
                <QrCode className="w-7 h-7 text-[#E6B012]" />
              </div>
              <p className="text-sm text-white/60">
                Aponte a câmera para o QR Code do participante.
              </p>
            </div>
          )}

          {iniciando && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-white/60" />
            </div>
          )}

          {processando && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-[#E6B012]" />
            </div>
          )}

          {resultado && !processando && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center animate-in fade-in zoom-in-95 duration-200 ${
                sucesso ? "bg-emerald-600/95" : aviso ? "bg-amber-500/95" : "bg-red-600/95"
              }`}
            >
              {sucesso ? (
                <CheckCircle2 className="w-16 h-16 text-white" />
              ) : aviso ? (
                <Clock className="w-16 h-16 text-white" />
              ) : (
                <XCircle className="w-16 h-16 text-white" />
              )}
              <p className="text-2xl font-semibold leading-tight text-white">
                {resultado.name || LABELS[resultado.status].titulo}
              </p>
              <p className="text-sm text-white/90">
                {resultado.name ? LABELS[resultado.status].titulo : LABELS[resultado.status].detalhe}
              </p>
              {resultado.event_name && (
                <p className="text-xs text-white/70">{resultado.event_name}</p>
              )}
            </div>
          )}
        </div>

        {erroCamera && <p className="text-sm text-red-400 text-center">{erroCamera}</p>}

        {ativo ? (
          <Button
            variant="ghost"
            className="w-full h-11 rounded-full text-white/70 hover:text-white hover:bg-white/10"
            onClick={parar}
          >
            Parar leitura
          </Button>
        ) : (
          <Button
            className="w-full h-11 rounded-full bg-[#E6B012] text-[#12151C] hover:bg-[#d3a20f]"
            onClick={iniciar}
            disabled={iniciando}
          >
            <Camera className="w-4 h-4 mr-2" />
            {iniciando ? "Abrindo câmera..." : "Iniciar leitura"}
          </Button>
        )}

        <p className="text-center text-xs text-white/45">
          Sem QR Code em mãos?{" "}
          <Link to="/checkin-rapido" className="text-[#E6B012] underline underline-offset-2">
            Fazer check-in pelo e-mail
          </Link>
        </p>
      </section>
    </main>
  );
}
