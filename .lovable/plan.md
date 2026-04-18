O usuário quer limpar a lista de participantes do evento atual (todos são cadastros de teste) para que os relatórios futuros contenham apenas inscrições reais.

## Diagnóstico

Evento atual: `cfd9d79d-78d3-45d8-bdc7-1250314ec2c4` (Circuito Experience Centerfrios Skymsen). Confirmei via consulta: 8 inscrições, todas com e-mails de teste (`filipecanuto@centerfrios.com`, variações de teste). Nenhuma é inscrição real de cliente final.

## Concordo com a abordagem

Sim, faz total sentido limpar antes de divulgar. Mas existem **duas opções** com trade-offs diferentes:

### Opção A — DELETE definitivo (recomendado)

Remove fisicamente as 8 linhas de `registrations` para o `event_id` desse evento.

- ✅ Relatórios, contadores e exports ficam 100% limpos.
- ✅ Libera o limite de 2 inscrições/e-mail caso você queira testar de novo depois.
- ⚠️ Irreversível (mas como são todos testes, não há perda real).

### Opção B — Marcar como `cancelled`

Mantém o histórico mas exclui das contagens de capacidade.

- ✅ Auditável.
- ⚠️ Ainda aparece na tabela de Participantes (com badge "Cancelado") e no CSV exportado — não resolve o problema do relatório limpo.

**Recomendo a Opção A.** É exatamente o caso de uso correto: dados de teste antes do go-live.

## Execução (Opção A)

Uma única operação SQL via insert tool:

```sql
DELETE FROM registrations 
WHERE event_id = 'cfd9d79d-78d3-45d8-bdc7-1250314ec2c4';
```

Após executar:

- A tabela "Participantes" do evento ficará vazia.
- Contador de inscrições zera.
- O evento continua `live` e pronto para receber inscrições reais.

## Fora de escopo

- Excluir o próprio evento (você quer manter, só zerar inscritos).
- Mexer em outros eventos (não há outros com inscrições de teste relevantes).
- Backup prévio (são dados de teste sem valor — se quiser, posso exportar o CSV antes; me avise).

## Confirmação necessária

Confirma **Opção A (DELETE definitivo das 8 inscrições)** no evento Circuito Experience Centerfrios Skymsen?  
- Sim