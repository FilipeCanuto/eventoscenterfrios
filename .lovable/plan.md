
## Objetivo

Permitir que o inscrito marque um ou mais dias do evento "Circuito Experience: Centerfrios & Skymsen" (05 a 08 de maio de 2026) em que pretende comparecer. Os dias selecionados ficarão visíveis no painel de Participantes (tabela e detalhe da inscrição) e serão exportados no CSV. A inserção continuará passando pela função `register_for_event` (SECURITY DEFINER), que já garante idempotência (sem dupla inscrição por e-mail e proteção de capacidade/prazo).

---

## Mudanças

### 1. Suporte a um novo tipo de campo: `multiselect` (checkbox)

Hoje os campos do formulário (`form_fields`) suportam: `text`, `email`, `tel`, `url`, `select`. Adicionaremos `multiselect`, reaproveitando a coluna `options` (jsonb) já existente.

- **Renderização (`src/pages/Register.tsx`)**: quando `field_type === "multiselect"`, exibir uma lista de checkboxes (componente `Checkbox` já usado para o consentimento) com cada opção. O valor é guardado em `formData[label]` como string `"opção A, opção B"` (mantém o tipo `Record<string, string>` atual e a compatibilidade com o resto do fluxo, incluindo o CSV e o detalhe do participante, que já tratam strings).
- **Validação `required`**: para `multiselect` obrigatório, exigir pelo menos uma opção marcada (mesma lógica atual com mensagem em pt-BR).
- **Editor de campos (`src/pages/dashboard/EventDetail.tsx`)**: adicionar a opção "Caixas de seleção (múltipla escolha)" ao dropdown de tipo, e reutilizar a textarea de "Opções (uma por linha)" que já existe para `select`. Mostrar as opções na lista igual ao `select`.

### 2. Criar o campo "Dias de Comparecimento" para o evento atual

Inserir uma linha em `form_fields` para o evento `cfd9d79d-78d3-45d8-bdc7-1250314ec2c4` com:

- `label`: "Dias de Comparecimento"
- `field_type`: `multiselect`
- `required`: `true`
- `position`: 4 (entre "Segmento de atuação" e "WhatsApp")
- `options`: `["Terça, 05/05", "Quarta, 06/05", "Quinta, 07/05", "Sexta, 08/05"]`

Como `register_for_event` aceita qualquer chave dentro de `p_data` e a coluna `data` é jsonb, **nenhuma migração de schema** é necessária — apenas um `INSERT` na tabela `form_fields`.

### 3. Exibição no painel de Participantes

- `src/components/dashboard/RegistrationDetailDialog.tsx`: a seção "Dados do formulário" já lista todas as chaves de `data` (exceto as que começam com `__`), portanto "Dias de Comparecimento" aparecerá automaticamente. Pequeno ajuste: quebrar vírgulas em "chips" visuais quando o label for "Dias de Comparecimento" (legibilidade).
- `src/components/event-detail/EventAttendeesTable.tsx`:
  - Adicionar coluna **"Dias"** (visível em md+) com os dias marcados em badges curtos (ex.: 05, 06, 07).
  - Incluir a coluna no cabeçalho do CSV (`Dias`) com a string completa.

### 4. Idempotência (sem mudanças no banco)

A função `public.register_for_event` já garante:
- duplicidade por e-mail por evento (máx. 2 registros não cancelados por e-mail);
- limite de capacidade e prazo;
- limite de tamanho de payload (4 KB);
- o frontend continua chamando exclusivamente este RPC (não faz `INSERT` direto).

Não há novas regras de unicidade necessárias — o campo "Dias de Comparecimento" entra dentro de `data` jsonb e herda as mesmas garantias.

---

## Detalhes técnicos

**Estado do checkbox no Register.tsx**

```ts
// helpers
const parseSelected = (v: string) => v ? v.split(", ").filter(Boolean) : [];
const serializeSelected = (arr: string[]) => arr.join(", ");

const toggle = (label: string, opt: string) => {
  const current = parseSelected(formData[label] || "");
  const next = current.includes(opt)
    ? current.filter(x => x !== opt)
    : [...current, opt];
  onFieldChange(label, serializeSelected(next));
};
```

**Validação no `handleSubmit`**

```ts
const missingMulti = formFields?.filter(
  f => f.required && f.field_type === "multiselect"
    && parseSelected(formData[f.label] || "").length === 0
);
```

**Insert de form_fields (via insert tool, sem migração)**

```sql
INSERT INTO form_fields (event_id, label, field_type, required, position, options)
VALUES (
  'cfd9d79d-78d3-45d8-bdc7-1250314ec2c4',
  'Dias de Comparecimento',
  'multiselect',
  true,
  4,
  '["Terça, 05/05","Quarta, 06/05","Quinta, 07/05","Sexta, 08/05"]'::jsonb
);
```

(É seguro re-rodar com `ON CONFLICT DO NOTHING` em (`event_id`,`label`) — vamos checar antes de inserir para não duplicar.)

---

## Arquivos afetados

- `src/pages/Register.tsx` — render de `multiselect` + validação.
- `src/pages/dashboard/EventDetail.tsx` — opção "Caixas de seleção" no editor de campos.
- `src/components/event-detail/EventAttendeesTable.tsx` — coluna "Dias" + CSV.
- `src/components/dashboard/RegistrationDetailDialog.tsx` — chips para a chave "Dias de Comparecimento".
- Banco: 1 INSERT em `form_fields` (sem alteração de schema).

---

## O que NÃO muda

- A função `register_for_event` permanece igual (já é robusta o bastante).
- Nenhuma RLS é alterada.
- E-mail de confirmação não é tocado (não renderiza dados de formulário hoje).
- Inscrições já existentes continuam válidas (campo simplesmente fica vazio para elas — exibido como "—").
