

## Objetivo

Garantir que o link `/register/circuito-experience-centerfrios-skymsen-rq0bmz` seja a porta de entrada direta do lead, sem login, sem etapas intermediárias, e sem qualquer barreira que atrapalhe a conversão vinda de anúncios e landing pages externas.

## Diagnóstico

Verifiquei `src/App.tsx`: a rota `/register/:slug` já é **pública** (não está dentro de `<ProtectedRoute>`). Tecnicamente, qualquer pessoa com o link consegue acessar e se inscrever sem login — o backend usa a função pública `register_for_event`.

Porém, revisando o componente `src/pages/Register.tsx` e o fluxo atual, identifiquei pontos de fricção que podem afastar o lead vindo de anúncio:

1. **Possível redirecionamento ou tela de espera** — preciso confirmar se há algum `useEffect` que checa autenticação ou faz redirect.
2. **Header/navbar com links** que podem tirar o lead da página (voltar ao site, ver outros eventos, fazer login).
3. **Carregamento lento ou flash de conteúdo** — se o lead vê um spinner longo ou conteúdo "piscando", pode desistir.
4. **CTA do formulário** pode não estar destacado o suficiente como primeira ação visual.
5. **Campos opcionais excessivos** podem espantar — manter só Nome, E-mail e WhatsApp em destaque (já está, conforme última edição).
6. **Open Graph / metatags** — quando o link é compartilhado em anúncios (Meta Ads, WhatsApp), precisa exibir prévia rica (imagem do evento, título, descrição) para aumentar CTR.
7. **Landing externa** — facilitar para que landing pages externas (ex.: do anunciante) consigam embedar ou redirecionar diretamente para essa URL.

## Plano de Ação

### 1. Confirmar acesso 100% público (sem login)
Inspecionar `src/pages/Register.tsx` e remover qualquer:
- Verificação de sessão (`useAuth`, `user`, redirect para `/auth`).
- Botões de login/cadastro no header da própria página.
- Links de navegação que tirem o lead do contexto de inscrição.

### 2. Layout focado em conversão (landing-style)
- Esconder qualquer navbar global na rota `/register/:slug`.
- Manter apenas: logo da empresa organizadora (sem link para outras páginas) + flyer + título + formulário + CTA.
- Botão de inscrição grande, em destaque (`h-12`, `rounded-full`, primary color), texto claro: "Garantir minha vaga".
- Acima do formulário, microcopy de urgência sutil: data + local + "Inscrição gratuita em menos de 1 minuto".

### 3. Carregamento otimizado
- Skeleton mínimo (sem flashes).
- Carregar dados do evento e campos do formulário em paralelo.
- Pré-renderizar título/descrição assim que disponível (sem esperar tudo).

### 4. SEO + Open Graph dinâmico
Adicionar `react-helmet-async` (ou tags diretas via `useEffect`) na página de registro para:
- `<title>` = "Inscreva-se · {nome do evento}"
- `<meta name="description">` = descrição curta do evento
- `<meta property="og:title">`, `og:description`, `og:image` (flyer do evento), `og:url`
- `<meta name="twitter:card" content="summary_large_image">`

Isso garante que o link compartilhado em anúncios e WhatsApp mostre prévia rica.

### 5. UTM tracking pronto para anúncios
Capturar parâmetros `utm_source`, `utm_medium`, `utm_campaign` da URL e:
- Salvar como metadata na inscrição (campo `data` ou novo campo `metadata` no insert).
- Persistir em `sessionStorage` para sobreviver a refresh.

Isso permite à equipe medir qual anúncio gerou cada inscrição.

### 6. Pixel/analytics ready (opcional, sem código de terceiros agora)
Disparar evento custom `lead_registered` no `window.dataLayer` (se existir) ao concluir inscrição — facilita plugar Meta Pixel ou GA4 depois sem tocar no código.

### 7. Mobile-first reforçado
- Inputs `h-12`, fonte 16px (evita zoom no iOS).
- Botão sticky no rodapé em mobile (sempre visível ao rolar).
- Flyer com altura limitada em mobile para não empurrar o formulário para fora da dobra.

## Arquivos Afetados

- **`src/pages/Register.tsx`** — remover qualquer auth/redirect, esconder navbar, reforçar CTA, adicionar metatags OG, capturar UTMs, sticky CTA mobile.
- **`index.html`** — fallback de metatags base (caso JS demore).
- **`src/hooks/useRegistrations.ts`** — incluir UTMs no payload da inscrição.
- **`package.json`** — adicionar `react-helmet-async` (se ainda não houver).

## Fora de escopo (mas sugerido como próximo passo)

- Configurar Meta Pixel / Google Tag Manager (precisa dos IDs do anunciante).
- Criar variantes A/B do CTA.
- Página de "obrigado" com link de compartilhamento já preenchido para o lead convidar amigos.

