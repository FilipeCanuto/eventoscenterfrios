# Fix: registration page (and entire published site) returning blank

## Diagnóstico — causa raiz

A página de cadastro (e na verdade **todo o site publicado** em `eventos.centerfrios.com` e `eventoscenterfrios.lovable.app`) está em branco. O preview do Lovable funciona normalmente — o problema só ocorre no build de produção.

Erro reproduzido no console do site publicado:

```
Uncaught TypeError: Cannot read properties of undefined (reading 'createContext')
  at https://eventos.centerfrios.com/assets/vendor-B44iLDgb.js:1:21317
```

Investigando os bundles servidos:

- `assets/vendor-B44iLDgb.js` começa com:
  `import { r as E, R as O, j as he, c as Mr, g as st } from "./react-core-fDo77-Qy.js";`
- `assets/react-core-fDo77-Qy.js` começa com:
  `import "./react-dom-D1GBnleL.js"; import { G as S, H as he, ... } from "./vendor-B44iLDgb.js";`

Ou seja: **`react-core` e `vendor` se importam mutuamente** (import circular). Em produção isso faz com que `vendor` execute antes de `react-core` terminar de inicializar; quando uma dependência dentro de `vendor` (provavelmente `class-variance-authority` / `tailwind-merge` / `next-themes` / etc.) tenta chamar `React.createContext(...)` no top-level, `React` ainda está `undefined` → toda a árvore React falha em montar e a página fica em branco.

A causa está no `vite.config.ts`, na função `manualChunks`:

```ts
manualChunks: (id) => {
  if (!id.includes("node_modules")) return undefined;
  if (id.includes("react-dom")) return "react-dom";
  if (id.includes("/react/") || id.includes("react-router") || id.includes("scheduler")) return "react-core";
  if (id.includes("@tanstack")) return "tanstack";
  if (id.includes("@radix-ui")) return "radix";
  if (id.includes("@supabase")) return "supabase";
  if (id.includes("recharts") || id.includes("d3-") || id.includes("victory-vendor")) return "charts";
  if (id.includes("lucide-react")) return "icons";
  if (id.includes("date-fns") || id.includes("react-day-picker")) return "date";
  if (id.includes("react-hook-form") || id.includes("@hookform") || id.includes("zod")) return "forms";
  return "vendor";
}
```

Problemas:

1. O agrupamento `"react-core"` casa apenas `/react/` e `react-router`, mas **não** `react/jsx-runtime` em todos os caminhos do pnpm/bun, nem alguns helpers internos (ex.: `react-is`, `use-sync-external-store`). Esses ficam no chunk `vendor`, que então depende de `react-core` — mas vários pacotes em `vendor` (ex.: `next-themes`, `@radix-ui` re-exportados, `class-variance-authority`) também são importados a partir de `react-core` indiretamente, gerando o ciclo.
2. O agrupamento foi feito para SEO/performance mas hoje está quebrando a aplicação inteira em produção. Não há ganho que justifique manter o site fora do ar.

## Plano de correção (mínimo e seguro)

Apenas 1 arquivo precisa ser alterado.

### `vite.config.ts`
- Remover o bloco `build.rollupOptions.output.manualChunks` por completo.
- Manter o restante (`server`, `plugins`, `resolve`, `optimizeDeps`) intacto.
- O Rollup/Vite cairá no chunking padrão (mesmo chunk para o entry e splits automáticos para imports dinâmicos das rotas `lazy()` já existentes em `App.tsx`). Isso continua dando code-splitting por rota e elimina o ciclo React ↔ vendor.

Resultado:
- O site publicado volta a renderizar.
- A página `/register/:slug` carrega normalmente.
- Nenhuma mudança em UX, dados, RLS, autenticação ou edge functions.

## Validação após o deploy
1. Recarregar `https://eventos.centerfrios.com/register/circuito-experience-centerfrios-skymsen-rq0bmz` e confirmar que o formulário aparece (campos: Nome, E-mail, Empresa, Segmento, Dias de Comparecimento, WhatsApp).
2. Verificar console: não deve haver `Cannot read properties of undefined (reading 'createContext')`.
3. Confirmar que a landing `/` e `/dashboard` também voltam a abrir.

## Observações
- O preview do Lovable nunca apresentou esse erro porque em dev o Vite serve cada módulo separadamente (sem o split do Rollup), por isso o problema só aparece após publicar.
- A funcionalidade de "Dias de Comparecimento" (multiselect) e o restante da arquitetura de inscrição já foram validados — não há nada a corrigir nelas; o único bloqueio é o erro de bundling acima.
