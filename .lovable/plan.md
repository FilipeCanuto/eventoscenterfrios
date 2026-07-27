## Situação

A lista com os 14 nomes (Euclides, Maria, Clara, Neide, Clarice, Carla, Ricardo, Jackelline, Filipe, Willames, Rafaela, Rosângela, Humberto, Júlio) **já está no código** em `src/pages/Vendedor.tsx`. Os nomes antigos (João, Maria, Pedro, Ana, Carlos, Juliana, Outro…) que você vê são a versão **publicada** — o site em produção ainda está com o código anterior. Por isso o primeiro passo é publicar.

Hoje o formulário de `/vendedor` envia os dados **apenas para o webhook do Make** (planilha). Nada é gravado no banco do app, então não existe base para o painel/ranking. Isso será corrigido.

## O que será feito

**1. Publicar**
Publicar o app para que `https://eventos.centerfrios.com/vendedor` passe a mostrar a lista correta de colaboradores. Esse é o link público a compartilhar com a equipe:
`https://eventos.centerfrios.com/vendedor`

**2. Gravar as inscrições no banco**
Ao enviar o formulário em `/vendedor`, além do webhook do Make, a inscrição será gravada no evento ativo (Workshop Vácuo em Ação) via a função de inscrição já existente, marcando o vendedor no campo de rastreamento. Assim os cadastros aparecem no painel interno, nos relatórios e recebem e-mail de confirmação como qualquer inscrição.

- O nome do vendedor vai gravado em `tracking.vendedor` (mais `origem: "vendedor"`).
- Se o WhatsApp já existir no evento, mostra aviso claro de duplicado sem quebrar o fluxo (o envio ao Make continua acontecendo).

**3. Painel do colaborador (aba "Meu painel" em /vendedor)**
Uma nova função pública somente-leitura no banco retorna, sem expor dados pessoais de outros vendedores:
- Total de cadastros do colaborador (hoje e geral)
- Lista dos clientes que ele cadastrou (nome, segmento, horário, status de check-in)
- Ranking da equipe: apenas nome do colaborador + total de cadastros

**4. Identidade visual do evento**
O painel e o formulário recebem o visual do Workshop Vácuo em Ação: fundo grafite escuro (#12151C), destaques em dourado (#E6B012) e azul marinho (#0B2341), logo/artwork do evento no topo, cartões de KPI limpos, ranking com destaque para o 1º lugar, tudo mobile-first (o time vai usar no celular).

## Detalhes técnicos

- Migração: função `public_vendedor_stats(p_vendedor text, p_event_id uuid)` — SECURITY DEFINER, STABLE, retorna JSON com `meus_totais`, `meus_cadastros` e `ranking` (só nome + contagem, sem PII de terceiros); leitura restrita a eventos com status `live`.
- `Vendedor.tsx`: chamada a `register_for_event` com `p_tracking = { vendedor, origem: 'vendedor' }` antes do `enviarParaGoogleSheets`, tratamento de erros de duplicidade, reset imediato e contador incrementado a partir do retorno do banco (não mais só do localStorage).
- Novo componente `src/components/vendedor/VendedorDashboard.tsx` + tokens de tema do evento aplicados localmente na rota (sem alterar o tema global do app).
- A rota `/vendedor` continua pública (sem login) — a identificação é por seleção de nome, como já funciona.
