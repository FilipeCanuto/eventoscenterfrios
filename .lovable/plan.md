
O domínio `centerfrios.com` está verificado no Resend (print 1) e o último envio para `filipecanuto@centerfrios.com` foi entregue com sucesso (print 2: "Delivered"). Agora podemos sair do modo sandbox e enviar de `eventos@centerfrios.com` para qualquer destinatário.

## Mudança

Trocar o `FROM_ADDRESS` na edge function `send-registration-confirmation`:

```ts
// antes
const FROM_ADDRESS = "Eventos Centerfrios <onboarding@resend.dev>";
// depois
const FROM_ADDRESS = "Eventos Centerfrios <eventos@centerfrios.com>";
```

E remover o comentário `TODO` acima da constante.

## Arquivo afetado

- `supabase/functions/send-registration-confirmation/index.ts` — uma linha alterada + remoção do comentário TODO.

## Validação

Após o deploy automático, fazer uma inscrição de teste em `/register/circuito-experience-centerfrios-skymsen-rq0bmz` usando **qualquer e-mail** (não precisa ser o da conta Resend). O e-mail deve chegar com remetente `eventos@centerfrios.com`.

## Fora de escopo

- Configurar SPF/DKIM extras (já feito no Resend, status "Verified").
- Reenvio em massa de e-mails antigos (já foram enviados na correção anterior).
