## Problema

Hoje a função `register_for_event` bloqueia o 3º cadastro com o mesmo e-mail no mesmo evento (limite de 2). Famílias, casais e pessoas sem e-mail próprio ficam de fora. Ao mesmo tempo, precisamos:
- Não inflar bounces no Resend (1 e-mail = N envios duplicados é ruim).
- Manter rastreabilidade (saber quem é quem nos relatórios e check-in).
- Reduzir typos no momento do cadastro (já temos correção de typo, mas não checamos se o domínio realmente recebe e-mail).

## Solução proposta

### 1. Identidade primária = WhatsApp, e-mail = canal de contato

Mudamos a chave de unicidade da inscrição. Em vez de "máx. 2 por e-mail", passa a ser:

- **1 inscrição por (evento, WhatsApp)** — WhatsApp vira o identificador único da pessoa.
- **E-mail pode se repetir livremente** dentro do evento.
- Se WhatsApp não foi preenchido no formulário daquele evento, mantemos o limite atual de 2 por e-mail como fallback.

Isso resolve o caso real (esposa usando e-mail do marido, filho usando e-mail dos pais) sem perder a capacidade de detectar duplicatas reais (mesma pessoa clicando 2x).

### 2. Apenas 1 e-mail de confirmação por endereço por evento

Para não machucar a reputação no Resend quando 4 pessoas da mesma família usam o mesmo e-mail:

- A 1ª inscrição com aquele e-mail naquele evento → envia confirmação normal (com QR code dela).
- Da 2ª em diante com o mesmo e-mail no mesmo evento → envia **um único e-mail consolidado** listando todos os inscritos vinculados àquele endereço, com o QR code de cada um. Se o e-mail consolidado já foi enviado nas últimas 10 min, apenas atualiza-se o registro como "agrupado" sem reenviar.
- Cada inscrito ainda recebe o WhatsApp de confirmação individual (se tivermos integração) e tem seu próprio QR code acessível pelo link público.

Resultado: o Resend vê 1 envio por endereço/evento em vez de 4, mas todos os participantes ficam com confirmação válida.

### 3. Validação MX em tempo real no formulário

Hoje validamos formato + corrigimos typos conhecidos. Vamos adicionar uma checagem extra **no blur do campo de e-mail**:

- Nova edge function `validate-email-domain` (pública, rate-limited por IP) que recebe um e-mail e faz lookup MX do domínio via DNS-over-HTTPS (Cloudflare 1.1.1.1).
- Cache em memória de 24h por domínio para evitar chamadas repetidas.
- Resposta: `{ valid: true }` ou `{ valid: false, reason: "no_mx", suggestion?: "gmail.com" }`.
- No frontend, ao sair do campo: se o domínio não tem MX, mostra aviso amigável **não-bloqueante** ("Não encontramos o servidor de e-mail para `dominio.xyz`. Confira se está correto.") com botão "Usar mesmo assim". Não bloqueia o envio — só alerta.
- Mantém toda a validação de formato/typo atual como primeira camada (instantânea, sem chamada de rede).

### 4. UX no formulário

- Quando o usuário digita um WhatsApp já cadastrado naquele evento, mostramos mensagem clara: "Este WhatsApp já está inscrito. Se for outra pessoa, use um número diferente."
- Quando digita um e-mail já usado naquele evento, mostramos um aviso informativo (não bloqueante): "Este e-mail já está vinculado a outra inscrição neste evento. Tudo bem se for família/grupo — o link de confirmação será enviado uma vez só, com todos os QR codes."

## Detalhes técnicos

**Migration (schema):**
- Adicionar índice único parcial em `registrations(event_id, lead_whatsapp)` onde `lead_whatsapp IS NOT NULL AND status != 'cancelled'`.
- Reescrever `register_for_event` para:
  - Validar duplicata por WhatsApp quando presente (1 max).
  - Manter validação por e-mail apenas como fallback quando WhatsApp ausente, e elevar limite de 2 → configurável (default 5 por e-mail/evento).

**Edge function nova: `validate-email-domain`**
- Input: `{ email: string }`. CORS aberto, sem JWT.
- Rate limit: 30 req/min por IP usando Map em memória.
- Faz `fetch('https://cloudflare-dns.com/dns-query?name=DOMAIN&type=MX', { headers: { accept: 'application/dns-json' }})`.
- Cache por domínio em memória da função (TTL 24h).
- Retorna `valid` baseado em ter ao menos 1 registro MX.

**Edge function modificada: `send-registration-confirmation`**
- Antes de enviar, contar quantas inscrições daquele evento usam o mesmo `lead_email`.
- Se for a 1ª → envio normal.
- Se for 2ª+ e já existe envio recente (< 10 min) com `template_name = 'group_confirmation'` para esse e-mail/evento → marca log como `grouped` e não chama Resend.
- Caso contrário → renderiza template "consolidado" listando todos os participantes vinculados ao e-mail e envia 1 mensagem.

**Frontend (`src/pages/Register.tsx`):**
- Adicionar `onBlur` no campo de e-mail chamando `validate-email-domain` com debounce.
- Estado `emailDomainWarning` exibido como `<Alert>` informativo abaixo do campo, com botão "Usar mesmo assim" que silencia o aviso.
- Ao detectar e-mail já existente no evento (consulta leve via RPC pública nova `count_registrations_by_email(event_id, email)`), mostrar nota informativa de "envio agrupado".
- Ao detectar WhatsApp já existente no evento, bloquear submit com mensagem clara.

**Compatibilidade:**
- Inscrições existentes não são afetadas (índice é parcial, e a função só valida em novos inserts).
- Logs históricos no `email_send_log` continuam válidos.

## Resumo do que muda para o usuário final

1. Pode inscrever toda a família com o mesmo e-mail, contanto que cada um tenha seu WhatsApp.
2. Recebe um único e-mail de confirmação consolidado (com todos os QR codes) em vez de 4 mensagens iguais.
3. Vê aviso amigável quando digita um domínio de e-mail que provavelmente não existe (ex: `@gmial.cox`), antes de enviar o formulário.
4. Vê aviso quando o e-mail já foi usado no evento (transparente, não-bloqueante).
5. É bloqueado se tentar usar o mesmo WhatsApp duas vezes no mesmo evento (proteção contra duplo-clique e fraude).

Posso aprovar e implementar?
