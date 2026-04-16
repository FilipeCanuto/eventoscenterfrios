

# Captura completa de leads + e-mail de confirmação com QR Code + animação comemorativa

## Visão geral

Quatro mudanças coordenadas:
1. **Formulário de inscrição** — incluir WhatsApp como campo obrigatório (junto a Nome e E-mail).
2. **E-mail de confirmação** — enviar automaticamente após inscrição, com dados do evento + QR Code do "cartão de presença" + aviso sobre sorteio.
3. **Validação de QR Code na entrada** — o QR aponta para uma URL pública que valida a inscrição.
4. **Animação comemorativa** — confetes + mensagem empolgante na tela de sucesso.

---

## 1. Captura de WhatsApp obrigatório

### 1a. Novos eventos (código)
Em `src/pages/dashboard/CreateEvent.tsx`, atualizar `defaultFields`:
```ts
const defaultFields = [
  { label: "Nome Completo", field_type: "text", required: true, position: 0 },
  { label: "Endereço de E-mail", field_type: "email", required: true, position: 1 },
  { label: "WhatsApp", field_type: "tel", required: true, position: 2 },
  { label: "Empresa", field_type: "text", required: false, position: 3 },
  { label: "Cargo", field_type: "text", required: false, position: 4 },
];
```

### 1b. Eventos existentes (dados)
Inserir o campo "WhatsApp" como obrigatório em todos os eventos atuais que ainda não tenham, via tool de insert (sem migração).

### 1c. Validação no formulário público
`src/pages/Register.tsx` — adicionar máscara/validação leve para WhatsApp brasileiro (ex.: `(11) 99999-9999`) e mensagem de erro clara.

---

## 2. E-mail de confirmação com QR Code

### 2a. Pré-requisito: domínio de e-mail
O projeto **ainda não tem domínio de e-mail configurado**. O usuário precisa configurar um domínio remetente antes de enviarmos e-mails. Após o domínio ser configurado, prossigo automaticamente com:
- Configuração da infraestrutura de e-mail (filas, log, supressão).
- Criação do template transacional `event-registration-confirmation`.
- Criação da Edge Function `send-transactional-email`.

### 2b. Template do e-mail (`registration-confirmation.tsx`)
Conteúdo do e-mail:
- Saudação com o nome do inscrito.
- Confirmação: "Sua inscrição em **{nome do evento}** foi confirmada!"
- Bloco com **detalhes do evento**: data/hora (com timezone), local (físico/virtual + link), descrição curta.
- **Cartão de presença com QR Code** (imagem PNG embutida via data URL, gerada no servidor com `qrcode` em Deno, contendo a URL `https://<app>/check-in/<registration_id>`).
- Aviso destacado: "🎁 **Apresente este QR Code na entrada para validar sua participação no sorteio de brindes.**"
- Rodapé com identidade da empresa organizadora (nome do organizador puxado do perfil).

Estilo: branco (#ffffff) de fundo, cores da marca (rose-red HSL 340 75% 58%) para CTA e acentos, tipografia segura para e-mail.

### 2c. Disparo do e-mail
Modificar `src/hooks/useRegistrations.ts` (`useCreateRegistration`): após `register_for_event` retornar com sucesso, invocar `supabase.functions.invoke('send-transactional-email', { body: { templateName: 'registration-confirmation', recipientEmail, idempotencyKey: 'reg-confirm-${registrationId}', templateData: { name, eventName, eventDate, location, registrationId, organizerName } } })`.

A Edge Function busca o evento + perfil do organizador, gera o QR Code como data URL e injeta no template como prop.

### 2d. Página de validação `/check-in/:registrationId`
Nova rota pública somente leitura que mostra:
- Nome do inscrito, evento, data.
- Status: "✅ Inscrição válida" ou "⚠️ Inscrição cancelada / não encontrada".
- (Futuro: organizador autenticado pode marcar como "presente".)

---

## 3. Animação comemorativa de "Obrigado"

### 3a. Instalar `canvas-confetti`
Pacote leve para disparar confetes coloridos.

### 3b. Atualizar `SuccessCard` em `src/pages/Register.tsx`
- Disparar confete contínuo (3 bursts) ao montar o componente.
- Substituir o card discreto por uma tela mais empolgante:
  - Ícone grande animado (CheckCircle com bounce).
  - Headline: "🎉 Obrigado, {primeiro nome}!"
  - Subtexto: "Sua presença em **{evento}** está garantida."
  - Mensagem secundária: "Enviamos seu **cartão de presença com QR Code** para o seu e-mail. Apresente-o na entrada para concorrer aos brindes!"
  - Botões: "Adicionar ao calendário" (gera link .ics) + "Compartilhar".
- Animação framer-motion: scale-in + fade + leve rotação no ícone.

---

## Arquivos afetados

- **Editar**: `src/pages/dashboard/CreateEvent.tsx`, `src/pages/Register.tsx`, `src/hooks/useRegistrations.ts`, `src/App.tsx` (nova rota).
- **Criar**: `src/pages/CheckIn.tsx`, `supabase/functions/_shared/transactional-email-templates/registration-confirmation.tsx`, edge functions de e-mail.
- **Dados**: insert de campo "WhatsApp" obrigatório em eventos existentes.
- **Pacote**: adicionar `canvas-confetti` + `@types/canvas-confetti`.

## Pré-requisito bloqueante

Antes de eu prosseguir com a parte de e-mail, é necessário configurar um **domínio de envio de e-mails** (ex.: `notify.centerfrios.com.br`). É um passo único que melhora a entregabilidade e mostra os e-mails como vindos da sua marca. Vou seguir com as outras três mudanças (WhatsApp, QR Code na página de check-in, animação comemorativa) em paralelo, e a parte de e-mail é ativada assim que o domínio estiver pronto.

<lov-actions>
<lov-open-email-setup>Configurar domínio de e-mail</lov-open-email-setup>
</lov-actions>
