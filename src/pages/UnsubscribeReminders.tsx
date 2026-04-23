import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, MailX } from "lucide-react";
import { Logo } from "@/components/Logo";

const Unsubscribe = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<"ok" | "not_found" | "error" | null>(null);
  const ranRef = useRef(false);

  const handleConfirm = async () => {
    if (!token || ranRef.current) return;
    ranRef.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("unsubscribe_reminders", { p_token: token });
      if (error) {
        console.error(error);
        setDone("error");
      } else {
        setDone((data as "ok" | "not_found") || "error");
      }
    } catch (e) {
      console.error(e);
      setDone("error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo size="md" />
      </div>
      <Card className="w-full max-w-md shadow-2xl">
        <CardContent className="p-8 text-center">
          {!done ? (
            <>
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                <MailX className="w-10 h-10 text-muted-foreground" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-2">Não receber mais lembretes</h1>
              <p className="text-muted-foreground mb-6">
                Confirma que deseja parar de receber e-mails de lembrete sobre este evento? Sua inscrição continua ativa — você só não receberá mais avisos.
              </p>
              <Button onClick={handleConfirm} disabled={loading} className="rounded-full" size="lg">
                {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Confirmar cancelamento de lembretes
              </Button>
            </>
          ) : done === "ok" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12 text-success" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-2">Tudo certo!</h1>
              <p className="text-muted-foreground">
                Você não receberá mais lembretes deste evento. Sua inscrição segue ativa.
              </p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-12 h-12 text-destructive" />
              </div>
              <h1 className="text-2xl font-display font-bold mb-2">Link inválido</h1>
              <p className="text-muted-foreground">
                Este link expirou ou já foi usado. Se ainda quiser parar de receber lembretes, responda o último e-mail recebido.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
};

export default Unsubscribe;
