
## Fase 1 — Painel de Auditoria de E-mails (entregar agora)

A pergunta "todos os inscritos receberam o e-mail?" hoje só pode ser respondida abrindo cada inscrito um por um. Vamos resolver isso com uma central por evento, e ao mesmo tempo deixar a mensagem confusa do card individual mais explicativa.

### 1. Mensagem clara no card do inscrito

Hoje aparece um único aviso amarelo genérico ("Este inscrito ainda não tem confirmação registrada como enviada.") em três situações muito diferentes. Vamos diferenciar:

- **Nunca tentado** (caixa amarela) — "Nenhuma tentativa de envio registrada. Provavelmente esta inscrição é anterior à reativação do envio. Use 'Enviar confirmação' para disparar agora."
- **Falhou na entrega** (caixa vermelha) — "A última tentativa falhou: [motivo]. Verifique se o e-mail está correto antes de reenviar." Mostra o erro real do log (bounce, timeout, formato inválido).
- **E-mail suprimido** (caixa vermelha, já existe) — mantida como está.
- **Entregue com sucesso** (caixa verde, nova) — "Confirmação entregue em [data]." Hoje não mostramos sucesso, só ausência.

A lógica de classificação já está disponível no `email_send_log` + `suppressed_emails` que o hook `useRegistrationEmails` carrega.

### 2. Nova aba "E-mails" no dashboard do evento

Dentro de `EventDetail.tsx`, ao lado das abas atuais, adicionar uma aba **Auditoria de e-mails** que mostra para o evento selecionado:

```text
┌─────────────────────────────────────────────────────────┐
│ Auditoria de envios — Evento: Workshop Center Frios     │
├─────────────────────────────────────────────────────────┤
│ [142] Inscritos    [128] Confirmados    [9] Pendentes   │
│ [3] Falharam       [2] Suprimidos       91% entregue    │
├─────────────────────────────────────────────────────────┤
│ Filtro: [Pendentes ▾] [Falharam] [Suprimidos] [Todos]  │
├─────────────────────────────────────────────────────────┤
│ ☐ João Silva     joao@gmail.com    Nunca tentado    [↗]│
│ ☐ Maria Costa    maria@hotmial.cm  Bounce: invalid  [↗]│
│ ☐ Pedro Lima     pedro@empresa.br  Suprimido        [↗]│
│ ...                                                     │
├─────────────────────────────────────────────────────────┤
│ [Selecionar todos]  [Reenviar selecionados (9)]        │
│ [Exportar lista pendentes em planilha]                  │
└─────────────────────────────────────────────────────────┘
```

**Cálculo dos buckets** (uma única query agregada, server-side):
- **Confirmado** = existe `email_send_log` com `email_type IN ('confirmation','registration_confirmation')` e `status IN ('sent','delivered')`.
- **Falhou** = última linha de log de confirmação tem `status = 'failed'` e e-mail não está suprimido.
- **Suprimido** = e-mail está em `suppressed_emails`.
- **Nunca tentado** = nenhum log de confirmação para a inscrição e e-mail não está suprimido.

**Ações em massa** (com mesmo throttling do backfill atual: 5 por lote, 400ms entre itens, 2s entre lotes):
- Reenviar selecionados → reaproveita `backfill-confirmations` aceitando uma lista de `registrationIds`.
- Exportar pendentes → planilha .xlsx via `ExportMenu` reutilizando `attendeesFilters.ts`, com colunas: nome, e-mail, WhatsApp, motivo, data da inscrição.

### 3. Ajuste no `backfill-confirmations`

Aceitar payload opcional `registrationIds: string[]` para reprocessar apenas IDs específicos (em vez de varrer o evento todo). Mantém validação de admin/dono e a verificação contra a Resend API antes de reenviar (anti-duplicação que já existe).

### 4. Visão global em `/dashboard/attendees`

Na página global de participantes, adicionar um chip de status de e-mail ao lado de cada linha (✓ entregue / ⏳ pendente / ⚠ falhou / ⛔ suprimido) e um filtro "Status do e-mail" no `AttendeesFilters`.

---

## Fase 2 — WhatsApp (planejada, não implementada agora)

Após validar a Fase 1, integramos **WhatsApp Cloud API (Meta oficial)** para mandar mensagem aos inscritos cujo e-mail falhou ou não foi tentado. O fluxo será:

1. Botão "Enviar correção via WhatsApp" no card do inscrito e em massa no painel de auditoria.
2. Mensagem com **template aprovado pela Meta** (categoria `UTILITY`) contendo um **link único tokenizado** tipo `meuevento.com/corrigir-email/{token}`.
3. Página `/corrigir-email/{token}` (pública, sem login) onde o inscrito digita o e-mail correto. O token tem validade de 7 dias e uso único.
4. Ao confirmar, atualiza `registrations.lead_email`, registra a alteração em log de auditoria e dispara `send-registration-confirmation` automaticamente.

**Pré-requisitos que precisaremos do usuário** (para a Fase 2, não agora):
- Conta WhatsApp Business verificada na Meta
- Phone Number ID + WABA ID
- Token permanente de System User
- Aprovação do template de mensagem (24-48h pela Meta)

A Fase 2 fica documentada e pronta para ser destravada quando você tiver esses itens.

---

## Detalhes técnicos

**Arquivos a criar/editar (Fase 1):**
- `src/components/dashboard/RegistrationEmailsTab.tsx` — substituir aviso único por classificação em 4 estados.
- `src/components/event-detail/EventEmailAudit.tsx` (novo) — painel de auditoria do evento.
- `src/hooks/useEventEmailAudit.ts` (novo) — query agregada + lista paginada com filtro por bucket.
- `src/pages/dashboard/EventDetail.tsx` — adicionar nova aba.
- `src/pages/dashboard/Attendees.tsx` + `src/components/dashboard/AttendeesFilters.tsx` — coluna e filtro "Status do e-mail".
- `supabase/functions/backfill-confirmations/index.ts` — aceitar `registrationIds: string[]`.
- Migração: índice em `email_send_log (registration_id, email_type, status)` para acelerar a query agregada.

**Não vamos mexer em:** templates de e-mail, lógica de throttling, validação de e-mails — tudo isso já está pronto e funcionando.

**Posso prosseguir com a Fase 1?**
