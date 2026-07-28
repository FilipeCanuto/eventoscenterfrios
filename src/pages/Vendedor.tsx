import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, CheckCircle2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { enviarParaGoogleSheets } from "@/lib/makeWebhook";
import { supabase } from "@/integrations/supabase/client";
import VendedorDashboard from "@/components/vendedor/VendedorDashboard";
import { useEventFavicon } from "@/hooks/useEventFavicon";

const VENDEDORES = [
  "Carla",
  "Clara",
  "Clarice",
  "Euclides",
  "Filipe",
  "Humberto",
  "Jackelline",
  "Júlio",
  "Maria",
  "Neide",
  "Rafaela",
  "Ricardo",
  "Rosângela",
  "Willames",
];

const SEGMENTOS = [
  "Restaurante",
  "Padaria / Confeitaria",
  "Açougue / Frigorífico",
  "Supermercado",
  "Indústria de Alimentos",
  "Food Service / Buffet",
  "Distribuidor / Revenda",
  "Outro",
];

const EVENT_SLUG = "vacuo_em_acao";
const SELLER_KEY = "vendedor:nome";
const COUNT_KEY = "vendedor:contador";

function hojeKey() {
  return new Date().toISOString().slice(0, 10);
}

function lerContador(vendedor: string): number {
  try {
    const raw = JSON.parse(localStorage.getItem(COUNT_KEY) || "{}");
    const item = raw?.[vendedor];
    if (item && item.dia === hojeKey()) return Number(item.total) || 0;
  } catch {
    /* ignore */
  }
  return 0;
}

function salvarContador(vendedor: string, total: number) {
  try {
    const raw = JSON.parse(localStorage.getItem(COUNT_KEY) || "{}");
    raw[vendedor] = { dia: hojeKey(), total };
    localStorage.setItem(COUNT_KEY, JSON.stringify(raw));
  } catch {
    /* ignore */
  }
}

const emptyForm = { nome: "", whatsapp: "", email: "", segmento: "" };

export default function Vendedor() {
  const [vendedor, setVendedor] = useState<string | null>(null);
  useEventFavicon({ slug: EVENT_SLUG });
  const [escolha, setEscolha] = useState("");
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [enviando, setEnviando] = useState(false);
  const [aba, setAba] = useState<"cadastro" | "painel">("cadastro");
  const [eventId, setEventId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    document.title = "Cadastro rápido | Workshop Vácuo em Ação";
    const salvo = localStorage.getItem(SELLER_KEY);
    if (salvo) {
      setVendedor(salvo);
      setTotal(lerContador(salvo));
    }
    supabase
      .from("events")
      .select("id")
      .eq("slug", EVENT_SLUG)
      .eq("status", "live")
      .maybeSingle()
      .then(({ data }) => setEventId(data?.id ?? null));
  }, []);

  // Sincroniza o contador com o número real de cadastros de hoje no banco.
  const sincronizarTotal = useCallback(
    async (nome: string) => {
      const { data } = await supabase.rpc("public_vendedor_stats" as never, {
        p_vendedor: nome,
      } as never);
      const hoje = (data as { hoje?: number } | null)?.hoje;
      if (typeof hoje === "number") {
        setTotal(hoje);
        salvarContador(nome, hoje);
      }
    },
    [],
  );

  useEffect(() => {
    if (!vendedor) return;
    sincronizarTotal(vendedor);
  }, [vendedor, refreshKey, aba, sincronizarTotal]);

  const nomeFinal = useMemo(() => escolha.trim(), [escolha]);


  function identificar() {
    if (!nomeFinal) return;
    localStorage.setItem(SELLER_KEY, nomeFinal);
    setVendedor(nomeFinal);
    setTotal(lerContador(nomeFinal));
  }

  function alterarVendedor() {
    localStorage.removeItem(SELLER_KEY);
    setVendedor(null);
    setEscolha("");
    setAba("cadastro");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendedor) return;
    if (!form.nome.trim() || !form.whatsapp.trim()) {
      toast.error("Preencha ao menos nome e WhatsApp.");
      return;
    }
    setEnviando(true);
    let avisoDuplicado = false;

    // Snapshot exato do que o vendedor digitou + vendedor logado (localStorage)
    const vendedorAtual = localStorage.getItem(SELLER_KEY) || vendedor;
    const payload = {
      nome: form.nome.trim(),
      whatsapp: form.whatsapp.trim(),
      email: form.email.trim(),
      segmento: form.segmento,
      vendedor: vendedorAtual,
    };

    try {
      // 1) Webhook do Make sempre primeiro (nunca depende do banco)
      await enviarParaGoogleSheets(payload);

      // 2) Grava no evento (falha aqui não impede a planilha)
      if (eventId) {
        const { error } = await supabase.rpc("register_for_event", {
          p_event_id: eventId,
          p_data: {
            "Nome Completo": payload.nome,
            "Endereço de E-mail": payload.email,
            WhatsApp: payload.whatsapp,
            Segmento: payload.segmento,
          },
          p_tracking: { vendedor: vendedorAtual, origem: "vendedor" },
        });
        if (error && /already registered|maximum number/i.test(error.message)) {
          avisoDuplicado = true;
        } else if (error) {
          console.warn("[vendedor] falha ao gravar inscrição", error.message);
        }
      }

      const novo = total + 1;
      setTotal(novo);
      salvarContador(vendedor, novo);
      setForm(emptyForm);
      setRefreshKey((k) => k + 1);

      if (avisoDuplicado) {
        toast.warning("Cliente já estava inscrito — enviado para a planilha mesmo assim.", {
          duration: 5000,
        });
      } else {
        toast.success(`Cliente cadastrado com sucesso! (${novo} hoje)`, {
          duration: 4000,
          className: "!bg-emerald-600 !text-white !border-emerald-600",
          icon: <CheckCircle2 className="w-5 h-5" />,
        });
      }
      document.getElementById("campo-nome")?.focus();
    } catch {
      toast.error("Não foi possível enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (!vendedor) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#12151C] px-4">
        <div
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            background:
              "radial-gradient(60% 50% at 20% 0%, #0B2341 0%, transparent 60%), radial-gradient(50% 40% at 90% 100%, rgba(230,176,18,0.18) 0%, transparent 65%)",
          }}
        />
        <div className="relative w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#E6B012]/15 flex items-center justify-center">
            <UserRound className="w-7 h-7 text-[#E6B012]" />
          </div>
          <div className="space-y-1">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[#E6B012]">
              Workshop Vácuo em Ação
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Quem é você?</h1>
            <p className="text-sm text-white/55">
              Selecione seu nome para começar os cadastros.
            </p>
          </div>
          <Select value={escolha} onValueChange={setEscolha}>
            <SelectTrigger className="h-11 rounded-full bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Selecione o vendedor" />
            </SelectTrigger>
            <SelectContent>
              {VENDEDORES.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            className="w-full h-11 rounded-full bg-[#E6B012] text-[#12151C] hover:bg-[#d3a20f]"
            disabled={!nomeFinal}
            onClick={identificar}
          >
            Continuar
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#12151C]">
      <header className="sticky top-0 z-40 bg-[#12151C]/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-md flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[#E6B012]">
              Vácuo em Ação
            </p>
            <p className="text-sm font-semibold truncate text-white">Vendedor: {vendedor}</p>
            <p className="text-xs text-white/50">
              Você cadastrou {total} {total === 1 ? "cliente" : "clientes"} hoje
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-xs shrink-0 text-white/70 hover:text-white hover:bg-white/10"
            onClick={alterarVendedor}
          >
            Alterar vendedor
          </Button>
        </div>
        <div className="mx-auto max-w-md mt-3 grid grid-cols-2 gap-1 p-1 rounded-full bg-white/5">
          {(["cadastro", "painel"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setAba(t)}
              className={`h-9 rounded-full text-sm font-medium transition-colors ${
                aba === t ? "bg-[#E6B012] text-[#12151C]" : "text-white/60"
              }`}
            >
              {t === "cadastro" ? "Cadastrar" : "Meu painel"}
            </button>
          ))}
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 py-6 pb-16">
        {aba === "painel" ? (
          <VendedorDashboard key={refreshKey} vendedor={vendedor} />
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight mb-6 text-white">
              Cadastro rápido
            </h1>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="campo-nome" className="text-white/70">
                  Nome do cliente
                </Label>
                <Input
                  id="campo-nome"
                  className="h-11 rounded-full bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Nome completo"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campo-whats" className="text-white/70">
                  WhatsApp
                </Label>
                <Input
                  id="campo-whats"
                  className="h-11 rounded-full bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  inputMode="tel"
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  placeholder="(82) 99999-9999"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="campo-email" className="text-white/70">
                  E-mail
                </Label>
                <Input
                  id="campo-email"
                  type="email"
                  className="h-11 rounded-full bg-white/5 border-white/10 text-white placeholder:text-white/30"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="cliente@empresa.com"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/70">Segmento de atuação</Label>
                <Select
                  value={form.segmento}
                  onValueChange={(v) => setForm({ ...form, segmento: v })}
                >
                  <SelectTrigger className="h-11 rounded-full bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="Selecione o segmento" />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENTOS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-full bg-[#E6B012] text-[#12151C] hover:bg-[#d3a20f] font-semibold"
                disabled={enviando}
              >
                {enviando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…
                  </>
                ) : (
                  "Cadastrar cliente"
                )}
              </Button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
