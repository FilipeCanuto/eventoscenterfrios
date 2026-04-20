

## Objetivo

Adicionar um campo **obrigatório** ao formulário de inscrição perguntando o **segmento de atuação** do lead (Supermercado, Açougue, Horti-Fruti, Lanchonete, Restaurante, Pizzaria, Laticínio, Outros). Isso qualifica os leads e habilita remarketing segmentado.

## O que eu acho da configuração proposta

Ótima ideia para qualificação — segmento é o filtro nº 1 para remarketing B2B em food service. Algumas observações:

1. **Formato "acordeon" vs. "dropdown":** acordeon costuma ser usado quando o conteúdo é longo e expansível. Para escolher 1 entre 8 opções, o padrão de UX/mobile é um **dropdown (select)** ou **chips/radio**. Vou implementar como **dropdown estilizado** (componente `Select` do shadcn, já no padrão pill da marca), que é mais rápido e ocupa menos espaço no formulário. Se preferir mesmo um acordeon visual com as opções dentro, me diga.
2. **"Outros"** — vou incluir, mas sem campo livre de texto adicional (mantém o formulário curto). Se quiser, posso adicionar um input "Qual?" condicional depois.
3. **Obrigatório:** sim, marcado como `required`.
4. **Escopo:** vou aplicar **apenas ao evento atual** ("Circuito Experience: Centerfrios & Skymsen"). Se quiser que vire padrão para todos os novos eventos, é uma segunda mudança que faço depois.

## Mudanças

### 1. Banco de dados
- Nova migration adicionando coluna `options jsonb` em `form_fields` (nullable, default `null`) — guarda o array de opções para campos do tipo `select`.
- Insert de um novo registro em `form_fields` para o evento `cfd9d79d-78d3-45d8-bdc7-1250314ec2c4`:
  - `label`: "Segmento de atuação"
  - `field_type`: `"select"`
  - `required`: `true`
  - `position`: `3` (entre WhatsApp e Empresa)
  - `options`: `["Supermercado","Açougue","Horti-Fruti","Lanchonete","Restaurante","Pizzaria","Laticínio","Outros"]`

### 2. Renderização do formulário (`src/pages/Register.tsx`)
- No `formFields.map`, quando `field.field_type === "select"`, renderizar um componente `Select` (shadcn) no lugar do `Input`, populando com `field.options`.
- Estilo casa com o resto: `h-12`, `rounded-xl`, label igual aos outros campos, mensagem de obrigatoriedade.
- Validação: se `required` e valor vazio → toast "Selecione seu segmento de atuação".

### 3. Wizard de criação de evento (`src/pages/dashboard/CreateEvent.tsx` + `EventDetail.tsx`)
- Adicionar `"select"` como opção no seletor de tipo de campo (ao adicionar campo customizado).
- Quando `select` é escolhido, mostrar um textarea simples "Opções (uma por linha)" para o organizador preencher.
- Salvar `options` como array.
- Não mexer nos `defaultFields` por enquanto (escopo só do evento atual).

### 4. Exibição em participantes/leads
- O valor escolhido vai automaticamente para `registrations.data["Segmento de atuação"]` e aparece no diálogo de detalhes do participante (já renderiza `data` genericamente). Sem mudança extra.

## Arquivos alterados

- **Nova migration:** adiciona `options` em `form_fields` + insere o campo no evento.
- `src/pages/Register.tsx` — render condicional de `select`.
- `src/pages/dashboard/CreateEvent.tsx` — opção "select" + editor de opções.
- `src/pages/dashboard/EventDetail.tsx` — opção "select" + editor de opções no editor inline.
- `src/components/ui/select.tsx` — já existe, sem mudanças.

## Validação

1. Abrir a página pública do evento → ver "Segmento de atuação *" com dropdown das 8 opções.
2. Tentar enviar sem escolher → erro de validação.
3. Concluir inscrição → ver o segmento no diálogo de detalhes do participante em `/dashboard/attendees` e na aba Participantes do evento.
4. Exportar CSV → coluna "Segmento de atuação" presente.
5. Testar em mobile (dropdown nativo amigável).

