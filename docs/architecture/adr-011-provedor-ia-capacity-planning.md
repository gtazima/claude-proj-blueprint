# ADR-011: Provedor de IA, Estratégia de Custo e Capacity Planning

## Status
Accepted

## Context
ADR-004 estabeleceu a **arquitetura plugável** da camada de IA — qualquer provedor pode ser configurado por instalação. Resta decidir:

1. Qual é o **provedor padrão sugerido** (configurável)?
2. Quais **modelos** específicos usar para cada caso de uso, em cada provedor suportado?
3. Como **dimensionar custo** de tokens — antes que vire surpresa de fatura?
4. Quais **guardrails de custo** implementar para o produto não consumir mais do que o esperado?

Restrições adicionais do projeto:

- **Fase atual: ferramenta para uso próprio** — escolha do provedor é prioritariamente dimensionada por **maior limite gratuito disponível**, com qualidade técnica suficiente para os casos de uso reais.
- **Fase futura (pós-construção pessoal): possível centralização paga** — quando o produto evoluir para distribuição comercial, é provável que o operador centralize as chamadas em um único provedor pago e processe centralmente em servidor próprio. A arquitetura precisa permitir essa transição sem retrabalho.
- **Provedor não pode ficar hardcoded** — escolha permanece configurável por instalação ao longo de toda a vida do produto.

O AgroecologIA usa IA em múltiplos pontos com perfis muito diferentes:

| Caso de uso | Frequência | Latência aceitável | Tokens típicos | Sensibilidade à qualidade |
|---|---|---|---|---|
| Criação de tarefa por linguagem natural | Alta (várias/dia) | <2s | ~500 input, ~200 output | Média |
| Classificação de transação bancária | Média (~10/dia) | <5s | ~1k input, ~50 output | **Alta** (decisão estratégica depende) |
| Sugestões a partir de observação no caderno | Alta | <10s | ~2k input, ~500 output | Alta |
| Geração de conteúdo para redes sociais (Vendas) | Baixa (~5/semana) | <30s | ~3k input, ~1k output | **Alta** (representa marca) |
| Transcrição de áudio | Alta | <5s | N/A (Whisper local ou API) | Alta |
| Embeddings (busca semântica caderno) | Alta (em background) | tolerante | ~1k tokens cada | N/A |
| Análise agroecológica (contexto técnico) | Baixa | <30s | ~5k input, ~2k output | **Crítica** (decisão de manejo) |

## Decision

### Filosofia da escolha de provedor

A camada de IA do AgroecologIA suporta **quatro provedores principais** como cidadãos de primeira classe, todos com adapter mantido ativamente:

1. **Anthropic Claude**
2. **Google Gemini**
3. **OpenAI**
4. **DeepSeek**

A escolha entre eles é **decisão de configuração por instalação**, não decisão de código. O produto trata todos com paridade — adapters seguem a mesma interface `AIProvider` (ADR-004).

**Princípio de seleção:**

- **Fase de construção pessoal (atual):** escolher o provedor com **maior limite gratuito disponível** que tenha qualidade técnica suficiente. Premissa: como uso individual, o volume está dentro de free tiers generosos da maioria dos provedores.
- **Fase de produto distribuído (futuro):** considerar **um único provedor pago** centralizado no servidor próprio do operador, com modelos dimensionados por caso de uso para otimizar custo. Pode ser qualquer um dos quatro listados — decisão dependente de pricing, qualidade e regulação à época.

### Provedor sugerido por padrão (configurável)

**Sugestão atual: configurar provedor com base no estado do mercado no momento da instalação.**

Cenário de mercado (referência — verificar antes de instalar):

- **Google Gemini (via AI Studio API):** historicamente o **maior free tier sustentado** entre os quatro — limites diários generosos para Gemini Flash, suficientes para a propriedade individual. Recomendação inicial em ausência de outro motivo.
- **DeepSeek:** **pricing pago mais agressivo do mercado** (frequentemente 10x mais barato que Claude/GPT-4). Em algumas janelas oferece uso gratuito off-peak. Excelente custo-benefício mesmo quando pago. **Preferência declarada do produtor para uso pessoal.**
- **Anthropic Claude:** créditos iniciais ($5 no signup), depois pago. Qualidade alta em PT-BR, prompt caching nativo, tool use maduro.
- **OpenAI:** créditos iniciais ($5 no signup), depois pago. Maduro, ecossistema amplo.

**Decisão prática para a instalação atual:**

A configuração padrão do produto vem com **DeepSeek** ativo, refletindo a preferência declarada do produtor. Caso o produtor opte por re-validar antes do primeiro uso, o checklist de onboarding pode oferecer comparação atualizada de free tiers.

**Importante:** este ADR não eternizar essa escolha — basta trocar o valor de `default_provider` em `config/ai.yaml` para mudar. O critério "maior free tier disponível" é volátil e deve ser re-checado a cada 6 meses.

### Detalhamento dos provedores

#### 1. Anthropic Claude

**Modelos disponíveis (referência):**
- `claude-haiku-4-5` — rápido, barato, bom para classificação
- `claude-sonnet-4-6` — equilibrado, recomendado para a maioria dos casos
- `claude-opus-4-7` — máxima qualidade, mais caro

**Característica diferencial:** **prompt caching** nativo reduz custo significativamente em prompts com system prompt longo repetitivo (classificação financeira, sugestões do caderno). Cache hit pode reduzir custo de input em até 90%.

**Janela de contexto:** 200k tokens — suporta system prompts extensos com contexto da propriedade sem fragmentação.

**Tool use:** maduro — útil para integração com APIs internas via IA.

**Política de retenção:** sem treinamento em dados de clientes API por padrão.

**Embeddings:** Anthropic não oferece embeddings próprios. Quando este provedor for o ativo, embeddings são delegados para **Voyage AI** (parceiro recomendado oficialmente).

**Free tier:** $5 de crédito ao signup, depois pago.

**Pricing de referência (verificar antes da instalação):**
- Sonnet 4.6: ~$3/M input, ~$15/M output
- Haiku 4.5: ~$1/M input, ~$5/M output
- Opus 4.7: ~$15/M input, ~$75/M output

**Modelos por caso de uso (quando Claude é o provedor ativo):**

| Caso de uso | Modelo | Justificativa |
|---|---|---|
| Criação de tarefa (extração estruturada) | `claude-haiku-4-5` | Simples + rápido + barato; classificação determinística não exige modelo grande |
| Classificação de transação bancária | `claude-haiku-4-5` | Idem; padrões repetitivos com prompt caching |
| Sugestões de ação a partir de observação | `claude-sonnet-4-6` | Requer raciocínio sobre contexto da propriedade |
| Geração de conteúdo para redes | `claude-sonnet-4-6` | Qualidade do texto importa para a marca |
| Análise agroecológica técnica | `claude-opus-4-7` | Decisão crítica; máxima qualidade |
| Embeddings | `voyage-3` (Voyage AI) | Anthropic não oferece embeddings; Voyage é parceiro recomendado |

#### 2. Google Gemini

**Modelos disponíveis (referência):**
- `gemini-2.0-flash` — rápido, barato, free tier generoso
- `gemini-1.5-pro` — equilibrado, free tier mais limitado
- `gemini-1.5-flash` — variação de Flash, com free tier de centenas a milhares de requests/dia

**Característica diferencial:** **maior free tier sustentado entre os quatro provedores** historicamente. Gemini Flash via AI Studio API permite ~1.500 requests/dia gratuitos. Gemini Pro tem free tier menor (~50/dia) mas suficiente para casos de uso de análise técnica esporádica.

**Janela de contexto:** 1M tokens em modelos Pro — significativamente maior que os concorrentes. Útil para casos com muito contexto histórico (caderno de campo extenso).

**Embeddings:** API nativa de embeddings com tier gratuito separado — `text-embedding-004` cobre o caso de uso da busca semântica do caderno.

**Política de retenção:** AI Studio API (free tier) **usa dados para melhorar serviços** por padrão. Vertex AI (pago) tem política mais restritiva. **Atenção:** para uso próprio na fase atual, o trade-off é aceitável; para distribuição comercial, migrar para Vertex AI ou outro provedor.

**Free tier:** generoso e sustentado.

**Pricing pago (verificar):**
- Gemini Flash: ~$0.075/M input, ~$0.30/M output
- Gemini Pro: ~$1.25/M input, ~$5/M output

**Modelos por caso de uso (quando Gemini é o provedor ativo):**

| Caso de uso | Modelo | Justificativa |
|---|---|---|
| Criação de tarefa | `gemini-2.0-flash` | Rápido, dentro de free tier |
| Classificação de transação | `gemini-2.0-flash` | Volume cabe no free tier |
| Sugestões do caderno | `gemini-1.5-pro` | Janela de contexto grande para histórico extenso |
| Geração de conteúdo | `gemini-1.5-pro` | Qualidade textual |
| Análise agroecológica | `gemini-1.5-pro` | Suficiente para análise técnica |
| Embeddings | `text-embedding-004` (Gemini) | Free tier nativo |

#### 3. OpenAI

**Modelos disponíveis (referência):**
- `gpt-4o-mini` — barato, rápido
- `gpt-4o` — equilibrado, qualidade alta
- `o1-preview` / `o3` — raciocínio profundo (quando disponível)

**Característica diferencial:** ecossistema mais amplo (Whisper API, DALL-E, embeddings, vision unificados). **Whisper API** da OpenAI é referência para transcrição de áudio em PT-BR — útil mesmo quando o provedor de chat não é OpenAI.

**Janela de contexto:** 128k tokens em GPT-4o.

**Tool use:** maduro, formato `function calling` é referência da indústria.

**Embeddings:** API nativa — `text-embedding-3-small` e `text-embedding-3-large`.

**Política de retenção:** API tier não usa dados de clientes para treinamento por padrão.

**Free tier:** $5 de crédito ao signup, depois pago.

**Pricing pago (verificar):**
- GPT-4o: ~$2.50/M input, ~$10/M output
- GPT-4o-mini: ~$0.15/M input, ~$0.60/M output
- text-embedding-3-small: ~$0.02/M tokens
- Whisper API: ~$0.006/min de áudio

**Modelos por caso de uso (quando OpenAI é o provedor ativo):**

| Caso de uso | Modelo | Justificativa |
|---|---|---|
| Criação de tarefa | `gpt-4o-mini` | Rápido e barato |
| Classificação de transação | `gpt-4o-mini` | Suficiente para padrões repetitivos |
| Sugestões do caderno | `gpt-4o` | Raciocínio sobre contexto |
| Geração de conteúdo | `gpt-4o` | Qualidade textual |
| Análise agroecológica | `gpt-4o` (ou `o3` quando disponível) | Análise complexa |
| Embeddings | `text-embedding-3-small` | Custo-benefício |
| Transcrição online | `whisper-1` | Referência em PT-BR |

#### 4. DeepSeek

**Modelos disponíveis (referência):**
- `deepseek-chat` (V3) — modelo de chat geral, custo agressivamente baixo
- `deepseek-reasoner` (R1) — modelo de raciocínio, comparável a o1 em benchmarks

**Característica diferencial:** **pricing extremamente agressivo** — frequentemente 1/10 do custo de Claude/GPT-4 para qualidade comparável em muitas tarefas. Off-peak (horário chinês 16:30–00:30 UTC) com descontos adicionais de até 75%.

**Janela de contexto:** 64k tokens (suficiente para a maioria dos casos do AgroecologIA).

**Tool use:** suportado, formato compatível com OpenAI function calling.

**Embeddings:** **não oferece embeddings nativamente** no momento. Quando este provedor for ativo, embeddings precisam ser delegados a outro provedor — sugestão: Voyage AI (mesmo modelo usado com Claude) ou Gemini text-embedding-004 (gratuito).

**Política de retenção:** API empresarial não usa dados para treinamento. **Atenção:** dados podem trafegar por servidores na China — para uso próprio é aceitável; para distribuição comercial avaliar implicações regulatórias (LGPD).

**Qualidade em PT-BR:** **boa, embora não no nível de Claude/GPT-4 em casos de raciocínio sutil.** Para casos de classificação e extração estruturada, funciona muito bem. Para geração de conteúdo de marca, requer review extra.

**Free tier:** historicamente ofereceu créditos iniciais e janelas de uso gratuito off-peak. Verificar estado atual no momento da instalação.

**Pricing pago (referência — verificar):**
- DeepSeek V3: ~$0.27/M input, ~$1.10/M output (off-peak: ~50% desses valores)
- DeepSeek R1: ~$0.55/M input, ~$2.19/M output

**Modelos por caso de uso (quando DeepSeek é o provedor ativo):**

| Caso de uso | Modelo | Justificativa |
|---|---|---|
| Criação de tarefa | `deepseek-chat` | Custo baixíssimo, qualidade adequada |
| Classificação de transação | `deepseek-chat` | Padrões repetitivos, custo é prioridade |
| Sugestões do caderno | `deepseek-chat` | Custo permite muitas chamadas |
| Geração de conteúdo | `deepseek-chat` | **Atenção:** revisar qualidade antes de publicação (PRD Vendas já exige aprovação humana — ADR-015) |
| Análise agroecológica | `deepseek-reasoner` | Raciocínio profundo para decisão técnica crítica |
| Embeddings | `voyage-3` ou `text-embedding-004` (Gemini) | DeepSeek não oferece embeddings |
| Transcrição online | `whisper-1` (OpenAI API) ou Whisper local | DeepSeek não oferece transcrição |

### Adapters implementados

```
src/ai/adapters/
├── claude.py        → Anthropic Claude (completion + stream + tool use + prompt caching)
├── gemini.py        → Google Gemini (completion + stream + embeddings nativos)
├── openai.py        → OpenAI (completion + stream + embeddings + Whisper)
├── deepseek.py      → DeepSeek (completion + stream + tool use)
├── voyage.py        → Voyage AI (apenas embeddings — fallback quando provedor ativo não oferece)
└── whisper_local.py → Whisper local (offline, transcrição de áudio)
```

Cada adapter implementa a interface `AIProvider` do ADR-004. Provedor sem suporte nativo a embeddings ou transcrição delega automaticamente para `voyage.py` (embeddings) ou `whisper_local.py` (transcrição offline) ou `openai.py` adapter dedicado a Whisper API (transcrição online).

### Configuração

```yaml
# config/ai.yaml — exemplo de configuração da instalação
default_provider: deepseek      # configurável: claude | gemini | openai | deepseek
fallback_provider: gemini        # usado quando default falha por timeout/erro

providers:
  claude:
    api_key: ${CLAUDE_API_KEY}
    enabled: false               # ativado quando o usuário escolher trocar
    
  gemini:
    api_key: ${GEMINI_API_KEY}
    enabled: true
    use_for:
      - embeddings               # mesmo quando outro provedor é o default
      
  openai:
    api_key: ${OPENAI_API_KEY}
    enabled: true
    use_for:
      - audio_transcription_online  # Whisper API
      
  deepseek:
    api_key: ${DEEPSEEK_API_KEY}
    enabled: true
    base_url: https://api.deepseek.com
    
  voyage:
    api_key: ${VOYAGE_API_KEY}
    enabled: false               # ativado quando default for Claude e quiser usar Voyage para embeddings

# Configuração por caso de uso
use_cases:
  task_creation:
    provider: ${default_provider}
    model: auto                  # cada adapter escolhe o modelo apropriado
    
  banking_classification:
    provider: ${default_provider}
    model: auto
    
  field_note_suggestions:
    provider: ${default_provider}
    model: auto
    
  content_generation:
    provider: ${default_provider}
    model: auto
    require_human_approval: true
    
  technical_analysis:
    provider: ${default_provider}
    model: auto                  # adapter escolhe modelo "premium" do provedor
    
  embeddings:
    provider: gemini             # default — Gemini tem embedding gratuito de qualidade
    model: text-embedding-004
    
  audio_transcription:
    online: openai               # Whisper API
    offline: whisper_local
```

### Capacity planning — estimativa de custo

Estimativa baseada em **um produtor ativo** (uso real, não teórico):

**Volume estimado por mês (single user, propriedade ativa):**

| Caso de uso | Chamadas/mês | Tokens médios (in+out) | Total mensal (tokens) |
|---|---|---|---|
| Criação de tarefa | ~150 | 700 | 105k |
| Classificação bancária | ~300 | 1.050 | 315k |
| Sugestões do caderno | ~200 | 2.500 | 500k |
| Geração de conteúdo | ~20 | 4.000 | 80k |
| Análise técnica | ~10 | 7.000 | 70k |
| Embeddings | ~600 | 1.000 | 600k |
| **TOTAL** | **~1.280** | — | **~1.67M tokens/mês** |

**Estimativa de custo mensal por provedor (uso ativo):**

| Provedor | Custo mensal estimado | Observação |
|---|---|---|
| **DeepSeek** | **~$1-3/mês** (off-peak: ~$0.50-1.50) | Mais barato; off-peak desconta ~50% |
| **Gemini** | **$0/mês** se cabe no free tier; ~$2-5/mês acima | Pode ser zero para uso individual |
| **Claude** | **~$10-15/mês** | Com prompt caching (~60% de cache hit) |
| **OpenAI** | **~$8-12/mês** | Sem prompt caching nativo, GPT-4o-mini ajuda |

**Atenção:** estimativas são aproximadas e variam +/- 50% nos primeiros meses. Validar com monitoramento real após 30 dias de uso.

Detalhamento por componente do total (referência Claude):
- Modelos pequenos (Haiku) para tarefas frequentes: ~$2-3/mês
- Sonnet para sugestões e geração: ~$5-7/mês
- Opus para análise crítica (10 chamadas/mês): ~$2-3/mês
- Embeddings via Voyage: ~$0.10-0.50/mês
- Whisper: $0 (offline) ou ~$1-2/mês (online)

**Atenção:** estimativa baseada em uso ativo intenso. Uso esporádico fica em $1-3/mês mesmo com Claude.

### Guardrails de custo

Implementação obrigatória **antes** de habilitar IA em produção, **independente do provedor escolhido**:

#### 1. Limite duro por usuário (`user_token_quota`)

```yaml
quotas:
  default_user:
    daily_tokens: 200000        # ~$1-2/dia em modelos médios (referência Claude)
    monthly_tokens: 3000000     # margem 2x sobre estimativa
    burst_calls_per_minute: 60  # rate limit de proteção contra loops
```

Quando o limite é atingido, requests retornam erro estruturado e o usuário vê banner: "Limite de IA atingido — funcionalidades limitadas até amanhã. Aumentar o limite em Configurações."

Quotas são em **tokens**, não em dólares — independente do provedor escolhido. Cliente que usa DeepSeek pode ter quota maior que cliente que usa Claude para o mesmo orçamento mensal, mas isso é decisão de configuração da instalação, não de código.

#### 2. Quota por caso de uso

Distribuição da quota total para evitar que um caso de uso mal comportado consuma tudo:

```yaml
use_case_limits:
  task_creation: 30%      # criação de tarefa não pode consumir mais de 30% da quota
  banking_classification: 30%
  field_note_suggestions: 25%
  content_generation: 10%
  technical_analysis: 5%
```

#### 3. Cache obrigatório quando o provedor suporta

Provedores com prompt caching nativo (Claude) devem usar para system prompts >500 tokens. Provedores sem cache nativo (DeepSeek, OpenAI sem cached completions, Gemini) usam estratégia alternativa: caching no servidor de aplicação para deduplicar inputs idênticos em janela curta.

#### 4. Timeout agressivo

Cada chamada à API tem timeout de **30 segundos**. Após isso, falha imediatamente — sem retry automático no MVP. Retry com backoff é responsabilidade da camada de aplicação quando o caso de uso justifica.

#### 5. Fallback de provedor

Se o provedor padrão falhar (timeout, erro 5xx, rate limit), o adapter automaticamente tenta com o `fallback_provider` configurado. Isso garante resiliência sem perda de funcionalidade. O usuário não percebe a troca, mas a métrica é registrada.

#### 6. Fallback para modelo menor em caso de quota

Se o usuário atingiu 80% da quota mensal, casos de uso com modelo "premium" do provedor caem automaticamente para o modelo "econômico" do mesmo provedor (ex: Claude Sonnet → Haiku, Gemini Pro → Flash, GPT-4o → 4o-mini, DeepSeek R1 → V3). Indicador visual "modo economia ativo".

#### 7. Modo offline assumido

Cada caso de uso DEVE definir comportamento offline (sem IA). Exemplo: criação de tarefa por voz offline → grava texto literal sem extração estruturada; processa quando conectar.

### Monitoramento de custo

Dashboard interno (em `observability/`) com métricas em tempo real:

- Tokens consumidos por usuário (diário, mensal) — segregado por provedor
- Cost-per-call por caso de uso (média e p95) — segregado por provedor
- Cache hit rate por caso de uso (quando aplicável)
- Latência por caso de uso (p50, p95, p99) — segregado por provedor
- Taxa de erro por provedor
- Eventos de fallback de provedor (quantas vezes default falhou)

Alertas:
- Cost burn rate > 2x do esperado (alerta verde, requer investigação)
- Cost burn rate > 5x do esperado (alerta vermelho, congela IA até investigação)
- Cache hit rate < 30% por mais de 24h (otimizar prompts) — apenas para provedores com cache nativo
- Taxa de fallback > 5% (provedor padrão instável — considerar troca permanente)

### Estratégia de troca de provedor

ADR-004 suporta troca via configuração. Critérios para considerar troca do padrão:

- **Aumento de preço >50%** — avaliar alternativas
- **Free tier reduzido ou eliminado** — o provedor não é mais "the one with biggest free tier" e merece reavaliação
- **Qualidade degrada em eval contínuo** — investigar e migrar caso de uso afetado
- **Latência piora consistentemente** — testar alternativas
- **Bloqueio regional ou regulatório** — fallback para provedor com presença local

A troca **deve ser precedida de execução da suíte de evals (ADR-008)** contra o novo provedor para validar qualidade. Estimar 1-2 semanas de trabalho para migração de provedor padrão, principalmente porque prompts costumam precisar de pequenos ajustes para cada modelo.

### Caminho para fase futura (centralização paga)

Quando o produto evoluir da fase de uso pessoal para distribuição comercial, é provável que:

1. **Operador centraliza chamadas em um único provedor pago** no servidor próprio
2. **Modelos são dimensionados por caso de uso** para otimizar custo (Haiku/Flash/4o-mini para tarefas frequentes; Sonnet/Pro/4o para casos complexos)
3. **Free tiers deixam de ser critério dominante** — qualidade, latência e custo total dominam a decisão

A arquitetura plugável (ADR-004) e este ADR já preparam o terreno para essa transição. **Nenhum código de negócio precisa ser alterado** — apenas a configuração `default_provider` e os adapters envolvidos.

## Alternatives considered

1. **Provedor único hardcoded (sem plugabilidade)** — pros: simplicidade extrema; cons: viola decisão da revisão (camada plugável é princípio do produto, não decisão a ser revertida). Descartado.

2. **Apenas Claude como provedor de primeira classe** — pros: foco, prompt caching otimizado, qualidade superior em PT-BR; cons: free tier limitado para fase de construção pessoal, força custo desde o dia 1. Descartado a favor de igual cidadania entre os quatro.

3. **Apenas DeepSeek como provedor de primeira classe** — pros: custo mínimo, alinhado com preferência declarada do produtor; cons: dependência forte de provedor de país com regulação volátil, ausência de embeddings/transcrição força sempre fallback. Descartado a favor de igual cidadania.

4. **Apenas Gemini como provedor padrão por causa do free tier** — pros: zero custo para uso individual; cons: política de retenção do AI Studio (free tier) não é ideal para distribuição comercial futura. Descartado como **único** padrão; aceito como **opção forte** entre as quatro.

5. **Mix automático por caso de uso entre múltiplos provedores** — pros: máxima otimização de custo/qualidade; cons: complexidade operacional alta (manter prompts ajustados para cada provedor em cada caso de uso). Aceito **parcialmente** — embeddings e transcrição podem usar provedor diferente do default; mas casos de uso de chat usam o default.

6. **Quatro provedores como cidadãos de primeira classe + escolha por configuração (decisão atual)** — pros: flexibilidade total, alinha com fase de construção pessoal e fase comercial futura, permite escolher por critério dominante (free tier, custo, qualidade) sem retrabalho de código; cons: mais código de adapter para manter, evals precisam rodar em todos os provedores suportados. Aceito.

## Consequences

- **Positivo:** o produtor pode usar DeepSeek (preferência declarada) ou Gemini (free tier alto) na fase atual sem fricção, e migrar para Claude/OpenAI na fase comercial sem mudança de código.
- **Positivo:** dependência crítica é mitigada — qualquer um dos quatro pode ser default, troca é configuração.
- **Positivo:** custo na fase pessoal pode ser <$5/mês ou até zero, dependendo da escolha (DeepSeek off-peak ou Gemini free tier).
- **Negativo:** quatro adapters significam quatro caminhos de manutenção — mudanças de API de qualquer provedor requerem ajuste.
- **Negativo:** evals (ADR-008) precisam rodar em todos os provedores suportados para garantir paridade de qualidade — custo de manutenção da suíte de testes cresce.
- **Risco:** prompts otimizados para um provedor podem performar pior em outro (cada modelo tem suas preferências). Mitigação: evals adversariais por provedor detectam regressão; ajustes por provedor podem ser feitos via prompts específicos no adapter (último recurso).
- **Risco:** free tiers mudam frequentemente — DeepSeek pode reduzir, Gemini pode endurecer política. Mitigação: revisão semestral deste ADR.

## Impact on specs

- **AI/ML spec** (`docs/specs/ai-ml/README.md`): este ADR é a fonte de configuração padrão. Spec deve detalhar: prompt templates por caso de uso e por provedor, configuração de cache (quando aplicável), configuração de quotas, fallbacks offline.
- **Observability:** dashboard de custo de IA é métrica crítica de produto. Implementar antes de habilitar IA em produção. Métricas devem segregar por provedor.
- **Onboarding (feat-onboarding.md):** fluxo de primeira instalação pode oferecer escolha de provedor com comparação atualizada de free tiers (opcional — default `deepseek` é aceitável).
- **Caderno de Campo (feat-caderno-de-campo.md):** AC-9 (sugestões em até 10 segundos) depende do dimensionamento correto do modelo por provedor. Testar com prompts reais antes de finalizar.
- **Vendas (feat-vendas.md):** geração de conteúdo é caso de uso de qualidade alta. Quando provedor é DeepSeek, garantir que ADR-015 (moderação) está ativo — qualidade pode ser inferior em casos de marketing comparado a Claude/GPT-4.
- **Testing strategy (ADR-008):** suíte de evals deve rodar em todos os provedores suportados. Modelo de "provider matrix" no CI.

## References

- [[adr-004-camada-ia-plugavel]] — arquitetura que este ADR especializa (interface AIProvider + adapters)
- [[adr-008-estrategia-de-testes]] — evals de IA dependem das definições aqui; suíte deve rodar em todos os provedores
- [[adr-015-moderacao-conteudo-ia]] — moderação aplicável a todos os provedores, especialmente DeepSeek em conteúdo de marketing
- [[feat-caderno-de-campo]] — AC-9 (sugestões em ≤10s) depende do dimensionamento correto por provedor
- [[feat-vendas]] — geração de conteúdo: qualidade varia por provedor; moderação obrigatória
