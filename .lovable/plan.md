## Problema identificado

A página está fora do ar porque o build do CSS está falhando. O arquivo `src/index.css` tem um `@import` do Google Fonts colocado **depois** das diretivas `@tailwind`, o que viola a regra do CSS:

> `@import must precede all other statements (besides @charset or empty @layer)`

Isso impede o Vite de processar o CSS e quebra a renderização da aplicação inteira.

### Log de erro (vite)
```
[vite:css] @import must precede all other statements (besides @charset or empty @layer)
3  |  @tailwind utilities;
4  |  
5  |  @import url('https://fonts.googleapis.com/css2?...
```

## Correção

Reordenar as primeiras linhas de `src/index.css` para colocar o `@import` das fontes **antes** das diretivas `@tailwind`:

```css
@import url('https://fonts.googleapis.com/css2?...');

@tailwind base;
@tailwind components;
@tailwind utilities;
```

Nenhuma outra mudança é necessária — o restante do CSS, tokens de tema, layers e componentes permanecem intactos. Não há impacto em funcionalidades, design ou dados.

## Verificação pós-correção

- Confirmar que o log do Vite não exibe mais o erro `@import must precede all other statements`.
- Confirmar que a página de preview volta a renderizar normalmente.
