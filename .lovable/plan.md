
## Diagnóstico

Os logs do edge function `send-registration-confirmation` mostram claramente o erro:

```
[send-registration-confirmation] Resend error 403
"The centerfrios.com domain is not verified. 
Please, add and verify your domain on https://resend.com/domains"
```

Isso aconteceu nos dois últimos envios (timestamps 1776528322 e 1776525110, hoje).

## Causa raiz

Há uma **incompatibilidade entre o domínio verificado no Resend e o domínio usado no `FROM_ADDRESS`** da edge function.

Na imagem que você enviou (Outlook), o e-mail de contato é `contato@eventos.centerfrios.com` — ou seja, o subdomínio configurado é **`eventos.centerfrios.com`**, não `centerfrios.com` (raiz).

Mas no código da edge function temos:
```ts
const FROM_ADDRESS = "Eventos Centerfrios <eventos@centerfrios.com>";
```

O Resend está rejeitando porque:
- **Verificado no Resend:** `eventos.centerfrios.com` (subdomínio)
- **Tentando enviar de:** `eventos@centerfrios.com` (raiz — não verificada)

A API do Resend só aceita envios de domínios/subdomínios exatamente verificados. `centerfrios.com` (raiz) e `eventos.centerfrios.com` (subdomínio) são tratados como domínios distintos.

## Solução

Trocar o `FROM_ADDRESS` para usar o subdomínio verificado:

```ts
// antes
const FROM_ADDRESS = "Eventos Centerfrios <eventos@centerfrios.com>";

// depois
const FROM_ADDRESS = "Eventos Centerfrios <eventos@eventos.centerfrios.com>";
```

Endereço final: `eventos@eventos.centerfrios.com` — bate com o subdomínio verificado.

## Arquivos alterados

- `supabase/functions/send-registration-confirmation/index.ts` — uma linha alterada (constante `FROM_ADDRESS`).

## Reenvio para o inscrito atual

Após o deploy, vou também limpar o flag `confirmation_email_sent_at` da inscrição mais recente (que falhou com 403) para que o sistema reenvie automaticamente, e dispararei manualmente o envio via invocação do edge function.

## Validação

1. Deploy automático da função.
2. Verificar logs: deve aparecer "Sent" em vez de "Resend error 403".
3. Confirmar que o inscrito recebeu o e-mail de `eventos@eventos.centerfrios.com`.

## Confirmação alternativa (caso eu tenha lido errado)

Se na verdade o domínio verificado no Resend for `centerfrios.com` (raiz) e `eventos.centerfrios.com` for só um alias do Microsoft 365 para recebimento, me avise — nesse caso a correção é diferente (precisaríamos verificar o domínio raiz no Resend). Mas pelos logs e pelo print do Outlook, a hipótese mais provável é a acima.
