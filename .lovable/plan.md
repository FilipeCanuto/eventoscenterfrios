## Resumo

Vamos (1) reescrever o texto do checkbox de consentimento na página de inscrição para incluir a **autorização de uso de imagem** (LGPD), (2) criar uma página pública de **Política de Privacidade** completa em pt-BR e (3) transformar "Política de Privacidade" em link clicável que abre essa página em nova aba.

---

## 1. Novo texto do checkbox (Register.tsx)

Substituir o texto atual por uma versão mais clara, com link e menção explícita ao uso de imagem:

> "Li e concordo com a **[Política de Privacidade](/privacidade)**. Autorizo o uso da minha imagem (foto e vídeo) captada durante o evento para divulgação nos canais digitais da CENTERFRIOS, conforme a LGPD (Lei 13.709/2018)."

Detalhes técnicos:

- O link "Política de Privacidade" abre `/privacidade` em nova aba (`target="_blank" rel="noopener noreferrer"`), com `text-primary underline underline-offset-2`.
- Mantém o mesmo `Checkbox` + validação já existente (`toast.error` na linha 638 — ajustar mensagem para "Aceite a Política de Privacidade e a autorização de uso de imagem para se inscrever.").
- Ajustar `<Label>` para permitir conteúdo HTML/JSX (o link precisa ser elemento separado dentro do label).

---

## 2. Nova página `/privacidade` (PrivacyPolicy.tsx)

Criar `src/pages/PrivacyPolicy.tsx` (lazy-loaded) e registrar a rota pública em `src/App.tsx`:

```tsx
<Route path="/privacidade" element={<PrivacyPolicy />} />
```

### Estrutura da página (seguindo boas práticas LGPD)

Layout limpo, max-w-3xl, tipografia do app (Bricolage Grotesque nos títulos, DM Sans no corpo), com header simples (logo CENTERFRIOS + link "Voltar") e as seguintes seções numeradas:

1. **Introdução** — quem somos (CENTERFRIOS), objetivo da política, base legal (LGPD).
2. **Controlador dos dados** — razão social CENTERFRIOS, e-mail de contato do encarregado (DPO) — *placeholder a confirmar*.
3. **Dados que coletamos** — nome, e-mail, WhatsApp, campos do formulário do evento, dados de navegação (cookies/analytics), imagem (foto/vídeo).
4. **Finalidades do tratamento** — gestão da inscrição, envio de comunicações sobre o evento (sequência de e-mails de aquecimento), check-in, divulgação institucional do evento.
5. **Autorização de uso de imagem** — seção destacada explicando que, ao se inscrever, o participante autoriza captura e divulgação de fotos/vídeos do evento nos canais digitais da CENTERFRIOS (site, redes sociais, YouTube, materiais promocionais), em caráter gratuito e por prazo indeterminado, podendo solicitar remoção a qualquer momento via contato.
6. **Compartilhamento de dados** — provedores estritamente necessários (hospedagem, e-mail transacional), sem venda a terceiros.
7. **Retenção** — pelo tempo necessário às finalidades; logs de inscrição arquivados após o evento.
8. **Direitos do titular (Art. 18 LGPD)** — acesso, correção, anonimização, portabilidade, eliminação, revogação do consentimento, oposição. Como exercer: e-mail de contato + link de descadastro de e-mails (`/unsubscribe-reminders/:token` já existente).
9. **Segurança** — RLS, criptografia em trânsito (HTTPS), boas práticas.
10. **Cookies** — uso para analytics e melhoria da experiência.
11. **Alterações desta política** — data de última atualização visível no topo.
12. **Contato** — e-mail e telefone do DPO/encarregado.

### Componentes reusados

- `<Logo>` no header
- Tipografia padrão do projeto, sem cards extras — texto corrido, headings claros
- Botão "Voltar" usando `useNavigate(-1)` ou link para `/`

---

## 3. Pontos de atenção / boas práticas

- **Consentimento granular**: o checkbox cobre 2 itens (dados + imagem) em uma única frase. É juridicamente aceitável quando ambos são essenciais à participação no evento, mas o ideal seria 2 checkboxes separados. **Recomendação**: manter 1 checkbox por simplicidade de UX, deixando o texto explícito sobre os dois consentimentos. Confirmo essa abordagem ao implementar.
- **Revogação**: a página menciona o link de descadastro de e-mails que já existe e oferece e-mail de contato para remoção de imagem.
- **Data de atualização**: variável `LAST_UPDATED` no topo da página (`24/04/2026`).
- **Footer da Landing**: opcionalmente adicionar link "Política de Privacidade" no rodapé da página inicial — confirmar se quer essa adição.
- **SEO**: rota indexável com `<title>` e `<meta description>` apropriados via `document.title` no `useEffect`.

---

## 4. Informações que preciso confirmar antes/durante a implementação

Para deixar a Política de Privacidade juridicamente sólida, preciso de:

- **Razão social completa + CNPJ da CENTERFRIOS** (aparece como controlador dos dados)
- **E-mail de contato do encarregado/DPO** (ex.: `privacidade@centerfrios.com`)
- **Telefone/endereço** para contato (opcional, mas recomendado)

Se você não tiver esses dados agora, posso usar **placeholders claros** marcados como `[A PREENCHER]` e você ajusta depois — nada bloqueia o lançamento.

---

## Arquivos afetados

- `src/pages/PrivacyPolicy.tsx` *(novo)*
- `src/pages/Register.tsx` *(editado: linhas 454-459 e mensagem do toast linha 638)*
- `src/App.tsx` *(editado: adicionar lazy import + rota `/privacidade`)*

Aprovando, eu implemento e te entrego um link funcional para revisar.

&nbsp;

(Razão Social da CENTERFRIOS: Center Frios Máquinas e Equipamentos LTDA; CNPJ: ***06698222000378;*** E-mail de contato: adm@centerfrios.com; Telefone para contato: 82 3223-2497.)