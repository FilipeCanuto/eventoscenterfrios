## Resumo

Vamos transformar o e-mail único de confirmação em uma **sequência de aquecimento de 3 disparos** automáticos até o evento, ajustar o **check-in** para registrar **data/hora real do escaneamento** (sem alterar o status pré-evento na visão geral), e adicionar pequenas melhorias de experiência para manter o inscrito engajado.

---

## 1. Sequência de e-mails de aquecimento (3 disparos)

Cada inscrito receberá automaticamente:


| #   | Quando                     | Assunto (exemplo)                                        | Objetivo                                                              |
| --- | -------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------- |
| 0   | Imediato                   | "Inscrição confirmada — {evento}"                        | Confirmação + QR (já existe hoje)                                     |
| 1   | **7 dias antes** do evento | "Faltam 7 dias para {evento} — prepare-se"               | Reativar interesse, dicas de preparação, link para adicionar à agenda |
| 2   | **1 dia antes**            | "Amanhã é o dia! Tudo pronto para o {evento}?"           | Lembrete final, local/link, QR de check-in em destaque                |
| 3   | **2 horas antes**          | "Começa em 2h — seu QR Code está pronto para o Check-In" | Último aviso prático, QR em primeiro plano, instruções de chegada     |


**Templates fixos em pt-BR**, usando variáveis dinâmicas (nome do inscrito, nome do evento, data/hora formatada, local, QR Code). Você não precisa escrever nada por evento.

**Como funciona tecnicamente:**

- Nova tabela `scheduled_emails` registra os 3 envios programados no momento da inscrição (com `send_at` calculado a partir de `event_date`).
- Um **cron job** (executado a cada 5 min) busca e-mails com `send_at <= now()` e status `pending`, dispara via Resend e marca como `sent`.
- Se o evento mudar de data, os envios são reagendados automaticamente.
- Se o inscrito cancelar, os envios pendentes são cancelados.
- Idempotência garantida (não envia duplicado mesmo com retry).

**Cancelamento por inscrito:** cada e-mail terá link "não quero mais receber lembretes deste evento" → marca todos os envios futuros daquele `registration_id` como `cancelled`.

---

## 2. Check-in: registrar data/hora apenas no escaneamento

**Comportamento atual:** status do inscrito é `registered` até alguém escanear o QR, que muda para `checked_in`.

**Mudanças:**

- Adicionar coluna `checked_in_at` (timestamp) na tabela `registrations` — fica `NULL` até o escaneamento real.
- A função `public_check_in` passa a preencher `checked_in_at = now()` no momento do escaneamento.
- **Bloqueio inteligente:** o QR só registra check-in se `now()` estiver dentro de uma janela do evento (de 4h antes do início até 4h após o fim). Fora dessa janela, mostra mensagem "Check-in disponível a partir de {data/hora}" — sem alterar o registro.
- Na **planilha de participantes** (Attendees Table):
  - Todos os inscritos continuam visíveis desde a inscrição (sem mudança).
  - Nova coluna **"Check-in em"** mostra a data/hora real do escaneamento, ou fica vazia/em branco se ainda não foi feito.
  - Filtro adicional "Apenas check-in confirmado" para separar quem realmente compareceu de quem só se inscreveu.
  - Exportação CSV passa a incluir essa coluna.

---

## 3. Outras melhorias para manter inscritos "aquecidos"

**Implementadas neste mesmo plano (sem custo extra):**

1. **Botão "Adicionar à agenda" (.ics)** — link em todos os e-mails que gera arquivo de calendário (Google/Apple/Outlook). Reduz drasticamente o no-show.
2. **Contagem regressiva no e-mail de 1 dia antes** — bloco visual destacando "faltam X horas".
3. **QR Code em destaque crescente** — no e-mail #1 aparece pequeno, no #2 médio, no #3 ocupa a maior parte do e-mail (para escaneamento direto da tela).
4. **Página pública do evento com countdown** — quando o inscrito clica de volta na página, vê quantos dias faltam.
5. **Mensagem personalizada no check-in** — após escanear, além do "Checkin Realizado", exibir "Aproveite o evento, {nome}!" com cores do evento.

**Sugestões para iterações futuras (não implementadas agora — só me avise se quiser):**

- E-mail de pré-pesquisa ("o que você espera do evento?") 3 dias antes
- Notificação por WhatsApp via Zapier/n8n
- E-mail pós-evento com agradecimento + foto + pesquisa NPS
- "Convide um amigo" com link rastreável

---

## Detalhes técnicos

**Banco de dados (migração):**

- Nova tabela `scheduled_emails`: `id`, `registration_id`, `event_id`, `email_type` (`reminder_7d` | `reminder_1d` | `reminder_2h`), `send_at`, `status` (`pending` | `sent` | `cancelled` | `failed`), `sent_at`, `error`, RLS para owners do evento.
- Índice em `(status, send_at)` para o cron processar rapidamente.
- Coluna `checked_in_at timestamptz NULL` em `registrations`.
- Função `schedule_event_reminders(p_registration_id uuid)` (SECURITY DEFINER) que insere as 3 linhas calculando `send_at` a partir de `events.event_date`.
- Função `reschedule_event_reminders(p_event_id uuid)` para quando a data mudar.
- Atualização da `public_check_in` para validar janela do evento e preencher `checked_in_at`.

**Edge functions:**

- `send-registration-confirmation` (existente) — após enviar a confirmação, chamar `schedule_event_reminders`.
- `process-reminder-queue` (nova) — disparada por cron a cada 5 min, busca e-mails pendentes vencidos, monta HTML/texto via templates compartilhados e envia via Resend.
- Templates extraídos para `_shared/email-templates/` (confirmation, reminder-7d, reminder-1d, reminder-2h) reaproveitando o visual atual.

**Cron (pg_cron + pg_net):**

```sql
select cron.schedule(
  'process-reminder-queue',
  '*/5 * * * *',
  $$ select net.http_post(url:='...functions/v1/process-reminder-queue', ...) $$
);
```

**Frontend:**

- `EventAttendeesTable` e `Attendees`: nova coluna "Check-in em" + filtro.
- `CheckIn.tsx`: tratar novo retorno `outside_window` da RPC.
- Botão `.ics` gerado client-side a partir dos dados do evento (sem nova dependência — função utilitária ~30 linhas).

---

## Validação

1. Inscrever-se em um evento de teste com data daqui a 8 dias → 3 linhas em `scheduled_emails` com `send_at` correto.
2. Antecipar manualmente o `send_at` de um lembrete e aguardar o cron → e-mail chega com o template correto.
3. Cancelar inscrição → linhas pendentes ficam `cancelled`.
4. Escanear QR antes da janela → mensagem "Check-in disponível a partir de…", coluna `checked_in_at` continua vazia.
5. Escanear dentro da janela → confetes + `checked_in_at` preenchido + planilha atualiza.
6. Mudar a data do evento no painel → reagendamento automático recalcula `send_at`.
7. Exportar CSV de participantes → inclui coluna "Check-in em".