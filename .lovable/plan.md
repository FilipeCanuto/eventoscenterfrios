
## Objetivo

Refinar a página "Obrigado" (`SuccessCard` em `src/pages/Register.tsx`):
1. **Remover** o banner/flyer do evento do topo do card.
2. **Aplicar o tema do evento** à página inteira (cor primária, color_mode, tipografia) — não só ao card.
3. **Dar muito mais destaque** à mensagem de confirmação ("Inscrição confirmada") e à mensagem principal.

## Mudanças

### 1. Remover o hero da flyer
- Tirar o bloco `<img src={background_image_url}>` do topo do `SuccessCard`.
- Remover também o overlay com logo sobreposto.

### 2. Aplicar o tema à página toda
Hoje só o card tem cor de marca; o fundo da página é neutro. Vou:
- Envolver toda a tela de sucesso num container que respeita `event.color_mode` (claro/escuro) e usa `primary_color` como acento.
- Fundo da página: gradiente sutil derivado da `primary_color` (ex: `linear-gradient(180deg, primary/8%, background)`) — mesma lógica visual da página de inscrição, para continuidade.
- Logo do evento (se houver) reposicionado no topo da página, acima do card, em tamanho médio — substitui a função visual do banner sem ser pesado.
- Tipografia: Bricolage Grotesque já em uso, manter.

### 3. Hierarquia da confirmação (muito mais evidência)
Reorganizar o card em três blocos verticais bem espaçados:

**Bloco 1 — Selo + título (ENORME):**
- Selo circular grande (80–96px) com check, usando `primary_color` de fundo.
- Título principal: **"Inscrição confirmada"** em `text-4xl md:text-6xl`, font-bold, tracking apertado. Esta é A mensagem.
- Subtítulo logo abaixo, mais suave: "Você está garantido(a) no [nome do evento]".

**Bloco 2 — Mensagem principal em destaque:**
- Card/bloco interno com a mensagem personalizada (ou padrão "Enviamos os detalhes para seu e-mail. Salve a data!"), em `text-lg md:text-xl`, com bom respiro (py-6).
- Linha divisória sutil com a cor primária.

**Bloco 3 — Detalhes do evento (ticket-style mantido, mas secundário):**
- Data/hora + local em formato compacto, labels uppercase pequenas, valores em peso médio.
- Visualmente menor que o título — função de referência, não de destaque.

**Bloco 4 — CTAs:**
- WhatsApp + copiar link, mantidos como pills, alinhados horizontalmente em desktop e empilhados em mobile.

### 4. Confetti
- Mantido, com a cor primária do evento.

## Arquivos alterados

- `src/pages/Register.tsx` — apenas o componente `SuccessCard` e o wrapper de página de sucesso. Sem mudanças em tracking, e-mail ou banco.

## Validação

1. Concluir uma inscrição → ver a nova página com tema do evento aplicado, sem banner, com "Inscrição confirmada" gigante no topo.
2. Testar em mobile e desktop.
3. Testar com evento de `color_mode: dark` para garantir que o tema escuro funciona.
