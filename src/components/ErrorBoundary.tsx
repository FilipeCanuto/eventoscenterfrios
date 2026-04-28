import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Erros de renderização (Select da Radix, confetti, framer-motion, chunks lazy
 * que falham por rede ruim) ficavam em tela branca sem feedback. Esta boundary
 * captura esses casos e mostra uma mensagem amigável em pt-BR com botões
 * de recuperação. Mobile-first.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log para diagnóstico
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary] caught error", error, info);
  }

  private handleReload = () => {
    try {
      window.location.reload();
    } catch {
      /* ignore */
    }
  };

  private handleGoHome = () => {
    try {
      window.location.href = "/";
    } catch {
      /* ignore */
    }
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen w-full flex items-center justify-center px-4 py-12 bg-background text-foreground">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <span className="text-3xl" aria-hidden>⚠️</span>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-display font-bold tracking-tight">
              Ops! Algo deu errado
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tivemos um problema ao carregar esta página. Tente recarregar — seus dados não foram perdidos.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="flex-1 h-11 rounded-full bg-primary text-primary-foreground font-semibold text-sm shadow-md hover:opacity-90 transition-opacity"
            >
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={this.handleGoHome}
              className="flex-1 h-11 rounded-full bg-muted text-foreground font-semibold text-sm hover:bg-muted/80 transition-colors"
            >
              Voltar ao início
            </button>
          </div>
          {this.state.error?.message && (
            <details className="text-left text-xs text-muted-foreground bg-muted/40 rounded-lg p-3">
              <summary className="cursor-pointer font-medium">Detalhes técnicos</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {this.state.error.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}
