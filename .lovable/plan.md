## Diagnóstico

Evento ativo: **Circuito Experience: Centerfrios & Skymsen**
- `event_date`: 05/05 14h (BRT) → `event_end_date`: 07/05 18h (BRT)
- `registration_deadline`: 05/05 14h (BRT) — **já expirou** ⇒ novas inscrições estão sendo rejeitadas pela função `register_for_event`.
- 269 inscritos, 15 com check-in, sem cancelados. Janela do `/checkin-rapido` está aberta (até 07/05 22h BRT).

### Por que alguns check-ins falham
A função `public_check_in_by_email` está correta. Os erros que vocês veem são quase todos `not_found` — pessoas que **nunca se inscreveram** e por isso não aparecem na busca por e-mail. Hoje a única saída é mandá-las à recepção. Vamos resolver permitindo inscrição + check-in na hora.

Há também 38 e-mails duplicados (ex.: 3 inscrições do mesmo e-mail). A função já trata: pega a mais recente. Não é causa de erro.

---

## Plano de correção

### 1. Permitir inscrição até o fim do evento

Atualizar a função `register_for_event` para que o prazo efetivo seja **`COALESCE(registration_deadline, event_end_date, event_date)`**, mas **nunca antes do `event_end_date`**. Ou seja, inscrição fica aberta até o último minuto do último dia.

Em SQL: trocar
```
IF registration_deadline IS NOT NULL AND now() > registration_deadline THEN reject
```
por
```
v_cutoff := GREATEST(
  COALESCE(v_event.registration_deadline, 'epoch'::timestamptz),
  COALESCE(v_event.event_end_date, v_event.event_date, 'infinity'::timestamptz)
);
IF now() > v_cutoff THEN reject
```

Resultado: enquanto o evento estiver "live" e dentro do `event_end_date`, a inscrição é aceita — mesmo após o `registration_deadline` antigo.

### 2. Inscrição + check-in na hora pelo `/checkin-rapido`

Adicionar fluxo secundário na mesma página:

- Quando o resultado for `not_found`, em vez de só "Procure a recepção", mostrar botão **"Não tenho inscrição — fazer agora"**.
- Abre um mini-form (mesmos campos mínimos do registro: Nome, E-mail pré-preenchido, WhatsApp).
- Submit chama:
  1. `register_for_event(p_event_id, p_data)` com o evento aberto (escolhe automaticamente se houver só um evento "live" agora; se houver mais de um, pede para escolher antes — reaproveita o estado `multiple_events`).
  2. Em sequência, `public_check_in_by_email(email, event_id)` para já marcar presença.
- Sucesso: mostra a mesma tela ✅ "Check-in Realizado" + confete.

Como o `/checkin-rapido` é público (anon), o `register_for_event` já é `SECURITY DEFINER` e aceita chamadas anônimas — sem mudança de RLS.

Para descobrir o evento aberto sem precisar do e-mail existir, criar uma RPC auxiliar:
```
public_get_open_events_for_checkin() returns jsonb
  -- lista eventos live cuja janela de check-in está aberta agora
```
Pública (anon EXECUTE). Usada apenas para popular o seletor quando há mais de um evento simultâneo.

### 3. Pequenos polimentos no `/checkin-rapido`

- Mensagem de `not_found` passa a sugerir o botão "Inscrever agora".
- Texto do `outside_window` mantido.
- Manter botão "Próximo participante" para limpar e atender o próximo.

### 4. Validação

- Testar `register_for_event` chamando via `curl` (sem auth) com payload mínimo após a migration.
- Testar `public_check_in_by_email` com e-mail recém-criado → deve retornar `success`.
- Confirmar que duplicatas continuam respeitando os limites (`max 5 por e-mail`, `1 por WhatsApp`).

---

## Arquivos afetados

- **Migration SQL** — atualiza `register_for_event` (deadline = fim do evento) e cria `public_get_open_events_for_checkin()` com GRANT para `anon`.
- **`src/pages/CheckInRapido.tsx`** — adiciona fluxo "Inscrever agora" no estado `not_found`, mini-form, e chamada encadeada register→check-in.
- (Sem mudança em RLS, edge functions ou tipos manuais.)

---

## Fora de escopo (intencional)

- Não alteramos `registration_deadline` no banco (preserva intenção original de cada evento; a regra nova fica na função e vale para todos).
- Não adicionamos captcha — a função já tem rate-limit de payload e o WhatsApp único por evento limita abuso.
- Não mexemos no fluxo de e-mails de confirmação para inscrições "na hora" (o trigger existente já dispara a confirmação automaticamente).