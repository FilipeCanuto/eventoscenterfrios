## Diagnóstico

O elemento selecionado mostra "5 de mai. de 2026 – 8 de mai. de 2026 ·11h - 15h BRT" — uma linha única e densa, difícil de escanear. Os horários atuais (11h–15h) também estão errados; o correto é 14h–18h BRT.

Verifiquei via `lsp` que o texto vem da função `formatEventDateTime(event)` em `src/pages/Register.tsx`, que lê `event.event_date` e `event.event_end_date`. Ou seja, o horário "11h - 15h" reflete os dados salvos no banco para este evento — não está hardcoded.

Há, portanto, duas frentes:

1. **Dados** — corrigir o horário no banco para 14h–18h (BRT = UTC-3, então `2026-05-05 17:00:00Z` até `2026-05-08 21:00:00Z`).
2. **Apresentação** — reformatar o bloco de data/hora para ser mais escaneável, visual e profissional.

## Plano

### 1. Corrigir os dados do evento

Migration UPDATE no evento `circuito-experience-centerfrios-skymsen-rq0bmz`:

- `event_date` → `2026-05-05 17:00:00+00` (14h BRT)
- `event_end_date` → `2026-05-08 21:00:00+00` (18h BRT)
- `timezone` → `America/Sao_Paulo`

### 2. Redesenhar o bloco de data/hora (em `src/pages/Register.tsx`)

Em vez de uma linha corrida, usar um pequeno **"date card" horizontal** com hierarquia visual clara, padrão usado por Sympla/Eventbrite/Meetup:

```text
┌─────────────────────────────────────────────────┐
│  📅  5 – 8 de maio de 2026                      │
│      4 dias · ter a sex                         │
│  🕐  Das 14h às 18h  (horário de Brasília)      │
└─────────────────────────────────────────────────┘
```

Detalhes:

- **Linha 1 (data)**: ícone `Calendar` + range compacto "5 – 8 de maio de 2026" em fonte de destaque (Bricolage Grotesque, semibold).
- **Linha 2 (subtexto da data)**: "4 dias · qua a sáb" em `text-sm text-muted-foreground` — dá contexto de duração e dias da semana sem poluir.
- **Linha 3 (horário)**: ícone `Clock` + "Das 14h às 18h" + "(horário de Brasília)" mais discreto.
- Quando início e fim estão no mesmo mês/ano, condensar para "5 – 8 de maio de 2026" (em vez de repetir "de 2026" duas vezes).
- Quando o horário diário é o mesmo nos dois extremos, mostrar uma única faixa "Das Xh às Yh" em vez de "início — fim".

### 3. Lógica do helper `formatEventDateTime`

Refatorar para retornar um objeto estruturado `{ dateRange, durationLabel, timeRange, tzLabel }` em vez de string única, permitindo o layout em múltiplas linhas com ícones. Manter o timezone via `Intl.DateTimeFormat` com `America/Sao_Paulo`.

Cálculo do `durationLabel`:

- Diferença em dias + 1 (inclusivo) → "4 dias"
- Dias da semana abreviados em pt-BR do início e fim → "ter a sex"

### 4. Consistência visual

- Manter ícones `lucide-react` (`Calendar`, `Clock`) já em uso no projeto, tamanho `h-4 w-4`, `text-muted-foreground`.
- Tipografia: data principal em `font-semibold text-base md:text-lg`, sub-linhas em `text-sm`.
- Sem bordas (regra do projeto: borderless), apenas espaçamento e hierarquia de cor/peso.
- Layout responsivo: empilha naturalmente em mobile, fica compacto em desktop.

## Arquivos afetados

- `**src/pages/Register.tsx**` — refatorar `formatEventDateTime` e o JSX do bloco de data/hora (linha ~136).
- **Migration SQL** — UPDATE do evento para corrigir horários para 14h–18h BRT.

## Fora de escopo

- Não altero outros locais que renderizam data (ex.: cards do dashboard) nesta iteração — foco na página pública de inscrição, conforme contexto do elemento selecionado.