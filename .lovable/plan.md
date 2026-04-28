# Edição de inscritos + melhorias de UX

## Problema
Quando o cliente digita errado (e-mail, nome, WhatsApp), a inscrição fica salva com dados inconsistentes nos relatórios e o e-mail de confirmação nunca chega. Hoje só dá para visualizar, marcar check-in ou cancelar — não há como corrigir.

## O que será entregue

### 1. Edição da inscrição (principal)
No diálogo de detalhes do participante (`RegistrationDetailDialog`), adicionar botão **"Editar dados"** que coloca o formulário em modo de edição inline, com campos para:

- **Nome completo**
- **E-mail** (com validação de formato)
- **WhatsApp** (com normalização — só dígitos)
- **Demais campos do formulário** (renderizados a partir do que existe em `data`, ex. "Dias de Comparecimento", campos customizados)

Ao salvar:
- Atualiza `registrations.data` (mesclando alterações), `lead_name`, `lead_email`, `lead_whatsapp`.
- Registra um histórico mínimo em `tracking.edits` (quem editou, quando, quais campos) — sem alterar nenhuma outra configuração.

### 2. Reenvio inteligente do e-mail de confirmação
Regra de idempotência ao salvar a edição:

| Situação | Ação |
|---|---|
| E-mail mudou | Limpa `tracking.confirmation_email_sent_at` e dispara `send-registration-confirmation` para o novo endereço |
| E-mail não mudou, mas confirmação nunca foi enviada | Dispara `send-registration-confirmation` |
| E-mail não mudou e confirmação já foi enviada | Não reenvia (mantém idempotência) |
| Botão "Reenviar e-mail de confirmação" (manual) | Sempre força um reenvio, registrando no toast |

Os lembretes (7d/1d/2h) continuam atrelados ao mesmo `registration_id` — não são duplicados nem reagendados, salvo se a data do evento mudar (regra já existente).

### 3. Melhorias adicionais de UX (sem alterar configurações do evento)

- **Botão "Reenviar confirmação"** explícito no diálogo, útil quando o cliente diz "não recebi". Mostra a data do último envio (`tracking.confirmation_email_sent_at`).
- **Indicador visual de status do e-mail** no diálogo: "✓ E-mail enviado em DD/MM HH:mm" ou "⚠ E-mail ainda não enviado".
- **Validação em tempo real** dos campos editados (e-mail com regex, WhatsApp com mínimo de dígitos) antes de habilitar "Salvar".
- **Detecção de duplicatas ao editar e-mail**: avisa se o novo e-mail já está em outra inscrição ativa do mesmo evento (mesma regra de máx. 2 por e-mail já aplicada na criação).
- **Botão "Reverter check-in"** (quando status é `checked_in`) — útil quando alguém marca check-in por engano. Atualiza status para `registered` e limpa `checked_in_at`.
- **Atalho "Copiar dados"** no diálogo (copia nome, e-mail e WhatsApp formatados para a área de transferência) — agiliza atendimento por WhatsApp/telefone.

## Detalhes técnicos

**Arquivos a alterar:**
- `src/components/dashboard/RegistrationDetailDialog.tsx` — modo de edição inline, botões de reenviar e reverter check-in, indicador de status do e-mail.
- `src/hooks/useRegistrations.ts` — novos hooks `useUpdateRegistration` e `useResendConfirmation` (invoca a edge function existente `send-registration-confirmation`).

**Sem alterações em:**
- Configurações do evento, templates, regras de RLS, edge functions, banco de dados.
- A função `send-registration-confirmation` já é idempotente (pula quando `tracking.confirmation_email_sent_at` está definido) — apenas limparemos esse campo no fluxo de troca de e-mail para forçar o reenvio.

**RLS:** já existe `Event owners can update registrations` permitindo `UPDATE` para o dono do evento — nenhuma migração necessária.

**Tracking de edição:** anexado em `tracking.edits` como array `[{ at, by, fields: ["lead_email","lead_name"] }]`, mantendo o restante de `tracking` intacto.

## Fora do escopo
- Edição em massa (múltiplas inscrições).
- Alteração da data/configuração do evento (já existe trigger próprio).
- Auditoria detalhada com diff antes/depois (apenas lista de campos editados).
