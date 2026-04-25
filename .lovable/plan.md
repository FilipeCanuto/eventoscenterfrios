## Diagnóstico

Auditei o pipeline completo: cadastro → e-mail de confirmação → lembretes agendados → check-in. Encontrei **uma falha real** que impede o e-mail de confirmação de sair, além de oportunidades de blindagem.

### O que está acontecendo

| Etapa | Estado | Evidência |
|---|---|---|
| `register_for_event` (RPC) | ✅ OK | Inscrição mais recente `bc688131` foi gravada normalmente em 25/04 11:51:39 |
| Frontend chama `send-registration-confirmation` | ✅ OK | Logs da rede mostram a chamada |
| **Edge function `send-registration-confirmation` boota** | ❌ **FALHA** | Único request de hoje retornou **503 no OPTIONS** preflight, e a função **não tem nenhum log** (nem o `console.log("[send-registration-confirmation] invoked")` da linha 24). 503 + ausência total de logs = a função não inicializou. |
| Como consequência: reminders **não foram agendados** para `bc688131` (porque `schedule_event_reminders` é chamado dentro dessa função) | ❌ Falha em cascata | `scheduled_emails` não tem nenhuma linha para essa inscrição |
| `process-reminder-queue` cron | ✅ OK | Tick a cada 5 min, 200 OK |
| Lembretes da inscrição anterior (`b166adb2` de 24/04) | ✅ Agendados corretamente | `reminder_7d` em 28/04 17:00 UTC, `reminder_1d` em 04/05 17:00 UTC, `reminder_2h` em 05/05 15:00 UTC — consistentes com o novo cronograma (evento começa 05/05) |
| Check-in (`get_check_in_window` / `public_check_in`) | ✅ OK | Ajustado na rodada anterior; janela fecha em 08/05 01:00 UTC |

### Por que a função quebrou hoje?

A função roda há semanas e funcionou ainda ontem (registro `b166adb2` tem `confirmation_email_sent_at` gravado). Hoje, na primeira chamada, retornou 503 no preflight sem nenhum log de boot. Isso é típico de:

- Edge function fora de sincronia com o último deploy (possivelmente após mudanças recentes de banco/migrações), OU
- Erro transitório de cold-start no Deno runtime que persistiu.

A correção segura e idempotente é simplesmente **redeployar** a função. O código fonte em `supabase/functions/send-registration-confirmation/index.ts` está íntegro e não precisa de alteração funcional.

---

## Mudanças

### 1. Redeploy das três edge functions de e-mail (correção principal)

Redeploy de `send-registration-confirmation`, `process-reminder-queue` e `enhance-description` para garantir que o runtime está sincronizado com o código atual. Isto resolve o 503 e restabelece o envio do e-mail de confirmação.

### 2. Robustez do frontend: surfacear falha do envio em vez de "fire-and-forget" silencioso

Em `src/pages/Register.tsx` (linhas ~733–763), a chamada hoje é fire-and-forget — se a função der 503, o usuário vê tela de sucesso mas nunca recebe e-mail e não há sinal visível para o admin. Vamos:

- Manter o comportamento não-bloqueante (não trava a inscrição se o e-mail falhar), mas
- Adicionar um aviso discreto (toast warning) quando o invoke retornar erro, com a mensagem "Inscrição confirmada, mas não conseguimos enviar o e-mail agora — entraremos em contato". Isto torna o problema visível.

### 3. Job de "catch-up" para reenviar confirmações perdidas

Para inscrições onde `confirmation_email_sent_at` está ausente em `tracking` e a inscrição é recente (últimas 24h, `status != 'cancelled'`), o `process-reminder-queue` passa a tentar acionar `send-registration-confirmation` no início de cada tick. Isto cria uma rede de segurança automática: se o cliente fechar o navegador antes do invoke, ou se a função estiver indisponível, o cron recupera em até 5 minutos.

Implementação: adicionar no início de `process-reminder-queue/index.ts` um SELECT em `registrations` filtrando por `created_at >= now() - 24h AND status != 'cancelled' AND lead_email IS NOT NULL AND (tracking->>'confirmation_email_sent_at' IS NULL)`, e para cada uma fazer `supabase.functions.invoke('send-registration-confirmation', { body: { registrationId } })`. A função alvo já é idempotente (linhas 92–98 verificam `confirmation_email_sent_at` antes de enviar).

### 4. Reenviar manualmente o e-mail da inscrição de hoje (`bc688131`)

Após o redeploy, invocar a função uma vez para `bc688131-0367-4077-9775-cbb9c8d51d43` (coordenacao01@centerfrios.com) para que o usuário do teste receba o e-mail e os lembretes sejam agendados. Pode ser feito via curl à edge function logo após o deploy.

---

## Validação pós-mudança

- Conferir nos logs de `send-registration-confirmation` a linha `[send-registration-confirmation] invoked`.
- Conferir que `registrations.tracking->>'confirmation_email_sent_at'` é populado para `bc688131`.
- Conferir que três linhas de `scheduled_emails` aparecem para `bc688131` (reminder_7d, reminder_1d, reminder_2h).
- Próximo tick do `process-reminder-queue` (a cada 5 min) deve continuar 200 OK e processar a fila de catch-up sem regressão.
- Fluxo de check-in (`/checkin/...`) já validado na rodada anterior — janela 05/05 17:00 UTC → 08/05 01:00 UTC.

## Detalhes técnicos

Arquivos tocados:
- `supabase/functions/process-reminder-queue/index.ts` — adiciona job de catch-up para confirmações
- `src/pages/Register.tsx` — toast warning quando invoke falhar
- Deploy: `send-registration-confirmation`, `process-reminder-queue`
- Curl pontual: `POST /functions/v1/send-registration-confirmation` com `{registrationId: "bc688131-0367-4077-9775-cbb9c8d51d43"}`

Sem alterações de schema, sem novas tabelas, sem novos secrets (LOVABLE_API_KEY e RESEND_API_KEY já estão configurados).
