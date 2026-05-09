# Inventário do código legado — `old/fazenda-dashboard`

Este documento lista o código do projeto anterior, classificando o que pode ser reaproveitado, adaptado ou descartado na nova arquitetura.

## Estrutura geral

```
old/fazenda-dashboard/
├── main.py                      → servidor FastAPI + dashboard HTML embutido
├── setup.py                     → configuração inicial e auth Google
├── importar_caderno.py          → migração histórica de planilha (~250 registros 2024)
├── modules/
│   ├── google_client.py         → autenticação OAuth Google compartilhada
│   ├── gmail.py                 → leitura emails + parsing transações C6
│   ├── tasks.py                 → integração Google Tasks
│   ├── calendar_mod.py          → leitura Google Calendar
│   └── caderno.py               → backend completo do caderno de campo
└── config/
    ├── credentials.json         → credenciais OAuth
    ├── token.pkl                → token OAuth ativo
    └── fazenda.db               → SQLite com dados reais
```

## Reaproveitável diretamente

### `modules/gmail.py` — parsing de transações C6
**Status:** alta valor de reaproveitamento.

O que aproveitar:
- Padrões regex para extrair valores de e-mails do C6 (`PADROES_C6`)
- Função `_extrair_corpo()` para decodificar payload de e-mail (base64 + HTML stripping)
- Função `_parsear_transacao()` com lógica de extração de valor + tipo + data
- Lógica de deduplicação por `gmail_id`

Onde encaixa: adapter `email_parser` do ADR-005 (integração bancária).

Adaptações necessárias:
- Remover dependência de SQLite local — emitir `BankTransaction` (interface do ADR-005)
- Trocar `CATEGORIAS` hardcoded por classificação via IA (ADR-004) com tags configuráveis
- Adicionar suporte a outros bancos (Caixa) — extrair padrões para configuração externa

### `modules/google_client.py` — autenticação OAuth
**Status:** reaproveitável com pequenos ajustes.

O que aproveitar:
- Fluxo de carregamento e renovação de token
- Estrutura de `SCOPES` declarativa

Adaptações necessárias:
- Token armazenado em pickle local → migrar para armazenamento criptografado (precisa decisão de stack — Fernet, libsodium, etc.)
- Suporte a múltiplos usuários (cada um com sua autenticação Google própria) quando o produto escalar

### `importar_caderno.py` — dados históricos
**Status:** dados são patrimônio. Migrar 100%.

São aproximadamente 250 registros reais do caderno de campo de 2024 — histórico real de manejos, plantios, colheitas, manutenções. Esses dados devem ser migrados para o novo sistema na primeira inicialização do módulo Caderno de Campo.

Plano de migração:
1. Parsear `REGISTROS_RAW` para extrair (data, área, atividade, observação)
2. Inferir cultura automaticamente via IA (campo `cultura` no novo modelo)
3. Inferir tipo (atividade/plantio/colheita/manutenção) via IA
4. Detectar lotes mencionados nas observações (padrões como `Lote_S_001_100524`)
5. Inserir como entradas históricas no caderno com `origem = "migracao_2024"`
6. Disparar processamento de IA do ADR-004 para extrair padrões e sugestões

Esse histórico é particularmente valioso porque permite à IA aprender padrões sazonais reais da propriedade desde o dia 1 — ciclos de capim-cidreira, frequência de limpeza de filtro de irrigação, plantios de melaleuca, etc.

### `modules/caderno.py` — modelo conceitual
**Status:** reaproveitar conceitos, não código.

O que aproveitar (ideias e estruturas):
- Lista de tipos de atividade (`TIPOS`) — base para categorização inicial do novo sistema
- Estrutura conceitual de lotes (`lotes` table) — alinha com módulo Culturas
- Lógica de alertas de ciclo (`alertas_ciclo()`) — base para AC-7 e AC-10 do PRD Culturas
- `historico_cultura()` e `stats_cultura()` — boas referências para AC-14 e AC-15 do PRD Culturas

Por que não reaproveitar código:
- Schema SQLite monolítico não suporta sync offline (ADR-002)
- Nenhum modelo de permissões (ADR-003)
- Categorias e ciclos hardcoded — novo sistema usa cadastro dinâmico
- Sem suporte a UUID v4 (ADR-002 exige)

## Reaproveitável parcialmente

### `modules/tasks.py` — integração Google Tasks
**Status:** descartar dependência, manter conceitos.

Por que descartar a integração:
- O AgroecologIA é a fonte de verdade da agenda (ADR Agenda — "Não Doing: integração com Google Calendar")
- Google Tasks limita campos (sem `scheduled_window`, sem dependências, sem priorização computada)

O que aproveitar:
- Lógica de identificar "tarefa atrasada" (`_esta_atrasada()`) — útil como referência para timing_score do ADR-001
- Função `tarefas_do_dia()` — base conceitual para a query da ordem do dia

### `modules/calendar_mod.py` — Google Calendar
**Status:** descartar.

O AgroecologIA não consome Google Calendar (excludído explicitamente no PRD da Agenda). Não há código aproveitável.

### `main.py` — servidor monolítico
**Status:** descartar arquitetura, aproveitar apenas o aprendizado.

O `main.py` é um arquivo único com FastAPI + HTML embutido + lógica de negócio + queries SQL. Antípoda da arquitetura modular do novo produto.

O que vale a pena revisar:
- Endpoints expostos — boa referência sobre quais operações foram efetivamente usadas no dia a dia
- Padrões de query observados — pode informar quais índices/views precisamos no novo schema

## A descartar completamente

- **Schema SQLite atual** (`fazenda.db`) — incompatível com sync offline do ADR-002. Os **dados** serão migrados; o schema, não.
- **`token.pkl`** — pickle não é seguro para tokens de produção. Substituir por armazenamento criptografado.
- **Configuração via `.env` no formato atual** — manter como referência, mas o novo sistema terá `config/` por instalação.
- **`INICIAR.bat`** — script de conveniência específico do dev local.

## Recomendações de migração

1. **Antes de implementar o módulo Caderno de Campo:** finalizar a migração dos 250 registros de 2024 — é dado real que dá valor imediato à IA.
2. **Antes de implementar o adapter de e-mail (ADR-005):** copiar `gmail.py` como base, adaptar para emitir `BankTransaction`.
3. **Antes de implementar autenticação Google:** copiar fluxo OAuth de `google_client.py`, adaptar para criptografia de token.
4. **Não copiar `main.py` ou `caderno.py` literalmente** — usar apenas como referência conceitual.

## Riscos

- **Pickle de credenciais:** o token OAuth atual está em `config/token.pkl`. Não copiar este arquivo para o novo projeto — gerar token novo do zero por segurança.
- **Categorias hardcoded em `gmail.py`:** ao copiar, **não trazer** o dicionário `CATEGORIAS` — ele violaria o princípio de tags livres definido no PRD do Financeiro.
