## Diagnóstico (confirmado)

Testei o endpoint diretamente:

```
POST https://ahwecyjzzczcwunptxae.supabase.co/functions/v1/send-registration-confirmation
→ HTTP 404
```

**A edge function nunca foi deployada.** Por isso:

- Não há **nenhum log** (`supabase--edge_function_logs` retorna vazio).
- Nenhum e-mail foi enviado em nenhuma das tentativas.
- O usuário não vê erro porque a chamada no client é fire-and-forget (`.catch(console.warn)`), e logs do client foram limpos.

A causa raiz é que o arquivo `supabase/functions/send-registration-confirmation/index.ts` foi criado, mas o deploy não aconteceu (ou falhou silenciosamente). Além disso, faltam dois reforços de robustez:

1. `**supabase/config.toml**` não declara a função com `verify_jwt = false`. A página `/register/:slug` é pública (lead não-autenticado), então sem isso o gateway pode rejeitar a chamada antes de chegar ao código da função.
2. **Observabilidade zero no client**: o `.catch(console.warn)` esconde 401/403/404. Vou trocar por um log mais visível (sem incomodar o lead) para diagnóstico futuro.

## Plano de correção

### 1. Garantir deploy da edge function

- Reescrever (idempotente) `supabase/functions/send-registration-confirmation/index.ts` para forçar o redeploy.
- Adicionar bloco em `supabase/config.toml`:
  ```toml
  [functions.send-registration-confirmation]
  verify_jwt = false
  ```
  Isso permite invocação pelo client público sem sessão (o lead não está logado).

### 2. Melhorar observabilidade

- No `Register.tsx`, trocar `console.warn` por `console.error` com prefixo `[confirmation-email]` e logar `status` + `body` da resposta quando `invoke` retornar erro. Sem `toast` ao lead — a inscrição em si foi bem-sucedida.
- Acrescentar `console.log` na entrada da edge function ("[send-registration-confirmation] invoked", payload mínimo) para confirmar invocação ao testar.

### 3. Validar pós-deploy

- Após deploy, fazer uma chamada de teste via `curl` ao endpoint com um `registrationId` real e conferir os logs em tempo real.
- Confirmar que `RESEND_API_KEY` e `LOVABLE_API_KEY` estão ativos como secrets (✅ já confirmados na configuração — Resend está conectado).

### 4. Lembrete de sandbox (não é bug — só comunicação)

A função usa `from: onboarding@resend.dev` (modo sandbox do Resend). **Nesse modo, o Resend só entrega para o e-mail dono da conta Resend (Filipe).** E-mails para qualquer outro destinatário são aceitos pela API mas **silenciosamente descartados/bounced** pelo Resend.

- Para teste imediato: usar o e-mail do Filipe na inscrição.
- Para produção real: verificar `centerfrios.com.br` no painel do Resend e trocar `FROM_ADDRESS` para `eventos@centerfrios.com.br`.

## Arquivos afetados

- `**supabase/functions/send-registration-confirmation/index.ts**` — touch/reescrita idêntica para forçar redeploy + log de entrada.
- `**supabase/config.toml**` — adicionar bloco `[functions.send-registration-confirmation]` com `verify_jwt = false`.
- `**src/pages/Register.tsx**` — melhorar log de erro do `invoke` (sem afetar UX do lead).

## Fora de escopo

- Verificação do domínio `centerfrios.com.br` no Resend (ação manual no painel Resend; depende do DNS do cliente).
- Persistir status detalhado de envio em `email_send_log` (a função já marca `tracking.confirmation_email_sent_at` para idempotência — suficiente por ora).  
  
(Observação: nosso domínio não é "centerfrios.com.br" é "centerfrios.com")