// Valida em tempo real se o domínio de um e-mail tem registros MX (servidor
// de e-mail). Usado pelo formulário público de inscrição para alertar o
// usuário quando o domínio digitado não recebe e-mails — sem bloquear,
// apenas avisando. Reduz drasticamente bounces causados por typos.
//
// Público (sem JWT). Faz lookup via DNS-over-HTTPS no Cloudflare 1.1.1.1.
// Cache em memória de 24h por domínio. Rate limit simples por IP (60 req/min).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CacheEntry {
  hasMx: boolean;
  expiresAt: number;
}

const DOMAIN_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const RATE_LIMIT = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const entry = RATE_LIMIT.get(ip);
  if (!entry || entry.resetAt < now) {
    RATE_LIMIT.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX;
}

// Domínios populares que sabemos receber e-mails — pula DNS para acelerar.
const KNOWN_GOOD = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "msn.com", "yahoo.com", "yahoo.com.br", "icloud.com", "me.com", "mac.com",
  "uol.com.br", "bol.com.br", "terra.com.br", "globo.com", "ig.com.br",
  "r7.com", "zipmail.com.br", "oi.com.br", "uol.com", "protonmail.com",
  "proton.me", "yandex.com", "zoho.com", "aol.com", "gmx.com", "fastmail.com",
]);

async function lookupMx(domain: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { accept: "application/dns-json" } },
    );
    if (!res.ok) return true; // Em caso de falha de rede, não bloqueia
    const json = await res.json();
    // Status 0 = NOERROR. Answer com type=15 (MX) significa que existe MX.
    if (json?.Status !== 0) {
      // NXDOMAIN (3) → domínio inexistente
      if (json?.Status === 3) return false;
      return true;
    }
    const answers: Array<{ type: number; data: string }> = json?.Answer || [];
    const hasMx = answers.some((a) => a.type === 15 && a.data && a.data.trim() !== "");
    if (hasMx) return true;
    // Sem MX → tenta A como fallback (RFC 5321: A record pode receber e-mail)
    const aRes = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
      { headers: { accept: "application/dns-json" } },
    );
    if (!aRes.ok) return false;
    const aJson = await aRes.json();
    const aAnswers: Array<{ type: number }> = aJson?.Answer || [];
    return aAnswers.some((a) => a.type === 1);
  } catch {
    return true; // Falha de rede → não bloqueia
  }
}

async function checkDomain(domain: string): Promise<boolean> {
  if (KNOWN_GOOD.has(domain)) return true;
  const cached = DOMAIN_CACHE.get(domain);
  const now = Date.now();
  if (cached && cached.expiresAt > now) return cached.hasMx;
  const hasMx = await lookupMx(domain);
  DOMAIN_CACHE.set(domain, { hasMx, expiresAt: now + CACHE_TTL_MS });
  return hasMx;
}

const EMAIL_RE = /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!rateLimitOk(ip)) {
    return new Response(JSON.stringify({ error: "rate_limited" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const raw = (body?.email || "").toString().trim().toLowerCase();
  if (!raw || raw.length > 254) {
    return new Response(JSON.stringify({ valid: false, reason: "invalid_format" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const match = raw.match(EMAIL_RE);
  if (!match) {
    return new Response(JSON.stringify({ valid: false, reason: "invalid_format" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const domain = match[1];
  const hasMx = await checkDomain(domain);

  return new Response(
    JSON.stringify({
      valid: hasMx,
      domain,
      reason: hasMx ? null : "no_mx",
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
