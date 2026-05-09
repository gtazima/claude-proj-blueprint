# ADR-002: Estratégia de Sync Offline

## Status
Accepted

## Context
A propriedade tem excelente conectividade na casa sede e oficina, mas sem cobertura no campo. O produtor registra observações, conclui tarefas e colheitas diretamente no campo — sem internet. Esses dados precisam ser persistidos localmente e sincronizados ao retornar à área com conexão, sem perda e sem conflitos silenciosos.

O desafio central é **conflict resolution**: o que acontece quando o mesmo dado é modificado em dois lugares antes da sincronização?

Cenários reais de conflito:
- Produtor conclui tarefa A no campo (offline); pai edita a descrição da mesma tarefa A no desktop (online) ao mesmo tempo.
- Produtor cria observação no caderno offline; sistema gera uma sugestão de IA para aquela observação online antes do sync.
- Produtor adia tarefa B offline; sistema recalcula score de prioridade online baseado em nova tarefa gerada pelo módulo Culturas.

## Decision

Adotar **Last Write Wins (LWW) com timestamp de dispositivo + fila de operações append-only**.

### Modelo de dados

Toda entidade mutável carrega:
```
id:          UUID v4 (gerado no cliente — sem dependência de servidor para criar)
created_at:  timestamp UTC (imutável)
updated_at:  timestamp UTC (atualizado a cada modificação)
device_id:   identificador do dispositivo que fez a última modificação
version:     inteiro incremental local (para detectar divergência)
deleted_at:  timestamp UTC nullable (soft delete — nunca deletar fisicamente no sync)
```

### Fila de operações (Operation Log)

Em vez de sincronizar estado, sincronizamos **operações**. Cada ação do usuário gera uma entrada imutável na fila local:

```
operation_id:  UUID
entity_type:   "task" | "harvest" | "field_note" | ...
entity_id:     UUID da entidade afetada
operation:     "create" | "update" | "complete" | "delete"
payload:       JSON com os campos modificados
timestamp:     UTC do momento da operação
device_id:     identificador do dispositivo
synced:        boolean (false até confirmação do servidor)
```

A fila é append-only e nunca é apagada — apenas marcada como `synced = true`. Isso garante rastreabilidade completa e permite replay em caso de falha.

### Regra de conflict resolution: LWW por campo

Quando o servidor recebe operações conflitantes (mesma entidade modificada em dois dispositivos antes do sync):

1. Para cada campo modificado, vence a operação com `timestamp` mais recente.
2. Campos não modificados por nenhum dos lados não são afetados.
3. O servidor grava o estado resultante e propaga para todos os dispositivos.

**Operações de conclusão de tarefa — janela de undo:** conclusão tem uma janela de 5 minutos durante a qual pode ser revertida pelo mesmo usuário no mesmo dispositivo. Após esse prazo, a conclusão é considerada definitiva e tem precedência sobre qualquer edição posterior — ela permanece concluída independente de timestamp. Isso protege contra cliques acidentais sem permitir "desconclusão" silenciosa por sync após o fato.

A entidade tarefa carrega:
```
completed_at:        timestamp UTC nullable
completion_locked:   boolean (true após 5 minutos da conclusão — bloqueia revert)
```

O cliente exibe botão "Desfazer" por 5 minutos após marcar como concluída. Após o lock, a tarefa só pode voltar à lista por uma operação explícita de "reabrir tarefa" — que é uma ação distinta no log de operações, não um simples undo.

### Fluxo de sync

**Offline → Online:**
1. App detecta conexão disponível
2. Envia fila de operações não sincronizadas (`synced = false`) em ordem cronológica
3. Servidor aplica operações com LWW, retorna estado resolvido + timestamp de sync
4. App atualiza estado local com resultado do servidor
5. Marca operações como `synced = true`

**Online → Offline (receber mudanças do servidor):**
1. App mantém conexão SSE (Server-Sent Events) quando online para receber push de mudanças em tempo real
2. Ao conectar após período offline, solicita todas as operações do servidor desde `last_sync_timestamp`
3. Aplica as operações recebidas com a mesma regra LWW

### Dados que nunca conflitam

Entidades append-only não precisam de conflict resolution:
- Entradas do caderno de campo (imutáveis após criação)
- Log de acionamentos de automação
- Histórico de colheitas
- Operações financeiras

Para essas entidades, o sync é simples: enviar o que não foi sincronizado ainda.

### Indicador visual de sync

O app exibe estado de sync em tempo real:
- ✓ Sincronizado
- ↑ N operações pendentes de envio
- ⚠ Conflito resolvido automaticamente (log disponível para o produtor revisar)

Conflitos resolvidos automaticamente ficam acessíveis em log de auditoria por 30 dias — o produtor pode revisar mas raramente precisará.

## Alternatives considered

1. **CRDTs (Conflict-free Replicated Data Types)** — pros: resolução matemática de conflitos sem servidor; cons: complexidade de implementação muito alta, bibliotecas maduras são escassas para o stack escolhido, comportamento em casos de borda é difícil de explicar ao usuário. Descartado para o MVP.

2. **Operational Transformation (OT)** — pros: usado pelo Google Docs, robusto para edição colaborativa de texto; cons: complexidade desproporcional para o caso de uso (edição colaborativa de documentos de texto ≠ campos discretos de uma tarefa). Descartado.

3. **LWW puro por entidade inteira** — pros: simples; cons: se produtor edita campo A e pai edita campo B na mesma tarefa offline, a versão de quem sincronizar por último sobrescreve o outro inteiro — perda silenciosa de dados. Descartado em favor de LWW por campo.

4. **Sync manual com resolução pelo usuário** — pros: zero perda de dados; cons: mostrar telas de "conflito detectado, escolha qual versão manter" para um agricultor no campo é experiência inaceitável. Descartado.

5. **LWW por campo com operation log (decisão atual)** — pros: simples de implementar, sem perda de dados na maioria dos casos, rastreável, funciona bem para o padrão de uso real (conflitos são raros — os usuários raramente editam o mesmo campo ao mesmo tempo); cons: edge case de conflito simultâneo no mesmo campo resolve pelo timestamp, que pode não refletir a intenção do usuário. Aceito — o edge case é raro e o log de auditoria permite revisão.

## Consequences

- **Positivo:** UUIDs gerados no cliente eliminam dependência de servidor para criar entidades offline — o app funciona completamente desconectado sem degradação.
- **Positivo:** operation log append-only é auditável — qualquer estado pode ser reconstruído replaying as operações.
- **Positivo:** soft delete garante que dados nunca são perdidos silenciosamente durante sync.
- **Negativo:** operation log cresce indefinidamente. Precisamos de política de compactação: manter log bruto por 90 dias, depois manter apenas snapshot do estado final.
- **Risco:** relógios de dispositivos desincronizados (clock skew) podem causar LWW incorreto. Mitigação: o servidor corrige timestamps com offset calculado no handshake de sync.
- **Risco:** sync de grandes volumes após período longo offline (ex: semana sem conexão) pode ser lento. Mitigação: sync incremental por lote de 100 operações com indicador de progresso.

## Impact on specs

- **Data Architecture:** toda tabela mutável precisa dos campos `device_id`, `version`, `deleted_at`. Operation log é uma tabela central do schema. Definir índices adequados para queries por `entity_id + timestamp` e por `synced = false`.
- **API:** endpoint de sync precisa aceitar batch de operações e retornar estado resolvido de forma atômica. Transação de banco obrigatória.
- **Security:** device_id deve ser autenticado — não aceitar operações de dispositivos não registrados na conta do usuário.
- **Observability:** monitorar tamanho da fila de operações pendentes por dispositivo. Alertar se dispositivo acumular >1000 operações sem sync (pode indicar problema de conectividade persistente).
- **Agenda (feat-agenda.md):** AC-6 e AC-19 dependem diretamente deste ADR.
- **Caderno de Campo (feat-caderno-de-campo.md):** AC-5 depende deste ADR.
- **Culturas (feat-culturas.md):** colheitas e atualizações de ciclo offline dependem deste ADR.

## References
- PRD: `docs/product/feat-agenda.md`
- PRD: `docs/product/feat-caderno-de-campo.md`
- PRD: `docs/product/feat-culturas.md`
