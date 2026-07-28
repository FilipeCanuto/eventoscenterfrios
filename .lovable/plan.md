## Objetivo

Transformar a aba "E-mails" do evento em uma Central de E-mails com três blocos: **Auditoria** (já existe), **Editor de Templates** (novo) e **Pré-visualização** (novo), além de "Ver e-mail enviado" por participante.

## Estado atual (verificado)

- A aba "E-mails" renderiza apenas `EventEmailAudit` (auditoria + reenvio em massa).
- Existe a tabela `email_templates` (event_id, template_type, subject, body, enabled), mas ela está **vazia e não é usada por nada** — os e-mails são 100% montados em código (`supabase/functions/_shared/email-templates.ts` → `buildEmail`).
- O enum `email_template_type` só tem `confirmation | reminder | followup`, ou seja, não cobre `reminder_1d` / `reminder_2h`.
- Já existe a função `render-email-preview`, que renderiza o e-mail real de uma inscrição (usada no detalhe do inscrito).
- O HTML efetivamente entregue **não é armazenado** hoje em `email_send_log` — só status/erro.

## O que será construído

### 1. Editor de Templates (sub-aba "Templates")

- Seletor de template: Confirmação, Lembrete 1 dia, Lembrete 2 horas.
- Campos: **Assunto** e **Corpo da mensagem** (texto/HTML da parte editável — a moldura de marca, cabeçalho CENTERFRIOS, bloco de QR Code e rodapé continuam sendo gerados pelo sistema, garantindo entregabilidade e QR válido).
- Barra de tags dinâmicas clicáveis que inserem no cursor: `{{nome}}`, `{{evento}}`, `{{data}}`, `{{horario}}`, `{{local}}`, `{{qr_code}}`, `{{vendedor}}`.
- Botões **Salvar template** (grava em `email_templates`, por evento) e **Restaurar padrão** (volta ao template do sistema).
- Botão **Enviar e-mail de teste** → dispara para o e-mail do usuário logado, com dados de exemplo (ou do primeiro inscrito real quando existir).

### 2. Pré-visualização em tempo real

- Sub-aba "Pré-visualização" ao lado do editor, com alternância **Computador / Celular** (iframe 100% vs. 390px, com moldura).
- Renderização com debounce a cada alteração, mostrando também o assunto final.
- Usa o mesmo motor de renderização do envio real, então o que aparece é o que será entregue.

### 3. Auditoria: "Ver e-mail enviado"

- Nova ação por linha na tabela de auditoria e no histórico de e-mails do inscrito.
- Abre um modal com o e-mail daquele participante, com variáveis já substituídas (nome, evento, data, local, QR Code individual) e alternância desktop/celular.
- Para envios feitos a partir de agora, o HTML renderizado é **gravado** junto ao log, então o modal mostra exatamente o que foi entregue. Para envios antigos (sem snapshot), o modal re-renderiza o template atual com os dados do inscrito e exibe um aviso de que é uma reconstrução, não o original.

## Detalhes técnicos

**Banco de dados (migração)**
- Ampliar o enum `email_template_type` com `reminder_1d` e `reminder_2h` (ou migrar a coluna para `text` com CHECK) e adicionar `UNIQUE (event_id, template_type)` + `created_at/updated_at` com trigger.
- Adicionar `rendered_html text` e `rendered_subject text` em `email_send_log` (snapshot do envio).
- Grants/RLS: dono do evento e admin gerenciam `email_templates`; leitura do HTML só pelo dono do evento/admin (política de SELECT já existente em `email_send_log` cobre isso).

**Backend (edge functions)**
- `_shared/email-templates.ts`: extrair um interpolador de tags (`{{nome}}`, `{{evento}}`, `{{data}}`, `{{horario}}`, `{{local}}`, `{{vendedor}}`, `{{qr_code}}` → bloco de imagem QR) e fazer `buildEmail` aceitar um override opcional `{subject, body}` vindo de `email_templates`, com sanitização do HTML (sem `<script>`, sem handlers inline).
- `send-registration-confirmation` e `process-reminder-queue`: carregar o template customizado do evento (se houver e `enabled`) e gravar `rendered_html`/`rendered_subject` no log.
- `render-email-preview`: aceitar payload alternativo `{eventId, templateType, draftSubject, draftBody}` para prévia sem inscrição real, e `{logId}` para recuperar o snapshot armazenado.
- Nova função `send-test-email`: valida sessão + posse do evento, renderiza o rascunho e envia ao e-mail do usuário logado (rate-limit simples de 1 envio a cada 30s).

**Frontend**
- `src/components/event-detail/EventEmailCenter.tsx`: casca com sub-abas Auditoria / Templates / Pré-visualização, substituindo a chamada direta a `EventEmailAudit` em `EventDetail.tsx`.
- `EmailTemplateEditor.tsx` (editor + barra de tags + salvar/testar) e `EmailPreviewFrame.tsx` (iframe reutilizável com toggle desktop/mobile), reaproveitado no modal "Ver e-mail enviado".
- `useEmailTemplates.ts`: hooks de leitura/gravação em `email_templates` + invalidação de cache.
- Estilo alinhado ao projeto: pt-BR, cartões `rounded-xl`, botões pill, sem bordas.

## Fora de escopo

- Editor visual arrastar-e-soltar (o editor será de assunto + corpo com tags).
- Envio em massa de campanhas/marketing.
