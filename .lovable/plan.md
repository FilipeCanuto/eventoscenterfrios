

## Objetivo

1. Adicionar um **QR Code no e-mail de confirmação** que aponta para uma página pública de check-in.
2. Reformular essa página (`/check-in/:registrationId`) para mostrar um **emoji gigante de confirmação ✅, mensagem "Checkin Realizado" e confetes**, marcando a inscrição como `checked_in` automaticamente.
3. **Corrigir o bug do Resend** que está bloqueando 100% dos e-mails de confirmação hoje (`The \n is not allowed in the subject field` — quebra de linha no nome do evento).

---

## 1. Bug crítico do Resend (corrigir já)

Logs mostram:
```
[send-registration-confirmation] Resend error 422
"The `\n` is not allowed in the `subject` field."
```

**Causa:** o nome do evento atual contém `\n` ("Circuito Experience: \nCenterfrios & Skymsen") para quebrar linha visualmente. O subject do e-mail concatena isso direto: `Inscrição confirmada — ${ctx.eventName}`.

**Correção (em `supabase/functions/send-registration-confirmation/index.ts`):**
- Sanitizar o nome do evento ao montar o `subject`: substituir `\r`, `\n`, `\t` por espaço e colapsar espaços duplos (`name.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim()`).
- Aplicar o mesmo no campo `text` (alguns clientes também não gostam) onde o nome aparece.
- Manter o nome com quebra de linha no **HTML** (já é seguro lá, fica bonito).

Resultado: o e-mail volta a ser enviado.

---

## 2. QR Code no e-mail de confirmação

**Mudanças em `supabase/functions/send-registration-confirmation/index.ts`:**

- O QR code precisa ser uma **imagem clicável**. E-mail não roda JS, então o QR é gerado server-side via API pública confiável (Google Charts/QR Server). Vou usar:
  ```
  https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=2&data=<URL_ENCODED>
  ```
  (Sem dependência nova, sem token; API estável usada amplamente em e-mails transacionais.)
- A URL codificada será `${origin}/check-in/${registrationId}`.
- Adicionar bloco no HTML (entre o "Quando/Local" e o botão "Ver página do evento"):
  - Título "Seu ingresso digital"
  - QR como `<img>` 220×220 centralizado, com `alt` e fallback de link `<a>` abaixo ("Ou clique aqui para fazer check-in").
  - Texto curto: "Apresente este QR Code na entrada do evento."
- Adicionar a URL de check-in também na versão `text` (plain).

---

## 3. Página `/check-in/:registrationId` — "Checkin Realizado" 🎉

**Reformular `src/pages/CheckIn.tsx`:**

Comportamento:
1. Ao montar, se a inscrição existe e não está `cancelled`:
   - Se `status === "registered"` → executar `UPDATE registrations SET status='checked_in' WHERE id=...` (a RLS atual **não permite** UPDATE público — ver subseção abaixo).
   - Se já estava `checked_in` → mostrar tela de confirmação igual com legenda "Check-in já realizado em <data>".
2. Se `cancelled` ou inexistente → tela de erro (mantém o que já existe).
3. Sucesso → disparar confetes (`canvas-confetti`, já instalado), mostrar:
   - **Emoji gigante ✅** (text-[120px], com leve animação de scale/bounce via framer-motion ou Tailwind `animate-in`).
   - Título **"Checkin Realizado"** (font-display, text-4xl/5xl).
   - Subtítulo com nome do participante e nome do evento.
   - Salvas de confeti em 3 ondas (300ms, 600ms, 1000ms) usando as cores da marca do evento (`primary_color`).
4. Acessibilidade: `role="status"`, `aria-live="polite"` no bloco principal.
5. Mobile-first: padding seguro, emoji escala para `text-[96px]` em telas pequenas.

### RLS — habilitar check-in público

Hoje:
```
"Event owners can update registrations" → UPDATE só para o dono.
```
Se mantivermos assim, a página de check-in não consegue marcar `checked_in` direto do navegador anônimo.

**Solução segura:** criar uma RPC `SECURITY DEFINER` `public_check_in(p_registration_id uuid)` que:
- Faz o `UPDATE … SET status='checked_in'` **apenas** se o status atual for `'registered'` (idempotente: se já `checked_in`, retorna `'already_checked_in'`; se `cancelled`, retorna `'cancelled'`; se não existe, retorna `'not_found'`).
- `GRANT EXECUTE … TO anon, authenticated`.
- Não retorna nada de PII (só o resultado da operação).

A página chama `supabase.rpc('public_check_in', { p_registration_id: id })`. Sem novas policies de UPDATE diretas — superfície de ataque mínima (atacante com o UUID só consegue marcar como checked_in, o que não vaza dado e não exclui nada).

---

## 4. Verificação da conexão Resend

- O segredo `RESEND_API_KEY` já está configurado (gerenciado pelo conector). Sem necessidade de tocar.
- O `FROM_ADDRESS` (`eventos@eventos.centerfrios.com`) já está em uso — funcionou nos envios anteriores aos e-mails recentes; o único motivo de falha agora é o `\n` no subject.
- Após corrigir o subject e fazer deploy da function, testar reenvio (apagando `tracking.confirmation_email_sent_at` da última inscrição com problema, se necessário, para re-disparar — opcional).

---

## Arquivos alterados

- `supabase/functions/send-registration-confirmation/index.ts` — sanitiza subject; injeta bloco de QR Code no HTML/text.
- `src/pages/CheckIn.tsx` — reescrita: confeti, emoji, "Checkin Realizado", chamada à RPC.
- **Nova migration** `supabase/migrations/...sql` — função `public_check_in(uuid)` `SECURITY DEFINER` + grant para `anon`/`authenticated`.

Sem novas dependências (`canvas-confetti` e `qrcode` já existem; QR no e-mail usa API externa por imagem).

---

## Validação

1. Inscrever um lead de teste no evento → verificar inbox: e-mail chega (sem o erro 422), com QR Code visível e clicável.
2. Escanear o QR (ou abrir a URL `/check-in/<id>` em aba anônima) → ver tela com ✅ gigante + "Checkin Realizado" + confetes.
3. Recarregar a mesma URL → continua mostrando "Checkin Realizado" (estado idempotente).
4. Conferir em `/dashboard/attendees` que o status do participante virou **Checked-in**.
5. Tentar a URL com um UUID inválido → tela de erro (sem crash).
6. Verificar logs da edge function: nenhum erro 422 do Resend.

