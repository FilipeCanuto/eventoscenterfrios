## Auditoria do fluxo de inscrição — diagnóstico

Análise completa de `src/pages/Register.tsx`, `src/App.tsx`, `src/components/ui/select.tsx`, `index.html` e do hook de criação de inscrição. A seguir, todos os pontos identificados que podem causar **tela em branco** ou degradar a experiência (priorizando mobile).

### Falhas críticas (causam tela branca)

1. **Sem ErrorBoundary global.** Hoje, qualquer erro de renderização (no `Select` da Radix, no `confetti`, no `framer-motion`, em um chunk lazy que falhou ao baixar, em parsing de data inválida, etc.) faz o React desmontar toda a árvore. O usuário vê uma página completamente em branco — exatamente o sintoma do print. Não há logs no console do usuário porque o evento já passou pelo React e o site simplesmente "morreu".

2. **`Suspense fallback={null}` no `App.tsx`.** Cada rota é `lazy()`. Se o chunk JS do `Register` falhar (rede instável no mobile, cache corrompido, deploy novo no meio da sessão), o Suspense fica suspenso para sempre mostrando **nada**. Em mobile com 3G/4G isso acontece bastante.

3. **`SuccessCard` chama `confetti` em `useEffect` sem proteção.** Em alguns navegadores (in-app browsers do Instagram/WhatsApp/Facebook no Android, ou Safari iOS antigo) o `canvas-confetti` pode falhar — e como está dentro de um effect sem try/catch, derruba a árvore inteira logo após o submit dar certo. O usuário vê: "enviei o formulário e a tela ficou branca".

4. **Select da Radix dentro de container com `transform`.** O componente pai usa `motion.div` com `initial={{ opacity:0, x:20 }} animate=...`. O Radix Select usa Portal com `position="popper"` e mede coordenadas com base no trigger. Em alguns Android WebViews (Chrome 90, Samsung Internet antigo) a combinação de `transform: translate3d` na hierarquia + Portal pode disparar `ResizeObserver loop` e quebrar o cálculo de posição — o popover abre fora da viewport ou o trigger perde foco e o react re-renderiza em loop. Usar um `<select>` HTML nativo no mobile elimina o problema e ainda dá UX nativa (roleta do iOS, drawer do Android).

5. **Submit chama `supabase.functions.invoke` sem await dentro de try externo.** Se `functions.invoke` lançar de forma síncrona (ex.: client não inicializado), o `try` interno captura, mas se algo na construção do payload (`window.location.origin` em contexto sandbox quebrado) falhar, derruba o `setSubmitted`. Pequeno risco, mas vale envolver.

### Falhas médias (degradam UX / dados)

6. **Validação de e-mail só client-side via `type="email"`.** Em mobile, navegadores aceitam `aaa@bbb` como válido. Não há regex de e-mail. Resultado: muitos cadastros entram com e-mail malformado (já visível na base — `Julianazevedo@hotmail.com` com J maiúsculo, `DOMPRATORESTAURANTE@GMAIL.COM`, etc.). O backend já normaliza para minúsculo, mas não rejeita strings sem `.tld`.

7. **Botão de submit não previne duplo-tap.** Em mobile o usuário tóca duas vezes rápido; o `disabled={isPending}` ajuda, mas a transição React entre clique e setState dá ~100ms de janela em que dois `mutateAsync` disparam — gerando duplicatas (a hardening do Postgres mitiga, mas dá toast de erro confuso).

8. **`maskBRPhone` aceita DDDs inválidos** (ex.: `00`, `10`). Não é grave, mas confunde o atendimento depois.

9. **Sem `autoComplete` nos inputs.** Em mobile isso atrapalha o auto-preenchimento (nome, email, tel). É uma melhoria gratuita.

10. **Console warnings** já visíveis: `Function components cannot be given refs` em `RegistrationDetailDialog` (DialogFooter recebe ref) e `Missing Description for DialogContent`. Não causa branca, mas polui logs e indica que o componente não está usando `forwardRef` corretamente.

11. **`SuccessCard` declara `useState` e `useEffect` mas é um componente filho que pode ser remontado a cada render do pai** porque `formData["Nome Completo"]` muda — não causa bug, só desperdício.

### Falhas baixas / preventivas

12. **`captureUtms` usa `sessionStorage`** sem try/catch no `JSON.parse` do retorno (tem try, ok). Em modo privado iOS Safari, `sessionStorage` pode lançar — já está protegido. ✓
13. **`document.title` e meta tags** são modificados sem cleanup quando o usuário navega para outra rota. Pequeno vazamento de SEO entre rotas.
14. **`favicon-circuito.png` é referenciado mas não confirmamos que existe em `/public`.** Se faltar, é só 404 silencioso — não causa branca.

---

## Correções propostas

### 1. ErrorBoundary global (crítico)
Criar `src/components/ErrorBoundary.tsx` (class component) que:
- Captura erros em `componentDidCatch`
- Mostra fallback amigável em pt-BR: "Ops! Algo deu errado. Recarregue a página."
- Botão "Tentar novamente" que faz `window.location.reload()`
- Botão "Voltar ao início"
- Loga o erro no console com contexto

Envolver `<App />` no `main.tsx` e também envolver o `<Suspense>` em `App.tsx` para capturar falhas de chunk lazy.

### 2. Suspense fallback visível
Trocar `fallback={null}` por um spinner centralizado, igual ao do `Register`. Se o chunk demorar/falhar, o usuário vê "Carregando…" em vez de tela branca.

### 3. Tornar o Select resiliente — fallback nativo no mobile
No `RegistrationForm`, quando `field_type === "select"`:
- Detectar mobile (`window.matchMedia("(max-width: 767px)")` no mount, fallback para `false`)
- Renderizar `<select>` HTML nativo no mobile com mesmo `value`/`onChange` — UX nativa, zero risco de portal/transform
- Manter Radix Select no desktop
- Estilizar com Tailwind para parecer com o Input

### 4. Proteger `confetti` e `SuccessCard`
- `try { confetti(...) } catch {}` em todas as chamadas
- Verificar `typeof confetti === "function"` antes
- Fallback: se importação falhar, success page renderiza sem animação

### 5. Validação de e-mail com zod no client + autoComplete
- Adicionar regex de e-mail antes de submeter
- `autoComplete="name"`, `email`, `tel`, `organization` nos campos correspondentes baseando-se no label
- `inputMode="email"` no campo de email
- `autoCapitalize="none"` e `autoCorrect="off"` em e-mail/telefone

### 6. Anti duplo-submit
- Adicionar `useRef` `submittingRef` que bloqueia chamadas concorrentes mesmo antes do setState propagar

### 7. Corrigir warnings do Dialog (limpeza)
- `DialogFooter` no `RegistrationDetailDialog`: remover ref ou trocar por `<div>` se não precisa
- Adicionar `<DialogDescription>` (ou `aria-describedby={undefined}` explícito) no `DialogContent`

### 8. Limpar meta tags ao desmontar `Register`
Pequeno cleanup: restaurar `document.title` original ao sair da rota.

---

## Arquivos a editar

- **CRIAR** `src/components/ErrorBoundary.tsx` — boundary global em pt-BR
- **EDITAR** `src/main.tsx` — envolver `<App />` em `<ErrorBoundary>`
- **EDITAR** `src/App.tsx` — Suspense com spinner; segundo `ErrorBoundary` interno
- **EDITAR** `src/pages/Register.tsx`:
  - Select com fallback nativo no mobile
  - Proteger confetti
  - Validação de email + autoComplete + inputMode + autoCapitalize
  - submittingRef
  - Cleanup de title/meta
- **EDITAR** `src/components/dashboard/RegistrationDetailDialog.tsx` — corrigir warning de ref + adicionar DialogDescription

Nenhuma mudança de banco de dados, nenhuma alteração de configuração, nenhum impacto em e-mails já enviados.

## Resumo do que o usuário verá depois

- Telas brancas viram telas com mensagem clara + botão "Tentar novamente"
- O dropdown "Segmento" funciona em qualquer navegador mobile, com a roleta nativa do celular
- Animação de sucesso nunca derruba a página
- E-mails inválidos são rejeitados antes de salvar
- Auto-preenchimento do celular funciona (nome, email, telefone)
- Avisos no console somem
