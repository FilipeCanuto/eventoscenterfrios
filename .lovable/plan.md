

## Objetivo

1. Adicionar botão **"Remover inscrição"** (cancela / exclui) tanto na página global de **Participantes** quanto na tabela de participantes dentro de cada **evento**.
2. Enriquecer as informações exibidas sobre **participantes** e **leads** para dar mais contexto ao organizador.

> Observação: a tela "Configurações" (`/dashboard/settings`) trata de perfil/aparência/equipe — não tem inscrições. Vou aplicar a remoção de inscrição na **tela de Participantes** (`/dashboard/attendees`) e na **aba Participantes do evento** (que é onde o organizador "configura" cada inscrição). Se você quis dizer outra tela, me diga.

---

## 1. Remover inscrição

### Backend
- Hoje a RLS da tabela `registrations` permite `UPDATE` mas **não** `DELETE` para o dono do evento.
- Decisão: usar **soft-delete** mudando `status` para `'cancelled'` (a RLS de UPDATE já cobre isso, e mantém histórico para métricas/leads). Sem nova migration necessária.
- Novo hook `useCancelRegistration` em `src/hooks/useRegistrations.ts`:
  - `UPDATE registrations SET status='cancelled' WHERE id=...`
  - Invalida `["registrations"]` e `["registrations", eventId]`.

### UI
- **AlertDialog de confirmação** ("Tem certeza? Esta ação cancela a inscrição e libera a vaga.") antes de executar.
- Botão "Cancelar inscrição" (variant destructive, ícone `Trash2`):
  - **`src/pages/dashboard/Attendees.tsx`** → dentro do `Dialog` de detalhes do participante, no rodapé.
  - **`src/components/event-detail/EventAttendeesTable.tsx`** → nova coluna de ações com botão ícone (Trash2) por linha + dialog de confirmação.
- Inscrições com status `cancelled` ficam visíveis com o badge vermelho já existente; adicionar filtro rápido "Ocultar canceladas" (toggle, padrão **ligado**) em ambas as tabelas.
- Toast de sucesso/erro via `sonner`.

---

## 2. Mais informações sobre participantes

### Na página global `/dashboard/attendees`
**Novas colunas / dados (visíveis em desktop, ocultos em mobile conforme breakpoint):**
- **WhatsApp** (`lead_whatsapp`) — coluna nova.
- **Origem** — UTM source / referrer / "direto" (mesma lógica de `getSource` já usada por evento).
- **Hora** junto com a data (`HH:mm`).

**Novos cards de métricas no topo (substituem os 3 atuais):**
- Total de inscrições
- Check-ins realizados (com % do total)
- Cancelamentos (com %)
- Inscrições nos últimos 7 dias
- Taxa média de conversão (se houver page-views)

**Dialog de detalhes do participante — enriquecido:**
- Seção "Contato" (nome, e-mail, whatsapp clicável `https://wa.me/...`).
- Seção "Origem" (utm_source, utm_medium, utm_campaign, referrer, device_type, landing_page) lendo de `tracking` + fallback `data.__utm_*`.
- Seção "Linha do tempo": criado em, último update, link para página pública do evento.
- Botão **"Cancelar inscrição"** (destrutivo) e botão **"Marcar check-in"** (se ainda `registered`).

### Na aba do evento (`EventAttendeesTable`)
- Coluna **WhatsApp** (já mostrada em export, agora em tela em md+).
- Coluna **Origem** já existe — mantida.
- Hora junto com a data.
- Click na linha abre o mesmo Dialog de detalhes (extraído para componente compartilhado `RegistrationDetailDialog`).
- Coluna de **Ações** com Trash2 (cancelar) e CheckCircle (check-in).

---

## 3. Mais informações sobre leads (não convertidos)

A tabela de leads vive em `EventLeadsTable.tsx` (aba "Leads" do evento). Hoje mostra: data, status, nome parcial, e-mail parcial, whatsapp parcial, origem.

**Adições:**
- Coluna **Device** (mobile/tablet/desktop) com ícone.
- Coluna **Tempo no form** (diferença entre `form_started_at` e `form_abandoned_at` quando ambos existem) — sinaliza interesse real.
- **Tooltip ou hover-card** em cada linha com: `landing_url`, `referrer` completo, `utm_term`, `utm_content`, primeira/última atividade.
- Adicionar nova métrica no topo: **"Leads quentes"** = abandonaram com e-mail capturado (acionáveis para follow-up).
- Botão por linha **"Copiar contato"** que copia `nome | email | whatsapp` para a área de transferência (facilita follow-up manual).
- Filtro adicional "Só com WhatsApp" (junto com "Só com e-mail" e "Só abandonos").

---

## Arquivos alterados

- `src/hooks/useRegistrations.ts` — `useCancelRegistration`, `useCheckInRegistration`.
- `src/pages/dashboard/Attendees.tsx` — colunas extras, métricas extras, dialog enriquecido com ações.
- `src/components/event-detail/EventAttendeesTable.tsx` — colunas extras, ações de linha, integração com dialog compartilhado.
- `src/components/event-detail/EventLeadsTable.tsx` — colunas device/tempo, hover-card, métrica "leads quentes", filtro WhatsApp, botão copiar.
- **Novo** `src/components/dashboard/RegistrationDetailDialog.tsx` — componente compartilhado do dialog de detalhes (reaproveitado nas duas telas).

Sem migrations de banco. Sem mudanças em e-mail/edge functions.

---

## Validação

1. Em `/dashboard/attendees`: abrir um participante, clicar "Cancelar inscrição", confirmar → linha aparece como "Cancelado" (ou some se filtro ativo). Refresh persiste.
2. Em uma página de evento → aba Participantes: cancelar via ícone Trash2 da linha → mesmo comportamento.
3. Conferir novas colunas (WhatsApp, Origem, Hora) e novas métricas.
4. Em uma página de evento → aba Leads: conferir colunas Device e Tempo no form, hover-card com detalhes, métrica "Leads quentes", botão "Copiar contato".
5. Testar em mobile (colunas extras escondidas, ações continuam acessíveis pelo dialog).

