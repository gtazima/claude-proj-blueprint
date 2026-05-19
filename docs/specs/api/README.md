# API Conventions

## API Style

REST.

## Base URL

`/api/v1`

> Migração `/api` → `/api/v1` concluída em 2026-05-15 (backend + frontend + `.env.production`).

## Authentication

JWT Bearer via Supabase Auth.

- Header: `Authorization: Bearer {jwt}`
- Validação: JWKS endpoint (`{supabase_url}/auth/v1/.well-known/jwks.json`) — RS256/ES256
- Cache do JWKS: 300s (implementado em `app/api/deps.py`)
- Todos os endpoints requerem autenticação exceto `/health`

## Versioning

URL prefix: `/api/v1`. Sem header de versão.

## Request/Response Format

### Content type

`application/json` em todos os endpoints.

### Pagination

Offset-based:

```json
GET /api/v1/tasks?page=1&limit=50

{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 143,
    "total_pages": 3
  }
}
```

Defaults: `page=1`, `limit=50`. Máximo por requisição: `limit=200`.

### Filtering & sorting

```
GET /api/v1/tasks?status=pending&sort=priority_score&order=desc
```

### Error format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Descrição legível por humano",
    "details": [
      { "field": "title", "message": "Deve ter entre 1 e 200 caracteres" }
    ]
  }
}
```

### Standard error codes

| Code | HTTP | Meaning |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Body/params falharam na validação |
| `UNAUTHORIZED` | 401 | Auth ausente ou inválida |
| `FORBIDDEN` | 403 | Autenticado mas sem permissão |
| `NOT_FOUND` | 404 | Recurso não existe |
| `CONFLICT` | 409 | Conflito de estado (ex: duplicate) |
| `RATE_LIMITED` | 429 | Muitas requisições |
| `INTERNAL_ERROR` | 500 | Erro inesperado no servidor |

## Naming conventions

- Recursos: substantivos no plural (`/tasks`, `/config/executors`)
- Ações: via HTTP methods, não verbos na URL (`POST /tasks`, não `/createTask`)
- Aninhamento: máximo 2 níveis
- **IDs: UUID v4** (formato `{uuid}` no path, ex: `/api/v1/tasks/{task_id}`)
- Datas: ISO 8601 com timezone (`2026-04-01T12:00:00Z`)
- Enums e campos: `snake_case` (`financial_score`, `scheduled_window_end`)

## CORS

```
Allowed origins: ["*"]  # protegido pela camada de auth (Supabase JWT), não pela borda
Allowed methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
Allowed headers: Authorization, Content-Type
Max age: 86400
```

## Security

- HTTPS obrigatório em produção (garantido pelo Render)
- Dados sensíveis nunca em URL parameters
- Validação de input em todos os parâmetros (tipo, tamanho, formato) via Pydantic
- Ver `docs/specs/security/` para política completa

## Documentation

FastAPI gera OpenAPI automaticamente em `/docs` (Swagger UI) e `/openapi.json`.
Não há arquivo OpenAPI manual — o código é a fonte da verdade.
