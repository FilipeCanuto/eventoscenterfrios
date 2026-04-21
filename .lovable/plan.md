

## Objetivo

Ajustar o e-mail de confirmação de inscrição:
1. **Remover o banner do evento** que aparece no topo do e-mail.
2. **Substituir o rodapé** "powered by meuevento" por "powered by CENTERFRIOS".

## Mudanças

Arquivo único: `supabase/functions/send-registration-confirmation/index.ts`

- Remover o bloco `<img>` do banner/cover do evento renderizado no topo do HTML do e-mail (e qualquer wrapper/section que sobre vazio em consequência).
- Localizar a string `powered by meuevento` (no HTML e na versão `text` do e-mail) e trocar por `powered by CENTERFRIOS`.
- Manter todo o restante intacto: saudação, dados do evento (data/local), QR Code de check-in, botão "Ver página do evento", assinatura.

## Validação

1. Reenviar uma inscrição de teste → o e-mail chega **sem o banner do evento** no topo.
2. Conferir o rodapé: deve exibir **"powered by CENTERFRIOS"**.
3. QR Code, link de check-in e demais blocos permanecem funcionando normalmente.

