import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, Trophy, Users, CalendarCheck, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Cadastro = {
  id: string;
  nome: string | null;
  segmento: string | null;
  created_at: string;
  status: string;
};

type Stats = {
  total: number;
  hoje: number;
  checkins: number;
  cadastros: Cadastro[];
  ranking: { vendedor: string; total: number }[];
  error?: string;
};

const fmtHora = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 p-4">
      <Icon className="w-4 h-4 text-[#E6B012] mb-2" />
      <p className="text-2xl font-semibold text-white leading-none">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-white/50 mt-1">{label}</p>
    </div>
  );
}

export default function VendedorDashboard({ vendedor }: { vendedor: string }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const { data } = await supabase.rpc("public_vendedor_stats" as never, {
      p_vendedor: vendedor,
    } as never);
    setStats((data as unknown as Stats) ?? null);
    setCarregando(false);
  }, [vendedor]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (carregando && !stats) {
    return (
      <div className="flex items-center justify-center py-16 text-white/60">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    );
  }

  if (!stats || stats.error) {
    return (
      <p className="py-10 text-center text-sm text-white/60">
        Nenhum evento ativo no momento.
      </p>
    );
  }

  const ranking = stats.ranking ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Meu desempenho</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={carregar}
          className="rounded-full text-xs text-white/70 hover:text-white hover:bg-white/10"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${carregando ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Kpi icon={CalendarCheck} label="Hoje" value={stats.hoje ?? 0} />
        <Kpi icon={Users} label="Total" value={stats.total ?? 0} />
        <Kpi icon={BadgeCheck} label="Check-ins" value={stats.checkins ?? 0} />
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white/80 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#E6B012]" /> Ranking da equipe
        </h3>
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 divide-y divide-white/5 overflow-hidden">
          {ranking.length === 0 && (
            <p className="p-4 text-sm text-white/50">Nenhum cadastro ainda.</p>
          )}
          {ranking.map((r, i) => {
            const eu = r.vendedor.toLowerCase() === vendedor.toLowerCase();
            return (
              <div
                key={r.vendedor}
                className={`flex items-center gap-3 px-4 py-3 ${eu ? "bg-[#E6B012]/10" : ""}`}
              >
                <span
                  className={`w-6 h-6 shrink-0 rounded-full text-[11px] font-semibold flex items-center justify-center ${
                    i === 0
                      ? "bg-[#E6B012] text-[#12151C]"
                      : "bg-white/10 text-white/70"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="flex-1 truncate text-sm text-white">
                  {r.vendedor}
                  {eu && <span className="text-[#E6B012] text-xs ml-2">(você)</span>}
                </span>
                <span className="text-sm font-semibold text-white tabular-nums">
                  {r.total}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-white/80">Meus cadastros</h3>
        <div className="rounded-2xl bg-white/5 ring-1 ring-white/10 divide-y divide-white/5 overflow-hidden">
          {(stats.cadastros ?? []).length === 0 && (
            <p className="p-4 text-sm text-white/50">
              Você ainda não cadastrou clientes neste evento.
            </p>
          )}
          {(stats.cadastros ?? []).map((c) => (
            <div key={c.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-white truncate">{c.nome || "Sem nome"}</p>
                <span
                  className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0 ${
                    c.status === "checked_in"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-white/10 text-white/60"
                  }`}
                >
                  {c.status === "checked_in" ? "Check-in" : "Inscrito"}
                </span>
              </div>
              <p className="text-xs text-white/45 mt-0.5">
                {[c.segmento, fmtHora(c.created_at)].filter(Boolean).join(" · ")}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
