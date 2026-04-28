# Limpeza de Inscrições Anteriores a 26/04/2026

## Objetivo
Remover do banco todas as inscrições (ativas e canceladas) criadas **até 25/04/2026 inclusive**, para que os relatórios reflitam apenas o período real de inscrições, iniciado em 27/04/2026. Nenhuma outra configuração do evento, formulário, e-mails, perfis ou campos será alterada.

## Escopo identificado
Foram localizadas **14 inscrições** criadas antes de 26/04/2026 (horário de Brasília):

- **11 canceladas** (testes e cancelamentos antigos)
- **3 ativas** (`registered`):
  - Filipe Canuto — filipecanuto@msn.com (24/04 12:20 BRT)
  - Willames Costa — josecine657@gmail.com (24/04 18:06 BRT)
  - Jackelline dos Santos Gord — coordenacao01@centerfrios.com (25/04 08:51 BRT)

Também há **18 e-mails agendados** (`scheduled_emails`) atrelados a essas inscrições que precisam ser removidos para evitar lembretes órfãos.

## Plano de execução

### 1. Remover e-mails agendados vinculados
Migração SQL que apaga registros em `scheduled_emails` cuja `registration_id` pertence ao conjunto a ser excluído. Isso evita violação de integridade lógica e impede que o cron de lembretes processe registros inexistentes.

```sql
DELETE FROM public.scheduled_emails
WHERE registration_id IN (
  SELECT id FROM public.registrations
  WHERE created_at < '2026-04-26 00:00:00-03:00'
);
```

### 2. Limpar referências em `event_page_views`
A coluna `converted_registration_id` pode apontar para inscrições prestes a ser excluídas. Vamos zerar essas referências (mantendo o page view, apenas desvinculando):

```sql
UPDATE public.event_page_views
SET converted_registration_id = NULL
WHERE converted_registration_id IN (
  SELECT id FROM public.registrations
  WHERE created_at < '2026-04-26 00:00:00-03:00'
);
```

### 3. Excluir as inscrições
Remoção definitiva das 14 inscrições (ativas + canceladas) anteriores a 26/04/2026:

```sql
DELETE FROM public.registrations
WHERE created_at < '2026-04-26 00:00:00-03:00';
```

### 4. Verificação pós-execução
Após rodar as migrações, validarei via `read_query`:
- `SELECT count(*) FROM registrations WHERE created_at < '2026-04-26 ...'` deve retornar **0**
- Inscrições a partir de 27/04 devem permanecer intactas
- `scheduled_emails` restantes devem corresponder apenas a inscrições válidas

## O que NÃO será alterado
- Configurações do evento (datas 05–07/05/2026, capacidade, deadline, etc.)
- Campos do formulário (`form_fields`)
- Templates de e-mail (`email_templates`)
- Perfis, roles, leads, ou qualquer dado fora de `registrations` / `scheduled_emails`
- Edge functions e código da aplicação

## Observação técnica
A operação é **destrutiva e irreversível**. Como `registrations` não possui DELETE policy para usuários (apenas `SELECT`/`UPDATE`), a exclusão será feita via migração SQL com privilégios elevados — o caminho correto neste caso.
