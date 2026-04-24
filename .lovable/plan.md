## Problema identificado

O favicon do circuito **não está aparecendo** nas páginas de Inscrição, Obrigado e Política de Privacidade, apesar do código já ter sido escrito anteriormente. Causa raiz:

- O `index.html` **não declara nenhuma tag** `<link rel="icon">`. O browser está caindo no fallback automático `/favicon.ico` (arquivo legado da Lovable que ainda existe em `public/`).
- Os `useEffect` em `Register.tsx` e `PrivacyPolicy.tsx` fazem `document.querySelector("link[rel~='icon']")` — como a tag não existe, o resultado é `null` e o swap é silenciosamente ignorado.
- A página de "Obrigado" é o bloco `success` renderizado dentro do próprio `Register.tsx` (mesma rota), então será coberta automaticamente pela mesma correção.

## Correções

### 1. `index.html` — declarar o favicon padrão
Adicionar a tag de ícone no `<head>` apontando para o ícone do circuito como favicon **global** do site (assim ele já aparece em todas as páginas, incluindo Landing e Dashboard, mantendo a identidade da CENTERFRIOS):

```html
<link rel="icon" type="image/png" href="/favicon-circuito.png" />
<link rel="apple-touch-icon" href="/favicon-circuito.png" />
```

### 2. Remover `public/favicon.ico` legado
Apagar `public/favicon.ico` (ícone padrão da Lovable) para garantir que o browser não use o fallback antigo em nenhuma circunstância.

### 3. Tornar o `useEffect` de swap robusto (defensivo)
Em `Register.tsx` e `PrivacyPolicy.tsx`, ajustar o hook para **criar** a tag `<link rel="icon">` caso ela não exista, em vez de apenas tentar selecioná-la. Isso garante funcionamento mesmo se o `index.html` for alterado no futuro:

```tsx
useEffect(() => {
  let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  const created = !link;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  const previous = link.href;
  link.href = "/favicon-circuito.png";
  return () => {
    if (created) link!.remove();
    else link!.href = previous;
  };
}, []);
```

## Resultado esperado

- **Página de Inscrição** (`/r/:slug`): favicon do circuito ✅
- **Página de Obrigado** (estado `success` da mesma rota): favicon do circuito ✅
- **Página de Política de Privacidade** (`/privacidade`): favicon do circuito ✅
- **Demais páginas (Landing, Dashboard)**: também passam a usar o favicon do circuito como padrão global, reforçando a identidade da CENTERFRIOS.

## Arquivos afetados

- `index.html` (adicionar `<link rel="icon">`)
- `public/favicon.ico` (deletar)
- `src/pages/Register.tsx` (tornar o swap robusto)
- `src/pages/PrivacyPolicy.tsx` (tornar o swap robusto)

## Validação após implementação

Abrir cada página em uma aba nova e confirmar visualmente o ícone do circuito na aba do navegador:
1. `/r/<slug-de-um-evento>` (formulário)
2. Submeter o formulário e ver a tela de confirmação
3. `/privacidade`
