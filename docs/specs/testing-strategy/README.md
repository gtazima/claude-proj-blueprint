# Module: Testing Strategy

## Test pyramid

```
         /  E2E  \          ~5%  — não definido para MVP
        /----------\
       / Integration \      ~25% — Pytest (backend) / Vitest (frontend)
      /----------------\
     /      Unit        \   ~70% — Pytest (backend) / Vitest (frontend)
    /--------------------\
```

Pirâmide assimétrica: base unitária pesada, E2E mínimo até o produto estabilizar.

## Tools

| Layer | Backend | Frontend |
|---|---|---|
| Unit | Pytest | Vitest |
| Integration | Pytest + SQLAlchemy test session | Vitest + MSW (mock de API) |
| E2E | — (não configurado no MVP) | — |
| Performance | — (não configurado no MVP) | — |
| Security | Ruff (linting) + revisão manual | npm audit |

## Patterns

- **Naming:** `test_<what>_<condition>_<expected>` (Python) / `describe + it + AAA` (TypeScript)
- **Fixtures:** factory functions no conftest.py (backend); objetos inline nos testes (frontend)
- **Mocks:** banco de dados real em testes de integração — nunca mockar o banco (lição aprendida no ecossistema anterior). Mockar apenas serviços externos (Google Tasks API, Supabase Auth)
- **Test data:** fixtures geradas por factory — sem snapshots

## Coverage

- **Global mínimo:** 70%
- **Delta por PR:** sem requisito — velocidade não deve ser bloqueada por UI difícil de testar
- **Exclusões permitidas:** migrations, arquivos de config, código gerado, adaptadores de IA (`src/ai/adapters/`)
- **Ferramenta:** `coverage.py` (backend via `pytest-cov`) / `@vitest/coverage-v8` (frontend)

## Tests in CI

| Stage | Trigger | Requerido para merge |
|---|---|---|
| Unit + Integration | Todo push | Sim |
| Security scan (npm audit + ruff) | Todo PR | Sim |
| E2E | N/A — MVP | N/A |

## Test environments

| Environment | Dados | Propósito |
|---|---|---|
| Local | SQLite em memória / fixtures | Desenvolvimento |
| CI | PostgreSQL efêmero (GitHub Actions service) | Validação automatizada |

## Cenário offline obrigatório

Toda feature que afeta sincronização deve ter teste explícito simulando ausência de conexão.
Esse cenário é crítico por causa do ADR-002 (sync offline LWW) e do uso em campo.

## Definition of Done (por feature)

- [ ] Testes unitários para lógica de negócio nova
- [ ] Teste de integração para endpoints novos
- [ ] Cenário offline testado se a feature toca sync
- [ ] `pnpm test` e `uv run pytest` passando antes do commit
- [ ] Coverage não caiu abaixo de 70% global
