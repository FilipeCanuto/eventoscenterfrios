

## Objetivo

Três entregas para a página de inscrição do evento:
1. Página "Obrigado" mais profissional, com a arte/identidade visual do evento.
2. E-mail de confirmação com a arte do evento (header com a flyer, não só cor).
3. Rastreamento de leads que **acessaram a página de inscrição mas não se inscreveram**.

---

## 1. Página "Obrigado" — redesign com a arte do evento

Arquivo: `src/pages/Register.tsx` (componente `SuccessCard`).

Hoje o card é genérico (ícone + cor primária). Vou reconstruir para parecer um "ingresso/cartão de presença" temático:

- **Header visual com a flyer do evento** (`background_image_url`) como hero — mesma arte que o inscrito viu na página, agora coroada com um selo "Inscrição confirmada".
- **Logo do evento** (se existir `logo_url`) sobreposto sobre a arte.
- **Nome do evento** em destaque tipográfico (Bricolage Grotesque, igual ao restante).
- **Bloco "ingresso"** com data/hora formatada e local — replicando o padrão visual usado no e-mail (linhas com label uppercase + valor).
- **Selo de confirmação** mais elegante (check + "Presença garantida") em vez do popper emoji.
- **CTAs** mantidos: WhatsApp + copiar link, mas com estilo de pill alinhado à identidade.
- **Confetti** mantido (suave, com cor primária do evento).
- **Remoção** do "🎉" no título — gatilho visual amador. Trocar por "Tudo certo!" ou "Você está dentro".
- Suporte a `color_mode` claro/escuro (já existente).

Resultado: o "Obrigado" deixa de ser um card genérico e passa a ser uma extensão visual da página do evento — mesma arte, mesma cor, mesma tipografia, mas com a mensagem de confirmação.

---

## 2. E-mail de confirmação — incorporar a arte do evento

Arquivo: `supabase/functions/send-registration-confirmation/index.ts` (função `buildHtml`).

Hoje o header do e-mail é só uma faixa colorida (`brand`) com o nome do evento. Vou trocar por:

- **Hero com a flyer do evento** (`background_image_url`) no topo do e-mail — imagem responsiva, largura 560px, altura proporcional, sem cortar (estilo `object-fit: contain` simulado via tabela com background neutro).
- **Logo sobreposto/abaixo da flyer** (se existir).
- **Faixa de cor primária** mais fina logo abaixo da arte, com a tag "INSCRIÇÃO CONFIRMADA".
- Manter o restante do conteúdo (Quando, Local, CTA, footer) — já está bom.
- Fallback: se `background_image_url` não existir, mantém o header colorido atual.
- Garantir compatibilidade com clientes de e-mail (Outlook, Gmail) — usar `<img>` com `width`, `style="display:block;max-width:100%;height:auto"`, `alt` descritivo.

Importante: e-mails com 1 imagem grande no topo + texto bem estruturado têm boa deliverability se a proporção texto/imagem for mantida (~40/60). Vou garantir.

---

## 3. Rastreamento de leads que acessaram mas não se inscreveram

### Estratégia

Criar uma tabela `event_page_views` que registra **cada visita anônima à página de inscrição**, com identificador estável de visitante (cookie-like via `localStorage`) para depois cruzar com `registrations` e identificar quem **viu mas não converteu**.

### Schema novo (migration)

```sql
CREATE TABLE event_page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  visitor_id text NOT NULL,        -- ID estável gerado no cliente
  session_id text NOT NULL,        -- ID por aba/sessão
  created_at timestamptz NOT NULL DEFAULT now(),
  referrer text,
  landing_url text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  device_type text,
  user_agent text,
  -- Capturas progressivas (lead parcial)
  partial_email text,              -- preenchido se digitou no campo
  partial_name text,
  partial_whatsapp text,
  form_started_at timestamptz,     -- primeira interação com o form
  form_abandoned_at timestamptz,   -- saiu sem submeter
  converted_registration_id uuid   -- preenchido se essa visita virou inscrição
);

CREATE INDEX ON event_page_views (event_id, created_at DESC);
CREATE INDEX ON event_page_views (event_id, visitor_id);
CREATE INDEX ON event_page_views (event_id, partial_email) WHERE partial_email IS NOT NULL;
```

### RLS

- `INSERT`: público (anon + authenticated) — campos limitados, sem PII além do que o usuário digitou.
- `UPDATE`: público mas restrito por `visitor_id` + `session_id` recentes (≤30min) — para upsert progressivo.
- `SELECT`: somente o dono do evento (`events.user_id = auth.uid()`).

Para garantir UPDATE seguro, vou criar uma função RPC `track_page_view(p_event_id, p_visitor_id, p_session_id, p_data jsonb)` que faz upsert idempotente por `(event_id, session_id)` — evita poluir RLS com lógica complexa.

### Captura no front (Register.tsx)

- **Ao montar a página**: gera/recupera `visitor_id` (localStorage, persistente) e `session_id` (sessionStorage, por aba). Chama RPC `track_page_view` com UTMs, referrer, device.
- **Ao iniciar o form** (primeiro `onChange`): UPDATE marca `form_started_at`.
- **A cada blur** nos campos email/nome/whatsapp: UPDATE com captura progressiva (`partial_email`, `partial_name`, `partial_whatsapp`) — captura o lead "morno" mesmo se ele desistir.
- **Ao submeter com sucesso**: UPDATE marca `converted_registration_id`.
- **Ao sair sem submeter** (`beforeunload` ou `visibilitychange`): UPDATE marca `form_abandoned_at`.

Tudo com debounce e tolerância a erro de rede (não bloqueia UX).

### Visualização no dashboard

Nova aba **"Leads não convertidos"** dentro do `EventDetail` (`src/pages/dashboard/EventDetail.tsx`):

- Tabela com: data/hora, e-mail parcial (se capturado), nome parcial, WhatsApp parcial, UTMs, status (visitou / iniciou form / abandonou form).
- Filtros: somente com e-mail capturado, somente abandonos de form, por origem UTM.
- Métricas no topo: Total de visitas únicas, Iniciaram form, Abandonaram form, **Taxa de conversão** (registrations / visitas únicas).
- Botão "Exportar CSV" para o time fazer follow-up manual via WhatsApp/e-mail.

Hook novo: `src/hooks/useEventPageViews.ts`.

---

## Arquivos alterados/criados

**Novos:**
- `supabase/migrations/<timestamp>_event_page_views.sql` — tabela, índices, RLS, RPC `track_page_view`.
- `src/hooks/useEventPageViews.ts` — query + mutation.
- `src/lib/visitorTracking.ts` — helpers `getVisitorId()`, `getSessionId()`, `trackPageView()`, `trackProgressiveLead()`.
- `src/components/event-detail/EventLeadsTable.tsx` — tabela de leads não convertidos.

**Modificados:**
- `src/pages/Register.tsx` — redesign do `SuccessCard` + integração com tracking.
- `supabase/functions/send-registration-confirmation/index.ts` — `buildHtml` com hero da flyer.
- `src/pages/dashboard/EventDetail.tsx` — nova aba/seção "Leads".

---

## Validação pós-deploy

1. Acessar a página pública sem se inscrever → conferir registro em `event_page_views`.
2. Começar a preencher e abandonar → conferir captura parcial de e-mail.
3. Concluir inscrição → conferir `converted_registration_id` preenchido + nova arte na página "Obrigado".
4. Abrir o e-mail recebido → conferir flyer no topo, layout consistente em Gmail e Outlook.
5. Abrir aba "Leads" no dashboard do evento → conferir tabela e métricas.

---

## Fora de escopo (posso fazer depois se quiser)

- Notificação automática para o dono do evento quando alguém abandona o form com e-mail capturado.
- Disparo de e-mail de "esqueceu de finalizar?" para leads parciais (precisa de opt-in/consent — sensível).
- Heatmap de scroll/cliques na página de inscrição.

