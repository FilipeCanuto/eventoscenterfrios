import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const MAKE_WEBHOOK_URL = Deno.env.get('MAKE_WEBHOOK_URL');

function clean(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

function agoraBR(): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  if (!MAKE_WEBHOOK_URL) {
    console.error('MAKE_WEBHOOK_URL is not configured');
    return json({ error: 'Integration not configured' }, 500);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const input = (raw ?? {}) as Record<string, unknown>;

  const nome = clean(input.nome, 200);
  const whatsapp = clean(input.whatsapp, 30).replace(/[^\d+()\s-]/g, '');
  const email = clean(input.email, 255);
  const segmento = clean(input.segmento, 120);
  const vendedor = clean(input.vendedor, 100);

  if (!nome && !whatsapp && !email) {
    return json({ error: 'nome, whatsapp or email is required' }, 400);
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Invalid email' }, 400);
  }

  const body = {
    data: agoraBR(),
    nome,
    whatsapp,
    email,
    segmento,
    vendedor: vendedor || 'Orgânico',
    status: clean(input.status, 40) || 'Pendente',
  };

  try {
    const res = await fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error('Make webhook responded with status', res.status);
      return json({ ok: false }, 502);
    }
  } catch (e) {
    console.error('Make webhook request failed', e instanceof Error ? e.message : e);
    return json({ ok: false }, 502);
  }

  return json({ ok: true });
});
