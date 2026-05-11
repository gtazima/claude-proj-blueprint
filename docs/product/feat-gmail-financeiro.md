# PRD: Integração Gmail → Módulo Financeiro

## Context
Boa parte das transações financeiras da propriedade gera notificações por e-mail: extratos do banco, confirmações de pedidos em e-commerces, comprovantes de pagamento. Hoje esses e-mails ficam na caixa de entrada sem uso — o produtor não os processa para o controle financeiro porque exigiria entrada manual de cada transação.

O módulo Financeiro já prevê leitura de e-mails de notificação bancária como fallback quando Open Finance não está disponível (ver PRD `feat-financeiro.md`, AC-4). Este PRD expande e especifica esse mecanismo em profundidade: leitura periódica do Gmail da propriedade, extração assistida por IA, fila de confirmação pelo produtor, e alimentação automática do módulo Financeiro.

## Objective
Reduzir a zero a entrada manual de transações que já chegaram por e-mail — usando IA para parsear e-mails de banco e e-commerces e apresentando ao produtor apenas o que precisa de confirmação ou correção antes de entrar no financeiro.

## Scope

### Includes
- [ ] Leitura periódica da caixa de entrada Gmail da conta da propriedade via Gmail API
- [ ] Detecção automática de e-mails de transação: notificações bancárias (C6, Caixa) e confirmações de e-commerce (Amazon, Mercado Livre, outros)
- [ ] Extração dos campos: valor, data, estabelecimento/loja, tipo (débito/crédito/pix/transferência), e categoria inferida
- [ ] Extração assistida por IA (camada `AIProvider` plugável) para e-mails não estruturados ou fora dos padrões conhecidos
- [ ] Fila de confirmação no módulo Financeiro: produtor vê os dados extraídos e confirma, corrige ou descarta antes de salvar
- [ ] Aprovação rápida (um toque) quando a extração está correta
- [ ] Edição inline dos campos extraídos antes da confirmação
- [ ] Dados confirmados entram no módulo Financeiro seguindo o mesmo fluxo de classificação por IA já existente (categoria, cultura, tags)
- [ ] Marcação de e-mails já processados para evitar duplicação em leituras futuras
- [ ] OAuth 2.0 com Gmail API (escopo leitura)
- [ ] Worker assíncrono para leitura periódica configurável via variável de ambiente

### Excludes
- [ ] Envio de e-mails pelo AgroecologIA
- [ ] Leitura de e-mails que não são transações financeiras (sem acesso a conteúdo de e-mails pessoais ou outros assuntos)
- [ ] Integração com bancos além de C6 e Caixa no MVP
- [ ] Extração de notas fiscais eletrônicas (XML de NF-e) — complexidade separada
- [ ] Gestão da caixa de entrada ou ações no Gmail (mover, arquivar, deletar e-mails)
- [ ] Leitura de e-mails de outras contas além da conta principal da propriedade

## Not Doing (e por quê)

- **Processamento automático sem confirmação** — a extração por IA de e-mails não estruturados tem margem de erro. Entrar uma transação errada no financeiro distorce o custo por ciclo e o fluxo de caixa. A fila de confirmação é obrigatória por design, não opcional.
- **Acesso irrestrito ao Gmail** — o escopo OAuth é o mais restritivo possível: leitura apenas de e-mails que passam pelos filtros de detecção de transações. O app não lê, armazena nem processa qualquer outro e-mail. Documentar claramente no fluxo de onboarding.
- **Polling em tempo real (< 5 minutos)** — transações bancárias não requerem latência de segundos. Polling a cada 15 minutos é suficiente e evita consumo excessivo de cota da Gmail API (quota diária de 1 bilhão de unidades, mas requests frequentes com muitos usuários podem ser problemáticos).
- **Parsers hardcoded por banco** — o parser estruturado (regex/template por banco) cobre os casos conhecidos (C6, Caixa). A camada de IA entra como fallback para e-mails fora do padrão. Manter ambos os mecanismos sem criar dependência exclusiva de IA.
- **Extração de NF-e** — XML de nota fiscal é um formato completamente diferente de e-mail de transação. Requer validação de assinatura digital, parsing de schema específico e integração com SEFAZ. Complexidade justifica PRD próprio no futuro.

## User Stories

- Como **produtor**, quero que as transações que chegam por e-mail do banco apareçam automaticamente no financeiro para confirmação, para não precisar digitar cada compra manualmente.
- Como **produtor**, quero ver os dados que o sistema extraiu do e-mail antes de confirmar, para corrigir qualquer erro antes que entre no histórico financeiro.
- Como **produtor**, quero confirmar uma transação correta com um único toque, para que o processo de alimentar o financeiro seja rápido e não seja um obstáculo.
- Como **produtor**, quero que confirmações de pedidos de e-commerce (Amazon, Mercado Livre) também sejam capturadas, para que compras online entrem no financeiro mesmo sem transação bancária visível.
- Como **produtor**, quero que o sistema use IA para extrair dados de e-mails que não seguem um formato padrão, para que e-mails menos estruturados também sejam aproveitados.
- Como **produtor**, quero descartar um e-mail da fila de revisão quando ele não representa uma transação real da propriedade, para manter a fila limpa e relevante.
- Como **produtor**, quero ver um indicador de quantos e-mails estão na fila de confirmação, para saber quando preciso revisar o financeiro.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- A fila de confirmação aparece como seção destacada no topo da tela do módulo Financeiro (acima das transações já classificadas), similar ao destaque de classificações pendentes já previsto no PRD `feat-financeiro.md`.
- Card de confirmação: exibe dados extraídos (valor, data, estabelecimento, tipo), indicador de confiança da extração ("Alta confiança" / "Verificar"), e ações "Confirmar", "Editar" e "Descartar".
- Modo de edição inline: campos editáveis diretamente no card, sem abrir tela separada.
- Indicador de confiança: verde para extração estruturada (parser por banco), amarelo para extração por IA, vermelho para extração parcial ou incerta.
- Badge no menu lateral do módulo Financeiro com o número de itens na fila de confirmação.

## Acceptance Criteria

**Autenticação OAuth**
- AC-1: O produtor conecta a conta Gmail da propriedade via OAuth 2.0 com escopo `gmail.readonly`; o token é armazenado criptografado.
- AC-2: O sistema exibe claramente no fluxo de autenticação que lê apenas e-mails de transações financeiras — nenhum outro e-mail é acessado ou armazenado.
- AC-3: O produtor pode desconectar a conta Gmail a qualquer momento; a desconexão encerra o polling sem perda de dados do financeiro.

**Detecção e leitura de e-mails**
- AC-4: O worker faz polling da caixa de entrada do Gmail a cada 15 minutos (configurável via `GMAIL_POLL_INTERVAL_MINUTES`).
- AC-5: O sistema identifica e-mails de transação usando filtros combinados: remetente (domínios bancários e de e-commerces conhecidos) + palavras-chave no assunto ("comprovante", "débito", "crédito", "pix", "pedido confirmado", "pagamento aprovado").
- AC-6: E-mails fora dos filtros de detecção não são lidos nem armazenados — o app acessa apenas o conteúdo de e-mails que passaram na detecção.
- AC-7: E-mails já processados são marcados com uma label interna no sistema (não no Gmail) para evitar reprocessamento em pollings futuros.

**Extração de dados**
- AC-8: Para remetentes conhecidos (C6, Caixa), o parser estruturado extrai: valor, data, estabelecimento/descrição, tipo (débito/crédito/pix/transferência). Taxa de acerto esperada: >95%.
- AC-9: Para remetentes de e-commerce conhecidos (Amazon, Mercado Livre), o parser extrai: valor total do pedido, data, nome do estabelecimento.
- AC-10: Para e-mails que não correspondem a nenhum parser estruturado, a camada de IA (`AIProvider`) tenta extrair os campos com base no conteúdo do e-mail.
- AC-11: Cada extração é acompanhada de um indicador de confiança: `high` (parser estruturado com todos os campos), `medium` (IA com campos principais), `low` (extração parcial ou incerta).

**Fila de confirmação**
- AC-12: Todas as extrações (independente do nível de confiança) entram na fila de confirmação — nenhuma transação é salva no financeiro sem revisão do produtor.
- AC-13: O produtor vê na fila: dados extraídos do e-mail, indicador de confiança, e o trecho do e-mail que gerou a extração (para contexto).
- AC-14: Aprovação rápida (botão "Confirmar"): a transação entra no módulo Financeiro com os dados exibidos, passando pelo fluxo de classificação por IA (categoria, cultura, tags) já existente.
- AC-15: Edição antes de confirmar: o produtor corrige qualquer campo inline (valor, data, estabelecimento, tipo) e então confirma.
- AC-16: Descarte: o e-mail é marcado como processado e removido da fila; a transação não entra no financeiro. O produtor pode informar o motivo opcionalmente (para melhorar os filtros de detecção futuramente).
- AC-17: A fila exibe o número de itens pendentes como badge no menu lateral do módulo Financeiro.

**Deduplicação**
- AC-18: O sistema detecta possíveis duplicatas (mesmo valor + mesma data + mesmo estabelecimento já existente no financeiro) e sinaliza antes da confirmação.
- AC-19: O produtor decide se confirma mesmo assim (transações legítimas podem coincidir) ou descarta.

**Resiliência**
- AC-20: Falhas de comunicação com a Gmail API são registradas em log e o worker tenta novamente no ciclo seguinte.
- AC-21: Falhas consecutivas (3 ou mais ciclos) geram alerta para o produtor na interface do app.
- AC-22: Erros de parsing (parser estruturado ou IA) não interrompem o processamento dos demais e-mails do ciclo; o e-mail com erro entra na fila com indicador `low` e flag de erro de extração.

## Technical Decisions
- Gmail API v1 com escopo `https://www.googleapis.com/auth/gmail.readonly`. Usar `users.messages.list` com query param (`q`) para filtrar por remetente e assunto — evita baixar conteúdo de e-mails não relevantes.
- Armazenar apenas os campos extraídos e o ID do e-mail no Gmail (para deduplicação). Nunca armazenar o corpo completo do e-mail além do processamento em memória.
- Dois mecanismos de extração complementares: (1) parsers estruturados por remetente em `src/workers/gmail/parsers/` — um arquivo por banco/e-commerce; (2) fallback para `AIProvider` com prompt de extração estruturada.
- Tabela nova: `gmail_processed_messages` com campos: `id`, `property_id`, `gmail_message_id`, `processed_at`, `status` (enum: `pending_review`, `confirmed`, `discarded`), `extracted_data` (JSON), `confidence_level` (enum: `high`, `medium`, `low`).
- OAuth Google compartilhado com o módulo de sync Google Tasks/Calendar (mesmo fluxo de autenticação), porém com escopo adicional de Gmail. Avaliar se os escopos podem ser solicitados juntos ou em fluxos separados — registrar decisão em ADR.
- Worker implementado em `src/workers/gmail_sync.py`. Intervalo configurável via `GMAIL_POLL_INTERVAL_MINUTES` (default: 15).
- Extração por IA usa `AIProvider` plugável — nunca chamar provedor de IA diretamente.
- Parsers estruturados versionados: quando o banco muda o formato do e-mail, um novo parser é adicionado sem quebrar o existente (versionamento por remetente + data de início de validade).
- Registrar decisão de escopos OAuth separados vs. combinados em ADR.

## Impact on Specs

- **Security:** escopo Gmail é read-only e filtrado — o app não armazena conteúdo de e-mails além do necessário. Token OAuth armazenado criptografado. Acesso ao módulo de configuração Gmail restrito ao admin da propriedade. Documentar claramente no onboarding o que o app acessa.
- **Compliance:** leitura de e-mails de conta pessoal/empresarial requer consentimento explícito e transparência sobre o que é lido. Incluir tela de consentimento no fluxo OAuth com linguagem clara. Dados extraídos (valor, estabelecimento, data) são dados financeiros — aplicar as mesmas proteções do módulo Financeiro.
- **Scalability:** 1 polling/15min por conta Gmail. Volume de e-mails de transação por propriedade é baixo (<50/mês estimado). Sem impacto relevante no MVP.
- **Observability:** logar cada ciclo de polling (e-mails detectados, extraídos, erros). Métricas: `gmail_emails_detected_total`, `gmail_extraction_confidence_distribution`, `gmail_poll_errors_consecutive`. Taxa de correção na fila de revisão é métrica de qualidade da extração.
- **Accessibility:** a fila de confirmação deve ser operável com uma mão no mobile. Ação principal ("Confirmar") deve ser o gesto mais simples (botão grande ou swipe).
- **i18n:** PT-BR. Parsers estruturados são específicos para bancos brasileiros. Prompts de IA para extração devem incluir contexto de que os e-mails são em português e em formato brasileiro.

## Rollout
- [ ] Feature flag: `FEATURE_GMAIL_FINANCEIRO_ENABLED` (default: false; requer módulo Financeiro ativo)
- [ ] Migração de banco: criar tabela `gmail_processed_messages`
- [ ] Primeiro polling: processar apenas e-mails dos últimos 30 dias para evitar fila enorme no onboarding
- [ ] Rollback: desativar feature flag; worker para; tabela `gmail_processed_messages` permanece; nenhum dado do financeiro é afetado
- [ ] Validação pré-produção: testar com conta Gmail de teste contendo e-mails reais de C6 e Mercado Livre; validar taxa de extração correta antes de ativar em produção
- [ ] Documentar no `.env.example`: `GMAIL_POLL_INTERVAL_MINUTES`, escopos OAuth necessários
- [ ] Parceiros de onboarding: instruções claras para o produtor sobre quais permissões está concedendo e como revogar

## Métricas de Sucesso
- Taxa de extração com confiança `high` (meta: >80% dos e-mails detectados — indica que os parsers estruturados cobrem os casos principais)
- Taxa de confirmação vs. descarte na fila de revisão (meta: >70% confirmados — indica que a detecção está filtrando bem os e-mails relevantes)
- Taxa de edição antes da confirmação (meta: <20% — indica que a extração está correta na maioria dos casos)
- Redução de transações inseridas manualmente no módulo Financeiro após ativação da feature (avaliado por comparação de período antes/depois)
- Tempo médio de processamento da fila de revisão pelo produtor (meta: <30 segundos por item — valida que o fluxo de confirmação não cria fricção excessiva)
