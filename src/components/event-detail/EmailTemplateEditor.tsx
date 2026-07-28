import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Save, Send, RotateCcw, Eye, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import EmailPreviewFrame from "./EmailPreviewFrame";
import {
  DEFAULT_TEMPLATES,
  TEMPLATE_META,
  TEMPLATE_TAGS,
  TemplateType,
  renderEmail,
  sendTestEmail,
  useEmailTemplates,
  useResetEmailTemplate,
  useSaveEmailTemplate,
} from "@/hooks/useEmailTemplates";

interface Props {
  eventId: string;
}

export default function EmailTemplateEditor({ eventId }: Props) {
  const { data: templates, isLoading } = useEmailTemplates(eventId);
  const saveMut = useSaveEmailTemplate(eventId);
  const resetMut = useResetEmailTemplate(eventId);

  const [type, setType] = useState<TemplateType>("confirmation");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [dirty, setDirty] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [preview, setPreview] = useState<{ html: string; subject: string; loading: boolean; error: string | null }>({
    html: "", subject: "", loading: true, error: null,
  });

  // Carrega o template salvo (ou o padrão) ao trocar de tipo
  useEffect(() => {
    if (isLoading) return;
    const saved = templates?.[type];
    setSubject(saved?.subject?.trim() || DEFAULT_TEMPLATES[type].subject);
    setBody(saved?.body?.trim() || DEFAULT_TEMPLATES[type].body);
    setDirty(false);
  }, [type, isLoading, templates]);

  // Prévia com debounce
  useEffect(() => {
    if (!subject && !body) return;
    let cancelled = false;
    setPreview((p) => ({ ...p, loading: true, error: null }));
    const t = setTimeout(() => {
      renderEmail({ eventId, templateType: type, draftSubject: subject, draftBody: body })
        .then((res) => {
          if (cancelled) return;
          setPreview({ html: res.html, subject: res.subject, loading: false, error: null });
        })
        .catch((e) => {
          if (cancelled) return;
          setPreview({ html: "", subject: "", loading: false, error: e?.message || "Erro ao gerar prévia." });
        });
    }, 600);
    return () => { cancelled = true; clearTimeout(t); };
  }, [eventId, type, subject, body]);

  const insertTag = (tag: string) => {
    const el = bodyRef.current;
    if (!el) { setBody((b) => `${b}\n${tag}`); setDirty(true); return; }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + tag + body.slice(end);
    setBody(next);
    setDirty(true);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + tag.length, start + tag.length);
    });
  };

  const handleSave = async () => {
    try {
      await saveMut.mutateAsync({ templateType: type, subject, body });
      setDirty(false);
      toast.success("Template salvo. Os próximos envios usarão esta versão.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível salvar o template.");
    }
  };

  const handleReset = async () => {
    if (!window.confirm("Restaurar o template padrão do sistema? Suas alterações serão perdidas.")) return;
    try {
      await resetMut.mutateAsync(type);
      setSubject(DEFAULT_TEMPLATES[type].subject);
      setBody(DEFAULT_TEMPLATES[type].body);
      setDirty(false);
      toast.success("Template restaurado ao padrão.");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível restaurar.");
    }
  };

  const handleTest = async () => {
    setSendingTest(true);
    try {
      const res = await sendTestEmail({ eventId, templateType: type, subject, bodyHtml: body });
      toast.success(`E-mail de teste enviado para ${res.sentTo}.`);
    } catch (e: any) {
      const msg = String(e?.message || "");
      toast.error(
        msg.includes("rate_limited")
          ? "Aguarde alguns segundos antes de enviar outro teste."
          : msg || "Não foi possível enviar o teste.",
      );
    } finally {
      setSendingTest(false);
    }
  };

  const meta = useMemo(() => TEMPLATE_META.find((t) => t.type === type)!, [type]);
  const isCustom = !!templates?.[type];

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="bg-card rounded-xl p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="font-display font-semibold">Editar template de e-mail</h3>
          <p className="text-sm text-muted-foreground">
            Personalize o assunto e a mensagem. O cabeçalho da marca, o QR Code e o rodapé continuam
            sendo montados automaticamente.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TEMPLATE_META.map((t) => (
            <Button
              key={t.type}
              type="button"
              size="sm"
              variant={type === t.type ? "default" : "outline"}
              className="rounded-full h-9 text-xs"
              onClick={() => setType(t.type)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {meta.description} {isCustom ? "• Usando template personalizado." : "• Usando o template padrão."}
        </p>
      </div>

      <Tabs defaultValue="edit">
        <TabsList className="bg-muted rounded-full p-1">
          <TabsTrigger value="edit" className="rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editor
          </TabsTrigger>
          <TabsTrigger value="preview" className="rounded-full data-[state=active]:bg-card data-[state=active]:shadow-sm">
            <Eye className="w-3.5 h-3.5 mr-1.5" /> Pré-visualização
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edit" className="mt-4">
          <div className="grid lg:grid-cols-2 gap-5">
            <div className="bg-card rounded-xl p-5 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tpl-subject">Assunto</Label>
                <Input
                  id="tpl-subject"
                  value={subject}
                  maxLength={300}
                  onChange={(e) => { setSubject(e.target.value); setDirty(true); }}
                  className="rounded-full h-11"
                />
              </div>

              <div className="space-y-2">
                <Label>Tags dinâmicas</Label>
                <div className="flex flex-wrap gap-1.5">
                  {TEMPLATE_TAGS.map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      title={t.label}
                      onClick={() => insertTag(t.tag)}
                      className="text-[11px] font-mono rounded-full bg-muted hover:bg-muted/70 px-3 py-1.5 transition-colors"
                    >
                      {t.tag}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tpl-body">Corpo da mensagem</Label>
                <Textarea
                  id="tpl-body"
                  ref={bodyRef}
                  value={body}
                  maxLength={50000}
                  onChange={(e) => { setBody(e.target.value); setDirty(true); }}
                  className="rounded-xl min-h-[320px] font-mono text-xs leading-relaxed"
                />
                <p className="text-xs text-muted-foreground">
                  Aceita HTML simples (&lt;p&gt;, &lt;strong&gt;, &lt;a&gt;, &lt;br/&gt;). Scripts são removidos automaticamente.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  className="rounded-full h-11"
                  onClick={handleSave}
                  disabled={saveMut.isPending || !dirty}
                >
                  {saveMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                  Salvar template
                </Button>
                <Button
                  variant="outline" className="rounded-full h-11"
                  onClick={handleTest} disabled={sendingTest}
                >
                  {sendingTest ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                  Enviar e-mail de teste
                </Button>
                {isCustom && (
                  <Button
                    variant="ghost" className="rounded-full h-11"
                    onClick={handleReset} disabled={resetMut.isPending}
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" /> Restaurar padrão
                  </Button>
                )}
              </div>
            </div>

            <div className="bg-card rounded-xl p-5">
              <EmailPreviewFrame
                html={preview.html}
                subject={preview.subject}
                loading={preview.loading}
                error={preview.error}
                height={520}
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          <div className="bg-card rounded-xl p-5">
            <EmailPreviewFrame
              html={preview.html}
              subject={preview.subject}
              loading={preview.loading}
              error={preview.error}
              height={720}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
