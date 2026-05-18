# ADR-008: Estratégia de Testes

## Status
Accepted

## Context
O AgroecologIA tem características que tornam testes especialmente críticos:

1. **Algoritmo de priorização (ADR-001)** é o coração do produto. Bug aqui inverte a ordem do dia e quebra a confiança do agricultor.
2. **Sync offline (ADR-002)** envolve conflict resolution distribuído. Edge cases não testados podem causar perda silenciosa de dados.
3. **IA generativa em vários módulos** produz output não-determinístico. Testes unitários tradicionais não capturam regressão de qualidade.
4. **Controle de acesso por cultura (ADR-003)** é segurança crítica. Vazamento de dados de culturas restritas é falha grave.
5. **Integração bancária (ADR-005)** processa dados financeiros reais. Erros de classificação distorcem decisões estratégicas do produtor.

Sem uma estratégia clara, o esforço de testes se distribui mal: muito teste de coisas triviais, pouco teste das partes críticas.

## Decision

Adotar uma **pirâmide de testes assimétrica** com cobertura intencionalmente desigual — peso dimensionado pelo risco de cada camada, não pelo volume de código.

### Camadas de teste

```
                ┌──────────────────────┐
                │  Testes manuais       │  ← exploratórios, dogfooding
                │  (não automatizados)  │
                └──────────────────────┘
              ┌──────────────────────────┐
              │  Testes E2E              │  ← fluxos críticos do usuário
              │  (Playwright)            │     ~20 testes
              └──────────────────────────┘
            ┌────────────────────────────────┐
            │  Testes de integração          │  ← API + banco real
            │  (pytest + httpx)              │     ~80 testes
            └────────────────────────────────┘
          ┌──────────────────────────────────────┐
          │  Evals de IA (separados)              │  ← qualidade de output
          │  (suíte própria, roda menos frequente)│     ~50 evals
          └──────────────────────────────────────┘
        ┌──────────────────────────────────────────┐
        │  Testes unitários                          │  ← lógica determinística
        │  (pytest, vitest)                          │     ~500+ testes
        └──────────────────────────────────────────┘
```

### Metas de cobertura por camada

| Camada / Componente | Meta de cobertura |
|---|---|
| `app/services/prioritization.py` | **100% das linhas + 100% das condições de hierarquia** (não-negociável) |
| `app/services/sync/` (operation log, LWW) | **≥95% das linhas + edge cases enumerados explicitamente** |
| Camada de acesso a dados (controle por cultura) | **100% dos endpoints retornam apenas dados permitidos** (testes de segurança) |
| Pipeline de classificação financeira | **≥85% das linhas + suíte de evals** |
| Endpoints CRUD genéricos | **≥80% das linhas** |
| Componentes UI puramente visuais | **0% obrigatório** (testes manuais e E2E cobrem) |
| Adapters de IA (`src/ai/adapters/`) | **≥80% das linhas com mocks; evals separados validam qualidade** |
| Migrations de banco | **100% — toda migration deve ter teste de up + down** |

### Tipos de teste por categoria

#### Testes unitários
**Quando usar:** lógica pura, transformações, regras de negócio determinísticas.
**Stack:** `pytest` (backend), `vitest` (frontend).
**Princípio:** rápidos (<100ms cada), isolados, sem I/O.

Exemplos obrigatórios:
- Toda função em `app/services/` precisa de teste unitário
- Toda regra de validação de schemas Pydantic
- Toda transformação de dados (extrator de transações bancárias, parser de KML)
- Algoritmo de priorização (já existe — 28 testes)

#### Testes de integração
**Quando usar:** validar que múltiplos componentes funcionam juntos com banco real.
**Stack:** `pytest` + `httpx.AsyncClient` + SQLite em memória ou Postgres em Docker.
**Princípio:** testam um fluxo inteiro (request → DB → response).

Exemplos obrigatórios:
- Cada endpoint da API tem ao menos 3 testes: caminho feliz, caso de erro de validação, caso de erro de autorização
- Sync offline: criar operação local, sincronizar, validar estado no servidor
- Controle de acesso por cultura: usuário com filtro `[abelhas]` recebe apenas dados de abelhas em todos os endpoints

#### Testes E2E
**Quando usar:** validar fluxos críticos do usuário no produto inteiro (frontend + backend + banco).
**Stack:** Playwright.
**Princípio:** raros e caros — limitados a fluxos onde uma falha quebra o produto.

Lista fechada de fluxos E2E obrigatórios:
1. Sign-up → criar primeira tarefa por voz → ver na ordem do dia
2. Concluir tarefa → ver no caderno de campo automaticamente
3. Adiar tarefa com justificativa → ver reposicionamento
4. Trabalhar offline → criar 3 tarefas → reconectar → ver sincronização
5. Convidar usuário com filtro de cultura → ele vê apenas o filtro permitido
6. Importar histórico de 2024 → ver classificação por IA
7. Conectar Gmail → importar transações → ver classificação financeira
8. Configurar WhatsApp → enviar ordem do dia → confirmar recebimento

Não adicionar fluxos E2E sem ADR justificando.

#### Evals de IA
**Quando usar:** validar qualidade de output não-determinístico de modelos generativos.
**Stack:** suíte própria em `tests/evals/` que roda contra o `AIProvider` real (não mock).
**Princípio:** evals não são pass/fail — são scoring contínuo. Detectam regressão entre versões de modelo ou prompt.

Tipos de eval:
- **Classificação:** dados rotulados (transação → categoria, observação → cultura) com threshold de acurácia mínima
- **Extração estruturada:** "preciso aplicar calcário no talhão 1 sexta" deve gerar `{action: "aplicar_calcario", area: "talhao_1", date: "<próxima sexta>"}`
- **Geração de conteúdo:** rascunho de post para Instagram avaliado por: tom adequado, presença de informação correta de produto, ausência de claims falsos

Evals rodam:
- A cada PR que altera prompts ou troca de provedor de IA
- Semanalmente em CI para detectar drift do modelo
- Antes de toda publicação de versão

#### Testes manuais
**Quando usar:** UX, comportamento de UI complexa, validação de feeling.
**Stack:** checklist em `docs/runbooks/manual-testing.md`.
**Princípio:** documentados, repetíveis, mas não automatizados.

Exemplos:
- Voz no campo com vento e barulho de motor
- Performance percebida do app no celular antigo
- Legibilidade da interface sob sol forte

### Princípios de qualidade dos testes

**Testes não são código de teste — são especificação executável.**

1. **Nome do teste descreve o comportamento esperado, não o método chamado**
   - ✅ `test_completed_task_returns_negative_score`
   - ❌ `test_calculate_priority_score`

2. **Um teste = uma asserção lógica**
   - Múltiplos `assert` são OK quando representam a mesma asserção lógica composta. Asserções que validam coisas distintas devem ser testes separados.

3. **Setup compartilhado via fixtures, não via herança**
   - Fixtures pytest, hooks Vitest. Sem hierarquias profundas de classes de teste.

4. **Sem mocks de código próprio em testes de integração**
   - Mocks só para dependências externas (APIs de terceiros, sistemas de arquivos quando necessário). Mockar código próprio em integração mascara o que se quer testar.

5. **Testes flaky são bug — corrige ou deleta**
   - Sem `@retry` em CI. Teste flaky é incentivo para piorar a suíte. Se o teste depende de timing, refatorar para ser determinístico.

### CI/CD

**Pipeline padrão a cada push:**
1. Lint + format check (Ruff, ESLint, Prettier) — bloqueia se falhar
2. Testes unitários (paralelos) — bloqueia se falhar
3. Testes de integração — bloqueia se falhar
4. Build do frontend — bloqueia se falhar

**Pipeline em main / antes de release:**
5. Testes E2E (Playwright) — bloqueia release se falhar
6. Evals de IA — não bloqueia, mas reporta drift

**Tempo total alvo:** <5 minutos para o pipeline padrão. Acima disso, perde adoção.

### Cobertura como guarda, não como meta

Cobertura de linhas não é meta — é guarda. Definimos thresholds mínimos por componente crítico (tabela acima). Pull request que reduz cobertura abaixo do threshold é bloqueado.

Não buscamos 100% global porque:
- Componentes UI puramente visuais não compensam o esforço de testes unitários
- Código gerado por bibliotecas (migrations geradas pelo Alembic) não precisa ser testado
- Adapters de terceiros (SDK do banco, SDK da IA) são responsabilidade do fornecedor

## Alternatives considered

1. **TDD estrito (teste primeiro sempre)** — pros: força design testável; cons: dogmatismo prejudica iteração inicial onde a forma do código está sendo descoberta. Aceito para componentes com regra de negócio complexa (priorização, sync), opcional para outros.

2. **Cobertura global mínima de 90%** — pros: simples de comunicar; cons: incentiva testes triviais para inflar percentual sem valor real. Descartado.

3. **Testes E2E como camada principal** — pros: testam o produto como o usuário usa; cons: lentos, frágeis, caros de manter, feedback loop ruim. Descartado como camada principal — restritos a fluxos críticos.

4. **Sem evals de IA — confiar nos provedores** — pros: menos infraestrutura; cons: provedores mudam modelos sem aviso, qualidade pode degradar silenciosamente em produção. Descartado para casos de uso críticos (classificação financeira, geração de conteúdo).

5. **Pirâmide assimétrica (decisão atual)** — pros: cobertura desigual onde o risco é desigual, esforço alinhado com impacto; cons: requer disciplina para manter as metas por componente. Aceito.

## Consequences

- **Positivo:** o algoritmo de priorização tem cobertura quase total — bug crítico é improvável.
- **Positivo:** evals de IA detectam regressão de qualidade entre versões de modelo ou prompt — proteção contra "modelo mudou e ninguém percebeu".
- **Positivo:** testes E2E limitados mantêm pipeline rápido (<5 minutos) — feedback loop rápido sustenta cultura de testar antes de commitar.
- **Negativo:** criar e manter suíte de evals de IA é trabalho contínuo. Requer dataset de exemplos rotulados que precisa ser atualizado conforme o produto evolui.
- **Negativo:** componentes UI sem testes automatizados dependem de testes manuais — risco de regressão visual.
- **Risco:** se o produto escalar para múltiplos clientes, evals podem ficar caros (custo de tokens). Mitigação: rodar evals em modo determinístico com `temperature=0` quando possível, e amostragem em vez de suíte completa em CI semanal.

## Impact on specs

- **Testing-strategy spec** (`docs/specs/testing-strategy/README.md`): este ADR é a fonte. A spec deve ser atualizada para apontar para aqui.
- **CI/CD (DevOps spec):** pipeline precisa ser configurado conforme tempos e ordens descritos.
- **Observability:** métricas de qualidade dos testes (tempo, taxa de flaky, cobertura por componente) devem ser monitoradas em dashboard interno.
- **AI/ML spec:** evals de IA são uma seção mandatória — definir formato dos datasets de avaliação e thresholds de drift.
- **Module owners:** cada módulo deve manter sua própria suíte de testes nos thresholds definidos. Pull requests que reduzem cobertura abaixo do mínimo são bloqueados.

## References

- [[adr-001-algoritmo-priorizacao-agenda]] — score de priorização é o componente com maior exigência de cobertura
- [[adr-002-sync-offline]] — edge cases de sync precisam de cobertura explícita
- [[adr-010-implementacao-sync-offline]] — operation log exige ≥95% de cobertura
- [[adr-003-controle-acesso-por-cultura]] — teste de segurança obrigatório: filtro por cultura em todas as rotas
- [[adr-004-camada-ia-plugavel]] — evals de IA encaixam no pipeline como camada adicional
- [[adr-011-provedor-ia-capacity-planning]] — suíte de evals deve rodar em todos os provedores suportados
