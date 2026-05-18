# ADR-010: Implementação Técnica do Sync Offline

## Status
Accepted

## Context
ADR-002 estabeleceu o **modelo conceitual** do sync offline: LWW por campo + operation log append-only. Este ADR define o **como** — quais bibliotecas, quais protocolos, quais estruturas de dados concretas — para que a implementação seja consistente e não reinvente o que já existe maduro.

Existem três caminhos viáveis para implementar o que ADR-002 descreve:

1. **Implementação manual** — escrever o operation log, lógica de LWW e protocolo de sync à mão sobre SQLite + PostgreSQL.
2. **PowerSync** — biblioteca comercial especializada em sync Postgres ↔ SQLite com replicação bidirecional.
3. **RxDB** — banco de dados reativo NoSQL com CRDT/conflict resolution e plugin de sync.

Cada um tem trade-offs significativos.

## Decision

Adotar **implementação manual** baseada nos primitivos descritos em ADR-002, com bibliotecas específicas para tarefas pontuais (não como solução end-to-end).

### Stack escolhido

**Backend:**
- **PostgreSQL** como fonte de verdade
- **SQLAlchemy + SQLModel** para ORM (já no stack — ADR-004 implícito)
- **Alembic** para migrations
- **APScheduler** ou **asyncio tasks** para compactação periódica do operation log

**Frontend:**
- **Dexie.js** como wrapper sobre IndexedDB (não SQLite no navegador — IndexedDB é o padrão PWA, mais leve, sem WASM)
- **TanStack Query** para gerenciar estado de servidor com cache offline
- **Custom sync engine** sobre Dexie + fetch — escrito à mão seguindo ADR-002

### Protocolo de sync

**Endpoint único de sync:** `POST /api/sync`

Request:
```json
{
  "device_id": "abc123",
  "last_sync_timestamp": "2026-05-08T14:30:00Z",
  "operations": [
    {
      "operation_id": "uuid",
      "entity_type": "task",
      "entity_id": "uuid",
      "operation": "update",
      "payload": { "title": "Aplicar calcário no talhão 1" },
      "timestamp": "2026-05-08T14:32:15Z"
    }
  ]
}
```

Response:
```json
{
  "synced_at": "2026-05-08T14:35:00Z",
  "accepted_operations": ["uuid", ...],
  "rejected_operations": [
    {
      "operation_id": "uuid",
      "reason": "completion_locked"
    }
  ],
  "remote_operations": [
    { "...": "operações do servidor desde last_sync_timestamp" }
  ]
}
```

O endpoint é transacional: ou todas as operações aceitas são aplicadas atomicamente, ou nada é. Falha parcial não é admitida.

### Streaming em tempo real (online)

Quando o cliente está online, mantém **WebSocket** com endpoint `/api/sync/stream` para receber operações em tempo real. Decisão entre WebSocket e SSE (Server-Sent Events): WebSocket porque permite envio bidirecional — útil para futuras features colaborativas (ex: pai vendo nova tarefa criada pelo produtor em tempo real).

Quando o WebSocket cai (perda de conexão), o cliente volta para o modo "polling com `/api/sync`" a cada 30 segundos até reconectar.

### Operation log no cliente (Dexie)

```typescript
// Schema simplificado da tabela de operations no IndexedDB
interface Operation {
  operation_id: string;        // UUID v4 gerado no cliente
  entity_type: string;
  entity_id: string;
  operation: "create" | "update" | "complete" | "delete";
  payload: Record<string, unknown>;
  timestamp: string;            // ISO 8601 UTC
  device_id: string;
  synced: boolean;              // true após confirmação do servidor
  retry_count: number;          // incrementa a cada tentativa de sync falha
}
```

Toda mutação no app gera uma `Operation` no IndexedDB primeiro, atualiza o estado local, e enfileira para sync. O retorno visual ao usuário é imediato (otimista) — sem esperar resposta do servidor.

### Operation log no servidor (PostgreSQL)

```sql
CREATE TABLE operation_log (
    operation_id UUID PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    operation TEXT NOT NULL,
    payload JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    device_id TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rejection_reason TEXT
);

CREATE INDEX idx_oplog_user_timestamp ON operation_log (user_id, timestamp);
CREATE INDEX idx_oplog_entity ON operation_log (entity_type, entity_id);
```

Aplicação de uma operação no servidor é responsabilidade de um **handler por entity_type**. Exemplo:

```python
# app/services/sync/handlers/task.py
def apply_task_operation(op: Operation, session: Session) -> ApplyResult:
    task = session.get(Task, op.entity_id)

    if op.operation == "create":
        # Idempotência: se já existe, pula
        if task is not None:
            return ApplyResult(accepted=True, skipped=True)
        task = Task(**op.payload, id=op.entity_id)
        session.add(task)
        return ApplyResult(accepted=True)

    if op.operation == "complete":
        if task.completion_locked:
            return ApplyResult(
                accepted=False,
                rejection_reason="completion_locked"
            )
        task.completed_at = op.timestamp
        # Lock será aplicado em background após COMPLETION_UNDO_WINDOW
        return ApplyResult(accepted=True)

    if op.operation == "update":
        # LWW por campo (ADR-002)
        for field, new_value in op.payload.items():
            current_updated_at = task.field_timestamps.get(field)
            if current_updated_at is None or op.timestamp > current_updated_at:
                setattr(task, field, new_value)
                task.field_timestamps[field] = op.timestamp
        return ApplyResult(accepted=True)
    ...
```

LWW por campo requer rastreamento de `field_timestamps`. Decisão: armazenar como `JSONB` na própria tabela da entidade — `task.field_timestamps = {"title": "2026-05-08T...", "executor": "..."}`. Adiciona ~200 bytes por entidade mas elimina necessidade de tabela auxiliar.

### Compactação do operation log

ADR-002 menciona compactação após 90 dias. Implementação:

- **Job diário** (`src/api/app/jobs/compact_oplog.py`) que roda às 3h da manhã
- Identifica operações `synced = true` e `timestamp < now - 90 dias`
- Gera **snapshot** do estado das entidades afetadas naquele momento
- Move o snapshot para `entity_snapshots` (tabela separada, append-only)
- Deleta as operações antigas do `operation_log`

A reconstrução do estado de uma entidade em qualquer ponto do tempo continua possível: aplicar snapshot + operações posteriores.

### Clock skew

ADR-002 identificou o risco. Solução concreta:

No primeiro request do cliente após login, servidor responde com header `X-Server-Time: <ISO 8601>`. Cliente compara com seu relógio e armazena `clock_offset = server_time - client_time`. Toda timestamp gerada pelo cliente é corrigida com esse offset antes de ser enviada.

```typescript
function clientNow(): string {
  return new Date(Date.now() + clockOffset).toISOString();
}
```

Atualização do offset ocorre a cada 24h ou após reconexão de longa duração.

### Conflitos de operação

ADR-002 define LWW por campo. Implementação no servidor:

```python
def resolve_field_conflict(
    field: str,
    current_value: Any,
    current_ts: datetime,
    incoming_value: Any,
    incoming_ts: datetime,
) -> tuple[Any, datetime, ConflictLog | None]:
    if incoming_ts > current_ts:
        # incoming vence
        log = ConflictLog(
            field=field,
            losing_value=current_value,
            losing_ts=current_ts,
            winning_value=incoming_value,
            winning_ts=incoming_ts,
        ) if values_differ_meaningfully(current_value, incoming_value) else None
        return incoming_value, incoming_ts, log

    # current vence — incoming é descartado
    return current_value, current_ts, None
```

Conflitos detectados (`ConflictLog` não-nulo) são persistidos em `conflict_audit_log` e ficam acessíveis ao usuário por 30 dias (PRD ADR-002 — indicador visual de sync).

### Lock de conclusão (após janela de undo)

Job em background:
- A cada minuto, busca tarefas com `completed_at IS NOT NULL AND completion_locked = false AND completed_at < now - COMPLETION_UNDO_WINDOW`
- Atualiza `completion_locked = true` em transação
- Propaga via WebSocket para clientes conectados (para esconder o botão "Desfazer")

### Não-objetivos explícitos

- **Sincronização P2P (sem servidor):** não. Servidor é sempre intermediário.
- **Resolução manual de conflitos pelo usuário:** não — LWW automático sempre. Auditoria existe para revisão posterior se necessário.
- **Replicação multi-master:** não — modelo é star (clientes sincronizam com servidor único).

## Alternatives considered

1. **PowerSync (Postgres ↔ SQLite)** — pros: solução end-to-end pronta, performance comprovada, conflict resolution built-in; cons: produto comercial pago, vendor lock-in alto, biblioteca cliente pesada (~500KB), curva de aprendizado da abstração própria, pode não cobrir as regras específicas (lock de conclusão após 5min, propagação por cultura). Descartado — para um produto que vai ser de uso próprio inicialmente, o custo não compensa.

2. **RxDB com plugin de sync GraphQL** — pros: framework reativo poderoso, CRDT opcional, ótima documentação; cons: NoSQL no cliente exige adaptação de mentalidade, não temos GraphQL no backend (FastAPI é REST), custo de mudar arquitetura toda. Descartado.

3. **Dexie.js + Dexie Cloud** — pros: integração nativa, sync gerenciado; cons: vendor lock-in (Dexie Cloud), pricing baseado em usuários ativos. Descartado a parte do Cloud, mantido apenas o Dexie como wrapper de IndexedDB.

4. **WatermelonDB** — pros: ótimo para mobile React Native, conflict resolution decente; cons: design otimizado para React Native, no PWA não há ganho real. Descartado.

5. **Implementação manual sobre Dexie + Postgres + custom sync engine (decisão atual)** — pros: zero vendor lock-in, controle total das regras de negócio (lock de conclusão, propagação por cultura, etc.), código próprio é responsabilidade do time, alinha com ADR-002 sem fricção; cons: mais código próprio para manter, edge cases descobertos no caminho. Aceito — o trabalho extra é proporcional ao controle ganho.

## Consequences

- **Positivo:** zero dependência de produto comercial — custo previsível.
- **Positivo:** controle total das regras específicas (LWW por campo, lock de conclusão, filtro por cultura no sync) sem lutar contra abstrações de bibliotecas.
- **Positivo:** Dexie + IndexedDB são tecnologias web nativas — funcionam em qualquer browser moderno sem WASM.
- **Negativo:** mais código próprio significa mais bugs descobertos com o uso. Mitigação: cobertura de testes alta no operation log (ADR-008 exige ≥95%).
- **Risco:** edge cases de sync não previstos podem causar perda de dados. Mitigação: append-only do operation log permite replay para corrigir bugs futuros — nunca perdemos dados, no pior caso reaplicamos.
- **Risco:** WebSocket pode ser bloqueado por proxies/firewalls em algumas redes. Mitigação: fallback automático para polling em `/api/sync`.

## Impact on specs

- **Data Architecture:** tabelas `operation_log`, `entity_snapshots`, `conflict_audit_log` precisam ser parte do schema inicial. Toda entidade mutável recebe coluna `field_timestamps JSONB`.
- **API:** endpoints `/api/sync` (POST), `/api/sync/stream` (WebSocket), `/api/sync/conflicts` (GET — para o usuário revisar) precisam ser implementados antes de qualquer feature multi-dispositivo.
- **Observability:** logar tamanho da fila de sync por dispositivo, latência do sync, taxa de conflitos resolvidos, taxa de operações rejeitadas. Métricas críticas para diagnosticar problemas em produção.
- **Testing strategy (ADR-008):** edge cases enumerados explicitamente — ADR-008 exige isso.
- **Security:** WebSocket precisa de autenticação no handshake (token JWT no query string ou primeiro frame). Validar `device_id` em cada operação contra a tabela de sessões.

## References

- [[adr-002-sync-offline]] — modelo conceitual LWW + operation log que esta ADR implementa
- [[adr-008-estrategia-de-testes]] — operation log exige ≥95% de cobertura; edge cases enumerados explicitamente
- [[adr-009-autenticacao]] — provê `device_id` autenticado e validação de sessão de dispositivo
