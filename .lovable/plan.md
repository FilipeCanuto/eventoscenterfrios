## Garantir consistência das datas do evento (3 dias: 05, 06 e 07/05/2026)

### Auditoria realizada

Procurei datas hardcoded em todo o código (`05/05`, `06/05`, `07/05`, `08/05`, `2026`, `maio`) e no banco. Resultados:

| Local | Estado | Observação |
|---|---|---|
| `src/pages/Register.tsx` (comentário linha 416) | OK | Apenas um comentário ilustrativo; não afeta funcionamento |
| `form_fields.options` (Dias de Comparecimento) | ✅ OK | Já contém os 3 dias corretos |
| `registrations.data` (1 inscrição com dias preenchidos) | ✅ OK | Já migrado para os 3 dias com `/2026` |
| **`events.event_end_date`** | ❌ **Inconsistente** | Atualmente `2026-05-08 21:00:00+00` (dia 8) |
| **`events.registration_deadline`** | ❌ **Inconsistente** | Atualmente `2026-05-08 00:00:00+00` (dia 8) |
| `events.event_date` | ✅ OK | `2026-05-05 17:00:00+00` |

Esses dois campos do registro do evento (`cfd9d79d-78d3-45d8-bdc7-1250314ec2c4`) ainda estão alinhados com o cronograma antigo de 4 dias. Eles afetam:

- **Janela de check-in** (`get_check_in_window` / `public_check_in`): usa `event_end_date + 4h`. Hoje a janela só fecha à 01:00 do dia 09/05. Deve fechar à 01:00 do dia 08/05.
- **Bloqueio de inscrições** (`register_for_event`): hoje o formulário aceita inscrições até 08/05 00:00. Deve fechar no início do evento (ou antes).
- **Exibição da data fim** no header e na página pública.

### Mudanças

1. **Atualizar `events`** (insert tool / UPDATE) para o evento `cfd9d79d-78d3-45d8-bdc7-1250314ec2c4`:
   - `event_end_date` → `2026-05-07 21:00:00-03` (quinta, 07/05/2026 18:00 BRT → mesmo horário de término que existia, porém no dia correto). Mantenho a duração diária equivalente (17:00 → 21:00 UTC = 14:00 → 18:00 BRT).
   - `registration_deadline` → `2026-05-05 17:00:00+00` (alinhado ao início do evento; impede inscrições após o início do primeiro dia).

2. **Sem alterações de código**: nenhuma referência hardcoded ao 08/05 ou às datas no TypeScript/SQL além do comentário citado, que não interfere. O comentário será atualizado para refletir o novo formato `Terça, 05/05/2026` para evitar confusão futura.

3. **Sem alteração em funções/triggers**: `reschedule_event_reminders` é disparada via trigger sempre que `event_date` muda; como vamos alterar apenas `event_end_date` (não `event_date`), os lembretes existentes continuam corretos.

### Detalhes técnicos

```sql
UPDATE events
   SET event_end_date = '2026-05-07 21:00:00+00',
       registration_deadline = '2026-05-05 17:00:00+00'
 WHERE id = 'cfd9d79d-78d3-45d8-bdc7-1250314ec2c4';
```

Edição menor em `src/pages/Register.tsx` linha 416: trocar o exemplo `"Terça, 05/05"` por `"Terça, 05/05/2026"` no comentário.

### Validação pós-mudança

- No dashboard do evento: o header passa a exibir `05/05/2026 – 07/05/2026`.
- Tentar simular inscrição após 05/05 17:00 UTC → deve retornar "Registration deadline has passed".
- `SELECT * FROM get_check_in_window(<reg_id>)` deve retornar janela terminando em `2026-05-08 01:00:00+00`.
- Verificar que `scheduled_emails` permanecem com `send_at` calculados a partir de `event_date` (05/05) — sem alteração.
