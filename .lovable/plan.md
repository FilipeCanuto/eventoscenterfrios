## Diagnóstico

Encontrei **dois problemas** com os QR Codes dos e-mails de confirmação e lembrete:

### 1. URL do check-in está apontando para o ambiente de PREVIEW (causa principal)

Os e-mails estão sendo enviados com links para `https://6cb9424f-...lovableproject.com/check-in/...` em vez de `https://eventos.centerfrios.com/check-in/...`.

Quando o participante escaneia, o navegador abre a URL de preview do Lovable, que **exige login do Lovable** — daí a mensagem que o usuário relatou ("Pede para fazer login no Lovable"). Mesmo que carregasse, o QR Code embutido aponta para esse mesmo domínio.

**Causa**: na função `send-registration-confirmation` o `origin` é resolvido a partir do header `Origin` da requisição (que é o ambiente de quem disparou — preview), e só usa fallback se vier vazio. A função `process-reminder-queue` já usa `PUBLIC_ORIGIN` fixo (`https://eventos.centerfrios.com`), por isso o lembrete de 1 dia funcionou — mas a confirmação não.

### 2. QR Code depende de serviço externo (`api.qrserver.com`)

Hoje todos os e-mails carregam a imagem de `https://api.qrserver.com/v1/create-qr-code/?...`. Se esse serviço cair, ficar lento, ou se o cliente de e-mail bloquear imagens externas (Outlook corporativo, Gmail em modo restrito), o QR aparece como **ícone quebrado / quadrado vazio** — exatamente o sintoma reportado.

Além disso, alguns provedores agressivos (Hotmail/Outlook) podem ter classificado esse domínio como tracker e bloqueado.

---

## Plano de correção

### Passo 1 — Travar o domínio público do check-in

Na função `send-registration-confirmation`, substituir a lógica de `origin` por uma constante fixa `PUBLIC_ORIGIN = "https://eventos.centerfrios.com"` (mesmo padrão do `process-reminder-queue`). Header `Origin` da request passa a ser ignorado.

Resultado: todos os QR Codes e botões de check-in passam a abrir `eventos.centerfrios.com/check-in/<id>` — domínio público, sem login.

### Passo 2 — Gerar o QR Code internamente (sem depender de qrserver.com)

Criar uma nova edge function `qr-code` que:
- Recebe `?data=<url>&size=320`
- Gera o PNG do QR Code com a lib `qrcode` (já instalada no projeto, roda no Deno)
- Retorna `image/png` com cache de 30 dias (`Cache-Control: public, max-age=2592000, immutable`)
- Sem JWT (`verify_jwt = false`) — precisa abrir direto no cliente de e-mail

Trocar nas 4 funções de template (`confirmation`, `reminder_1d`, `reminder_2h`, `final_reminder`) o `qrSrc`:

```ts
const qrSrc = `${SUPABASE_URL}/functions/v1/qr-code?size=320&data=${encodeURIComponent(checkInUrl)}`;
```

Vantagens:
- Imagem servida do mesmo Supabase que já tem boa reputação
- Sem ponto de falha externo
- Cacheável e rápido

### Passo 3 — Reenviar confirmação para os 244 já enviados? (opcional)

Os e-mails de confirmação **já enviados** continuam apontando para o domínio errado. Opções:

- **A)** Não reenviar. Hoje é o dia 1 — todo mundo vai receber o lembrete `reminder_2h` (que já usa o domínio correto e passará a usar o QR interno após o fix). Esse e-mail tem o QR e o botão de check-in destacados.
- **B)** Disparar um e-mail "atualização — seu QR Code está pronto" para os 268 inscritos com a URL correta + QR novo. Custa 268 envios da cota Resend.

Recomendação: **A** (já que o lembrete 2h cobre todos e estamos em cooldown de cota).

### Passo 4 — Pequeno ajuste no painel (opcional, não-bloqueante)

`EventQRCode.tsx` (preview do painel) usa a lib `qrcode` no canvas — está OK. Mas o link gerado usa `window.location.origin`, então quando o organizador acessa pelo preview do Lovable, o QR no painel aponta para o domínio errado. Trocar para usar o `published_url` do evento ou uma constante.

---

## Detalhes técnicos

**Arquivos a alterar:**
- `supabase/functions/send-registration-confirmation/index.ts` — fixar `PUBLIC_ORIGIN`
- `supabase/functions/_shared/email-templates.ts` — trocar 4 ocorrências de `api.qrserver.com` por endpoint interno
- `supabase/functions/qr-code/index.ts` — **novo**, gera PNG via `npm:qrcode`
- `supabase/config.toml` — registrar `qr-code` com `verify_jwt = false`
- `src/components/event-detail/EventQRCode.tsx` — usar domínio publicado

**Sem migração de banco.** Sem mudança em RLS. Sem novos secrets.

**Validação após implementar:**
1. Acessar diretamente `https://ahwecyjzzczcwunptxae.supabase.co/functions/v1/qr-code?data=https://eventos.centerfrios.com&size=240` → deve baixar PNG do QR
2. Abrir preview de e-mail no painel → QR deve aparecer
3. Escanear com celular → deve abrir `eventos.centerfrios.com/check-in/<id>` e marcar presença

---

## Observação sobre a cota Resend

Continuamos em cooldown até ~15:46 UTC (12:46 BRT). Esse fix **não** consome envios — só corrige o conteúdo dos próximos lembretes que sairão da fila assim que a cota liberar (ou após upgrade do plano).

Posso seguir?