// Validação e normalização avançada de e-mails — compartilhada por todas as
// edge functions de envio. Objetivo: reduzir drasticamente bounces causados
// por typos comuns e endereços claramente inválidos antes de chamar o
// provedor (Resend), preservando a reputação do remetente.

// Tabela canônica de typos comuns de domínio.
// Mantida em sync com a versão do front (src/pages/Register.tsx).
export const EMAIL_DOMAIN_TYPOS: Record<string, string> = {
  // gmail
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmai.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gmail.con": "gmail.com",
  "gmail.cm": "gmail.com",
  "gmail.comm": "gmail.com",
  "gnail.com": "gmail.com",
  "gmsil.com": "gmail.com",
  "gmaill.com": "gmail.com",
  // hotmail
  "hotnail.com": "hotmail.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "hotmail.con": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmail.cm": "hotmail.com",
  "homail.com": "hotmail.com",
  // outlook
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "outlook.con": "outlook.com",
  "outlook.cm": "outlook.com",
  "outllok.com": "outlook.com",
  // yahoo
  "yaho.com": "yahoo.com",
  "yahho.com": "yahoo.com",
  "yahoo.con": "yahoo.com",
  "yhoo.com": "yahoo.com",
  // icloud
  "icloud.con": "icloud.com",
  "iclod.com": "icloud.com",
  "icould.com": "icloud.com",
  "icluod.com": "icloud.com",
  // br
  "uol.com": "uol.com.br",
  "bol.com": "bol.com.br",
  "globomail.com": "globo.com",
  "terra.com": "terra.com.br",
};

// TLDs claramente inválidos / typos terminais.
const BAD_TLDS = new Set([
  "con", "cmo", "comm", "ne", "og", "vom", "xom", "coom", "om",
]);

// Endereços baseados em "papel/role" — não devem receber e-mails de marketing
// nem confirmações automáticas, e geralmente bouncem.
const ROLE_LOCAL_PARTS = new Set([
  "noreply", "no-reply", "donotreply", "do-not-reply", "postmaster",
  "mailer-daemon", "abuse", "spam", "bounces", "bounce",
]);

// Domínios descartáveis comuns. Lista deliberadamente curta — focamos nos
// que aparecem com mais frequência em formulários públicos brasileiros.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com",
  "yopmail.com", "trashmail.com", "throwawaymail.com", "maildrop.cc",
  "getairmail.com", "sharklasers.com", "tempr.email", "mintemail.com",
]);

// Caracteres invisíveis que aparecem ao colar de WhatsApp/PDF/etc.
const INVISIBLE_RE = /[\u00A0\u200B\u200C\u200D\u2060\uFEFF]/g;

export interface NormalizeResult {
  /** E-mail final (já com correções aplicadas, lowercase, trimmed). */
  email: string;
  /** True se aplicamos uma correção de typo no domínio. */
  corrected: boolean;
  /** Domínio original (se diferente do final). */
  originalDomain?: string;
}

/**
 * Normaliza um e-mail bruto: remove espaços invisíveis, faz trim,
 * lowercase, corrige vírgulas no domínio, remove ponto final acidental e
 * aplica correção de typos conhecidos de domínio.
 */
export function normalizeEmail(raw: string | null | undefined): NormalizeResult {
  let v = (raw || "").replace(INVISIBLE_RE, "").trim().toLowerCase();
  // Remove ponto final acidental
  v = v.replace(/\.+$/, "");
  // Vírgula no domínio é um typo clássico
  const at = v.lastIndexOf("@");
  if (at < 1) return { email: v, corrected: false };
  let local = v.slice(0, at);
  let domain = v.slice(at + 1).replace(/,/g, ".");
  const originalDomain = domain;
  // Auto-correção via tabela
  const fixed = EMAIL_DOMAIN_TYPOS[domain];
  if (fixed && fixed !== domain) domain = fixed;
  const email = `${local}@${domain}`;
  return {
    email,
    corrected: domain !== originalDomain,
    originalDomain: domain !== originalDomain ? originalDomain : undefined,
  };
}

export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

// Regex pragmática (não 100% RFC, mas evita falsos positivos comuns).
const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

/**
 * Valida um e-mail já normalizado. Retorna o motivo da rejeição quando
 * inválido (útil para registrar em email_send_log).
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) return { valid: false, reason: "empty" };
  if (email.length > 254) return { valid: false, reason: "too_long" };

  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) {
    return { valid: false, reason: "invalid_at" };
  }
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);

  if (local.length > 64) return { valid: false, reason: "local_too_long" };
  if (local.includes("..") || domain.includes("..")) {
    return { valid: false, reason: "consecutive_dots" };
  }
  if (!EMAIL_RE.test(email)) return { valid: false, reason: "regex_fail" };

  // TLD válido (≥2 letras, não numérico, não na blacklist)
  const tld = domain.split(".").pop() || "";
  if (tld.length < 2) return { valid: false, reason: "tld_too_short" };
  if (/^\d+$/.test(tld)) return { valid: false, reason: "tld_numeric" };
  if (BAD_TLDS.has(tld)) return { valid: false, reason: `bad_tld_${tld}` };

  return { valid: true };
}

/**
 * Verifica se o e-mail é descartável ou role-based — nesses casos, melhor
 * não enviar (alta probabilidade de bounce/complaint).
 */
export function isDisposableOrRoleEmail(email: string): boolean {
  const at = email.indexOf("@");
  if (at < 1) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  if (ROLE_LOCAL_PARTS.has(local)) return true;
  return false;
}

/**
 * Pipeline completo: normaliza, corrige typos, valida e checa role/descartável.
 * Retorna o e-mail "pronto para enviar" ou um motivo de rejeição.
 */
export interface PreparedEmail {
  ok: boolean;
  email: string;
  corrected: boolean;
  originalDomain?: string;
  reason?: string;
}

export function prepareEmailForSend(raw: string | null | undefined): PreparedEmail {
  const norm = normalizeEmail(raw);
  if (!norm.email) return { ok: false, email: "", corrected: false, reason: "empty" };
  const v = validateEmail(norm.email);
  if (!v.valid) {
    return { ok: false, email: norm.email, corrected: norm.corrected, originalDomain: norm.originalDomain, reason: v.reason };
  }
  if (isDisposableOrRoleEmail(norm.email)) {
    return { ok: false, email: norm.email, corrected: norm.corrected, originalDomain: norm.originalDomain, reason: "disposable_or_role" };
  }
  return { ok: true, email: norm.email, corrected: norm.corrected, originalDomain: norm.originalDomain };
}
