# ADR-004: Camada de IA Plugável

## Status
Accepted

## Context
A IA é usada em múltiplos módulos do AgroecologIA com finalidades distintas:
- **Agenda:** interpretar linguagem natural para criar tarefas
- **Caderno de Campo:** transcrição de áudio, categorização de observações, geração de sugestões de ação
- **Culturas:** inferência de padrões sazonais a partir do histórico
- **Financeiro:** classificação automática de transações bancárias
- **Vendas:** geração de conteúdo para redes sociais e rascunhos de mensagens
- **Automação:** interpretação de comandos de voz para controle de dispositivos

Por decisão de produto, o provedor de IA deve ser **configurável por instalação** — diferentes clientes podem ter preferências ou restrições diferentes (Claude, OpenAI, Gemini, modelos locais). Nenhum módulo pode depender diretamente de um provedor específico.

Adicionalmente, alguns casos de uso requerem IA offline (transcrição de áudio no campo sem internet), o que exige suporte a modelos locais leves além de APIs de nuvem.

## Decision

Implementar uma **camada de abstração de IA** em `src/ai/` com interface única `AIProvider` e adapters por provedor. Cada módulo usa exclusivamente a interface — nunca importa um SDK de provedor diretamente.

### Interface AIProvider

```python
# src/ai/provider.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator

@dataclass
class AIMessage:
    role: str  # "user" | "assistant" | "system"
    content: str

@dataclass 
class AIResponse:
    content: str
    model: str
    input_tokens: int
    output_tokens: int
    cached_tokens: int  # para provedores com prompt caching

class AIProvider(ABC):
    
    @abstractmethod
    async def complete(
        self,
        messages: list[AIMessage],
        system: str | None = None,
        max_tokens: int = 1024,
        **kwargs
    ) -> AIResponse: ...

    @abstractmethod
    async def stream(
        self,
        messages: list[AIMessage],
        system: str | None = None,
        max_tokens: int = 1024,
        **kwargs
    ) -> AsyncIterator[str]: ...
    
    @abstractmethod
    async def embed(
        self,
        text: str
    ) -> list[float]: ...
    
    @property
    @abstractmethod
    def supports_offline(self) -> bool: ...
    
    @property
    @abstractmethod
    def supports_audio_transcription(self) -> bool: ...
    
    @abstractmethod
    async def transcribe_audio(
        self,
        audio_bytes: bytes,
        language: str = "pt"
    ) -> str: ...
```

### Adapters implementados no MVP

```
src/ai/adapters/
├── claude.py        → Anthropic Claude (completion + stream + tool use + prompt caching)
├── gemini.py        → Google Gemini (completion + stream + embeddings nativos)
├── openai.py        → OpenAI (completion + stream + embeddings + Whisper API)
├── deepseek.py      → DeepSeek (completion + stream + tool use)
├── voyage.py        → Voyage AI (apenas embeddings — fallback)
└── whisper_local.py → Whisper local (offline, apenas transcrição de áudio)
```

**Os quatro provedores principais (Claude, Gemini, OpenAI, DeepSeek) são cidadãos de primeira classe** — adapters mantidos ativamente, sem hierarquia de "principal e alternativos". A escolha do provedor ativo é decisão de configuração da instalação (ver ADR-011).

**Provedores sem suporte nativo a embeddings** (Claude, DeepSeek) delegam automaticamente para Voyage AI ou Gemini text-embedding-004 conforme configuração. **Provedores sem suporte a transcrição de áudio** delegam para Whisper local (offline) ou OpenAI Whisper API (online).

### Provedor padrão e configuração

O provedor ativo é definido por configuração da instalação, não por código:

```yaml
# config/ai.yaml (por instalação)
default_provider: claude

providers:
  claude:
    api_key: ${CLAUDE_API_KEY}
    model: claude-sonnet-4-6
    
  openai:
    api_key: ${OPENAI_API_KEY}
    model: gpt-4o
    
  gemini:
    api_key: ${GEMINI_API_KEY}
    model: gemini-1.5-pro

# Provedor offline para casos sem internet
offline_provider: whisper_local
offline_model_path: models/whisper-base-pt.bin
```

### Casos de uso especializados

Nem todo caso de uso usa o mesmo provedor. O sistema suporta override por caso de uso:

```yaml
use_cases:
  audio_transcription:
    online: claude       # usa API do provedor padrão quando online
    offline: whisper_local  # modelo local quando sem internet
    
  embeddings:
    provider: voyage     # Anthropic não oferece embeddings — usar Voyage AI (parceiro recomendado)
    
  content_generation:   # geração de conteúdo para vendas
    provider: claude     # pode ser sobrescrito pelo cliente
```

### Prompt caching

Para provedores que suportam prompt caching (Claude), o sistema deve aproveitar o cache em prompts longos e repetitivos:

- System prompts com contexto da propriedade (culturas, ciclos, histórico) são marcados para cache
- Prompts de classificação financeira (contexto de categorias + histórico de transações) são cacheados
- O campo `cached_tokens` em `AIResponse` é logado para monitorar eficiência do cache

### Uso nos módulos

```python
# Correto — usando a interface
from src.ai import get_provider

provider = get_provider()
response = await provider.complete(messages=[...], system="...")

# Errado — nunca fazer isso fora de src/ai/adapters/
import anthropic
client = anthropic.Anthropic()
```

A factory `get_provider()` lê a configuração da instalação e retorna o adapter correto. Módulos nunca instanciam providers diretamente.

### Fallback offline

Quando o provedor padrão está indisponível (sem internet ou falha de API):

1. Para transcrição de áudio: usa `whisper_local` automaticamente
2. Para outros casos de uso: enfileira a operação com status `pending_ai` e processa quando a conexão retornar
3. O usuário vê indicador "processamento de IA pendente" — a entrada é salva normalmente, as sugestões chegam depois

## Alternatives considered

1. **Hardcodar Claude em todos os módulos** — pros: simples, sem abstração; cons: inviabiliza clientes com outros provedores, cria acoplamento que torna migration custosa. Descartado.

2. **LangChain ou LlamaIndex como framework de abstração** — pros: abstrações prontas, ferramentas de chain e RAG; cons: dependência de framework pesado, overhead de aprendizado, atualizações do framework podem quebrar o produto, abstrações de nível errado para o caso de uso. Descartado.

3. **Abstração própria com interface mínima (decisão atual)** — pros: sem dependências externas além dos SDKs de cada provedor, interface exatamente do tamanho necessário, fácil de adicionar novos provedores; cons: precisamos manter os adapters atualizados com mudanças de API dos provedores. Aceito — o custo de manutenção é baixo comparado ao benefício.

4. **Arquitetura de plugins com descoberta dinâmica** — pros: terceiros poderiam criar adapters; cons: complexidade excessiva para o estágio atual do produto. Pode ser considerado quando o produto escalar.

## Consequences

- **Positivo:** trocar de provedor de IA é mudança de configuração, não de código.
- **Positivo:** diferentes clientes podem usar diferentes provedores sem nenhuma customização no produto.
- **Positivo:** modelo offline de transcrição garante funcionamento no campo sem internet.
- **Negativo:** cada novo provedor requer implementação de um adapter. Manter adapters sincronizados com mudanças de API dos provedores é trabalho contínuo.
- **Negativo:** modelo Whisper local para transcrição PT-BR precisa ser baixado na primeira instalação (~150MB para whisper-base). Requer UX adequado de onboarding.
- **Risco:** diferenças de capacidade entre provedores (ex: Claude é melhor em português que alguns concorrentes) podem resultar em qualidade diferente por cliente. Documentar as diferenças conhecidas por caso de uso.

## Impact on specs

- **AI/ML:** esta ADR é a base de toda a camada de IA. Evals de qualidade devem ser executados por provedor — não assumir que todos os provedores têm a mesma performance nos casos de uso do produto.
- **Security:** API keys dos provedores nunca em código — sempre via variáveis de ambiente. Rotação de keys não deve exigir redeploy.
- **Observability:** logar por chamada: provedor usado, modelo, tokens consumidos (input/output/cached), latência e caso de uso. Métricas essenciais para controle de custo e diagnóstico de qualidade.
- **Scalability:** prompt caching reduz custo significativamente em prompts com contexto longo repetitivo (classificação financeira, sugestões do caderno de campo). Monitorar cache hit rate.
- **Caderno de Campo:** pipeline de processamento de observações usa esta camada. AC-9 depende deste ADR.
- **Financeiro:** classificação de transações usa esta camada. AC-5 e AC-7 dependem deste ADR.
- **Vendas:** geração de conteúdo usa esta camada. AC-8 a AC-12 dependem deste ADR.

## References

- [[adr-011-provedor-ia-capacity-planning]] — provedor default atual (DeepSeek), custo/usuário, capacity planning
- [[feat-caderno-de-campo]] — pipeline de processamento usa esta camada (AC-9)
- [[feat-financeiro]] — classificação de transações (AC-5 e AC-7)
- [[feat-vendas]] — geração de conteúdo (AC-8 a AC-12)
- [[feat-agenda]] — criação de tarefa por linguagem natural
