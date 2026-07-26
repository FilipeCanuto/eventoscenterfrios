## Objetivo

Preparar o evento **Workshop Vácuo em Ação** (hoje em rascunho, 19–20/08/2026, Showroom CENTERFRIOS Tabuleiro, cor `#c2a02d`) com identidade própria: favicon, e-mails branded e URL limpa.

## 1. Favicon do evento

- Enviar a arte "Vácuo em Ação" para o CDN de assets e gerar uma versão quadrada otimizada para ícone (`favicon-vacuo.png`, 512px) em `public/`.
- Hoje `Register.tsx` e `PrivacyPolicy.tsx` fixam `/favicon-circuito.png`. Trocar isso por um hook `useEventFavicon(event)` que escolhe o ícone conforme o evento carregado:
  - evento Vácuo em Ação → `/favicon-vacuo.png`
  - demais eventos → favicon atual do site
- Aplicar nas páginas do evento: `/register/:slug`, tela de sucesso, `/check-in/:id` e `/checkin-rapido`. O restante do site continua com o ícone Centerfrios.

## 2. E-mails do evento

Templates em `supabase/functions/_shared/email-templates.ts` (confirmação, 7 dias, 1 dia, 2 horas):

- **Topo**: logomarca CENTERFRIOS (branca sobre a faixa da cor do evento) — hoje o topo só mostra texto quando `logo_url` está vazio.
- **Arte do evento**: bloco visual da arte "Vácuo em Ação" logo abaixo do cabeçalho, largura total do card, cantos arredondados — aparece só quando o evento tem arte cadastrada (`background_image_url`), sem quebrar o layout do Circuito.
- **Cor de marca**: os e-mails já usam `primary_color`; ajustar o contraste do texto do cabeçalho e do bloco de contagem regressiva para tons dourados escuros (`#c2a02d`) continuarem legíveis.
- **Dados do evento**: conferir que "Quando" mostra corretamente evento de 2 dias (19/08 a 20/08, 11h–15h no fuso de São Paulo) e o local físico.
- **Rodapé**: manter "powered by CENTERFRIOS" e o link de descadastro dos lembretes.
- Cadastrar no evento a URL da logomarca CENTERFRIOS (`logo_url`) para que os e-mails já saiam branded.

## 3. Resend

- Conferir que o envio usa o remetente correto (`Eventos Centerfrios <eventos@eventos.centerfrios.com>`) e o `reply_to` configurado nas duas funções (confirmação e fila de lembretes).
- Atualizar a tag `event_slug` para o novo slug e validar que as tags são aceitas pelo Resend (só letras, números, `_` e `-`).
- Rodar um envio de teste real de confirmação e de lembrete para um endereço de verificação, checando `email_send_log` (status `sent` → `delivered` pelo webhook) e conferindo que o QR Code renderiza (gerado pela função interna `qr-code`, sem dependência externa).
- Verificar se o webhook do Resend está registrando `delivered`/`bounced` nas colunas de rastreio.

## 4. URL do evento

- Alterar o slug de `workshop-v-cuo-em-a-o-j4maq9` para `vacuo_em_acao`, deixando a página pública em `https://eventos.centerfrios.com/register/vacuo_em_acao`.
- Melhorar o gerador de slug para transliterar acentos (á→a, ç→c, ã→a) em vez de removê-los, evitando novos slugs quebrados como "v-cuo-em-a-o".
- Como o evento está em rascunho e sem inscritos, não há links antigos a preservar; os e-mails futuros já sairão com a URL nova.

## Detalhes técnicos

- Arquivos tocados: `src/pages/Register.tsx`, `src/pages/CheckIn.tsx`, `src/pages/CheckInRapido.tsx`, `src/pages/PrivacyPolicy.tsx`, novo `src/hooks/useEventFavicon.ts`, `supabase/functions/_shared/email-templates.ts`, `src/pages/dashboard/CreateEvent.tsx` (slugify).
- Migração: `update events set slug = 'vacuo_em_acao', logo_url = <logo centerfrios>` para o evento `29157586…`.
- Redeploy das funções `send-registration-confirmation`, `process-reminder-queue` e `render-email-preview` após a mudança nos templates.
