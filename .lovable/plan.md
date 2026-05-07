## Auditoria & Relatórios — Circuito Experience: Centerfrios & Skymsen

Evento `cfd9d79d-78d3-45d8-bdc7-1250314ec2c4` — 277 inscrições, 20 check-ins, 0 cancelamentos, janela 05/05 14h → 07/05 18h (BRT).

---

### 1. Investigação dos erros do `/checkin-rapido`

Vou cruzar logs do Postgres (chamadas `public_check_in_by_email` nas últimas 72h) com a tabela `registrations` para classificar cada falha:

- **`not_found`** — e-mail digitado não existe ⇒ pessoa não se inscreveu (esperado; já temos o fluxo "Inscrever agora").
- **`outside_window`** — inscrição existe mas evento fora da janela (não deve ocorrer agora).
- **`invalid_email`** — typo no e-mail digitado.
- **`multiple_events`** — só 1 evento live, não deve ocorrer.

Resultado vai numa aba **"Erros Check-in"** com timestamp, e-mail tentado, status retornado e provável causa.

### 2. Limpeza de duplicatas (merge)

- 38 e-mails têm 2-3 inscrições (ex.: `nossacompra@hotmail.com` 3x, 1 com check-in).
- **Regra**: para cada grupo de e-mails repetidos:
  - Manter a inscrição **mais antiga** (`created_at` ASC).
  - Se qualquer duplicata estiver `checked_in`, propagar status + `checked_in_at` para a mantida.
  - Cancelar (`status='cancelled'`) as demais com nota em `tracking.merge_reason='duplicate_email_merged_<data>'`.
- Total estimado: ~40 inscrições viram `cancelled`, mantendo o histórico (não deletamos).
- Saída: aba **"Duplicatas Mescladas"** no Excel listando antes/depois.

### 3. Geração dos relatórios

**📊 Excel (`relatorio_circuito_experience.xlsx`)** com abas:
1. **Resumo Executivo** — KPIs (total, check-ins, taxa, duplicatas, e-mails enviados/falhados).
2. **Inscritos** — todos os 277, ordenados por data, com status atual e flag de duplicata.
3. **Check-ins Realizados** — quem entrou, horário, dispositivo (se rastreado).
4. **Pendentes** — inscritos sem check-in (lista para a recepção).
5. **Duplicatas Mescladas** — auditoria da limpeza (item 2).
6. **Erros Check-in** — análise do item 1.
7. **Funil de Inscrição** — pageviews → form iniciado → abandono → conversão (de `event_page_views`).
8. **Inscrições por Hora** — série temporal (BRT) para gráfico.
9. **E-mails** — confirmações + lembretes (1d/2h): enviados, falhados, motivos.

**📄 PDF Executivo (`relatorio_circuito_experience.pdf`)** — 4-5 páginas:
1. Capa + KPIs principais
2. Funil de conversão (pageviews → inscritos → check-in) com gráfico
3. Cronologia de inscrições + pico de tráfego
4. Saúde dos e-mails (taxa de entrega, falhas)
5. Achados da auditoria + recomendações para próximos eventos

### 4. Validação

- Após o merge: rodar `SELECT lower(lead_email), count(*) FROM registrations WHERE event_id=... AND status!='cancelled' GROUP BY 1 HAVING count(*)>1` ⇒ deve retornar zero.
- Verificar que nenhum check-in foi perdido (count `checked_in` antes vs depois).
- QA visual do PDF (página por página) e abertura do Excel.

---

### Arquivos entregues

- `/mnt/documents/relatorio_circuito_experience.xlsx`
- `/mnt/documents/relatorio_circuito_experience.pdf`

### Mudanças no banco

- Apenas `UPDATE` em `registrations` para o merge (sem schema, sem deletes). Reversível pelo histórico em `tracking`.

### Fora de escopo

- Não mexer em RLS, edge functions ou estrutura de tabelas.
- Não alterar configuração do evento (datas, capacidade).
- Não enviar e-mails — só relatar.
