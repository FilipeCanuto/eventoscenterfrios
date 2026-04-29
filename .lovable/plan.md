## Objetivo

Eliminar a tela branca durante a inscrição (campo "Segmento de atuação" e similares) garantindo um fluxo 100% estável em qualquer navegador — desktop, mobile, WhatsApp/Instagram in-app browsers, iOS Safari antigo e Android WebView.

## Causa raiz confirmada

Em `src/pages/Register.tsx` (linhas 478–516), o componente `RegistrationForm` usa um toggle condicional baseado em `useIsMobile()`:

- Mobile → `<select>` HTML nativo
- Desktop → Radix `Select` (com Portal)

Esse toggle gera dois problemas:
1. **Hydration mismatch** — `useIsMobile()` retorna `false` no primeiro render e depois muda, fazendo o React desmontar o Radix `Select` e montar o `<select>` (ou vice-versa). Combinado com `framer-motion`, Google Translate e in-app browsers, o React perde a referência de nós DOM e crash com `removeChild`/"Rendered more hooks".
2. **Radix Portal instável** em WebViews antigos e quando há `transform`/`filter` em ancestrais.

## Mudanças

### 1. `src/pages/Register.tsx` — padronizar select nativo (todos os dispositivos)

- Remover import e uso de `useIsMobile` dentro de `RegistrationForm`.
- Remover imports de `Select, SelectContent, SelectItem, SelectTrigger, SelectValue` (não mais usados).
- Para `field_type === "select"`, sempre renderizar `<select>` HTML nativo (o mesmo bloco que hoje só roda no mobile, linhas 482–501). Isso elimina o Portal do Radix completamente no fluxo público.
- Manter `font-size: 16px` (evita zoom no iOS) e `h-12` para target de toque ≥44px.

### 2. `src/pages/Register.tsx` — blindar `safeConfetti` (já existe) e checar uso

- `safeConfetti` já está com try/catch (linhas 27–34). Garantir que **todas** as chamadas de `confetti(...)` no arquivo passam por `safeConfetti` (já é o caso em `SuccessCard`). Verificar se não há chamadas diretas restantes.

### 3. `src/pages/CheckIn.tsx` — blindar confetti

- Envolver as chamadas de `canvas-confetti` em try/catch (ou função wrapper local equivalente a `safeConfetti`) para não derrubar a UI em devices com canvas restrito.

### 4. `src/components/ErrorBoundary.tsx` — fallback que realmente recupera

- Hoje o "Tentar novamente" não destrava porque apenas reseta o state interno do boundary, mas o subtree quebrado é remontado nas mesmas condições.
- Mudar o fallback para:
  - Botão "Tentar novamente" → reseta state do boundary **e** força re-mount do subtree (via `key` incrementada).
  - Botão "Recarregar página" → `window.location.reload()` (saída garantida para o usuário final).
  - Botão "Voltar ao início" → `window.location.href = "/"` quando estiver em rota de inscrição.
- Adicionar log via `console.error` com stack para diagnóstico (já existente; manter).

### 5. Limpeza de avisos

Console mostra warning recorrente: `Function components cannot be given refs` em `Badge` dentro de `src/pages/dashboard/Attendees.tsx`. Não causa crash, mas polui logs e indica `Badge` sendo usado com `ref` ou dentro de `Tooltip`/`asChild`. Converter `Badge` para `React.forwardRef` em `src/components/ui/badge.tsx` (mudança trivial, sem efeito visual).

## Por que isso resolve definitivamente

- Sem Radix Select no fluxo público → sem Portal, sem hydration mismatch, sem conflito com `framer-motion`/Google Translate.
- `<select>` nativo é universalmente suportado e renderizado pelo SO (roleta iOS, drawer Android), inclusive em WebViews de WhatsApp/Instagram.
- ErrorBoundary com reload real garante que, mesmo em um cenário inesperado, o usuário tem um caminho para concluir a inscrição.
- Confetti blindado evita crash pós-sucesso em browsers exóticos.

## Arquivos alterados

- `src/pages/Register.tsx`
- `src/pages/CheckIn.tsx`
- `src/components/ErrorBoundary.tsx`
- `src/components/ui/badge.tsx`

Sem mudanças em banco de dados, RLS, edge functions ou configuração de eventos. Nenhum dado existente é afetado.