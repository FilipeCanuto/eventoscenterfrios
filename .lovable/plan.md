

## Diagnóstico

Verifiquei a página `/register/:slug` (`src/pages/Register.tsx`) e o fluxo de captura. Estado atual:

**Link de inscrição (já funcional):**
- URL pública: `https://eventoscenterfrios.lovable.app/register/circuito-experience-centerfrios-skymsen-rq0bmz`
- Rota pública (sem login), captura UTMs, OG tags dinâmicas já implementadas.

**Captura de dados (boa, mas com lacunas):**
- Inscrições vão para `registrations.data` (jsonb) via RPC `register_for_event` — ✅ hardened, anti-duplicidade por e-mail, limite 4KB.
- WhatsApp obrigatório já está no formulário.
- UTMs salvos como `__utm_source`, `__utm_medium`, etc. dentro do `data` — ✅ funcional, mas misturado com campos do lead, dificultando exportação.
- **Lacuna 1**: não há registro de `referrer` (de qual site veio), `landing_page` (qual URL trouxe o lead) nem `user_agent` simplificado (mobile/desktop).
- **Lacuna 2**: campos UTM ficam com prefixo `__` no `data`, o que polui a tabela de inscritos no dashboard.
- **Lacuna 3**: não há um "snapshot" estruturado dos dados-chave (nome, email, whatsapp) em colunas próprias — tudo vive no `jsonb`, o que torna queries e exports menos eficientes.

**Visual atual:**
- Layout funcional mas "plano": flyer + título + form em coluna única, sem hierarquia forte.
- Falta seção de "destaques do evento" (o que o lead vai viver).
- CTA não é sticky em mobile.
- Falta prova social / contagem de inscritos / urgência visual.
- Tipografia do título poderia ter mais impacto.

---

## Plano

### 1. Link de inscrição (entrega imediata)

URL pronta para colar em qualquer landing page ou anúncio:

```
https://eventoscenterfrios.lovable.app/register/circuito-experience-centerfrios-skymsen-rq0bmz
```

Para rastreio por origem, sugiro variantes com UTM:
- `?utm_source=landing&utm_medium=botao-cta&utm_campaign=circuito-experience-2026`
- `?utm_source=instagram&utm_medium=bio&utm_campaign=circuito-experience-2026`
- `?utm_source=whatsapp&utm_medium=mensagem&utm_campaign=circuito-experience-2026`

Vou exibir esse link de forma copiável também no painel do evento (`EventDetail`), com botão "Copiar link de inscrição".

### 2. Melhoria visual da página de inscrição

Refatorar `src/pages/Register.tsx` para um layout mais moderno e atrativo, mantendo a identidade do projeto (rose-red `HSL 340 75% 58%`, Bricolage Grotesque, DM Sans, borderless, pill-shaped):

**Estrutura nova (mobile-first → desktop split):**

```text
┌─────────────────────────────────────────────────────┐
│  [Logo do organizador]                              │
├─────────────────────────────────────────────────────┤
│  HERO em destaque                                   │
│  ├─ Flyer (left, sticky em desktop)                 │
│  └─ Título XL + tagline + date card + local        │
│       └─ pill "Inscrição gratuita · 1 min"         │
│       └─ contador sutil "X pessoas já inscritas"   │
├─────────────────────────────────────────────────────┤
│  3 cards "O que esperar"                            │
│  (ícones lucide: Sparkles, Users, Gift)             │
├─────────────────────────────────────────────────────┤
│  Formulário em card destacado                       │
│  ├─ Microcopy de urgência                          │
│  ├─ Nome / E-mail / WhatsApp (16px, h-12)          │
│  └─ CTA grande "Garantir minha vaga"               │
├─────────────────────────────────────────────────────┤
│  Footer minimalista                                 │
└─────────────────────────────────────────────────────┘
```

**Detalhes:**
- **Hero split**: em desktop (≥md), flyer à esquerda (sticky até o form), informações + form à direita. Em mobile, empilhado.
- **Título**: `text-4xl md:text-6xl font-display font-bold tracking-tight` para impacto.
- **Date card** já refatorado (mantido).
- **Pills de destaque** acima do título: "Inscrição gratuita", "Vagas limitadas", "4 dias de evento".
- **Contador de inscritos** (opcional, só se >5): "Junte-se a X pessoas já inscritas" — usa `get_registration_count` (RPC pública existente).
- **3 mini-cards "O que esperar"**: ícones `Sparkles`, `Users`, `Gift` com 1 linha cada (ex.: "Conteúdo exclusivo", "Networking", "Sorteio de brindes"). Conteúdo derivado da descrição do evento ou textos padrão.
- **Form em card elevado**: fundo `bg-card`, `rounded-3xl`, padding generoso, sem bordas (regra do projeto).
- **Sticky CTA mobile**: barra fixa no rodapé em <md com botão "Quero garantir minha vaga" que rola até o form.
- **Animações suaves**: `framer-motion` (já em uso) — fade+slide-up nos blocos do hero, stagger nos cards.
- **Tela de sucesso**: já tem confetti + animação; vou reforçar com botões de compartilhamento (WhatsApp, copiar link) para o lead convidar amigos — multiplica conversão.

### 3. Captura de dados — melhorias

**Mudanças no schema (`registrations`):** adicionar 3 colunas estruturadas (sem quebrar `data`):
- `lead_name text` — extraído no momento da inscrição
- `lead_email text` — normalizado (lowercase, trim)
- `lead_whatsapp text` — normalizado (apenas dígitos)
- `tracking jsonb default '{}'` — para UTMs, referrer, landing_page, device_type — separados do `data` do formulário

**Mudanças no RPC `register_for_event`:** aceitar 2º parâmetro opcional `p_tracking jsonb` e popular as colunas novas a partir do `p_data` + `p_tracking`.

**Mudanças no client (`useRegistrations.ts` + `Register.tsx`):**
- Coletar `document.referrer`, `window.location.href`, e tipo de dispositivo (mobile/tablet/desktop via `navigator.userAgent`).
- Enviar UTMs no campo `tracking` separado, **fora** do `data` (limpa a tabela de inscritos).
- Manter compatibilidade: se RPC ainda não tiver `p_tracking`, fallback para o comportamento atual.

**Index para queries rápidas:**
- `CREATE INDEX ON registrations (lead_email)` — busca rápida de duplicatas
- `CREATE INDEX ON registrations (event_id, created_at DESC)` — lista paginada do dashboard

### 4. Painel do organizador (`EventDetail`) — melhorias menores

- Adicionar bloco "Link público de inscrição" com botão "Copiar" e "Copiar com UTM (instagram/whatsapp/landing)".
- Mostrar coluna "Origem" na tabela de inscritos (lendo `tracking.utm_source` ou "direto").

---

## Arquivos afetados

- **`src/pages/Register.tsx`** — refatoração visual completa (hero split, cards de destaque, sticky CTA, contador, animações).
- **`src/components/RegistrationForm.tsx`** (ou inline no Register) — card elevado, microcopy, botões de compartilhamento na tela de sucesso.
- **`src/hooks/useRegistrations.ts`** — separar `tracking` do `data`, capturar referrer/device.
- **`src/pages/dashboard/EventDetail.tsx`** — bloco de "Link de inscrição" com cópia + variantes UTM; coluna de origem.
- **`src/components/event-detail/EventAttendeesTable.tsx`** — adicionar coluna "Origem".
- **Migration SQL**:
  - `ALTER TABLE registrations ADD COLUMN lead_name text, lead_email text, lead_whatsapp text, tracking jsonb DEFAULT '{}'::jsonb;`
  - `CREATE INDEX ...`
  - `CREATE OR REPLACE FUNCTION register_for_event(p_event_id uuid, p_data jsonb, p_tracking jsonb DEFAULT '{}')` — versão atualizada mantendo a assinatura antiga via `DEFAULT`.

## Fora de escopo

- E-mail de confirmação com QR code (já em pauta separada, depende do domínio de envio).
- Meta Pixel / GTM (depende dos IDs do anunciante).
- A/B testing do CTA.

