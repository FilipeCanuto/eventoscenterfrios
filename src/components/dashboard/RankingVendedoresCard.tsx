import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type RegistrationLike = {
  event_id: string;
  status?: string | null;
  tracking?: unknown;
};

type EventLike = { id: string; name: string };

export default function RankingVendedoresCard({
  registrations,
  events,
}: {
  registrations?: RegistrationLike[];
  events?: EventLike[];
}) {
  const [eventoId, setEventoId] = useState<string>("all");

  const ranking = useMemo(() => {
    const counts = new Map<string, number>();
    (registrations ?? []).forEach((r) => {
      if (r.status === "cancelled") return;
      if (eventoId !== "all" && r.event_id !== eventoId) return;
      const tracking = (r.tracking ?? {}) as Record<string, unknown>;
      const nome = String(tracking.vendedor ?? "").trim();
      if (!nome) return;
      counts.set(nome, (counts.get(nome) ?? 0) + 1);
    });
    return [...counts.entries()]
      .map(([vendedor, total]) => ({ vendedor, total }))
      .sort((a, b) => b.total - a.total || a.vendedor.localeCompare(b.vendedor));
  }, [registrations, eventoId]);

  const lider = ranking[0]?.total ?? 0;

  return (
    <div className="rounded-2xl bg-card p-5 mb-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-display font-semibold flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          Ranking do Time Comercial
        </h2>
        <Select value={eventoId} onValueChange={setEventoId}>
          <SelectTrigger className="h-9 w-[190px] rounded-full text-xs">
            <SelectValue placeholder="Todos os eventos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os eventos</SelectItem>
            {(events ?? []).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ranking.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          Nenhum cadastro com vendedor identificado ainda.
        </p>
      ) : (
        <ol className="space-y-2">
          {ranking.map((r, i) => (
            <li key={r.vendedor} className="flex items-center gap-3">
              <span
                className={`w-6 h-6 shrink-0 rounded-full text-[11px] font-semibold flex items-center justify-center ${
                  i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm truncate">{r.vendedor}</span>
                  <span className="text-sm font-semibold tabular-nums">{r.total}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${lider ? (r.total / lider) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
