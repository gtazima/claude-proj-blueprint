# PRD: Módulo de Compras

## Context
A lista de compras da propriedade hoje existe na cabeça do produtor ou em rascunhos desconexos. Insumos, equipamentos e materiais são lembrados na hora errada — na feira sem ter anotado o modelo correto, ou na loja sem saber o preço de referência pesquisado dias antes. O resultado é compras esquecidas, compras duplicadas e compras mal-feitas por falta de informação no momento decisivo.

O módulo de Compras centraliza essa lista com suporte a pesquisa prévia (links, notas, especificações) e sincroniza bidirecional com o Google Tasks para que a lista esteja disponível no celular mesmo sem abrir o app — exatamente onde o produtor está quando vai comprar.

## Objective
Dar ao produtor um repositório único para itens a comprar — com histórico de pesquisa, notas e links — sincronizado com o Google Tasks para acesso fácil no celular durante a compra.

## Scope

### Includes
- [ ] Módulo separado do Kanban de tarefas (acesso via menu lateral)
- [ ] Criação de item de compra com: nome, links de pesquisa (múltiplos), notas/informações levantadas, status (a comprar / comprado), data de criação
- [ ] Edição de qualquer campo de um item existente
- [ ] Marcação de item como comprado (com data de conclusão automática)
- [ ] Visualização separada de itens "a comprar" e "comprados" (histórico)
- [ ] Entrada por voz para criação rápida de itens
- [ ] Sincronização bidirecional com lista "lista de compras" no Google Tasks:
  - Item criado no AgroecologIA → vai para Google Tasks automaticamente
  - Item na lista Google Tasks que não existe no AgroecologIA → entra no módulo Compras
  - Item marcado como comprado no AgroecologIA → marcado como concluído no Google Tasks
  - Item marcado como concluído no Google Tasks → marcado como comprado no AgroecologIA
- [ ] Reutiliza o worker de sync do PRD Google Calendar/Tasks para a sincronização

### Excludes
- [ ] Integração com e-commerces ou sistemas de pedido automático
- [ ] Comparação de preços entre fornecedores
- [ ] Gestão de estoque (escopo do módulo Manutenção e Culturas)
- [ ] Aprovação de compras por outro usuário
- [ ] Anexos de foto ou PDF por item (MVP: apenas links e texto)
- [ ] Associação de item de compra com cultura ou talhão específico (futuro: pode alimentar custo por ciclo no Financeiro)

## Not Doing (e por quê)

- **Integração direta com e-commerce ou marketplaces** — o produtor pesquisa onde comprar como parte do fluxo natural; o app captura o link de pesquisa, não faz a compra. Automação de pedido é complexidade sem benefício imediato.
- **Controle de estoque acoplado ao módulo** — quando um item é comprado, ele não dá entrada automática em estoque. Essa integração requer modelagem de estoque (módulo Manutenção/Culturas) e é escopo futuro. No MVP, o módulo de Compras é uma lista inteligente, não um sistema de inventário.
- **Notificações de lembrete por item** — adiciona complexidade de agendamento de notificações. O produtor consulta a lista quando vai comprar; não precisa de lembrete por item individual.
- **Associação de custo (valor pago) por item** — o preço da compra deve entrar via módulo Financeiro (transação bancária ou registro manual). Duplicar esse dado aqui cria inconsistência.

## User Stories

- Como **produtor**, quero adicionar um item à lista de compras falando o nome em voz alta, para registrar o que precisa comprar enquanto trabalho sem parar o que estou fazendo.
- Como **produtor**, quero salvar links de pesquisa junto com o item (ex: link do produto na Amazon, link do vídeo de review), para ter as referências na mão na hora de comprar.
- Como **produtor**, quero adicionar notas a um item (ex: "conferir se serve para irrigação por gotejamento", "comprar o modelo com rosca 3/4"), para não perder as especificações levantadas antes da compra.
- Como **produtor**, quero que a lista de compras apareça automaticamente no meu Google Tasks, para consultá-la no celular na loja sem precisar abrir o app.
- Como **produtor**, quero marcar um item como comprado no Google Tasks quando estiver na loja, para que o app seja atualizado automaticamente sem precisar abrir o AgroecologIA.
- Como **pai**, quero adicionar itens à lista pelo Google Tasks e vê-los aparecer no app, para contribuir com a lista de compras da propriedade usando a ferramenta que já uso no dia a dia.
- Como **produtor**, quero ver o histórico de itens comprados com a data de compra, para saber quando foi a última compra de um insumo recorrente.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Tela principal do módulo: lista de itens "a comprar" com nome, número de links salvos e indicador de notas preenchidas.
- Botão flutuante de criação rápida + ativação de voz.
- Detalhe do item: nome editável, campo de notas, lista de links (adicionar, remover, abrir). Cada link exibe o domínio como label (ex: "amazon.com.br", "mercadolivre.com.br").
- Toggle "A comprar / Comprados" no topo da tela para alternar entre as duas visões.
- Desktop: painel dividido — lista à esquerda, detalhe do item selecionado à direita.

## Acceptance Criteria

**Criação e edição de item**
- AC-1: O produtor cria um item informando apenas o nome; todos os outros campos são opcionais.
- AC-2: O produtor adiciona múltiplos links a um item; cada link pode ser removido individualmente.
- AC-3: O produtor edita as notas de um item em qualquer momento, incluindo após a compra.
- AC-4: O produtor cria um item por voz; o sistema transcreve e preenche o campo nome automaticamente.
- AC-5: A data de criação é registrada automaticamente e exibida no detalhe do item.

**Marcação como comprado**
- AC-6: Ao marcar um item como comprado, o status muda para "comprado" e a data de conclusão é registrada automaticamente.
- AC-7: Itens comprados saem da lista principal e aparecem na aba "Comprados" ordenados do mais recente ao mais antigo.
- AC-8: O produtor pode reverter um item de "comprado" para "a comprar" se marcou por engano.

**Sincronização com Google Tasks**
- AC-9: Todo item criado no AgroecologIA aparece na lista "lista de compras" do Google Tasks em até 2 minutos, com o nome como título da task.
- AC-10: Item adicionado diretamente na lista "lista de compras" do Google Tasks aparece no módulo Compras do AgroecologIA em até 2 minutos, com status "a comprar".
- AC-11: Ao marcar um item como "comprado" no AgroecologIA, o item correspondente no Google Tasks é marcado como concluído em até 2 minutos.
- AC-12: Ao marcar um item como concluído no Google Tasks, o item correspondente no AgroecologIA é marcado como "comprado" em até 2 minutos.
- AC-13: Itens deletados no AgroecologIA são removidos do Google Tasks.
- AC-14: Edições no nome do item no AgroecologIA são propagadas ao Google Tasks.

**Histórico**
- AC-15: A aba "Comprados" exibe todos os itens já comprados com nome e data de conclusão.
- AC-16: O produtor pode pesquisar no histórico de itens comprados por nome.

**Integração com worker de sync**
- AC-17: O sync de Compras usa o mesmo worker assíncrono da integração Google Calendar/Tasks (PRD `feat-google-calendar-tasks-sync`). A lista "lista de compras" é gerenciada de forma independente da lista "AgroecologIA".
- AC-18: Falhas de sync do módulo Compras são logadas de forma isolada e não afetam o sync de tarefas.

## Technical Decisions
- A lista "lista de compras" no Google Tasks é criada automaticamente na primeira autenticação OAuth (reutiliza o fluxo do PRD Google Calendar/Tasks). Criação idempotente — verificar se já existe antes de criar.
- Modelo de dados novo: tabela `purchase_items` com campos: `id`, `property_id`, `name`, `notes`, `status` (enum: `to_buy`, `bought`), `created_at`, `bought_at`, `google_task_id`.
- Tabela auxiliar `purchase_item_links` com campos: `id`, `purchase_item_id`, `url`, `created_at` — relação N:1 com `purchase_items`.
- Sincronização usa o mesmo mecanismo de polling do PRD `feat-google-calendar-tasks-sync`; o worker precisa suportar múltiplas listas do Google Tasks.
- A dependência do worker de sync Google é obrigatória — o módulo Compras requer que a integração Google Tasks esteja ativada e autenticada.
- Registrar decisão de modelo de dados separado vs. extensão do modelo Task em ADR (purchase_items não é uma Task — não tem executor, prioridade, timing biológico ou integração com Caderno de Campo).

## Impact on Specs

- **Security:** links salvos pelo usuário devem ser validados como URLs antes de armazenar (prevenir injeção). Nenhum dado sensível no módulo além dos dados operacionais da propriedade.
- **Compliance:** sem dados pessoais sensíveis. Sem impacto legal no MVP.
- **Scalability:** volume de itens de compra por propriedade é baixo. Sem impacto relevante.
- **Observability:** logar falhas de sync da lista "lista de compras" separadamente das demais listas. Métrica: `purchase_sync_errors_total`.
- **Accessibility:** criação por voz é recurso de acessibilidade primário — o produtor está frequentemente com as mãos ocupadas. Botão de voz deve ser grande e visível.
- **i18n:** PT-BR. Nome da lista no Google Tasks ("lista de compras") em português.

## Rollout
- [ ] Feature flag: `FEATURE_COMPRAS_ENABLED` (requer `FEATURE_GOOGLE_SYNC_ENABLED` ativo)
- [ ] Migração de banco: criar tabelas `purchase_items` e `purchase_item_links`
- [ ] Criar lista "lista de compras" no Google Tasks na primeira ativação (idempotente)
- [ ] Rollback: desativar feature flag; tabelas permanecem mas módulo fica inacessível; lista no Google Tasks permanece mas para de ser sincronizada
- [ ] Dependência: requer PRD `feat-google-calendar-tasks-sync` implementado e autenticação Google ativa

## Métricas de Sucesso
- Número de itens criados por semana (indica adoção do módulo como substituto das listas informais)
- Taxa de itens com pelo menos um link ou nota preenchida (indica uso efetivo do campo de pesquisa, não só lista básica)
- Taxa de sincronização bem-sucedida entre AgroecologIA e Google Tasks (meta: >99%)
- Adoção do Google Tasks como interface de consulta durante compras (avaliado por feedback qualitativo do produtor)

## Relacionados

- [[feat-google-tasks-sync]] — integração Google Tasks que este módulo estende (FEATURE_GOOGLE_SYNC_ENABLED obrigatório)
- [[feat-manutencao]] — origem de itens de compra proativos gerados por alertas de manutenção
- [[adr-009-autenticacao]] — tokens OAuth Google reutilizados por este módulo
