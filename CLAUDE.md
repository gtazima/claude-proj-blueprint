# AgroecologIA

## Project
Assistente de gestão integrada para pequenas propriedades agroecológicas. Atua como memória externa da propriedade e copiloto do agricultor — priorizando tarefas por timing biológico, rastreando ciclos produtivos, controlando automações e apoiando decisões com base em literatura técnica.
Ver `docs/product/vision.md` para a visão completa do produto.

## Tech Stack
- **Frontend:** React + Vite (TypeScript) — PWA (cobre desktop e mobile)
- **Backend:** Python + FastAPI
- **Banco local (offline):** SQLite — sincroniza quando conectado
- **Banco nuvem:** PostgreSQL + extensão TimescaleDB para séries temporais de sensores
- **IA:** Camada plugável com 4 provedores de primeira classe — Claude, Gemini, OpenAI, DeepSeek. Default configurável por instalação. Atualmente: **DeepSeek** (preferência do produtor + custo agressivo); pode ser trocado para Gemini se o critério for "maior free tier sustentado". Ver ADR-011.
- **Embeddings:** Gemini `text-embedding-004` (free tier nativo) ou Voyage AI quando provedor ativo for Claude. Provedores sem embeddings nativos delegam automaticamente.
- **Transcrição offline:** Whisper local (~150MB, modelo `base` ou `small` para PT-BR)
- **WhatsApp:** Evolution API (self-hosted) — envio da ordem do dia para o funcionário
- **Autenticação:** Supabase Auth
- **Mapas:** Mapbox GL JS ou Leaflet (decisão pendente — ADR a escrever)
- **IoT — protocolo:** MQTT + HTTP REST como base (broker self-hosted Mosquitto vs. gerenciado — decisão pendente)
- **IoT — hardware:** stack a definir conforme escolha do produtor
- **Backup:** Google Drive como destino de backup automático com export disponível
- **Testes:** Pytest (backend) + Vitest (frontend)
- **Package manager:** pnpm (frontend) + uv (backend)

## Architecture

```
/
├── src/
│   ├── web/          → PWA React (frontend)
│   ├── api/          → FastAPI (backend)
│   ├── ai/           → camada de IA plugável (adapters por provedor)
│   ├── workers/      → jobs assíncronos (sync offline, WhatsApp, alertas)
│   └── shared/       → tipos e contratos compartilhados
├── docs/             → Obsidian vault
│   ├── product/      → visão, PRDs, personas, roadmap
│   ├── architecture/ → ADRs
│   ├── specs/        → especificações modulares
│   └── runbooks/     → deploy, debug, onboarding, post-mortems
├── .claude/          → skills, commands, agents, hooks
└── memory/           → memória de longo prazo entre sessões
```

### Decisões arquiteturais críticas
- **Modelo de uso atual:** ferramenta para uso próprio do produtor inicialmente. Multi-tenancy, LGPD e termos de uso são "arquitetura não fecha porta", não escopo agora. Arquitetura preserva `property_id` e modelo de permissões para expansão futura sem reescrita.
- **Offline-first:** o mobile deve funcionar sem internet. Dados são gravados em SQLite local e sincronizados ao retornar à área com conexão. Toda feature deve ser projetada considerando esse cenário.
- **IA plugável:** a camada de IA em `src/ai/` expõe uma interface única (`AIProvider`). Cada provedor (Claude, OpenAI, Gemini) é um adapter. O provedor ativo é configurável por instalação/cliente — nunca hardcoded.
- **WhatsApp como interface do funcionário:** o funcionário não usa o app. A ordem do dia é enviada automaticamente ao grupo WhatsApp toda manhã via Evolution API.
- **Controle de acesso por módulo + cultura:** permissões são configuráveis por admin em dois eixos independentes — quais módulos o usuário acessa e quais culturas ele pode ver dentro desses módulos. Ver ADR-003.
- **Backup automático em Google Drive:** sistema faz backup periódico do banco completo + assets (áudios, fotos, PDFs de manuais) em Google Drive do produtor. Export manual disponível a qualquer momento.
- **Notificações urgentes configuráveis por tipo:** alertas críticos (sensor offline, manutenção atrasada, lote no fim da janela) podem ser entregues via push, e-mail ou WhatsApp. Configurável por tipo de alerta.

### Documentação de módulos
| Módulo | Descrição |
|---|---|
| `agenda` | Ordem do dia, priorização, visão de semanas/meses |
| `culturas` | Todas as culturas da propriedade — ciclos, lotes, timings, colheita, rastreamento. Filtráveis por cultura. Controle de acesso por cultura (ex: parceiros de meliponicultura acessam apenas abelhas) |
| `caderno-de-campo` | Registro do que foi feito. Tarefas concluídas viram entradas no caderno. Alimenta a memória de contexto da IA — fonte primária para inferir tarefas futuras, repetições, padrões sazonais, transporte, vendas |
| `mapa` | Representação geográfica da propriedade — talhões, estruturas, culturas, automações. Dashboard visual para leitura gerencial espacial |
| `manutencao` | Histórico de manutenções, alertas preventivos, lista de compras proativa |
| `financeiro` | Custos por ciclo/cultura, receitas, integração bancária (C6/Caixa), caminho para ciclo fiscal completo |
| `vendas` | Estoque disponível para venda, pedidos, relacionamento com clientes, apoio a e-commerce |
| `automacao` | Monitoramento e controle de irrigação, sensores climáticos, ambiente controlado (nebulizador, ar condicionado) |

## Code Conventions
- **Style:** Ruff (Python) + ESLint + Prettier (TypeScript)
- **Types:** obrigatório — Python com type hints completos, TypeScript strict mode
- **Commits:** Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`)
- **Commit body:** inclua `Não alterou:` listando arquivos/módulos intencionalmente não modificados
- **Branches:** `feature/`, `fix/`, `docs/`, `refactor/`
- **PRs:** sempre com descrição, referenciando PRD ou ADR quando aplicável
- **Idioma do código:** inglês (variáveis, funções, classes); português nos comentários quando necessário

## Commands

### Desenvolvimento
- `pnpm dev` → dev server frontend (PWA)
- `PYTHONUTF8=1 uv run uvicorn main:app --reload` → dev server backend (rodar dentro de `src/api/`)
- `pnpm test` → testes frontend (Vitest)
- `uv run pytest` → testes backend
- `pnpm lint` → lint + format frontend
- `uv run ruff check . && ruff format .` → lint + format backend

### Slash commands
- `/implement <PRD>` → implementar feature a partir de PRD (Plan Mode → código → testes → docs)
- `/ralph <PRD>` → modo persistência: não para até todos os critérios de aceite passarem
- `/debug <erro|arquivo>` → debugging sistemático: reproduzir → isolar → corrigir → verificar
- `/refactor <arquivo|módulo>` → refatoração segura com testes antes e depois
- `/clean [arquivo|dir]` → remover slop gerado por IA do código
- `/debt [dir]` → escanear dívida técnica, produzir relatório priorizado
- `/learn [--commits N]` → analisar trabalho recente, extrair padrões, melhorar skills
- `/deploy` → executar checklist de deploy
- `/memory <search|index|stats>` → operações de memória de longo prazo
- `/spec-review <path>` → auditoria multi-agente (segurança + qualidade + performance)

### Magic keywords
- "não para" / "ralph" / "keep going" → modo persistência
- "debug" / "por que está falhando" / "quebrado" → skill de debugging
- "refatorar" / "extrair" / "reestruturar" → skill de refatoração
- "dívida técnica" / "código sujo" → tech debt tracker
- "escreve PRD" / "escopo isso" → PRD writer
- "design de API" / "novo endpoint" → API designer
- "auditoria" / "revisão de segurança" → /spec-review

## Workflow Rules
- Sempre rodar testes antes de commitar
- Nunca commitar secrets — usar `.env` com `.env.example` documentado
- Toda UI segue o design system definido em `docs/specs/design-system/`
- Features com impacto offline precisam de teste explícito no cenário sem rede

### Documentação obrigatória por tipo de mudança
| O que mudou | O que atualizar |
|---|---|
| Nova feature ou módulo | CLAUDE.md (tabela de módulos) + README |
| Novas variáveis de ambiente | `.env.example` com defaults e comentários |
| Decisão arquitetural | ADR em `docs/architecture/` (próximo número sequencial) |
| Bug em produção | Post-mortem em `docs/runbooks/post-mortems/` |
| Insight de negócio durante implementação | Nota no PRD relevante em `docs/product/` |
| Mudança de API ou integração | Runbook em `docs/runbooks/` |
| Gotcha descoberto | Seção Gotchas neste arquivo |

### Prioridade de conflito em decisões
**Timing biológico > Dependência > Impacto financeiro**
Esse é o critério de priorização do agricultor — qualquer feature de agenda ou priorização deve respeitar essa ordem.

### Contexto (sessões longas)
- Aviso automático quando contexto está longo (50+ tool calls = aviso, 80+ = crítico)
- Antes de compactar: salvar contexto em `memory/compact-context.md`
- Notas de sessão: `memory/session-notes.md`
- Se `memory/compact-context.md` existir ao iniciar sessão, ler para restaurar contexto

## Design
**Opção C — Agent flow** (sem designer dedicado)
- Design tokens: `docs/specs/design-system/README.md`
- Componentes: Radix UI + Tailwind CSS
- `/implement` lê PRD + tokens → frontend agent gera UI
- Princípio: interface simples o suficiente para um agricultor sem familiaridade digital usar sem treinamento
- **Voz como entrada universal:** todo campo de texto deve suportar entrada por voz com transcrição automática. O agricultor trabalha com as mãos no campo — digitar é um obstáculo. Campos de texto sem suporte a voz são considerados incompletos.

## Modular Specifications

### Habilitadas
- [x] `ai-ml/` → provedor plugável, prompts, evals, guardrails agroecológicos
- [x] `api/` → contratos de API, endpoints, formato de erros, paginação
- [x] `data-architecture/` → modelagem de ciclos produtivos, lotes, séries temporais de sensores
- [x] `security/` → controle de acesso por módulo, autenticação, dados sensíveis
- [x] `testing-strategy/` → pirâmide de testes, cenários offline, cobertura mínima
- [x] `observability/` → logs, alertas de automação, monitoramento de sync
- [x] `devops/` → CI/CD, ambientes, deploy

### A avaliar no futuro
- [ ] `compliance/` → certificação orgânica, rastreabilidade, obrigações fiscais
- [ ] `scalability/` → quando escalar para múltiplas propriedades
- [ ] `i18n/` → se o produto escalar para outros países

## Model Presets
| Agente | Modelo | Por quê |
|---|---|---|
| Lead (você) | opus | Raciocínio complexo, arquitetura, código |
| `security-auditor` | opus | Análise de vulnerabilidades, controle de acesso por módulo |
| `quality-guardian` | sonnet | Checklists objetivos, feedback rápido |
| `performance-auditor` | sonnet | Queries N+1, sync offline, paginação |
| `agro-domain-auditor` | sonnet | Regras de negócio agrícolas, timing biológico, ciclos |

## Gotchas
- **Windows + FastAPI CLI:** `fastapi dev` falha com UnicodeEncodeError no Windows devido a emoji no output do rich. Usar sempre `PYTHONUTF8=1 uv run uvicorn main:app --reload` no lugar
- **Offline-first não é opcional:** toda feature nova deve ser testada sem conexão antes de ser considerada pronta
- **IA plugável:** nunca referenciar um provedor de IA diretamente fora de `src/ai/adapters/` — sempre usar a interface `AIProvider`
- **Timing biológico tem precedência absoluta:** nenhuma lógica de priorização deve inverter essa ordem sem decisão explícita documentada em ADR
- **WhatsApp é a interface do funcionário:** qualquer mudança no formato da ordem do dia precisa ser validada considerando leitura em dispositivo simples via WhatsApp
- **Módulos com acesso restrito:** o módulo `culturas` suporta filtro e permissão por cultura individual — ao criar features nesse módulo, garantir que o controle de acesso é aplicado por cultura, não apenas por módulo
- **Caderno de campo é fonte de memória:** toda tarefa concluída deve gerar um registro no caderno. Esse fluxo é crítico — é daí que a IA extrai padrões, datas de repetição, sazonalidade e contexto histórico

## Memory (L4)
Memória semântica de longo prazo para decisões, padrões e contexto entre sessões.
- Indexar: `python memory/index.py`
- Buscar: `python memory/query.py "consulta"`
- Incremental: `python memory/index.py --incremental`
- Config: `memory/config.yaml`
