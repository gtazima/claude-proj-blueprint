# ADR-015: Moderação e Guardrails de Conteúdo Gerado por IA

## Status
Accepted

## Context
O módulo Vendas (PRD `feat-vendas.md`) gera conteúdo destinado a publicação externa: posts para Instagram, mensagens para grupos de clientes no WhatsApp, anúncios em marketplaces. Esse conteúdo representa a marca da propriedade.

Sem guardrails, riscos concretos:

1. **Claims falsos de produto** — IA inventa propriedades terapêuticas de óleos essenciais ou benefícios não comprovados
2. **Propaganda enganosa** — preço, quantidade, prazo de validade incorretos
3. **Tom inadequado** — estilo destoa da marca pretendida (premium, agroecológico)
4. **Linguagem problemática** — termos discriminatórios, ofensivos, ou que violem políticas das plataformas
5. **Informação desatualizada** — IA usa dados antigos por falta de contexto fresco
6. **Promessas que não podem ser cumpridas** — entrega rápida, garantias, certificações que a propriedade não tem

Adicionalmente, a IA também gera **conteúdo interno** (sugestões de manejo, classificação de transações, processamento de observações). Os riscos aqui são diferentes mas igualmente reais — sugestão errada de manejo pode causar prejuízo agronômico real.

ADR-004 estabeleceu a camada de IA plugável e ADR-011 definiu o provedor padrão. Este ADR foca no que vem **depois** da chamada à IA: validação, moderação, fallback.

## Decision

Implementar **três camadas de moderação** complementares:

1. **Pré-prompt (antes da chamada)** — guardrails no system prompt para guiar o modelo
2. **Pós-resposta (após a chamada)** — validação programática do output antes de apresentar ao usuário
3. **Aprovação humana (antes da publicação externa)** — usuário confirma todo conteúdo destinado ao público

### Camada 1: Pré-prompt — System Prompts com guardrails

Todo prompt de geração de conteúdo destinado a público externo inclui seção de guardrails obrigatória:

```
[CONTEXTO]
Você está gerando [tipo de conteúdo] para a propriedade [nome].
Filosofia da propriedade: agroecológica, produção pequena, alta qualidade.

[REGRAS INVIOLÁVEIS — LEIA COM ATENÇÃO]
1. NUNCA invente propriedades terapêuticas, medicinais ou de cura para nenhum produto.
   Use apenas as descrições verificadas listadas em [PRODUTOS].
2. NUNCA prometa prazos de entrega, garantias ou certificações que não estão em [CERTIFICACOES].
3. NUNCA use claims absolutos ("o melhor", "100% garantido", "cura de", "previne X").
4. NUNCA use preços diferentes dos listados em [PRECOS_VIGENTES].
5. NUNCA escreva conteúdo discriminatório, ofensivo ou político-partidário.
6. Se em dúvida sobre um fato específico, NÃO invente — escreva [REVISAR] no lugar.

[INFORMACOES VERIFICADAS]
Produtos: ...
Preços vigentes: ...
Certificações: ...
Estoque atual: ...
```

System prompts ficam em arquivos versionados (`src/api/app/services/ai/prompts/`) — toda mudança passa por code review.

### Camada 2: Pós-resposta — Validação programática

Após receber a resposta do modelo, validações automáticas antes de exibir ao usuário:

#### 2a. Detecção de claims problemáticos

Lista de termos vermelhos que disparam revisão obrigatória:

```python
RED_FLAG_PATTERNS = [
    # Saúde/cura
    r"\bcura\b", r"\bmedicinal\b", r"\bterapêutico\b",
    r"\btrata\b", r"\bprevine\b",
    # Claims absolutos
    r"\b100%\b", r"\bmelhor (do mercado|do mundo)\b",
    r"\búnico\b", r"\bgarantido\b",
    # Político-partidário
    r"\b(esquerda|direita)\b", r"\b(bolsonaro|lula)\b",
]
```

Conteúdo que casa com qualquer padrão é marcado com `requires_review = true` e exibido ao usuário com destaque visual antes de poder ser copiado/publicado.

#### 2b. Verificação de informação factual

Para conteúdo de Vendas:
- Preços mencionados são comparados com `PRECOS_VIGENTES` — discrepância → bloqueio com mensagem "preço não confere"
- Produtos mencionados devem existir em `PRODUTOS_DISPONIVEIS` — produto inventado → bloqueio
- Quantidades mencionadas não podem exceder estoque disponível

Para conteúdo interno:
- Sugestões de manejo que mencionam produtos químicos sintéticos disparam alerta extra (filosofia agroecológica do produto)
- Sugestões com prazos contraditórios ao histórico (ex: "aplicar X em 5 dias" quando ciclo da cultura é de 30 dias) → confirmação obrigatória

#### 2c. Marcador `[REVISAR]`

Quando o modelo encontra incerteza factual e seguiu a instrução de não inventar (regra 6 do system prompt), escreve `[REVISAR]` no lugar do dado. A presença desse marcador na resposta:
- Bloqueia copy direto
- Destaca os trechos para o usuário preencher manualmente
- Não conta como falha do modelo — é comportamento desejado

### Camada 3: Aprovação humana

Para qualquer conteúdo destinado a público externo (módulo Vendas), o fluxo é **sempre**:

```
IA gera rascunho → Usuário revisa → Usuário edita (opcional) → Usuário copia/exporta
```

**Nunca há postagem automática direta em redes sociais sem aprovação explícita do usuário.** Mesmo se o produto for evoluir para postagem automatizada via API (Instagram Graph API, etc.), a aprovação prévia é mandatória.

Isso é decisão de produto, não apenas técnica — está documentado no PRD da Vendas como princípio (PRD AC-10, "Not Doing").

### Caso especial: classificação financeira

Diferente de geração de conteúdo, classificação financeira (ADR-005) é **decisão estruturada** com confidence score do modelo. Estratégia:

- **Confidence ≥ 90%:** classificação aplicada automaticamente
- **Confidence 70-90%:** classificação aplicada mas marcada como "verificar"
- **Confidence < 70%:** classificação fica pendente, exige decisão do usuário antes de aplicar

Confidence é parte do output estruturado pedido ao modelo. Pode ser gerado pelo próprio modelo (ele se auto-avalia) ou inferido de logprobs quando disponível.

### Auditoria de outputs problemáticos

Toda detecção de red flag ou bloqueio é registrada em `ai_moderation_log`:

```sql
CREATE TABLE ai_moderation_log (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    use_case TEXT NOT NULL,
    flagged_content TEXT NOT NULL,
    flag_type TEXT NOT NULL,        -- "red_flag_pattern" | "factual_mismatch" | "review_marker"
    flag_details JSONB,
    user_action TEXT,                -- "kept" | "edited" | "discarded"
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

Análise periódica deste log identifica:
- Padrões recorrentes que justificam atualização do system prompt
- Casos onde o modelo está sistematicamente errando
- Ajustes necessários nos red flag patterns (false positives, false negatives)

### Não é objetivo deste ADR

- **Garantir que a IA nunca gere texto problemático** — isso é impossível com modelos generativos. O objetivo é detectar antes da publicação.
- **Substituir avaliação humana** — o usuário continua sendo o último filtro para conteúdo público.
- **Cobrir todos os casos de viés possíveis** — moderação se concentra nos riscos identificados para o domínio agrícola/comercial.

## Alternatives considered

1. **Sem guardrails — confiar no modelo** — pros: menos código, menos atrito; cons: modelos generativos alucinam; risco real de claims falsos sobre produtos é inaceitável. Descartado.

2. **Apenas system prompt restritivo** — pros: simples; cons: modelos não seguem perfeitamente system prompts, especialmente com poucos shots de exemplo; precisamos de validação programática complementar. Aceito como camada 1, mas insuficiente sozinha.

3. **Aprovação humana sem moderação programática** — pros: simples, usuário decide; cons: usuário cansado pode aprovar conteúdo problemático sem perceber; sem amplificação automática dos red flags. Descartado como única camada.

4. **Classificador externo de toxicidade (ex: Perspective API, OpenAI Moderation)** — pros: detecta linguagem problemática genérica; cons: não detecta claims falsos sobre produtos específicos da propriedade; adiciona dependência externa e custo. **Considerado para o futuro** se o produto escalar; não no MVP.

5. **Três camadas: prompt + validação programática + aprovação humana (decisão atual)** — pros: defesa em profundidade, cada camada cobre o que as outras deixam passar; cons: mais código de manter, complexidade de teste maior. Aceito.

## Consequences

- **Positivo:** risco de publicação acidental de conteúdo problemático cai significativamente.
- **Positivo:** marker `[REVISAR]` treina o usuário a perceber quando o modelo está em incerteza, reforçando confiança no que o sistema apresenta sem dúvida.
- **Positivo:** classificação financeira com confidence threshold equilibra automação e segurança — alta confiança automatiza, baixa confiança humaniza.
- **Negativo:** validação programática gera false positives (palavras inocentes em contexto seguro disparam red flags). Mitigação: revisão periódica do log de moderação para refinar padrões.
- **Negativo:** maintenance dos system prompts e dos red flag patterns é trabalho contínuo conforme o produto evolui.
- **Risco:** modelos generativos podem encontrar formas criativas de violar regras (ex: parafraseando claim médico). Mitigação: análise contínua do moderation_log identifica padrões emergentes.

## Impact on specs

- **AI/ML spec:** este ADR é parte central da spec de IA. System prompts versionados em `src/api/app/services/ai/prompts/` com code review obrigatório.
- **Vendas (feat-vendas.md):** AC-9, AC-10, AC-11 dependem deste ADR. PRD já estabelece "Not Doing: postagem automática sem aprovação" — coerente.
- **Financeiro (feat-financeiro.md):** AC-5, AC-6, AC-7 — adicionar comportamento de confidence threshold conforme este ADR.
- **Caderno de Campo (feat-caderno-de-campo.md):** AC-9 a AC-13 — sugestões da IA já passam por aprovação do usuário; este ADR confirma o padrão.
- **Observability:** dashboard de moderação com taxa de red flags por tipo, false positive rate inferida (red flag → usuário manteve sem editar), evolução temporal dos padrões.
- **Testing strategy (ADR-008):** evals de IA devem incluir casos adversariais — prompts que tentam fazer o modelo violar guardrails. Mede robustez do sistema.

## References

- [[feat-vendas]] — AC-9, AC-10, AC-11: guardrails para conteúdo publicado
- [[feat-caderno-de-campo]] — sugestões da IA passam por aprovação (AC-9 a AC-13)
- [[feat-financeiro]] — confidence threshold para classificação automática (AC-5, AC-6, AC-7)
- [[adr-004-camada-ia-plugavel]] — camada que este ADR complementa com guardrails
- [[adr-008-estrategia-de-testes]] — evals adversariais medem robustez dos guardrails
- [[adr-011-provedor-ia-capacity-planning]] — DeepSeek em conteúdo de marketing requer este ADR ativo
