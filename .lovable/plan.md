## Alteração: dias do evento de 4 para 3 dias

### Situação atual
O campo `Dias de Comparecimento` (form_fields, tipo `multiselect`) tem hoje 4 opções:
- `Terça, 05/05`
- `Quarta, 06/05`
- `Quinta, 07/05`
- `Sexta, 08/05`

Existe **1 registro** em `registrations` com a opção antiga `"Sexta, 08/05"` selecionada (id `b166adb2-…`).

### Mudanças

1. **Atualizar opções do campo de formulário** (`form_fields.options` do registro `6213f593-b949-4af3-84fe-92381e9a31b9`) para refletir 3 dias com ano 2026:
   - `Terça, 05/05/2026`
   - `Quarta, 06/05/2026`
   - `Quinta, 07/05/2026`

2. **Migrar dados da inscrição existente**: remover `"Sexta, 08/05"` e atualizar os rótulos remanescentes para o novo formato com `/2026`, mantendo a string separada por `", "` no JSONB `data->'Dias de Comparecimento'`.

3. **Sem mudanças de código**: a lógica de checkboxes em `src/pages/Register.tsx` (já corrigida com separador `\u001F`) funciona com qualquer conjunto de opções — só lê de `form_fields.options`.

### Pergunta de confirmação
Os rótulos das opções devem incluir o ano (`Terça, 05/05/2026`) ou manter o formato curto atual (`Terça, 05/05`)? Vou assumir **com `/2026`** para evitar ambiguidade, salvo indicação contrária no aprovar.

### Validação pós-mudança
- Abrir página pública de registro: aparecem apenas 3 checkboxes.
- Marcar/desmarcar cada um e submeter uma inscrição de teste.
- Conferir no dashboard que o detalhe do participante migrado mostra apenas os 3 dias válidos.
