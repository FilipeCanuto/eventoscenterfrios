

# Substituir integrações por gateways de pagamento

## Resumo
Remover todos os conectores atuais (Google Drive, Slack, etc.) e substituir por integrações sugeridas de gateways de pagamento para cobrança de ingressos.

## Alteração única

### `src/pages/dashboard/Integrations.tsx`
- Remover toda a lista de conectores atual (24 itens)
- Substituir por gateways de pagamento relevantes:
  - **Stripe** — Pagamentos online, assinaturas e checkout
  - **Mercado Pago** — Pagamentos via Pix, cartão e boleto (Brasil)
  - **PagSeguro** — Gateway de pagamento brasileiro com Pix e cartão
  - **PayPal** — Pagamentos internacionais e checkout rápido
- Categorias: "Pagamentos" (única categoria)
- Manter o mesmo layout de lista atual (ícone, nome, descrição, botão "Conectar")
- Atualizar subtítulo: "Conecte um gateway de pagamento para cobrar pelos ingressos dos seus eventos."
- Usar ícones adequados do lucide-react (`CreditCard`, `Wallet`, `DollarSign`, `Landmark`)
- Botões mantêm comportamento de toast informativo por enquanto

