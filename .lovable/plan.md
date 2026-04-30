## Resumo

Dois ajustes:

1. **Contagem de horas correta** no e-mail de "1 dia antes" — tanto no envio real (já correto) quanto na **prévia** do painel (hoje mostra "117h" porque calcula a partir de "agora", e não do momento em que o e-mail será enviado).
2. **Filtros avançados + exportação** na tabela de participantes (Dashboard → Participantes e dentro de cada evento), permitindo filtrar por dias de comparecimento, segmento, empresa, origem, status e período, e baixar a planilha (CSV + XLSX) **respeitando o filtro aplicado**.

---

## 1. Contagem de horas no lembrete de 1 dia

### Diagnóstico
- O e-mail real é enviado em `event_date - 1 dia`, então `hoursUntil()` resulta em ~24h. Correto.
- A **prévia** no painel (`render-email-preview`) e o template usam `Date.now()` como referência. Como o evento está a ~5 dias, a prévia mostra "117h" — confunde o organizador.

### Correção
- Em `supabase/functions/_shared/email-templates.ts`: aceitar um parâmetro opcional `referenceDate` no `EmailContext`. `hoursUntil()` passa a calcular `eventDate - referenceDate` (default `Date.now()`).
- Em `process-reminder-queue` e `send-registration-confirmation`: passar `referenceDate = new Date()` (envio real, comportamento atual mantido).
- Em `render-email-preview`: passar `referenceDate` apropriado por tipo:
  - `reminder_1d` → `event_date - 24h`
  - `reminder_2h` → `event_date - 2h`
  - `confirmation` → `now()`
- Resultado na prévia: o lembrete de 1 dia exibirá sempre "24h", o de 2 horas sempre "2h" — refletindo fielmente o que o destinatário verá.
- Adicional: o título "Amanhã é o dia!" e o texto do `reminder_1d` ficam coerentes com a contagem.

---

## 2. Filtros avançados + exportação na tabela de participantes

Aplicado nos **dois** locais:
- `src/pages/dashboard/Attendees.tsx` (lista global, todos os eventos)
- `src/components/event-detail/EventAttendeesTable.tsx` (dentro de cada evento)

### Filtros (barra recolhível "Filtros avançados")
- **Período de inscrição** (date range picker — últimos 7/30 dias, mês atual, customizado)
- **Status** (Inscrito / Check-in feito / Cancelado — multi-select)
- **Origem (UTM source)** (multi-select — populado dinamicamente)
- **Dias de comparecimento** (multi-select — extraído do `data["Dias de Comparecimento"]`)
- **Segmento de atuação** (multi-select — extraído de `data["Segmento de atuação"]`)
- **Empresa** (busca textual)
- **Apenas com check-in / sem check-in** (toggle)
- **Evento** (já existe na página global; mantido)

Todos combinam com a busca textual já existente. Contador de filtros ativos + botão "Limpar filtros". Estado preservado durante navegação na sessão.

### Colunas adicionais visíveis no desktop
Adicionar **Empresa** e **Segmento** como colunas (escondidas em mobile), e expor "Dias" também na lista global (hoje só está na tabela do evento).

### Exportação
Botão "Exportar" abre menu com:
- **Planilha Excel (.xlsx)** — usando `xlsx` (SheetJS) com colunas formatadas, cabeçalho em negrito e larguras automáticas. Inclui aba secundária "Filtros aplicados" listando os filtros usados e a data/hora da exportação.
- **CSV (.csv)** — mantém o atual, com escape anti-injeção.

A exportação **sempre** respeita o filtro/busca/ordenação atual e inclui todas as colunas relevantes:
Nome, E-mail, WhatsApp, Empresa, Segmento, Evento, Origem, Dias de comparecimento, Status, Data de inscrição, Data de check-in.

Nome do arquivo: `participantes_{evento-ou-todos}_{YYYY-MM-DD}.xlsx`.

---

## Detalhes técnicos

- **Dependência nova:** `xlsx` (SheetJS, ~600KB, lazy-loaded apenas quando o usuário clica em "Exportar Excel" via `import()` dinâmico — sem impacto no bundle inicial).
- **Filtros dinâmicos:** as opções de "Dias", "Segmento" e "Origem" são calculadas em `useMemo` a partir do conjunto bruto de inscritos para evitar opções vazias.
- **Componente compartilhado:** extrair `<AttendeesFilters />` reutilizável entre as duas páginas para evitar duplicação. Recebe `registrations` e emite `filters` via callback.
- **Persistência leve:** filtros em estado local (não em URL) — simples e suficiente para o caso atual.
- **Sem mudanças no banco** — toda a filtragem é client-side sobre o resultado já carregado (volume atual confortavelmente abaixo de 10k linhas por evento).

---

## Sugestões de melhorias adicionais (opcionais)

1. **Salvar filtros favoritos** por usuário (ex.: "Só dia 06/05 + segmento Indústria") — usaria `localStorage`.
2. **Estatísticas dinâmicas** — os 4 cards de métricas no topo poderiam refletir o filtro aplicado (ex.: "X check-ins nos filtros atuais").
3. **PDF resumido** para imprimir lista de presença diária (lista compacta com checkbox ao lado do nome).

Posso prosseguir com a implementação de (1) e (2) acima, ou aguardo sua confirmação antes?
