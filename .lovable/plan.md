

## Objetivo

Enviar e-mail de confirmação automático ao lead logo após inscrição em `/register/:slug`, contendo: confirmação, dados do evento (nome, data/hora, local), nome do inscrito e selo da marca. Provedor: **Resend** (escolha explícita do usuário).

## Diagnóstico

- Resend é um **connector** disponível (`connector_id: resend`, usa connector gateway).
- Já existe edge function `enhance-description` no projeto, então a infra de functions está ativa.
- A inscrição passa pela RPC `register_for_event` (chamada em `useRegistrations.ts`). Após sucesso, temos `lead_email`, `lead_name` no payload do form e o objeto `event` carregado em `Register.tsx` (com `name`, `event_date`, `event_end_date`, `timezone`, `location_type`, `location_value`, `slug`, `primary_color`, `logo_url`).
- O usuário escolheu Resend explicitamente, então **não usar Lovable Emails**.

## Plano

### 1. Conectar o Resend
- Acionar `standard_connectors--connect` com `connector_id: resend` para que o usuário selecione/crie a conexão.
- Após conectar, `RESEND_API_KEY` e `LOVABLE_API_KEY` ficam disponíveis como secrets em edge functions.
- O usuário precisa ter um **domínio verificado no Resend** (ex.: `centerfrios.com.br` → `eventos@centerfrios.com.br`). Para teste imediato, usaremos `onboarding@resend.dev` como remetente (limitação: só envia para o e-mail dono da conta Resend). Vou informar isso claramente.

### 2. Edge function `send-registration-confirmation`
Criar `supabase/functions/send-registration-confirmation/index.ts`:
- **Input** (POST JSON): `{ registrationId, eventId, recipientEmail, recipientName, eventName, eventDate, eventEndDate, timezone, locationType, locationValue, eventSlug, primaryColor, logoUrl }`.
- **Validação**: Zod no body. Sem auth (chamada do client público após inscrição) — protegida por:
  - rate-limit em memória simples (ip + email, 3/min) para mitigar abuso;
  - validação de que `registrationId` existe na tabela `registrations` (consulta com service role).
- **CORS**: headers padrão do projeto.
- **Envio via gateway**:
  ```
  POST https://connector-gateway.lovable.dev/resend/emails
  Headers: Authorization: Bearer ${LOVABLE_API_KEY}, X-Connection-Api-Key: ${RESEND_API_KEY}
  Body: { from, to, subject, html }
  ```
- **From inicial**: `meuevento <onboarding@resend.dev>` (modo sandbox). Comentário no código indica como trocar para domínio verificado.
- **HTML**: template inline responsivo (max-width 560px), header com `primary_color` do evento e logo (se houver), saudação personalizada, card com data/hora formatadas em pt-BR usando `Intl.DateTimeFormat` com `timezone`, local (online → link, presencial → endereço), botão "Ver página do evento" apontando para `/register/{slug}`, footer minimalista "powered by meuevento". Sem unsubscribe (é transacional 1:1, expectativa do destinatário).

### 3. Disparo do e-mail no client
Em `src/pages/Register.tsx`, no `onSuccess` do `createRegistration.mutateAsync`:
- Chamar `supabase.functions.invoke('send-registration-confirmation', { body: {...} })` em **fire-and-forget** (não bloqueia a UI de sucesso).
- Logar erro silencioso no console (não mostrar erro ao lead — o cadastro foi feito).
- Idempotência: passar `registrationId` retornado pela RPC; a function pode (em iteração futura) marcar `registrations.tracking.confirmation_email_sent_at` para evitar duplicidade. Por enquanto, o disparo só acontece uma vez no fluxo do front.

### 4. Tratamento de erros & observabilidade
- Logs claros na function (`console.log/error`) com prefixos para fácil filtro.
- Retorno 200 mesmo se Resend falhar com 4xx do remetente (logamos), para não bloquear retries inúteis. Erros de auth (401/403) retornam 502 para sinalizar problema de config.

### 5. Comunicação ao usuário (após implementação)
- Informar que o sistema está usando `onboarding@resend.dev` (sandbox) e que para produção é necessário verificar `centerfrios.com.br` no Resend e trocar 1 linha no código (`FROM_ADDRESS`).
- Explicar como testar: fazer uma inscrição com o e-mail dono da conta Resend e conferir a caixa de entrada.

## Arquivos afetados

- **`supabase/functions/send-registration-confirmation/index.ts`** (novo) — edge function com template HTML inline.
- **`src/pages/Register.tsx`** — adicionar `supabase.functions.invoke(...)` no `onSuccess` da inscrição.

## Fora de escopo (próximos passos)

- QR Code do "cartão de presença" no e-mail (depende de gerar QR server-side ou usar serviço externo).
- Lembrete D-1 / D-7 do evento (precisa de cron + tabela de jobs).
- Verificação de domínio próprio no Resend (ação manual do usuário no painel Resend).
- Persistir `confirmation_email_sent_at` em `registrations.tracking` para idempotência server-side.

