## Resumo

Vou (1) preencher os dados reais da empresa na Política de Privacidade, (2) salvar o favicon enviado em `public/` e usá-lo dinamicamente nas páginas `/registrar` e `/privacidade` (substituindo o favicon padrão apenas nessas rotas), e (3) armazenar o arquivo também no bucket `event-assets` do Lovable Cloud para reutilização futura.

---

## 1. Atualizar `src/pages/PrivacyPolicy.tsx`

Substituir os placeholders `[A PREENCHER]` e o e-mail genérico pelos dados oficiais:

- **Razão social:** Center Frios Máquinas e Equipamentos LTDA
- **CNPJ:** 06.698.222/0003-78 (formatado)
- **E-mail (DPO + contato):** adm@centerfrios.com → trocar todas as ocorrências de `privacidade@centerfrios.com`
- **Telefone:** (82) 3223-2497 (adicionar nas seções 2 e 12)
- Atualizar `LAST_UPDATED` para a data de hoje.

## 2. Adicionar o favicon

**Salvar o arquivo:**
- Copiar `user-uploads://favicon_circuito_experience.png` → `public/favicon-circuito.png`
- Também enviar para o bucket `event-assets` (caminho `branding/favicon-circuito.png`, público) para reuso futuro a partir do banco.

**Aplicar o favicon dinamicamente** apenas em `/registrar/:slug` (`Register.tsx`) e `/privacidade` (`PrivacyPolicy.tsx`):
- Em cada página, dentro de um `useEffect`, localizar `<link rel="icon">` no `<head>` e trocar o `href` para `/favicon-circuito.png`.
- No cleanup (unmount), restaurar o favicon original (`/favicon.ico` atual do projeto), para não vazar o ícone para o restante do app.

Padrão usado:
```ts
useEffect(() => {
  const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
  const previous = link?.href;
  if (link) link.href = "/favicon-circuito.png";
  return () => { if (link && previous) link.href = previous; };
}, []);
```

## 3. Persistir no Lovable Cloud (storage)

Sem nova tabela — basta publicar o arquivo no bucket público `event-assets`. A URL pública (`/storage/v1/object/public/event-assets/branding/favicon-circuito.png`) ficará disponível caso o usuário queira referenciá-lo dinamicamente depois (ex.: vincular favicon por evento futuramente).

---

## Arquivos afetados

- `src/pages/PrivacyPolicy.tsx` — dados reais da empresa + injeção de favicon
- `src/pages/Register.tsx` — injeção de favicon
- `public/favicon-circuito.png` — novo arquivo
- Storage `event-assets/branding/favicon-circuito.png` — upload via script único

## Fora do escopo

- Não alteramos o favicon global do app (`index.html`) — apenas as duas páginas pedidas.
- Não criamos tabela nova de "branding"; o storage já cumpre o papel de persistência solicitado.
