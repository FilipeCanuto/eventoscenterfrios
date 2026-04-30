## O que vou fazer

Aplicar quatro melhorias coordenadas: (1) remover o lembrete de 7 dias do produto, (2) garantir validação e normalização avançadas de e-mail antes de qualquer envio, (3) blindar o sistema contra envio duplicado para o mesmo destinatário, e (4) ajustar o ritmo de disparo em todos os pontos para ficar bem abaixo do limite do Resend e evitar bloqueios.

---

### 1. Remover o lembrete de 7 dias

- **Banco**: nova migração que
  - atualiza a função `schedule_event_reminders` para parar de enfileirar `reminder_7d`,
  - atualiza `reschedule_event_reminders` removendo o ramo de 7 dias,
  - cancela (`UPDATE scheduled_emails SET status='cancelled'`) todos os `reminder_7d` ainda `pending` (não apaga, preserva histórico).
- **Edge functions**:
  - `process-reminder-queue`: nada a mudar (lê o que está pending, e os pending de 7d serão cancelados).
  - `render-email-preview`: remover `reminder_7d` da lista válida.
- **Front**:
  - `RegistrationTemplatesTab.tsx` e `RegistrationEmailsTab.tsx`: remover o item "Lembrete — 7 dias antes".
- **Templates**: deixo a função `buildReminder7d` no arquivo (sem custo) para não quebrar histórico antigo já enviado, mas ela deixa de ser referenciada.

### 2. Validação e normalização avançadas de e-mail

Centralizo num utilitário `_shared/email-validate.ts` reutilizado por **todas** as funções (`send-registration-confirmation`, `process-reminder-queue`, `backfill-confirmations`):

- `normalizeEmail(raw)`: `trim`, lowercase, remove espaços invisíveis (zero-width, NBSP), corrige `,` por `.` no domínio, remove ponto final acidental.
- `validateEmail(email)`:
  - regex RFC-pragmática (sem TLD numérico, exige TLD ≥2 letras),
  - rejeita pontos consecutivos, `@` ausente/duplicado, comprimento >254 e local-part >64,
  - lista negra de TLDs claramente inválidos (`.con`, `.cmo`, `.comm`, `.ne`, `.og`).
- `suggestEmailFix(email)`: já existe no front; movo a tabela canônica para o shared (gmial→gmail, hotnail→hotmail, yaho→yahoo, outloo→outlook, icluod→icloud, bol.com→bol.com.br, etc.) e uso também no servidor para **autocorreção silenciosa** (ex.: `gmial.com` → `gmail.com`) ANTES de enviar, registrando no log o ajuste aplicado.
- `isDisposableOrRoleEmail(email)`: bloqueia envio para listas conhecidas de descartáveis e role-based (`postmaster@`, `noreply@`, `mailer-daemon@`).

Em qualquer envio, se a validação falhar:
- registra em `email_send_log` com `status='failed'` e `error_message='invalid_email_address: <motivo>'`,
- adiciona em `suppressed_emails` com `reason='invalid_format'`,
- não conta como tentativa contra o Resend (não chama o gateway).

No formulário de inscrição (`Register.tsx`) também aplico a mesma normalização + autocorreção (já existia para typos, agora unificada com o servidor) antes de chamar `register_for_event`, evitando que e-mails ruins entrem no banco.

### 3. Anti-duplicação por destinatário

Garantia em três camadas:

1. **Pré-checagem por log**: antes de enviar qualquer `confirmation`, verifico se existe linha em `email_send_log` com mesmo `registration_id` + `email_type='confirmation'` + `status='sent'`. Se sim, retorno `alreadySent`.
2. **Pré-checagem por destinatário+tipo+evento**: nova consulta em `email_send_log` que cruza `recipient_email` (normalizado) + `email_type` + `event_id` (via join com `registrations`) nos últimos 30 dias. Se houver `sent` recente, **não reenvio**, mesmo que o `registration_id` seja diferente. Isso cobre o caso do mesmo e-mail em duas inscrições do mesmo evento.
3. **Backfill blindado**: o `backfill-confirmations` já consulta o Resend para "delivered". Adiciono também a checagem do nº 2. E na flag `tracking.confirmation_email_sent_at` continuo respeitando.

Para a fila de lembretes (`scheduled_emails` já tem UNIQUE em `(registration_id, email_type)`), adiciono uma checagem extra antes do disparo: se já existe `email_send_log` com `status='sent'` para `registration_id + email_type` daquele item, marco o item como `sent` sem reenviar.

### 4. Ritmo seguro (anti-banimento)

Hoje o backfill envia em lotes de 8 com 1.1s, e o cron processa 25/ciclo. Vou reduzir a:

- **`backfill-confirmations`**: lotes de **5** sequenciais (não em `Promise.all`), com **400ms** entre cada envio individual e **2s** entre lotes. Resultado: ~2 envios/seg, **bem abaixo** dos 10/s do Resend, dando margem inclusive em rajada com a fila normal.
- **`process-reminder-queue`**: BATCH_SIZE de **15** (era 25), com **300ms** de pausa entre cada item dentro do batch. O cron continua chamando a cada minuto.
- **Cooldown global compartilhado**: ambas as functions já consultam `email_send_state.cooldown_until`. Adiciono uma pausa adicional de 60s **após qualquer 429** retornado pelo Resend, registrando o evento.
- **Envio em série, não paralelo**: troco os `Promise.all` do backfill por `for ... of` para garantir o espaçamento real (paralelismo estoura o rate-limit instantâneo mesmo respeitando média).

---

### Detalhes técnicos

**Arquivos novos**
- `supabase/functions/_shared/email-validate.ts` — `normalizeEmail`, `validateEmail`, `suggestEmailFix`, `isDisposableOrRoleEmail`.
- Migração: `..._drop_reminder_7d.sql` — recria as 2 funções sem o ramo de 7d e cancela pendentes.

**Arquivos editados**
- `supabase/functions/send-registration-confirmation/index.ts` — usa `normalizeEmail`/`validateEmail`/`suggestEmailFix`, pré-checa duplicidade por destinatário+evento+tipo (30d).
- `supabase/functions/process-reminder-queue/index.ts` — BATCH 15, pausa 300ms entre itens, pré-checa log antes de disparar, ignora qualquer item `reminder_7d` remanescente.
- `supabase/functions/backfill-confirmations/index.ts` — sequencial, lotes 5, pausas 400ms/2s, usa o validator compartilhado, pré-checa duplicidade.
- `supabase/functions/render-email-preview/index.ts` — remove `reminder_7d` da lista válida.
- `src/components/dashboard/RegistrationEmailsTab.tsx` — remove rótulo do 7d.
- `src/components/dashboard/RegistrationTemplatesTab.tsx` — remove card do 7d.
- `src/pages/Register.tsx` — usa o mesmo `normalizeEmail` (mantém `suggestEmailFix` já existente).

**Sem alterações de schema** além da migração que reescreve as duas funções e cancela pendentes; nenhuma coluna nova, nenhum índice novo.

**Sem aumento de custo** — apenas reduz envios.

### Resultado esperado

1. Nenhum e-mail de "7 dias antes" sai mais (nem para inscritos antigos com pendências).
2. E-mails com typos comuns (`gmial.com`, `hotnail.com`, `yaho.com`...) são autocorrigidos antes de bater no Resend; inválidos são bloqueados localmente e não geram bounce.
3. Mesmo destinatário não recebe a mesma confirmação duas vezes — nem entre inscrições diferentes do mesmo evento.
4. Throughput de envio fica em ~2/s no backfill e ~3/s na fila regular, bem dentro do limite de 10/s do Resend.