import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Share2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface Props {
  slug: string;
  eventName: string;
}

const PRESETS: { key: string; label: string; params: Record<string, string> }[] = [
  { key: "direto", label: "Link direto", params: {} },
  { key: "instagram", label: "Instagram", params: { utm_source: "instagram", utm_medium: "bio", utm_campaign: "evento" } },
  { key: "whatsapp", label: "WhatsApp", params: { utm_source: "whatsapp", utm_medium: "mensagem", utm_campaign: "evento" } },
  { key: "landing", label: "Landing page", params: { utm_source: "landing", utm_medium: "botao-cta", utm_campaign: "evento" } },
];

export default function RegistrationLinkBlock({ slug, eventName }: Props) {
  const [active, setActive] = useState("direto");
  const [copied, setCopied] = useState(false);

  const baseUrl = `${window.location.origin}/register/${slug}`;
  const preset = PRESETS.find(p => p.key === active) || PRESETS[0];
  const url = Object.keys(preset.params).length
    ? `${baseUrl}?${new URLSearchParams(preset.params).toString()}`
    : baseUrl;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: eventName, text: `Inscreva-se: ${eventName}`, url });
      } catch {}
    } else {
      handleCopy();
    }
  };

  return (
    <div className="bg-card rounded-xl p-5 sm:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-display font-semibold">Link público de inscrição</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Use nas suas campanhas. As variantes adicionam UTMs para rastrear a origem dos leads.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-full h-8 text-xs" asChild>
            <a href={baseUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5 mr-1" /> Visualizar
            </a>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map(p => (
          <button
            key={p.key}
            type="button"
            onClick={() => setActive(p.key)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
              active === p.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={url} readOnly className="rounded-full text-xs sm:text-sm font-mono bg-muted/40" onFocus={e => e.currentTarget.select()} />
        <div className="flex gap-2">
          <Button onClick={handleCopy} variant="outline" size="sm" className="rounded-full h-11 sm:h-9 px-4">
            {copied ? <Check className="w-4 h-4 mr-1 text-success" /> : <Copy className="w-4 h-4 mr-1" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button onClick={handleShare} size="sm" className="rounded-full h-11 sm:h-9 px-4">
            <Share2 className="w-4 h-4 mr-1" /> Compartilhar
          </Button>
        </div>
      </div>
    </div>
  );
}
