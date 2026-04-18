
## Diagnóstico

O e-mail está sendo entregue (status "Sent" no Resend), mas o provedor do destinatário está classificando como spam/lixo. Isso é um problema de **deliverability/reputação**, não de código.

Causas prováveis (em ordem de probabilidade):

1. **DMARC ausente ou mal configurado** no domínio `eventos.centerfrios.com`. Sem DMARC, provedores como Outlook/Gmail tratam o remetente como suspeito.
2. **SPF/DKIM apenas no subdomínio**, sem alinhamento com o domínio raiz `centerfrios.com`.
3. **Subdomínio novo sem reputação** — `eventos.centerfrios.com` foi verificado recentemente no Resend e ainda não tem histórico de envio.
4. **Conteúdo do e-mail com gatilhos de spam**: emoji ✅ no assunto, link único de CTA grande, pouco texto plano, ausência de versão `text/plain`.
5. **Falta de headers de boa prática**: `List-Unsubscribe`, `Reply-To`, `Message-ID` customizado.

## Plano de ação

### 1. Melhorias no código da edge function (o que posso fazer agora)

Editar `supabase/functions/send-registration-confirmation/index.ts`:

- **Remover emoji do subject** (`✅` é forte gatilho de spam): trocar `"✅ Inscrição confirmada — ..."` por `"Inscrição confirmada — ..."`.
- **Adicionar versão `text/plain`** no payload do Resend (campo `text`) — provedores penalizam e-mails só-HTML.
- **Adicionar `reply_to`** com endereço real monitorado (`contato@eventos.centerfrios.com` conforme print do Outlook anterior).
- **Adicionar header `List-Unsubscribe`** com `mailto:` — sinal forte de legitimidade para Outlook/Gmail.
- **Adicionar `tags`** no Resend para rastreabilidade (`type: registration-confirmation`).
- **Suavizar HTML**: garantir que o pré-header (preview text) tenha conteúdo natural e não duplicado.

### 2. Verificações DNS (você precisa confirmar no painel do Resend / DNS)

Vou pedir confirmação no chat após o deploy. Provavelmente já estão ok, mas é bom validar:

- **SPF** em `eventos.centerfrios.com`: `v=spf1 include:amazonses.com ~all` (Resend usa AWS SES)
- **DKIM**: 3 registros CNAME do Resend, todos verificados (verde)
- **DMARC** em `_dmarc.centerfrios.com` (no domínio raiz): `v=DMARC1; p=none; rua=mailto:dmarc@centerfrios.com` — **este é o mais provável de estar faltando**
- **MX** no subdomínio (opcional mas ajuda): pode ser o do Resend ou do Microsoft 365

### 3. Reenvio de teste

Após o deploy, vou reenviar para uma das inscrições reais (limpando o `confirmation_email_sent_at`) e verificar se cai na caixa de entrada.

## Arquivos alterados

- `supabase/functions/send-registration-confirmation/index.ts` — ajustes no subject, payload Resend e headers anti-spam.

## Validação

1. Deploy automático.
2. Reenvio manual via curl para uma inscrição real.
3. Você confirma se chegou na caixa de entrada do Outlook/Gmail.
4. Se ainda cair em spam, o próximo passo é configurar DMARC (depende de acesso ao DNS de `centerfrios.com`).

## Fora de escopo (depende de você)

- Aquecimento do subdomínio (enviar volume baixo crescente nos primeiros dias).
- Configurar DMARC no DNS do domínio raiz — me avisa se quiser que eu te passe o registro exato.
