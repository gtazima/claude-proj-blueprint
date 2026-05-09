# ADR-001: Algoritmo de Priorização da Agenda

## Status
Accepted

## Context
O módulo Agenda precisa ordenar tarefas automaticamente por prioridade real, seguindo o critério definido pelo produtor durante o design do produto:

**Timing biológico > Dependência > Impacto financeiro**

Para implementar esse critério computacionalmente, precisamos modelar três conceitos:

1. **Timing biológico**: algumas tarefas têm janelas de execução com prazo biológico — shiitake em frutificação não espera, cultura no ponto de colheita se perde. A urgência aumenta conforme a janela se fecha.

2. **Dependência**: algumas tarefas bloqueiam outras. Não posso aplicar calcário antes de fazer a análise de solo; não posso colher antes de verificar o ponto. A tarefa bloqueadora tem prioridade sobre a bloqueada.

3. **Impacto financeiro**: entre tarefas sem timing biológico ou dependência, priorizar as que desbloqueiam receita (entrega de produto, confirmação de pagamento) ou evitam perda financeira (manutenção preventiva de equipamento crítico).

O desafio é que no MVP o sistema não terá dados financeiros suficientes para calcular impacto financeiro preciso — e nem todos os ciclos de culturas estarão modelados. O algoritmo precisa funcionar com dados parciais desde o primeiro uso.

## Decision

Modelar prioridade como um **score numérico composto** calculado em tempo real, com três componentes independentes somados com pesos fixos.

### Score de prioridade

```
score = (timing_score × 1000) + (dependency_score × 100) + (financial_score × 10) + recency_score
```

Os pesos garantem que timing biológico sempre supera dependência, que sempre supera impacto financeiro. `recency_score` é um desempate por data de criação (tarefas mais antigas sobem levemente).

### Componente 1: timing_score

Cada tarefa tem dois campos opcionais:
- `scheduled_window_start`: data a partir da qual a tarefa pode ser executada
- `scheduled_window_end`: data limite — após essa data, a janela fechou (consequência biológica)

```
Se scheduled_window_end existe:
  dias_restantes = scheduled_window_end - hoje
  Se dias_restantes <= 0:  timing_score = 100  (janela fechada — crítico)
  Se dias_restantes <= 1:  timing_score = 90   (hoje ou amanhã)
  Se dias_restantes <= 3:  timing_score = 70   (esta semana)
  Se dias_restantes <= 7:  timing_score = 50   (próximos 7 dias)
  Se dias_restantes <= 14: timing_score = 30   (próximas 2 semanas)
  Senão:                   timing_score = 10   (prazo distante)

Se scheduled_window_end não existe:
  timing_score = 0  (sem timing biológico)
```

Tarefas com janela fechada (timing_score = 100) aparecem no topo com destaque visual em vermelho — o produtor precisa decidir se executa com atraso ou descarta.

### Componente 2: dependency_score

```
Se a tarefa tem dependentes (outras tarefas que só podem começar após esta):
  dependency_score = número de tarefas dependentes (máx. 10)
Senão:
  dependency_score = 0
```

Simples e eficaz: tarefa que desbloqueia mais coisas tem maior score.

### Componente 3: financial_score

No MVP, financial_score é atribuído manualmente pelo produtor ao criar ou editar uma tarefa, em escala 0-5:
- 0: sem impacto financeiro direto
- 3: desbloqueie uma entrega ou venda
- 5: evita perda financeira iminente (equipamento crítico, produto perecível)

Quando o módulo Financeiro estiver integrado, este componente pode ser calculado automaticamente cruzando a tarefa com receitas pendentes ou custos associados à cultura. Por ora, o produtor define na criação da tarefa — campo opcional, padrão 0.

### Override manual
O produtor pode adiar uma tarefa com justificativa. O adiamento não altera o score — apenas move `scheduled_window_start` para a nova data. O score é recalculado automaticamente.

Tarefas adiadas 3 ou mais vezes recebem um flag `repeatedly_deferred = true` que gera alerta visual, mas não altera a lógica de score.

### Geração de tarefas pelo módulo Culturas
Quando o módulo Culturas gera uma tarefa automaticamente (ex: "lote 003 entra em janela de frutificação"), ele preenche `scheduled_window_start` e `scheduled_window_end` com base nos parâmetros do ciclo da cultura. O timing_score é calculado automaticamente a partir dessas datas.

## Alternatives considered

1. **Ordenação manual pelo produtor** — pros: total controle; cons: exige esforço diário, contradiz o propósito do produto de substituir a memória humana. Descartado.

2. **Score único com pesos configuráveis pelo usuário** — pros: flexível; cons: o produtor não deveria precisar calibrar pesos — ele definiu a ordem de prioridade (timing > dependência > financeiro) e o sistema deve respeitar isso sem configuração. Descartado.

3. **Modelo de ML treinado com histórico de decisões do produtor** — pros: aprende o estilo do produtor; cons: requer histórico significativo para funcionar, não funciona no dia 1, adiciona complexidade de modelo. Pode ser considerado no futuro como refinamento do financial_score.

4. **Score composto com pesos separados por ordem de grandeza (decisão atual)** — pros: garante hierarquia rígida sem configuração, funciona com dados parciais desde o início, lógica transparente e auditável; cons: financial_score manual é impreciso no MVP. Aceito.

## Consequences

- **Positivo:** algoritmo funciona desde o primeiro uso mesmo sem dados de ciclos ou financeiro completos. Lógica transparente — o produtor entende por que uma tarefa está no topo.
- **Positivo:** financial_score manual evolui para automático quando o módulo Financeiro estiver integrado, sem alterar a estrutura do algoritmo.
- **Negativo:** financial_score manual depende de disciplina do produtor para preencher. Tarefas sem score financeiro (padrão 0) podem ficar subvalorizadas.
- **Risco:** tarefas com `scheduled_window_end` no passado (janela fechada) ficam com timing_score = 100 indefinidamente. Precisamos de uma política de arquivamento para tarefas com janela fechada há mais de N dias para não poluir a lista.

## Impact on specs

- **Agenda (feat-agenda.md):** implementação direta. AC-1, AC-2 e AC-3 dependem deste ADR.
- **Culturas (feat-culturas.md):** geração automática de tarefas deve preencher `scheduled_window_start` e `scheduled_window_end` com base nos parâmetros do ciclo. AC-10 e AC-11.
- **Financeiro (feat-financeiro.md):** evolução futura do financial_score para cálculo automático. Nenhum impacto no MVP.
- **Data Architecture:** campos `scheduled_window_start`, `scheduled_window_end`, `financial_score`, `dependency_ids[]` e `repeatedly_deferred` precisam estar no schema da tabela de tarefas desde o início.

## References
- PRD: `docs/product/feat-agenda.md`
- PRD: `docs/product/feat-culturas.md`
