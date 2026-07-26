import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Loader2 } from "lucide-react";

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

const OAuthConsent = () => {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Parâmetro authorization_id ausente.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = `/auth?next=${encodeURIComponent(next)}`;
        return;
      }
      const { data, error: detailsError } = await oauth().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailsError) {
        setError(detailsError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error: decideError } = approve
      ? await oauth().approveAuthorization(authorizationId)
      : await oauth().denyAuthorization(authorizationId);
    if (decideError) {
      setBusy(false);
      setError(decideError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("O servidor de autorização não retornou um redirecionamento.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "o aplicativo";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo size="lg" />
        </div>
        <div className="bg-card rounded-2xl border border-border shadow-lg p-6 text-center">
          {error ? (
            <>
              <h1 className="text-xl font-display font-bold mb-2">Não foi possível continuar</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </>
          ) : !details ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Carregando pedido de autorização…</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-display font-bold mb-2">
                Conectar {clientName} à sua conta
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                {clientName} poderá consultar seus eventos, inscritos e registrar check-ins agindo
                como você. Você pode revogar o acesso a qualquer momento.
              </p>
              <div className="flex flex-col gap-3">
                <Button
                  className="w-full rounded-full h-11 bg-foreground text-background hover:bg-foreground/90 font-medium"
                  disabled={busy}
                  onClick={() => decide(true)}
                >
                  {busy ? "Processando…" : "Autorizar"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full rounded-full h-11"
                  disabled={busy}
                  onClick={() => decide(false)}
                >
                  Recusar
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OAuthConsent;
