## Objetivo

Deixar o compartilhamento do link do Workshop Vácuo em Ação com um card escuro, premium e correto no WhatsApp, Telegram, LinkedIn e X — e fazer os links de campanha apontarem para o domínio publicado, não para o preview.

## 1. Imagem de compartilhamento (1200x630)

Gerar `public/og-vacuo-em-acao.png` no estilo Dark Industrial Premium:

- Fundo grafite `#12151C` com iluminação sutil azul-marinho `#0B2341` e dourada `#E6B012`.
- Esquerda: badge dourado "EVENTO PRESENCIAL | MACEIÓ-AL", título "WORKSHOP VÁCUO EM AÇÃO" (branco + dourado), subtítulo "Engenharia de Alimentos + Embalagens + Test Drive de Máquinas" e, no rodapé, as marcas CENTERFRIOS "Crescendo com você" + R BAIÃO.
- Direita: seladora a vácuo em bancada de aço inox, com produto selado a vácuo em destaque.
- Composição montada em script (fundo + tipografia com fontes reais + arte gerada), com QA visual da imagem final antes de entregar: nada cortado, nada sobreposto, margens respeitadas.

Se você tiver a logo oficial da R Baião e uma foto real da seladora, elas entram no lugar dos elementos gerados — é o que deixa o card 100% fiel.

## 2. Meta tags no `<head>`

O site é uma SPA estática: os robôs de preview (WhatsApp, Telegram, LinkedIn) leem **apenas** o `index.html`, não as tags injetadas por rota. Então as tags do evento vão no `index.html`, que hoje mostra "Centerfrios — Crescendo com você" e uma og:image antiga do Lovable.

Ajuste em relação ao texto enviado: **og:image e twitter:image precisam de URL absoluta** (`https://eventos.centerfrios.com/og-vacuo-em-acao.png`) — caminho relativo não é resolvido pelos crawlers. O resto fica exatamente como você definiu:

- `og:type` website, `og:title` "Workshop Vácuo em Ação | CENTERFRIOS & R Baião", `og:description` conforme enviado, `og:image:width` 1200, `og:image:height` 630, `og:url` e `canonical` apontando para `https://eventos.centerfrios.com/register/vacuo_em_acao`.
- `twitter:card` summary_large_image + title/description/image conforme enviado.
- `<title>` e `meta description` do documento alinhados ao evento.
- Remover as og/twitter images antigas do Google Storage para não haver ambiguidade.

Também adiciono JSON-LD de `Event` (nome, datas 19–20/08/2026, local Showroom CENTERFRIOS Tabuleiro, organizador) — isso melhora a leitura por buscadores e agentes de IA.

## 3. Links de campanha (UTMs) no domínio publicado

O bloco "Link público de inscrição" monta a URL com `window.location.origin`, por isso está gerando `https://id-preview--...lovable.app/register/...`. Vou fixar o domínio público (`https://eventos.centerfrios.com`) como base dos links copiados/compartilhados, mantendo o preview apenas quando não houver domínio publicado. Assim os presets Instagram / WhatsApp / Landing page saem com UTMs já no domínio final.

## Detalhes técnicos

- Arquivos: `index.html`, `src/components/event-detail/RegistrationLinkBlock.tsx`, novo `public/og-vacuo-em-acao.png`, e uma constante de origem pública em `src/lib/utils.ts`.
- A imagem fica em `public/` (não em assets CDN) porque o crawler precisa dela em URL previsível no domínio do site.
- Após publicar, os previews antigos ficam em cache nas plataformas; validar/forçar atualização no depurador de links do Facebook e no LinkedIn Post Inspector. O WhatsApp costuma atualizar sozinho em algumas horas.
