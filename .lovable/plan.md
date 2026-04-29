## Diagnóstico

### 1. Inscrições ainda com dificuldade

A correção anterior removeu o `Select` instável, mas o formulário público ainda usa o `Checkbox` da Radix para:

- campo de múltipla escolha “Dias de Comparecimento”;
- aceite da política/LGPD.

Esse componente também usa uma estrutura dinâmica interna que pode sofrer o mesmo tipo de conflito em navegadores embutidos de WhatsApp/Instagram, Android WebView, tradução automática e conexões instáveis. Como o evento atual tem um campo `multiselect` obrigatório, isso ainda pode impedir alguns usuários de concluir a inscrição.

Além disso, o formulário ainda usa animações `framer-motion` ao redor da área de inscrição. Elas não são a causa principal, mas aumentam o risco de inconsistência de DOM em WebViews problemáticos.

Os dados mostram que nas últimas 24h houve inscrições concluídas, mas também abandono de formulário após início, principalmente em mobile. Não apareceu erro atual no console capturado, então a correção deve ser defensiva e focada em remover os últimos pontos frágeis do fluxo público.

### 2. E-mails não enviados / Resend com “Bounced”

Os logs do envio de confirmação mostram repetidamente:

```text
The eventos.centerfrios.com domain is not verified
```

Ou seja: o envio está falhando porque o domínio usado no remetente `eventos@eventos.centerfrios.com` não está verificado no provedor de envio configurado atualmente. Isso explica por que muitas confirmações não chegam.

Também há um problema de volume/retry: a rotina de lembretes tenta reenviar confirmações pendentes, mas como o domínio não está verificado, ela gera várias tentativas falhas em sequência. Hoje existem centenas de lembretes pendentes, e parte dos registros recentes não está marcada como e-mail enviado.

Sobre “Bounced”: existem dois grupos de causa:

1. **Falha de domínio/remetente**: se o provedor não reconhece o domínio como verificado, os envios falham antes ou durante a entrega.
2. **Qualidade dos destinatários**: e-mails digitados incorretamente, caixas inexistentes, domínios inválidos ou corporativos com bloqueio. O app hoje valida apenas o formato básico do e-mail, mas não faz validação defensiva mais forte nem evita reenviar para endereços que já falharam.

## Plano de correção segura

### A. Blindar definitivamente o fluxo público de inscrição

1. **Substituir o Checkbox Radix por inputs nativos no `Register.tsx`**
   - Campo `multiselect`: trocar por `<input type="checkbox">` nativo.
   - Aceite LGPD: trocar por `<input type="checkbox">` nativo.
   - Manter o visual atual com Tailwind, touch target grande e layout mobile-first.
   - Resultado: o fluxo público fica sem Radix em inputs críticos.

2. **Reduzir animações no formulário público**
   - Substituir os wrappers `motion.div` da página de inscrição por `div` comum, ou manter somente animações não críticas na tela de sucesso.
   - Isso reduz risco de conflito com DOM em WebViews sem alterar funcionalidade.

3. **Melhorar recuperação em caso de erro inesperado**
   - Atualizar `ErrorBoundary` para ter:
     - “Tentar novamente” com remount real;
     - “Recarregar página” com reload completo;
     - “Voltar ao início”.
   - A versão atual já recarrega ao clicar em “Tentar novamente”, mas não oferece uma segunda opção clara nem remount sem reload.

4. **Mensagens de erro mais amigáveis no submit**
   - Mapear erros técnicos comuns da inscrição para mensagens em pt-BR:
     - evento lotado;
     - prazo encerrado;
     - e-mail já usado;
     - dados inválidos.
   - Isso evita que o usuário veja uma mensagem genérica e tente repetir sem entender o motivo.

### B. Corrigir envio de e-mails

1. **Parar o efeito cascata de tentativas falhas**
   - Ajustar a rotina de reenvio/catch-up para não disparar confirmações repetidas quando o erro é de configuração de domínio/remetente.
   - Implementar cooldown/backoff simples para evitar dezenas de chamadas em segundos quando o provedor responde erro 403 de domínio.

2. **Configurar o envio pelo caminho correto**
   - O projeto não tem domínio de e-mail gerenciado configurado no Lovable Cloud neste momento.
   - Para resolver de forma robusta, precisamos configurar um domínio/remetente de e-mail no Cloud e migrar o envio de confirmações/lembretes para a infraestrutura de e-mail do app, com fila, logs, retries e supressão.
   - Se a intenção for continuar especificamente com Resend, será necessário verificar o domínio `eventos.centerfrios.com` no Resend e garantir que a chave usada esteja vinculada ao mesmo domínio do remetente.

3. **Remetente correto para reduzir bounce**
   - Usar um subdomínio de envio próprio e autenticado, por exemplo `eventos@notify.centerfrios.com` ou equivalente configurado.
   - Manter `reply-to` como `contato@eventos.centerfrios.com`, se desejado.
   - Evitar enviar a partir de domínio não verificado.

4. **Não prometer e-mail quando ele falhar**
   - Na tela de sucesso, alterar o texto para algo mais seguro, por exemplo:
     - “Sua inscrição está confirmada. Se o e-mail não chegar, salve esta página ou entre em contato com a equipe.”
   - Isso evita frustração enquanto o domínio estiver sendo regularizado.

### C. Reduzir drasticamente “Bounced”

1. **Validação de e-mail mais forte antes de enviar**
   - Normalizar e-mails: trim, lowercase e remoção de espaços invisíveis.
   - Bloquear padrões claramente inválidos:
     - domínio sem ponto;
     - finais incompletos;
     - erros comuns como `gmai.com`, `hotnail.com`, `hotmai.com`, `outlok.com`.
   - Para erros prováveis, mostrar sugestão: “Você quis dizer gmail.com?”

2. **Supressão local de destinatários problemáticos**
   - Criar/usar lista de e-mails suprimidos para não reenviar para endereços que já deram bounce/falha permanente.
   - Antes de enviar confirmação ou lembrete, checar se o e-mail está suprimido.

3. **Registrar status de envio**
   - Registrar tentativas e falhas em uma tabela de log para distinguir:
     - enviado;
     - pendente;
     - falha temporária;
     - falha permanente/bounce;
     - suprimido.
   - Isso permite agir com dados, sem depender só do painel externo.

4. **Botão de correção/reenvio no painel**
   - Quando o e-mail estiver inválido ou falhar, o organizador poderá corrigir o endereço no detalhe da inscrição e reenviar.
   - O código já tem parte desse fluxo; vamos garantir que ele respeite a nova validação e não reenvie para suprimidos sem correção.

## Arquivos que serão alterados

- `src/pages/Register.tsx`
- `src/components/ErrorBoundary.tsx`
- `supabase/functions/send-registration-confirmation/index.ts`
- `supabase/functions/process-reminder-queue/index.ts`
- Possível novo arquivo utilitário para validação de e-mail compartilhada no frontend
- Possível migração para tabela de supressão/log, caso não seja usada a infraestrutura de e-mail gerenciada do Cloud

## O que depende de configuração externa

A correção de estabilidade da inscrição pode ser aplicada só no código.

A correção definitiva dos e-mails depende de um remetente verificado. Sem domínio/remetente verificado, qualquer código continuará falhando ou gerando bounce. A opção mais segura é configurar o domínio de e-mail no Lovable Cloud e usar o envio gerenciado do app.

## Resultado esperado

- Menos falhas de inscrição em mobile e navegadores embutidos.
- Formulário público sem dependência de componentes complexos nos inputs críticos.
- E-mails deixando de falhar por domínio não verificado após configuração do remetente.
- Redução grande de bounce por validação, supressão e menor repetição de envios falhos.
- Melhor visibilidade para a equipe sobre quais confirmações foram enviadas ou precisam de correção.