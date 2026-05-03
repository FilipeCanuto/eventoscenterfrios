## Objetivo

Trazer a verdade do Resend (entregue, bounce, complaint, opened) para dentro do nosso `email_send_log`, para que a auditoria deixe de depender de "o Resend aceitou a requisição" e passe a refletir "o e-mail realmente chegou na caixa do inscrito".

## Por que isso é necessário

Hoje o `email_send_log.status = 'sent'` significa apenas que o Resend respondeu HTTP 200 — não significa entrega. Bounces silenciosos ficam invisíveis. Sem isso, qualquer "reenvio para quem não recebeu" corre o risco de duplicar e-mails para quem já recebeu (e poupar quem teve bounce).

## Mudanças

### 1. Banco de dados (migration)

- Adicionar colunas em `email_send_log`:
  - `provider_message_id text` — ID retornado pelo Resend ao enviar (`Email.id`)
  - `delivered_at timestamptz` — preenchido pelo evento `email.delivered`
  - `bounced_at timestamptz` + `bounce_type text` (hard/soft) — pelo evento `email.bounced`
  - `complained_at timestamptz` — pelo evento `email.complained`
  - `opened_at timestamptz` (opcional) — pelo evento `email.opened`
- Índice em `provider_message_id` para o webhook fazer UPDATE rápido.
- Política de UPDATE restrita ao service role (webhook).

### 2. Salvar o `message_id` do Resend no envio

- Atualizar `send-registration-confirmation` e `backfill-confirmations` para capturar `data.id` da resposta do Resend e gravar em `provider_message_id` ao inserir/atualizar a linha do log.
- Mesmo tratamento para `send-event-reminders` (lembretes 1d/2h).

### 3. Nova Edge Function `resend-webhook` (pública, sem JWT)

- Endpoint `POST /resend-webhook`.
- Valida assinatura do Resend usando o segredo `RESEND_WEBHOOK_SECRET` (header `svix-signature` — Resend usa Svix).
- Trata os eventos: `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`, `email.opened` (opcional).
- Faz `UPDATE email_send_log SET delivered_at=…/bounced_at=…/… WHERE provider_message_id = data.email_id`.
- Em `email.bounced` (hard) e `email.complained`: também insere em `suppressed_emails` para bloquear futuros envios automáticos.
- Logs estruturados para depuração.

### 4. Atualizações no painel de auditoria (`EventEmailAudit.tsx` + `useEventEmailAudit.ts`)

- Recategorizar buckets usando os novos campos:
  - **Entregue** = `delivered_at IS NOT NULL`
  - **Bounce** = `bounced_at IS NOT NULL` (separar hard/soft)
  - **Reclamação** = `complained_at IS NOT NULL`
  - **Aceito (sem confirmação)** = `status='sent'` há > 30 min sem `delivered_at` nem `bounced_at`
  - **Falhou** = `status IN ('failed','dlq')`
  - **Nunca tentado** = sem log
- Banner informativo enquanto `provider_message_id` for nulo em registros antigos: "Histórico anterior ao webhook — status real desconhecido. Use o painel do Resend para validar."
- Reenvio em massa passa a oferecer o filtro "Apenas bounce + nunca entregue + nunca tentado" (excluindo `delivered`).

### 5. Onboarding (instruções para você no chat após deploy)

1. Eu te dou a URL da função: `https://ahwecyjzzczcwunptxae.supabase.co/functions/v1/resend-webhook`.
2. Você abre Resend → **Webhooks** → **Add Endpoint**, cola a URL e marca os eventos: `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_delayed`.
3. Resend gera um **Signing Secret**. Você me passa esse secret.
4. Eu salvo como `RESEND_WEBHOOK_SECRET` no backend e a partir daí tudo é automático.

### 6. Backfill (limitação honesta)

- Resend só envia webhook para eventos **novos** a partir do momento da configuração. Para os 62 e-mails históricos do bucket `A_sent`, **não há como recuperar o status retroativo via webhook** — só via export do CSV do painel do Resend ou consulta manual.
- Vou adicionar um botão no painel "Importar CSV do Resend" que aceita o export deles e atualiza `delivered_at`/`bounced_at` por correspondência de e-mail + janela de tempo. Isso resolve o passivo histórico do Circuito Experience.

## Ordem de execução

1. Migration (colunas novas).
2. Edge Function `resend-webhook` + alteração nas funções de envio para salvar `provider_message_id`.
3. Eu te passo a URL e peço o `RESEND_WEBHOOK_SECRET`.
4. Atualizo o painel de auditoria com os novos buckets.
5. Adiciono o importador de CSV do Resend para o histórico.
6. Você roda o reenvio cirúrgico para "bounce + nunca entregue + nunca tentado", excluindo entregues.

## Não vou fazer ainda

- Nenhum reenvio automático antes do webhook estar ativo e validado com 1–2 e-mails de teste.
- Nenhum disparo de WhatsApp (continua sendo Fase 2 separada).

## Posso prosseguir?

Ao aprovar, eu executo passos 1, 2 e te entrego a URL + peço o secret. O resto segue após você colar o secret.