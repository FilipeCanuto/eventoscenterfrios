import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, Wallet, DollarSign, Landmark, ExternalLink } from "lucide-react";

const gateways = [
  { id: "stripe", name: "Stripe", description: "Pagamentos online, assinaturas e checkout integrado", icon: CreditCard },
  { id: "mercado_pago", name: "Mercado Pago", description: "Pagamentos via Pix, cartão e boleto (Brasil)", icon: Wallet },
  { id: "pagseguro", name: "PagSeguro", description: "Gateway de pagamento brasileiro com Pix e cartão", icon: DollarSign },
  { id: "paypal", name: "PayPal", description: "Pagamentos internacionais e checkout rápido", icon: Landmark },
];

const Integrations = () => {
  const handleConnect = (name: string) => {
    toast.info(`Para conectar ${name}, entre em contato ou aguarde — em breve disponível.`, {
      duration: 5000,
    });
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Integrações</h1>
        <p className="text-muted-foreground">Conecte um gateway de pagamento para cobrar pelos ingressos dos seus eventos.</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pagamentos</h2>
        <div className="rounded-xl divide-y divide-muted">
          {gateways.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors first:rounded-t-xl last:rounded-b-xl"
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <g.icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{g.name}</h3>
                <p className="text-xs text-muted-foreground truncate">{g.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full text-xs flex-shrink-0"
                onClick={() => handleConnect(g.name)}
              >
                Conectar
                <ExternalLink className="w-3 h-3 ml-1.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Integrations;
