import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const LAST_UPDATED = "24 de abril de 2026";

const PrivacyPolicy = () => {
  useEffect(() => {
    document.title = "Política de Privacidade | CENTERFRIOS Eventos";
    const meta = document.querySelector('meta[name="description"]');
    const desc =
      "Política de Privacidade dos eventos CENTERFRIOS — tratamento de dados pessoais e autorização de uso de imagem em conformidade com a LGPD.";
    if (meta) meta.setAttribute("content", desc);
    else {
      const m = document.createElement("meta");
      m.name = "description";
      m.content = desc;
      document.head.appendChild(m);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="md" />
          </Link>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 md:py-16">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
          Política de Privacidade
        </h1>
        <p className="text-sm text-muted-foreground mb-10">
          Última atualização: {LAST_UPDATED}
        </p>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8 text-foreground">
          <Section n="1" title="Introdução">
            <p>
              A CENTERFRIOS valoriza sua privacidade e está comprometida com a
              proteção dos seus dados pessoais. Esta Política de Privacidade
              descreve como coletamos, utilizamos, armazenamos e protegemos as
              informações fornecidas pelos participantes que se inscrevem em
              nossos eventos, em conformidade com a Lei Geral de Proteção de
              Dados — LGPD (Lei nº 13.709/2018).
            </p>
          </Section>

          <Section n="2" title="Controlador dos dados">
            <p>
              <strong>CENTERFRIOS</strong> é a controladora dos dados pessoais
              tratados nesta plataforma de inscrição.
            </p>
            <ul>
              <li>Razão social: <em>[A PREENCHER]</em></li>
              <li>CNPJ: <em>[A PREENCHER]</em></li>
              <li>
                Encarregado pelo Tratamento de Dados (DPO):{" "}
                <a
                  href="mailto:privacidade@centerfrios.com"
                  className="text-primary underline underline-offset-2"
                >
                  privacidade@centerfrios.com
                </a>
              </li>
            </ul>
          </Section>

          <Section n="3" title="Dados que coletamos">
            <p>Ao se inscrever em um evento, podemos coletar:</p>
            <ul>
              <li>
                <strong>Dados de identificação e contato:</strong> nome
                completo, e-mail, telefone/WhatsApp.
              </li>
              <li>
                <strong>Dados adicionais do formulário:</strong> campos
                específicos definidos para cada evento (empresa, cargo, cidade,
                etc.).
              </li>
              <li>
                <strong>Dados de navegação:</strong> endereço IP, tipo de
                dispositivo, páginas visitadas e cookies de analytics.
              </li>
              <li>
                <strong>Imagem:</strong> fotos e vídeos captados durante o
                evento.
              </li>
            </ul>
          </Section>

          <Section n="4" title="Finalidades do tratamento">
            <p>Utilizamos os dados coletados para:</p>
            <ul>
              <li>Confirmar e gerenciar sua inscrição no evento;</li>
              <li>
                Enviar comunicações por e-mail e WhatsApp relacionadas ao
                evento (confirmação, lembretes e instruções);
              </li>
              <li>Realizar o check-in no dia do evento (via QR Code);</li>
              <li>
                Divulgação institucional do evento nos canais oficiais da
                CENTERFRIOS;
              </li>
              <li>
                Cumprir obrigações legais e regulatórias e melhorar nossos
                serviços.
              </li>
            </ul>
          </Section>

          <Section n="5" title="Autorização de uso de imagem">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 my-3">
              <p>
                Ao se inscrever no evento, o participante{" "}
                <strong>autoriza, de forma gratuita e por prazo
                indeterminado</strong>, a captação, edição e divulgação de
                fotografias e vídeos contendo a sua imagem, voz e nome, obtidos
                durante o evento, nos canais digitais e materiais
                institucionais da CENTERFRIOS, incluindo, mas não se limitando
                a: site oficial, redes sociais (Instagram, Facebook, LinkedIn,
                YouTube, TikTok), e-mail marketing, materiais promocionais
                impressos e digitais, e mídia interna.
              </p>
              <p className="mt-3">
                Esta autorização é concedida em conformidade com o art. 7º,
                incisos I e IX da LGPD, com finalidade exclusivamente
                institucional e promocional, sem cessão a terceiros para fins
                comerciais alheios à CENTERFRIOS.
              </p>
              <p className="mt-3">
                O participante poderá, a qualquer momento, solicitar a remoção
                de fotos ou vídeos específicos enviando uma solicitação para{" "}
                <a
                  href="mailto:privacidade@centerfrios.com"
                  className="text-primary underline underline-offset-2"
                >
                  privacidade@centerfrios.com
                </a>
                .
              </p>
            </div>
          </Section>

          <Section n="6" title="Compartilhamento de dados">
            <p>
              Não vendemos seus dados pessoais. Compartilhamos informações
              apenas com prestadores de serviço estritamente necessários à
              operação dos eventos (hospedagem em nuvem e envio de e-mails
              transacionais), todos contratualmente obrigados a respeitar a
              LGPD.
            </p>
          </Section>

          <Section n="7" title="Retenção dos dados">
            <p>
              Mantemos seus dados pelo tempo necessário ao cumprimento das
              finalidades descritas nesta política e ao atendimento de
              obrigações legais. Após o término do evento, os dados podem ser
              arquivados para fins históricos, estatísticos e de prestação de
              contas.
            </p>
          </Section>

          <Section n="8" title="Seus direitos como titular (Art. 18 da LGPD)">
            <p>Você tem o direito de, a qualquer momento, solicitar:</p>
            <ul>
              <li>Confirmação da existência de tratamento;</li>
              <li>Acesso aos seus dados;</li>
              <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
              <li>Anonimização, bloqueio ou eliminação de dados;</li>
              <li>Portabilidade dos dados;</li>
              <li>Revogação do consentimento;</li>
              <li>Oposição ao tratamento.</li>
            </ul>
            <p>
              Para exercer esses direitos, entre em contato pelo e-mail{" "}
              <a
                href="mailto:privacidade@centerfrios.com"
                className="text-primary underline underline-offset-2"
              >
                privacidade@centerfrios.com
              </a>
              . Você também pode descadastrar-se dos lembretes por e-mail
              através do link presente em cada mensagem enviada.
            </p>
          </Section>

          <Section n="9" title="Segurança da informação">
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus
              dados, incluindo criptografia em trânsito (HTTPS), controle de
              acesso por papéis, políticas de Row Level Security (RLS) no
              banco de dados e auditoria de acessos.
            </p>
          </Section>

          <Section n="10" title="Cookies">
            <p>
              Utilizamos cookies essenciais para o funcionamento da plataforma
              e cookies de analytics para entender como os usuários interagem
              com nossas páginas e melhorar a experiência. Você pode gerenciar
              cookies nas configurações do seu navegador.
            </p>
          </Section>

          <Section n="11" title="Alterações desta política">
            <p>
              Esta Política poderá ser atualizada periodicamente. Quando isso
              ocorrer, atualizaremos a data de "Última atualização" no topo
              desta página. Recomendamos revisar este documento sempre que se
              inscrever em um novo evento.
            </p>
          </Section>

          <Section n="12" title="Contato">
            <p>
              Em caso de dúvidas, solicitações ou reclamações relacionadas ao
              tratamento de seus dados pessoais, entre em contato com nosso
              Encarregado de Dados:
            </p>
            <ul>
              <li>
                E-mail:{" "}
                <a
                  href="mailto:privacidade@centerfrios.com"
                  className="text-primary underline underline-offset-2"
                >
                  privacidade@centerfrios.com
                </a>
              </li>
              <li>Site: centerfrios.com</li>
            </ul>
          </Section>
        </div>

        <footer className="mt-16 pt-8 border-t border-border/40 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} CENTERFRIOS. Todos os direitos
          reservados.
        </footer>
      </main>
    </div>
  );
};

const Section = ({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section>
    <h2 className="font-display text-xl md:text-2xl font-bold mb-3">
      {n}. {title}
    </h2>
    <div className="text-sm md:text-base text-muted-foreground leading-relaxed space-y-3 [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
      {children}
    </div>
  </section>
);

export default PrivacyPolicy;
