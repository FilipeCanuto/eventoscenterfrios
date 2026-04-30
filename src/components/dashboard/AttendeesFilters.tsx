import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import {
  AttendeesFilterState,
  EMPTY_FILTERS,
  FilterOptions,
  STATUS_LABELS,
  activeFilterCount,
} from "@/lib/attendeesFilters";

interface Props {
  value: AttendeesFilterState;
  onChange: (next: AttendeesFilterState) => void;
  options: FilterOptions;
}

function MultiSelect({
  label,
  values,
  selected,
  onToggle,
  empty,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (v: string) => void;
  empty?: string;
}) {
  const [open, setOpen] = useState(false);
  const summary = selected.length === 0
    ? "Todos"
    : selected.length === 1
      ? selected[0]
      : `${selected.length} selecionados`;
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-9 justify-between rounded-full bg-card font-normal text-sm"
          >
            <span className="truncate max-w-[140px] text-left">{summary}</span>
            <ChevronDown className="w-3.5 h-3.5 opacity-60 ml-2" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2 rounded-2xl">
          {values.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">
              {empty || "Sem opções disponíveis."}
            </p>
          ) : (
            <ScrollArea className="max-h-64">
              <div className="space-y-1 p-1">
                {values.map((v) => {
                  const checked = selected.includes(v);
                  return (
                    <label
                      key={v}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer text-sm"
                    >
                      <Checkbox checked={checked} onCheckedChange={() => onToggle(v)} />
                      <span className="truncate">{v}</span>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function AttendeesFilters({ value, onChange, options }: Props) {
  const [open, setOpen] = useState(false);
  const count = useMemo(() => activeFilterCount(value), [value]);

  const toggle = (key: "status" | "sources" | "days" | "segments", v: string) => {
    const cur = value[key];
    const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
    onChange({ ...value, [key]: next });
  };

  const update = <K extends keyof AttendeesFilterState>(k: K, v: AttendeesFilterState[K]) =>
    onChange({ ...value, [k]: v });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs shrink-0 rounded-full bg-card relative"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
          Filtros avançados
          {count > 0 && (
            <Badge className="ml-2 h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5">
              {count}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] sm:w-[400px] p-4 rounded-2xl" align="end">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Filtros avançados</h4>
          {count > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs rounded-full"
              onClick={() => onChange(EMPTY_FILTERS)}
            >
              <X className="w-3 h-3 mr-1" /> Limpar
            </Button>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Inscrição de</Label>
              <Input
                type="date"
                value={value.dateFrom || ""}
                onChange={(e) => update("dateFrom", e.target.value || null)}
                className="h-9 rounded-full text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">até</Label>
              <Input
                type="date"
                value={value.dateTo || ""}
                onChange={(e) => update("dateTo", e.target.value || null)}
                className="h-9 rounded-full text-sm"
              />
            </div>
          </div>

          <MultiSelect
            label="Status"
            values={Object.keys(STATUS_LABELS)}
            selected={value.status}
            onToggle={(v) => toggle("status", v)}
          />

          <MultiSelect
            label="Dias de comparecimento"
            values={options.days}
            selected={value.days}
            onToggle={(v) => toggle("days", v)}
            empty="Nenhum dia configurado neste evento."
          />

          <MultiSelect
            label="Segmento de atuação"
            values={options.segments}
            selected={value.segments}
            onToggle={(v) => toggle("segments", v)}
            empty="Sem segmentos informados ainda."
          />

          <MultiSelect
            label="Origem (UTM)"
            values={options.sources}
            selected={value.sources}
            onToggle={(v) => toggle("sources", v)}
          />

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Empresa contém</Label>
            <Input
              value={value.company}
              onChange={(e) => update("company", e.target.value)}
              placeholder="Buscar empresa…"
              className="h-9 rounded-full text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Check-in</Label>
            <div className="flex gap-1">
              {[
                { v: "any", l: "Qualquer" },
                { v: "with", l: "Compareceu" },
                { v: "without", l: "Não compareceu" },
              ].map((opt) => (
                <Button
                  key={opt.v}
                  type="button"
                  variant={value.checkInOnly === opt.v ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs rounded-full flex-1"
                  onClick={() => update("checkInOnly", opt.v as any)}
                >
                  {opt.l}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
