# PRD: Módulo Culturas

## Context
A Agenda (feat-agenda.md) trabalha hoje com tarefas criadas manualmente. Para que o sistema gere tarefas automaticamente — alertar que o lote 003 de shiitake está entrando na janela de frutificação, ou que o talhão 1 de café precisa da segunda adubação — ele precisa conhecer os ciclos de cada cultura.

O módulo Culturas é a fonte de verdade sobre o que existe na propriedade: quais culturas, em quais unidades de gestão (lotes, talhões, enxames), em que estágio de ciclo cada uma está, e qual foi o histórico de produção. É daqui que a Agenda passa a ser proativa em vez de apenas reativa.

## Objective
Modelar todas as culturas da propriedade com seus ciclos, unidades de gestão e histórico de colheita, de forma que o sistema possa gerar alertas automáticos de timing e acumular memória de produção por lote/talhão.

## Scope

### Includes
- [ ] Cadastro de culturas com tipo de ciclo (ciclo fixo, ciclo repetitivo com múltiplas frutificações, ciclo anual, perene)
- [ ] Unidades de gestão por cultura: lote (shiitake, cúrcuma), talhão (café, melaleuca, banana, limão), enxame (abelhas), área genérica (canavial, horta, gramíneas)
- [ ] Rastreamento de estágio atual por unidade de gestão com datas de transição
- [ ] Registro de colheita por unidade de gestão com unidade de medida configurável por cultura (peso, volume, quantidade de toras, touceiras, cacho)
- [ ] Histórico completo de colheitas por lote/talhão com média de produção calculada automaticamente
- [ ] Geração automática de tarefas na Agenda quando uma unidade entra em janela de ação (ex: lote de shiitake entra em janela de frutificação)
- [ ] Filtro de visualização por cultura (acesso restrito por cultura para usuários externos — ex: parceiros de meliponicultura)
- [ ] Suporte a múltiplos talhões por cultura com cultivar e data de plantio distintos
- [ ] Registro de colheita pode gerar automaticamente uma receita não consolidada no módulo Financeiro (venda em consignação — receita registrada, pagamento pendente)
- [ ] Cadastro de novas culturas pelo usuário, com definição de tipo de unidade de gestão e eventos de ciclo customizáveis
- [ ] Adição de novos eventos ao ciclo de uma cultura existente a qualquer momento

### Excludes
- [ ] Gestão financeira de custos por cultura (módulo Financeiro)
- [ ] Integração com sensores de automação (módulo Automação)
- [ ] Venda de toras ou produtos (módulo Vendas)
- [ ] Análise de solo e recomendações agronômicas (módulo a definir — usa camada de IA)

## Not Doing (e por quê)

- **Modelo único de ciclo para todas as culturas** — cada cultura tem sua própria estrutura. Shiitake tem lotes com até 4 frutificações rastreadas individualmente; café tem talhões perenes com manejo contínuo; abelhas têm enxames com dinâmica própria. Um modelo genérico demais não serve; um modelo rígido demais não escala. A solução é um núcleo comum (unidade de gestão + estágio + histórico) com campos configuráveis por cultura.
- **Edição de ciclos em lotes já em andamento** — alterar o template de ciclo de uma cultura não afeta lotes/talhões já criados. Mudanças de ciclo se aplicam apenas a novas unidades criadas depois da alteração. Retroatividade cria inconsistência no histórico.
- **Rastreamento individual de cada tora de shiitake** — o nível de granularidade é o lote, não a tora individual. O registro de quantidade de toras na colheita serve para calcular média do lote e eventual comercialização, não para rastrear cada tora separadamente.
- **Mapa georreferenciado de talhões** — visualização no mapa é responsabilidade do módulo Mapa. Este PRD define o modelo de dados; o Mapa consome.
- **Alertas de pragas e doenças** — requer integração com base de conhecimento técnico e IA. Escopo futuro.

## User Stories

- Como **produtor**, quero ver o status atual de cada lote de shiitake (em incubação, em frutificação, aguardando próxima frutificação, encerrado), para saber exatamente em que ponto cada lote está sem precisar lembrar.
- Como **produtor**, quero receber uma tarefa automática na Agenda quando um lote de shiitake entra na janela de frutificação, para nunca perder o timing de colheita.
- Como **produtor**, quero registrar a colheita de um lote informando peso, volume e quantidade de toras, para acumular histórico e saber a média de produção por frutificação.
- Como **produtor**, quero ver o histórico das 4 frutificações de um lote com datas e volumes, para decidir quando encerrar o lote e comparar desempenho entre lotes.
- Como **produtor**, quero cadastrar um novo talhão de café com cultivar e data de plantio, para que o sistema saiba quando cada talhão deve entrar em produção e gere os manejos correspondentes.
- Como **parceiro de meliponicultura**, quero acessar apenas as informações dos enxames de abelhas, para acompanhar o desenvolvimento sem ver dados do restante da propriedade.
- Como **produtor**, quero ver a média histórica de produção por lote de shiitake, para identificar quais lotes rendem mais e tomar decisões sobre inoculação futura.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Visão principal: lista de culturas → seleciona cultura → lista de unidades (lotes/talhões/enxames) com status visual por estágio → seleciona unidade → detalhe com histórico e próximas ações.
- Status de estágio deve ser comunicado visualmente com cor e ícone — verde (em produção/frutificação), amarelo (em transição/aguardando), cinza (encerrado/inativo).
- Mobile: foco em registrar colheita rapidamente (2 toques para chegar no formulário de colheita de um lote).

## Acceptance Criteria

**Culturas e unidades de gestão**
- AC-1: O sistema vem pré-configurado com as culturas da propriedade: shiitake, café, melaleuca, banana, limão, abelhas nativas, cúrcuma, canavial, mombaça, napier.
- AC-2: Cada cultura possui unidades de gestão do tipo correto: shiitake → lotes, café/melaleuca/banana/limão → talhões, abelhas → enxames, demais → área genérica.
- AC-3: Um talhão de café armazena: identificador, cultivar, data de plantio, e permite múltiplos talhões com cultivares diferentes.

**Ciclo do shiitake**
- AC-4: Um lote de shiitake possui: número do lote, data de inoculação, e registro de até N frutificações (sem limite fixo, histórico máximo de referência: 4).
- AC-5: Cada frutificação registra: número sequencial, data de início, data de colheita, peso (kg), volume (L) e quantidade de toras colhidas.
- AC-6: O sistema calcula e exibe automaticamente a média de produção por frutificação do lote (peso médio, volume médio).
- AC-7: Quando a data de incubação esperada é atingida, o sistema gera automaticamente uma tarefa na Agenda: "Verificar lote [X] — janela de frutificação".

**Colheita**
- AC-8: O formulário de registro de colheita adapta os campos de medição conforme a cultura: shiitake (peso + volume + qtd toras), banana (peso + qtd cachos), cúrcuma (peso + qtd touceiras), café (peso), outras (peso + campo livre).
- AC-9: Toda colheita registrada gera automaticamente uma entrada no caderno de campo com: cultura, unidade, data, quantidades registradas e executor.

**Geração de tarefas automáticas**
- AC-10: Cada cultura possui uma lista de eventos de ciclo configurados (ex: shiitake: inoculação → incubação → frutificação; café: plantio → adubação N dias → poda → colheita) que geram tarefas na Agenda automaticamente nas datas calculadas.
- AC-11: Tarefas geradas automaticamente pelo módulo Culturas são identificadas na Agenda com a origem (ex: "Gerado por: Shiitake — Lote 003").

**Controle de acesso por cultura**
- AC-12: Um usuário com acesso restrito à cultura "abelhas" consegue visualizar apenas os enxames, sem acesso a nenhuma outra cultura ou módulo.
- AC-13: O admin consegue configurar quais culturas cada usuário pode acessar.

**Cadastro de novas culturas e ciclos**
- AC-16: O produtor pode cadastrar uma nova cultura definindo: nome, tipo de unidade de gestão (lote, talhão, enxame, área genérica), unidade de medida de colheita e eventos de ciclo com intervalos em dias.
- AC-17: O produtor pode adicionar novos eventos ao ciclo de uma cultura existente a qualquer momento; a mudança se aplica apenas a unidades criadas após a alteração.
- AC-18: As culturas pré-configuradas da propriedade (shiitake, café, etc.) seguem o mesmo modelo das culturas criadas pelo usuário — sem tratamento especial em código.

**Integração com Financeiro**
- AC-19: Ao registrar uma colheita, o produtor pode opcionalmente criar uma receita não consolidada no módulo Financeiro, informando: produto, quantidade, valor unitário e comprador.
- AC-20: A receita não consolidada fica com status "aguardando pagamento" até ser confirmada manualmente; quando confirmada, o valor entra no fluxo de caixa.
- AC-21: A rastreabilidade é mantida: a receita consolidada referencia a colheita que a originou (lote/talhão, data, cultura).

**Histórico**
- AC-14: O produtor consegue ver o histórico completo de colheitas de um lote/talhão em ordem cronológica.
- AC-15: O sistema exibe comparativo de produção entre lotes da mesma cultura (ex: lote 001 vs lote 002 de shiitake — média de peso por frutificação).

## Technical Decisions
- Modelagem de ciclos configuráveis por cultura requer ADR: como representar eventos de ciclo (templates de ciclo vs. instâncias de evento) sem tornar o modelo rígido demais.
- Geração de tarefas a partir de ciclos deve usar o mesmo sistema de tarefas da Agenda — não criar um sistema paralelo. Registrar integração em ADR.
- Controle de acesso por cultura é extensão do modelo de permissões definido na Agenda. Registrar em ADR de segurança.

## Impact on Specs

- **Security:** acesso por cultura é o primeiro caso real de permissão granular no sistema. A implementação aqui define o padrão para todos os módulos futuros.
- **Data Architecture:** modelo de dados central do produto — ciclos, lotes, talhões, histórico de colheita. Requer atenção especial ao schema para não criar dívida técnica.
- **Observability:** logar geração de tarefas automáticas para auditoria (qual evento gerou qual tarefa, quando).
- **Scalability:** histórico de colheitas cresce indefinidamente — garantir paginação nas queries de histórico desde o início.
- **Accessibility:** formulário de registro de colheita é usado no campo, possivelmente com mãos sujas ou luvas. Campos grandes, ação de salvar proeminente.
- **Compliance:** dados de produção são sensíveis para certificação orgânica futura — estrutura de rastreabilidade por lote/talhão já prepara o terreno.
- **i18n:** PT-BR. Sem necessidade agora.

## Rollout
- [ ] Sem feature flag — módulo central sem o qual a Agenda não é proativa
- [ ] Seed de dados: culturas e estrutura inicial da propriedade devem ser inseridas via script antes do primeiro uso
- [ ] Rollback: sem impacto em outros módulos se revertido (Agenda volta a funcionar apenas com tarefas manuais)
- [ ] Validação: produtor deve revisar o seed de culturas e confirmar que os ciclos configurados refletem a realidade da propriedade antes de ativar geração automática de tarefas

## Relacionados

- [[adr-001-algoritmo-priorizacao-agenda]] — geração de tarefas preenche janelas de timing biológico (AC-10, AC-11)
- [[adr-003-controle-acesso-por-cultura]] — AC-12 e AC-13: parceiros acessam apenas suas culturas permitidas
- [[feat-agenda]] — tarefas geradas por ciclos aparecem na ordem do dia
- [[feat-caderno-de-campo]] — colheitas registradas viram entradas no caderno automaticamente
