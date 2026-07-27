## Problema

O favicon padrão declarado no `index.html` é `/favicon-circuito.png` (evento anterior), então qualquer página que não troque o ícone dinamicamente mostra o Circuito. A troca dinâmica existe (`useEventFavicon`) mas só é usada em `Register`, `CheckIn` e `CheckInRapido` — a página `/vendedor`, dedicada ao Vácuo em Ação, não a usa.

## O que fazer

1. **`/vendedor`**: aplicar `useEventFavicon({ slug: "vacuo_em_acao" })` (a página já é fixa nesse evento), garantindo o ícone do Vácuo na aba.
2. **Favicon padrão neutro**: trocar o padrão do `index.html` de `favicon-circuito.png` para um ícone da marca CENTERFRIOS (não de um evento específico), para que páginas genéricas (landing, dashboard, login) não herdem o ícone de um evento passado. Se não houver ícone de marca disponível, gero um a partir da logo CENTERFRIOS.
3. **Manter por evento**: `useEventFavicon` continua sendo a única fonte de ícone por evento — cada evento com regra própria no mapa `EVENT_FAVICONS`; eventos sem regra caem no ícone da marca. O Circuito passa a ser mapeado explicitamente (`/favicon-circuito.png`) para continuar correto nas suas páginas.
4. **Verificar** as demais páginas ligadas a um evento (detalhe do evento no dashboard, página pública da empresa/eventos) e aplicar o hook onde houver um evento em contexto.

## Detalhes técnicos

- `src/hooks/useEventFavicon.ts`: adicionar entrada para `circuito` e trocar `DEFAULT_FAVICON` pelo ícone de marca; a limpeza no unmount já restaura o valor anterior.
- `index.html`: atualizar `rel="icon"` e `apple-touch-icon`.
- Nenhuma mudança de backend ou de dados.
