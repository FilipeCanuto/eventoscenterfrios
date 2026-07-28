import { useEffect, useRef, useState } from "react";
import { Monitor, Smartphone, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  html: string;
  subject?: string;
  loading?: boolean;
  error?: string | null;
  height?: number;
}

export default function EmailPreviewFrame({ html, subject, loading, error, height = 620 }: Props) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html || "<html><body></body></html>");
    doc.close();
  }, [html, device]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {subject !== undefined && (
          <div className="text-sm min-w-0">
            <span className="text-muted-foreground">Assunto: </span>
            <span className="font-medium break-words">{subject || "—"}</span>
          </div>
        )}
        <div className="flex items-center gap-1 bg-muted rounded-full p-1">
          <Button
            type="button" size="sm" variant="ghost"
            className={`h-8 rounded-full px-3 text-xs ${device === "desktop" ? "bg-card shadow-sm" : ""}`}
            onClick={() => setDevice("desktop")}
          >
            <Monitor className="w-3.5 h-3.5 mr-1" /> Computador
          </Button>
          <Button
            type="button" size="sm" variant="ghost"
            className={`h-8 rounded-full px-3 text-xs ${device === "mobile" ? "bg-card shadow-sm" : ""}`}
            onClick={() => setDevice("mobile")}
          >
            <Smartphone className="w-3.5 h-3.5 mr-1" /> Celular
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl bg-destructive/10 text-destructive text-sm px-4 py-3">{error}</div>
      ) : (
        <div className="relative bg-muted/40 rounded-2xl p-3 flex justify-center overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          )}
          <iframe
            ref={iframeRef}
            title="Pré-visualização do e-mail"
            sandbox=""
            className="bg-white rounded-xl w-full"
            style={{
              height,
              maxWidth: device === "mobile" ? 390 : "100%",
            }}
          />
        </div>
      )}
    </div>
  );
}
