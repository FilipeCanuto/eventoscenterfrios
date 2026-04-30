# Plano: recuperação de confirmações + central de e-mails por inscrito

## 1. Diagnóstico (o que descobri no banco)

Antes de propor a solução, fiz um levantamento direto na base:

- **123 inscritos** com status `registered`.
- **0 registros** em `email_send_log` com confirmação enviada com sucesso.
- **246 lembretes pendentes** (`reminder_1d` e `reminder_2h`) já programados — esses vão sair normalmente agora que o Resend voltou.
- **48 lembretes `reminder_7d**` já marcados como `sent` (do período antes da queda).
- A confirmação de inscrição **não é agendada** em `scheduled_emails` — ela é disparada inline no momento do cadastro. Como o domínio estava rejeitando, **nenhum dos 123 inscritos atuais recebeu o e-mail de confirmação.**

Conclusão: precisamos de uma **operação de recuperação** (resend em lote) + a **central de e-mails por inscrito** que você pediu.

---

## 2. O que vou construir

### Parte A — Recuperar os inscritos que não receberam confirmação

**A.1. Detecção automática de "pendentes"**
Criar uma view/consulta que identifica todo `registration` com status `registered` que **não** tem registro `sent` em `email_send_log` para `email_type = 'registration_confirmation'`. Esses são os candidatos ao reenvio.

**A.2. Edge function `backfill-confirmations**` (nova)

- Recebe opcionalmente um `eventId` (ou roda para todos os eventos do admin).
- Lista os inscritos pendentes da consulta acima.
- Filtra: ignora e-mails na `suppressed_emails` e e-mails inválidos.
- Dispara `send-registration-confirmation` em lotes pequenos (10 por rodada, com 1s de pausa) para respeitar o rate-limit do Resend e evitar bounce em cascata.
- Registra cada tentativa em `email_send_log` (já existe a infra).
- Retorna `{ scheduled, skipped_suppressed, skipped_invalid, failed }` para feedback no UI.

**A.3. Botão "Reenviar confirmações pendentes" no painel**

- Na tela do evento (em `EventAttendeesTable.tsx` / `EventDetailHeader.tsx`), adicionar um botão discreto que:
  1. Mostra a contagem de pendentes ("23 inscritos sem confirmação").
  2. Ao clicar, abre confirmação ("Enviar 23 e-mails agora?") e dispara a function.
  3. Mostra toast de progresso e atualiza a contagem ao fim.

### Parte B — Aba "E-mails" no card do inscrito (`RegistrationDetailDialog`)

Adicionar abas no diálogo do inscrito: **Dados | E-mails | Templates**.

**B.1. Aba "E-mails" — histórico do que esse inscrito recebeu**

- Tabela com: tipo (`Confirmação`, `Lembrete 7d`, `Lembrete 1d`, `Lembrete 2h`), status (Enviado / Falhou / Pendente / Cancelado), data, código de erro do provedor (se houver).
- Combina dados de `email_send_log` (envios efetivos) + `scheduled_emails` (programados/pendentes/falhados).
- Botão **"Reenviar confirmação"** ao lado da linha de confirmação se o status for `failed` ou inexistente — chama `send-registration-confirmation` com `force: true`.
- Aviso visível se o e-mail estiver na lista de supressão, com o motivo.

**B.2. Programados futuros**  
Mostra na mesma tabela (badge "Programado para 30/04 às 14h") os lembretes ainda não enviados, com data/hora prevista no fuso do evento. (analisar a possibilidade da inclusão de um botão de editar a data do envio dos e-mails programados )

**B.3. Aba "Templates" — prévia + download**

- Renderiza no client uma prévia HTML (iframe sandboxed) de cada um dos 4 templates **personalizados com os dados reais daquele inscrito e do evento** (mesmas funções de `_shared/email-templates.ts` reaproveitadas no front via uma function `render-email-template`).
- Para cada template:
  - Botão **"Baixar PNG (alta qualidade)"** — usa `html2canvas` em escala 3x sobre o iframe renderizado, gerando PNG ~retina.
  - Botão **"Baixar PDF"** — usa `jsPDF` com a imagem capturada, página A4.
  - Botão **"Baixar HTML"** — salva o `.html` puro (útil para devs/marketing).

### Parte C — Hardenings adicionais ("como melhorar ainda mais")

Aproveitando que estamos tocando nesse fluxo, três melhorias defensivas para **evitar que o problema reapareça**:

1. **Re-envio automático no próximo `process-reminder-queue**`: a function que já roda periodicamente passa também a varrer confirmações `failed`/`missing` recentes (últimas 48h) e tenta de novo, respeitando cooldown e supressão. Isso significa que mesmo sem ação manual, futuros incidentes se auto-corrigem assim que o domínio volta.
2. **Painel de saúde de e-mails**: pequeno card no topo de `/dashboard/attendees` mostrando "Últimas 24h: X enviados, Y falhados, Z em cooldown" (deduplicado por `message_id`). Visibilidade imediata de problemas.
3. **Validação proativa do domínio**: a `send-registration-confirmation` testa o status do domínio Resend uma vez por hora (cache em `email_send_state`) e, se estiver `not_verified`, retorna 200 + `queued_for_later` em vez de 403, gravando o registro como `pending_domain` para reenvio automático posterior. Isso elimina o "erro vermelho" para o inscrito.

---

## 3. Detalhes técnicos

**Arquivos novos**

- `supabase/functions/backfill-confirmations/index.ts`
- `supabase/functions/render-email-preview/index.ts` (retorna HTML renderizado para um `registrationId` + `templateType`, reusa `_shared/email-templates.ts`)
- `src/components/dashboard/RegistrationEmailsTab.tsx`
- `src/components/dashboard/RegistrationTemplatesTab.tsx`
- `src/hooks/useRegistrationEmails.ts`
- Migração: índice `email_send_log(registration_id, email_type, status)` para acelerar consultas.

**Arquivos editados**

- `src/components/dashboard/RegistrationDetailDialog.tsx` — adiciona `<Tabs>` com 3 abas.
- `src/components/event-detail/EventAttendeesTable.tsx` — botão "Reenviar pendentes".
- `supabase/functions/send-registration-confirmation/index.ts` — modo `queued_for_later` quando domínio não verificado.
- `supabase/functions/process-reminder-queue/index.ts` — varre confirmações falhadas recentes.

**Dependências novas no front**

- `html2canvas` (~45kb gz) — captura DOM em alta resolução.
- `jspdf` (~80kb gz) — geração de PDF client-side.
Ambas tree-shakable e carregadas só na aba de templates (lazy import).

**RLS / segurança**

- `email_send_log` já tem policy de admin select; o front consulta via hook que respeita RLS.
- A function `backfill-confirmations` valida `auth.uid()` e exige `has_role(uid, 'admin')` antes de rodar.
- Iframe da prévia é `sandbox="allow-same-origin"` (sem scripts), apenas para renderizar HTML.

**Performance / custo**

- Backfill em lotes de 10 com 1s de espaço evita estourar quota do Resend (100/s no plano padrão).
- Renderização de templates é cacheada por `registrationId+templateType` no React Query (5 min).

---

## 4. Resultado esperado

1. Os 123 inscritos atuais que não receberam confirmação podem ser recuperados em 1 clique (~2 minutos para enviar todos).
2. Para qualquer inscrito futuro, você abre o card → aba **E-mails** e vê exatamente o que ele recebeu, o que vai receber, e pode reenviar/baixar tudo.
3. Se o domínio cair de novo, o sistema **não perde** envios — eles ficam em `pending_domain` e são reenviados automaticamente quando voltar.

Posso aplicar?  
  
Certifique-se de enviar o e-mail de confirmação de cadastro apenas para os contatos que não estão marcados com "delivered" no Resend.