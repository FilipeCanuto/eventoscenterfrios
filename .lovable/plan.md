

# Redesign da Página Pública da Empresa

## Diagnóstico Atual

A página `/company/:slug` (`src/pages/CompanyPage.tsx`) tem problemas sérios:

**Problemas visuais:**
- Hero section fraca: gradiente genérico cor primária, sem hierarquia visual forte
- Logo da empresa pequeno (16x16) e mal posicionado
- Texto sobre fundo gradiente com contraste inconsistente (usa `text-foreground` e `text-white` misturados — quebra em light mode)
- Ícones sociais usam `cdn.simpleicons.org` com cor branca fixa (invisíveis em light mode)
- Cards de evento sem identidade — parecem genéricos
- Toggle grid/list pequeno e sem destaque
- Falta separação clara entre seções "Próximos" e "Anteriores"
- Sem indicação visual de eventos passados (deveriam ter aparência diferente)

**Problemas de acessibilidade (WCAG):**
- Contraste: `text-white` em hero gradiente claro falha AA
- Botões `<button>` do toggle sem `aria-label` nem `aria-pressed`
- Imagens sem texto alternativo descritivo (apenas o nome do evento)
- Links externos sem `aria-label` indicando "abre em nova janela"
- Headings: hierarquia OK (h1 → h2 → h3) mas falta landmark `<main>`
- Sem skip link, sem foco visível customizado
- Ícones decorativos sem `aria-hidden`
- Cards inteiros são `<Link>` mas o botão "Inscrever-se" dentro também é clicável → link aninhado inválido

**Problemas de autoridade/profissionalismo:**
- Falta de elementos de prova social (contagem total de eventos, participantes)
- Sem badge/identidade de "empresa verificada" ou destaque institucional
- Descrição da empresa perdida no hero
- Sem call-to-action claro além de "inscrever-se"

## Solução Proposta

Redesenhar `src/pages/CompanyPage.tsx` mantendo a mesma estrutura de dados (sem mudanças em hooks ou banco).

### 1. Hero Redesenhado — Estilo Institucional

```text
┌──────────────────────────────────────────────────────────┐
│  [bg pattern sutil + gradiente da marca rose-red]        │
│                                                          │
│   ┌────┐                                                 │
│   │LOGO│  CENTER FRIOS                    [Verificada ✓] │
│   │80px│  Máquinas e Equipamentos Ltda                   │
│   └────┘                                                 │
│                                                          │
│   Descrição em parágrafo limpo, max 2 linhas, alto       │
│   contraste, fonte body confortável.                     │
│                                                          │
│   🌐 site.com   in   ig   yt              📅 12 eventos  │
└──────────────────────────────────────────────────────────┘
```

- Logo 80x80, rounded-2xl, sombra suave, borda branca
- Nome em Bricolage Grotesque, text-4xl/5xl
- Badge "Organizador verificado" pequeno ao lado
- Descrição em texto sólido `text-foreground/80` (passa AA)
- Linha de stats: total de eventos + total de participantes (autoridade)
- Ícones sociais maiores (44x44), com fundo neutro adaptado a light/dark, hover com cor da marca
- Substituir `cdn.simpleicons.org/.../ffffff` por versão neutra que respeita tema (ou usar `lucide-react` quando possível: Globe, Mail, Linkedin, Instagram, Facebook, Youtube, Twitter, Github)

### 2. Barra de Stats / Filtros

Logo abaixo do hero, uma barra com:
- "X próximos · Y realizados" (texto descritivo)
- Toggle Grid/List mais polido com `aria-pressed` e labels acessíveis
- (Opcional) busca por nome de evento

### 3. Seção "Próximos Eventos"

Cards redesenhados:
- Aspect ratio `16/10` consistente
- Overlay gradient sutil só na parte inferior
- Data em pill destacado no canto superior esquerdo da imagem (estilo "save the date")
- Título text-xl, line-clamp-2
- Metadata em linha clean: 📍 local · 👥 X inscritos
- CTA "Inscrever-se →" como link semântico (não botão dentro de Link)
- Hover: leve elevação + borda sutil rose-red

### 4. Seção "Eventos Anteriores"

- Mesmos cards, mas com:
  - Overlay grayscale leve na imagem (visualmente "passado")
  - Badge "Realizado" no lugar da data
  - CTA muda para "Ver detalhes" (sem incentivo a inscrição)

### 5. Footer Institucional

Adicionar pequeno footer com:
- Nome da empresa
- Link "Ver mais empresas" → `/events` (página pública de eventos)
- Link sutil "Powered by meuevento"

### 6. Correções de Acessibilidade (WCAG 2.1 AA)

- Adicionar `<main>` wrapping
- Toggle: `<button role="tab" aria-pressed aria-label="Visualizar em grade">`
- Imagens: alt descritivo (`alt={`Capa do evento ${event.name}`}`)
- Links externos: `aria-label="Visite nosso LinkedIn (abre em nova aba)"`
- Ícones decorativos: `aria-hidden="true"`
- Resolver link aninhado: card vira `<article>` com `<Link>` interno cobrindo título + imagem; botão "Inscrever-se" é parte do mesmo Link via `stretched-link` pattern (pseudo-element `::after`)
- Foco visível: `focus-visible:ring-2 ring-primary ring-offset-2`
- Cores: garantir contraste mínimo 4.5:1 no texto sobre hero (testar com texto sólido `text-foreground` em fundo claro com pattern, não gradiente sobre imagem)
- Pular testes de degradê — usar fundo sólido suave + ornamento decorativo
- Skip link "Pular para conteúdo" no topo

### 7. Estados Vazios e Loading

- Skeleton mais fiel ao novo layout
- Empty state com ilustração (ícone grande Calendar) e mensagem amigável
- Estado de erro acessível com `role="alert"`

## Arquivos Afetados

- **`src/pages/CompanyPage.tsx`** — reescrita completa do componente (mantém hooks atuais e roteamento)

Nenhuma mudança em:
- Banco de dados / RLS
- Hooks (`usePublicCompany.ts`)
- Rotas (`App.tsx`)
- Componentes compartilhados

## Detalhes Técnicos

- Continua usando shadcn/ui (`Card`, `Button`, `Skeleton`, `Badge`)
- Adiciona ícones de `lucide-react` (já disponível): `Globe`, `Mail`, `Linkedin`, `Instagram`, `Facebook`, `Youtube`, `Twitter`, `Github`, `BadgeCheck`, `Calendar`, `MapPin`, `Users`, `ArrowRight`, `LayoutGrid`, `List`
- Locale `date-fns/locale/pt-BR` para datas em português ("Qua, 16 de abr · 19:00")
- Tipografia: Bricolage Grotesque para títulos, DM Sans para corpo (já configurado)
- Responsivo: 1 col mobile → 2 sm → 3 lg
- Suporta light + dark mode (default light, conforme regra do projeto)

