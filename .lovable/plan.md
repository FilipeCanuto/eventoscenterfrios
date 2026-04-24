# Correção: checkbox de "Dias de Comparecimento" não marca

## Causa raiz (confirmada)

O campo "Dias de Comparecimento" é do tipo `multiselect` no banco, com opções como:
`Terça, 05/05`, `Quarta, 06/05`, `Quinta, 07/05`, `Sexta, 08/05`.

Em `src/pages/Register.tsx` (linhas ~414-437), o componente armazena as opções selecionadas em uma única string `formData[label]` separada por `", "` (vírgula + espaço), e recalcula o estado de cada checkbox com `value.split(", ")`.

Como o próprio rótulo da opção contém `", "`, a string `"Terça, 05/05"` é fragmentada em `["Terça", "05/05"]`. Nenhum desses pedaços corresponde à opção original `"Terça, 05/05"`, então o `checked` volta a `false` imediatamente após o clique — o checkbox parece "não marcar".

Há ainda colisões secundárias do mesmo padrão em:
- `src/components/dashboard/RegistrationDetailDialog.tsx` (split `", "` ao exibir)
- onde quer que o valor salvo seja re-exibido como chips.

## Vínculo com a participação do usuário (confirmado)

A seleção é gravada na tabela existente `public.registrations`, na coluna `data jsonb`, sob a chave `"Dias de Comparecimento"`. A função RPC `register_for_event` (já em produção) persiste esse JSON normalmente. **Nenhuma nova tabela é necessária** — o vínculo `usuário ↔ evento ↔ dias` já existe via `registrations.event_id` + `registrations.data->'Dias de Comparecimento'`.

## Solução

Trocar o delimitador interno para um caractere que jamais aparecerá nos rótulos:

1. **`src/pages/Register.tsx`** — no bloco do `multiselect`:
   - Usar separador interno `"\u001F"` (Unit Separator, invisível) para `selectedMulti` e para a string em `formData`.
   - Continuar preservando a ordem original das opções.
   - Antes de enviar (submit), normalizar a string desse campo para `", "` (formato amigável que a UI atual já espera para exibição) **OU** armazenar como array. Para minimizar mudanças, normalizar para `", "` apenas no `payload` enviado ao RPC.

2. **`src/components/dashboard/RegistrationDetailDialog.tsx`** — a exibição como chips (`stringValue.split(", ")`) continua válida porque o valor salvo no banco terá `", "` como separador legível.

3. Sem mudanças no banco, RLS, RPC ou edge functions.

## Validação

- Marcar e desmarcar cada um dos 4 dias na página `/register/...` do evento atual.
- Confirmar que múltiplos dias permanecem marcados simultaneamente.
- Submeter inscrição e verificar em `registrations.data` que `"Dias de Comparecimento"` veio salvo como, ex.: `"Terça, 05/05, Quinta, 07/05"`.
- Conferir que o diálogo de detalhes do participante exibe os chips corretamente.

## Arquivos a alterar

- `src/pages/Register.tsx` (handler do multiselect + normalização no submit)
