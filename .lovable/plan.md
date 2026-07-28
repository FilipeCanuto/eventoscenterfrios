## 1. Nova rota `/checkin` — leitura por câmera

Página mobile-first (mesmo visual escuro/dourado do `/vendedor`) com leitor de câmera via `html5-qrcode`.

Fluxo:
- Botão "Iniciar leitura" (necessário para permissão de câmera no iOS), câmera traseira por padrão.
- Ao ler o QR, extrai o `registrationId` (UUID) do conteúdo — os QRs atuais apontam para `https://eventos.centerfrios.com/check-in/<uuid>`, então aceita tanto a URL completa quanto o UUID puro.
- Chama uma função no banco que faz o check-in e devolve o nome do participante e o evento.
- Tela de sucesso em verde com o nome grande, nome do evento e vibração curta; volta ao scanner automaticamente após ~2,5s para ler o próximo.
- Estados tratados: já fez check-in (amarelo), inscrição não encontrada / cancelada / fora da janela (vermelho), erro de câmera com fallback de link para `/checkin-rapido` (por e-mail).
- Proteção contra leituras duplicadas em sequência (mesmo código ignorado por alguns segundos).

Detalhe técnico: hoje a leitura anônima não consegue ler o nome do participante (as inscrições são protegidas por regras de acesso). Será criada uma função de banco `public_check_in_scan(registration_id)` que executa o check-in e retorna status + nome + nome do evento em uma única chamada — mesma janela de 4h e mesmas validações já usadas hoje. O campo de presença continua sendo `status = checked_in` + `checked_in_at`, que é o padrão já existente no sistema.

## 2. Widget "Ranking do Time Comercial" no Dashboard

Card novo na aba principal do dashboard (`/dashboard/events`), acima da lista de eventos:
- Lista os vendedores em ordem decrescente pelo nº de inscritos cadastrados (`tracking.vendedor` das inscrições, ignorando canceladas).
- Cada linha: posição (1º destacado), nome, total e barra de progresso proporcional ao líder.
- Seletor de evento (padrão: evento ativo mais recente) e opção "Todos os eventos".
- Estado vazio quando não há cadastros com vendedor.

Usa os dados já carregados pelo hook de inscrições do dashboard — sem chamadas extras.

## 3. Correção do contador do vendedor

Hoje o texto "Você cadastrou X clientes hoje" vem de um contador em `localStorage`, que zera em outro aparelho/navegador e não reflete o banco — por isso aparece 0 enquanto o painel mostra 1.

Correção: o cabeçalho passa a usar o valor real `hoje` retornado pelo mesmo RPC que alimenta o painel (`public_vendedor_stats`), atualizando após cada cadastro e ao trocar de aba. O `localStorage` fica só como valor otimista imediato até a resposta do servidor chegar.

## Arquivos

- Novo: `src/pages/CheckInScanner.tsx` (rota `/checkin`)
- Novo: `src/components/dashboard/RankingVendedoresCard.tsx`
- Editar: `src/App.tsx` (rota), `src/pages/dashboard/Events.tsx` (widget), `src/pages/Vendedor.tsx` + `src/components/vendedor/VendedorDashboard.tsx` (contador real)
- Dependência: `html5-qrcode`
- Migração: função `public_check_in_scan`
