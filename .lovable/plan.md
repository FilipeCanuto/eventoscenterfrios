
# Auditoria — Circuito Experience: Centerfrios & Skymsen

Evento ao vivo, 207 inscrições, começa em **~36 horas** (05/05 às 14h BRT). Investiguei banco de dados, edge functions, agendamentos e código. Abaixo, o que encontrei e o que precisa ser feito **antes do evento**.

---

## Achados críticos (precisam ser corrigidos hoje)

### C1 — 70% das inscrições (146 de 207) NÃO têm e-mail de confirmação entregue
O log mostra apenas **64 envios `sent`** e **2.390 envios `skipped` com motivo `dedupe_recipient_event`**. Esse "dedupe" foi acionado em looping pelo backfill, mascarando a falha real: muitos inscritos simplesmente nunca tiveram a confirmação processada com sucesso na primeira tentativa.

### C2 — 15 inscrições recentes (após 30/04) estão SEM lembrete agendado
A função `schedule_event_reminders` só é chamada **dentro do `send-registration-confirmation`**, *depois* dos blocos de dedupe. Quando a confirmação é abortada por dedupe (segunda inscrição com o mesmo e-mail) ou por e-mail inválido, **o agendamento dos lembretes nunca acontece**. Resultado: essas 15 pessoas não receberão lembrete 1 dia antes nem 2 horas antes.

Inscritos afetados incluem: josesalmeida@hotmail.com, ronatasilvajr.rj@gmail.com, alexaleixo2008@gmail.com, dygo4p@gmail.com, alexandreflp2@hotmail.com, fabricio_fba@hotmail.com, pousadamahonmar70@gmail.com, e mais 8.

### C3 — 29 e-mails duplicados geram inscrições "fantasma" sem comunicação
58 inscrições compartilham e-mail com outra (mesma pessoa se inscreveu 2x, ou cadastrou colega usando o próprio e-mail). A regra atual envia confirmação só para a primeira e marca as demais como `skipped`. As segundas inscrições aparecem na lista de participantes mas **não recebem nenhum e-mail** — nem confirmação, nem lembrete.

### C4 — 3 inscrições com e-mail inválido travado
- `d**********@gmail.com` (Diego Cassiano) — e-mail mascarado, claramente erro de cadastro
- `su~carmo@hotmail.com` (Suzana) — caractere `~` inválido
- `let'spizzarulliam@gmail.com` (Diego Rulliam) — apóstrofo inválido

Estas 3 pessoas estão inscritas mas o sistema não consegue enviá-las. Ninguém foi notificado para corrigir.

---

## Achados de média gravidade

### M1 — 432 lembretes enfileirados, mas só 192 por tipo (1d e 2h)
Diferença de 15 inscrições entre o total ativo (207) e os lembretes agendados (192) — efeito colateral do C2.

### M2 — 2 inscritos em lista de supressão (suppressed_emails)
Bouncearam ou marcaram como spam em campanhas anteriores. Não receberão nada e não há aviso visível ao organizador.

### M3 — 48 lembretes `reminder_7d` foram enviados (status `sent`)
O sistema atual está marcado para usar só `reminder_1d` e `reminder_2h`, mas 48 reminders de 7 dias antes saíram. Resíduo de configuração antiga — não é bug ativo, mas polui métricas.

### M4 — Função RPC `register_for_event` não dispara `schedule_event_reminders`
O agendamento depende exclusivamente do edge function de confirmação rodar até o fim. Se o edge function falhar (cold start, timeout, indisponibilidade Resend), a inscrição grava mas nunca recebe lembretes. Acoplamento frágil.

---

## Achados de baixa gravidade

### B1 — Janela de dedupe de 30 dias é fixa em código (`DEDUPE_WINDOW_DAYS`)
Não está exposta no painel; difícil de ajustar sem deploy.

### B2 — Validação de e-mail acontece só no envio, não na inscrição
O formulário público aceita `let'spizzarulliam@gmail.com` sem reclamar; o erro só aparece horas depois no log.

### B3 — Logs `skipped` (2.390 entradas) inflam a tabela `email_send_log`
Ruído nas métricas e no painel de auditoria.

### B4 — Sem alerta proativo para o organizador
Nenhuma notificação no dashboard avisa "X inscritos não receberão nenhum e-mail". Visibilidade depende de abrir aba a aba.

---

## Plano de correção (ordem de execução)

### Fase 1 — Hotfix imediato (antes do evento, hoje)

1. **Agendar lembretes para todas as 207 inscrições ativas** independentemente do status de confirmação. Migração SQL que executa `schedule_event_reminders(id)` para cada inscrição do evento que ainda não tem `reminder_1d` agendado. Resolve C2 e M1.

2. **Desacoplar agendamento de lembretes do envio de confirmação.** Adicionar trigger no Postgres em `registrations AFTER INSERT` que chama `schedule_event_reminders` automaticamente. Garante que toda inscrição futura tenha lembretes, mesmo que o edge function falhe. Resolve M4.

3. **Reenviar confirmação para os 146 inscritos sem entrega.** Botão "Reenviar para todos os pendentes" no painel de auditoria do evento, ignorando o dedupe `recipient_event` para envios manualmente solicitados pelo organizador. Resolve C1.

4. **Mostrar lista de inscrições com e-mail inválido + ação rápida para corrigir.** Bloco destacado no topo da aba "E-mails" do evento listando os 3 e-mails travados, com input inline para o organizador editar e disparar reenvio. Resolve C4.

### Fase 2 — Tratamento de duplicatas (esta semana)

5. **Tela de "Inscrições duplicadas"** mostrando os 29 e-mails compartilhados por 2 inscrições. Para cada par, organizador escolhe: cancelar a duplicata, manter as duas e enviar e-mails separados (override do dedupe), ou marcar como acompanhante (sem comunicação). Resolve C3.

6. **Validação de e-mail no formulário público** (regex no cliente + validação RPC) impedindo apóstrofo, til e formatos quebrados antes da gravação. Previne novos casos como C4.

### Fase 3 — Higiene e visibilidade (próxima sprint)

7. **Painel de saúde do evento** no topo do dashboard de cada evento: card vermelho quando há inscritos sem confirmação ou sem lembrete agendado, com link direto para a aba de ação. Resolve B4.

8. **Limpeza dos logs `skipped`**: deixar de gravar log quando o motivo é `dedupe_recipient_event` (já é uma decisão silenciosa) e marcar os 2.390 existentes como `archived`. Resolve B3.

9. **Cancelar e arquivar os `reminder_7d`** órfãos. Resolve M3.

10. **Aviso visível para inscritos em lista de supressão**: badge "E-mail suprimido" na linha do participante com tooltip explicando o motivo. Resolve M2.

---

## Detalhes técnicos

**Arquivos e objetos envolvidos:**
- `supabase/migrations/<nova>.sql` — backfill de `schedule_event_reminders`, trigger `AFTER INSERT` em `registrations`, cancelamento de `reminder_7d` pendentes, arquivamento de logs `skipped`.
- `supabase/functions/send-registration-confirmation/index.ts` — mover chamada de `schedule_event_reminders` para **antes** dos blocos de dedupe; aceitar flag `skipDedupe` quando vier de retry manual.
- `supabase/functions/backfill-confirmations/index.ts` — adicionar modo `force=true` por `registrationIds` ignorando dedupe `recipient_event`.
- `src/components/event-detail/EventEmailAudit.tsx` — bloco de "E-mails inválidos" + botão "Reenviar todos os pendentes (forçar)".
- `src/components/event-detail/EventDuplicates.tsx` (novo) — tela de duplicatas.
- `src/pages/Register.tsx` + `register_for_event` RPC — validação regex de e-mail.
- `src/components/event-detail/EventHealthBanner.tsx` (novo) — banner de saúde no topo do dashboard.

**Por que o trigger `AFTER INSERT` é seguro:** `schedule_event_reminders` já existe como `SECURITY DEFINER`, é idempotente (UNIQUE em `registration_id, email_type` + `ON CONFLICT DO UPDATE`), e roda em ms. Não bloqueia a inscrição.

**Risco zero para os 64 já confirmados:** todas as ações são aditivas (agendar, reenviar com `force`); não tocam em registros já entregues.

---

## Resumo executivo

Estado atual a 36h do evento: **70% dos inscritos sem confirmação, 7% sem lembretes agendados, 14% com inscrição duplicada sem comunicação, 3 inscrições travadas por e-mail inválido**. A Fase 1 corrige os quatro pontos críticos antes do evento começar. As Fases 2 e 3 evitam que o problema se repita nos próximos eventos.

**Posso prosseguir com a Fase 1 (hotfix imediato) agora?**
