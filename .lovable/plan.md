# Plano: Página pública de check-in por e-mail

Página simples e pública (sem login, sem QR individual) onde o participante digita o e-mail e o sistema faz o check-in automaticamente, baseado nos eventos que estão acontecendo hoje (dentro da janela de check-in: 4h antes até 4h depois).

## Rota e UX

- Nova rota pública: `/checkin-rapido` (no `App.tsx`, fora do dashboard, lazy-loaded).
- Layout idêntico ao `/check-in/:registrationId` atual (Logo + Card centralizado, mobile-first, mesmas cores/tipografia).
- Fluxo:
  1. Tela inicial: input grande de e-mail + botão "Fazer check-in" (rounded-full, primary). Texto auxiliar: "Digite o e-mail usado na sua inscrição".
  2. Ao enviar → spinner → resultado.
  3. Resultado de sucesso: mesma tela `✅ Check-in Realizado` + nome + evento + confetti (reaproveita o componente visual do `CheckIn.tsx`).
  4. Erros amigáveis em pt-BR:
     - `not_found` → "Não encontramos sua inscrição. Verifique o e-mail ou procure a equipe na recepção."
     - `outside_window` → "Nenhum evento está aberto para check-in agora."
     - `cancelled` → "Inscrição cancelada. Procure a equipe."
     - `multiple_events` → mostra os eventos abertos hoje (botões com nome do evento) para o participante escolher; o segundo clique reenvia com `event_id` específico.
- Botão "Tentar outro e-mail" para recomeçar sem refresh.

## Backend (RPC SECURITY DEFINER)

Como `registrations` tem RLS restrita a donos do evento, criar uma função pública que faz toda a lógica server-side:

`public.public_check_in_by_email(p_email text, p_event_id uuid default null) returns jsonb`

Lógica:
1. Normaliza e valida e-mail (lower/trim, regex básico, max 255).
2. Busca registrations não canceladas onde `lower(lead_email) = p_email`, juntando com `events` que estejam:
   - `status = 'live'`
   - dentro da janela `event_date - 4h <= now() <= coalesce(event_end_date, event_date) + 4h`
   - Se `p_event_id` informado, filtra por ele.
3. Casos:
   - 0 registros → retorna `{status: 'not_found'}`. Se houver registro fora de janela, retorna `{status: 'outside_window'}`.
   - >1 evento distinto e `p_event_id` não informado → retorna `{status: 'multiple_events', events: [{id, name}]}`.
   - 1 registro: faz `UPDATE` para `checked_in` (idempotente: se já estava checked_in, retorna `already_checked_in`); retorna `{status: 'success'|'already_checked_in', name, event_name, primary_color}`.
4. Rate-limit leve via guard de tamanho de input (já é o suficiente para esse uso de recepção).

A função substitui a necessidade de chamar `public_check_in(uuid)` do cliente sem expor a tabela.

## Arquivos a criar/editar

1. **Migration SQL** — cria `public_check_in_by_email` (SECURITY DEFINER, search_path = public) e concede `EXECUTE` para `anon, authenticated`.
2. **`src/pages/CheckInRapido.tsx`** (novo) — formulário + estados (idle/loading/success/error/multiple), chamada via `supabase.rpc("public_check_in_by_email", { p_email, p_event_id })`. Reaproveita o visual de sucesso (confetti, ✅, h1, brand color do evento).
3. **`src/App.tsx`** — adicionar `const CheckInRapido = lazy(...)` e `<Route path="/checkin-rapido" element={<CheckInRapido />} />` na seção pública.

## Como usar no dia do evento

- Imprimir um QR Code único apontando para `https://eventos.centerfrios.com/checkin-rapido` e colar na recepção.
- Participante escaneia → digita e-mail → check-in concluído.
- Funciona mesmo se ele não recebeu (ou perdeu) o e-mail individual com QR.

## Não incluído (por escopo)

- Sem busca por nome/WhatsApp (manter mínimo). Se quiser depois, posso adicionar fallback "tentar por WhatsApp".
- Sem auth, sem captcha (a operação é idempotente e limitada à janela do evento — risco baixo).