import { useEffect, useMemo, useState } from "react";
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

const VENDEDORES = ["João", "Maria", "Pedro", "Ana", "Carlos", "Juliana"];

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
  const [escolha, setEscolha] = useState("");
  const [outro, setOutro] = useState("");
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    document.title = "Cadastro rápido | Equipe comercial";
    const salvo = localStorage.getItem(SELLER_KEY);
    if (salvo) {
      setVendedor(salvo);
      setTotal(lerContador(salvo));
    }
  }, []);

  const nomeFinal = useMemo(
    () => (escolha === "__outro__" ? outro.trim() : escolha),
    [escolha, outro],
  );

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
    setOutro("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vendedor) return;
    if (!form.nome.trim() || !form.whatsapp.trim()) {
      toast.error("Preencha ao menos nome e WhatsApp.");
      return;
    }
    setEnviando(true);
    try {
      await enviarParaGoogleSheets({
        nome: form.nome.trim(),
        whatsapp: form.whatsapp.trim(),
        email: form.email.trim(),
        segmento: form.segmento,
        vendedor,
      });
      const novo = total + 1;
      setTotal(novo);
      salvarContador(vendedor, novo);
      setForm(emptyForm);
      toast.success(`Cliente cadastrado com sucesso! (${novo} hoje)`, {
        duration: 4000,
        className: "!bg-emerald-600 !text-white !border-emerald-600",
        icon: <CheckCircle2 className="w-5 h-5" />,
      });
      document.getElementById("campo-nome")?.focus();
    } catch {
      toast.error("Não foi possível enviar. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  if (!vendedor) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-6 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <UserRound className="w-7 h-7 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">Quem é você?</h1>
            <p className="text-sm text-muted-foreground">
              Selecione seu nome para começar os cadastros.
            </p>
          </div>
          <Select value={escolha} onValueChange={setEscolha}>
            <SelectTrigger className="h-11 rounded-full">
              <SelectValue placeholder="Selecione o vendedor" />
            </SelectTrigger>
            <SelectContent>
              {VENDEDORES.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
              <SelectItem value="__outro__">Outro…</SelectItem>
            </SelectContent>
          </Select>
          {escolha === "__outro__" && (
            <Input
              className="h-11 rounded-full"
              placeholder="Digite seu nome"
              value={outro}
              onChange={(e) => setOutro(e.target.value)}
            />
          )}
          <Button
            className="w-full h-11 rounded-full"
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
    <main className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-md flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Vendedor: {vendedor}</p>
            <p className="text-xs text-muted-foreground">
              Você cadastrou {total} {total === 1 ? "cliente" : "clientes"} hoje
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full text-xs shrink-0"
            onClick={alterarVendedor}
          >
            Alterar vendedor
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-md px-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Cadastro rápido</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="campo-nome">Nome do cliente</Label>
            <Input
              id="campo-nome"
              className="h-11 rounded-full"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Nome completo"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campo-whats">WhatsApp</Label>
            <Input
              id="campo-whats"
              className="h-11 rounded-full"
              inputMode="tel"
              value={form.whatsapp}
              onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
              placeholder="(82) 99999-9999"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campo-email">E-mail</Label>
            <Input
              id="campo-email"
              type="email"
              className="h-11 rounded-full"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="cliente@empresa.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label>Segmento de atuação</Label>
            <Select
              value={form.segmento}
              onValueChange={(v) => setForm({ ...form, segmento: v })}
            >
              <SelectTrigger className="h-11 rounded-full">
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

          <Button type="submit" className="w-full h-12 rounded-full" disabled={enviando}>
            {enviando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…
              </>
            ) : (
              "Cadastrar cliente"
            )}
          </Button>
        </form>
      </section>
    </main>
  );
}
