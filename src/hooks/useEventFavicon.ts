import { useEffect } from "react";

const DEFAULT_FAVICON = "/favicon-circuito.png";

// Ícone específico por evento (chave = slug ou parte do slug/nome).
const EVENT_FAVICONS: { match: RegExp; href: string }[] = [
  { match: /vacuo[_-]?em[_-]?acao|v-cuo-em-a-o/i, href: "/favicon-vacuo.png" },
];

export function faviconForEvent(event?: { slug?: string | null; name?: string | null } | null) {
  const key = `${event?.slug ?? ""} ${event?.name ?? ""}`;
  return EVENT_FAVICONS.find((f) => f.match.test(key))?.href ?? DEFAULT_FAVICON;
}

/**
 * Define o favicon da aba conforme o evento exibido na página.
 * Restaura o ícone anterior ao desmontar.
 */
export function useEventFavicon(event?: { slug?: string | null; name?: string | null } | null) {
  const href = faviconForEvent(event);

  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    const created = !link;
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    const previous = link.href;
    link.href = href;

    let apple = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
    const previousApple = apple?.href;
    if (apple) apple.href = href;

    return () => {
      if (created) link!.remove();
      else link!.href = previous;
      if (apple && previousApple) apple.href = previousApple;
    };
  }, [href]);
}
