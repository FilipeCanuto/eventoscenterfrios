## Diagnóstico definitivo

A função `register_for_event` extrai email/nome buscando chaves em inglês (`Email Address`, `Full Name`), mas o formulário envia em português (`Endereço de E-mail`, `Nome Completo`). Resultado: `lead_email` salvo como `NULL` em **todas as 7 inscrições recentes**. A edge function `send-registration-confirmation` então rejeita com `"No valid email on registration"` e nenhum e-mail é enviado. Confirmado via consulta direta — o email está em `data->>'Endereço de E-mail'` mas não em `lead_email`.

## Correção

### 1. Migration: atualizar `register_for_event`

Adicionar as chaves em pt-BR usadas pelo formulário real:

- Email: `'Endereço de E-mail'`, `'Endereço de Email'`, `'E-mail'` (além das já existentes)
- Nome: já cobre `'Nome Completo'` ✅
- WhatsApp: já cobre `'WhatsApp'` ✅

E **backfill** das 7 inscrições existentes:

```sql
UPDATE registrations SET 
  lead_email = lower(trim(COALESCE(data->>'Endereço de E-mail', data->>'email', ...))),
  lead_name  = trim(COALESCE(data->>'Nome Completo', data->>'Full Name', ...)),
  lead_whatsapp = regexp_replace(COALESCE(data->>'WhatsApp', ''), '\D', '', 'g')
WHERE lead_email IS NULL;
```

### 2. Reenvio dos e-mails pendentes

Após o backfill, as 7 inscrições terão `lead_email` válido e `tracking.confirmation_email_sent_at` ainda nulo (idempotência). Vou expor um endpoint admin simples ou reaproveitar a função existente: invocar `send-registration-confirmation` para cada `registrationId` recente via script único no console do navegador (forneço o snippet).

### 3. Verificação pós-correção

- Conferir logs da edge function (`supabase--edge_function_logs`) para confirmar entrega.
- Validar via `supabase--read_query` que `tracking.confirmation_email_sent_at` foi preenchido.

## Arquivos afetados

- **Migration SQL** (novo) — `CREATE OR REPLACE FUNCTION register_for_event(...)` com chaves pt-BR + UPDATE de backfill.
- Nenhum arquivo de código frontend/edge precisa mudar — a edge function já lê `lead_email` corretamente; só faltava a coluna estar populada.

## Fora de escopo

- Verificação do domínio `centerfrios.com` no Resend (ação manual).
- Trocar `FROM_ADDRESS` para `eventos@centerfrios.com` (faço junto se você confirmar que o domínio já está verificado).  
  
(O domínio já está verificado)