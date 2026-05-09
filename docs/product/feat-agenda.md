# PRD: Módulo Agenda — Ordem do Dia

## Context
O maior problema operacional da propriedade é a definição da ordem do dia. Hoje essa decisão é feita de memória, combinando pendências do dia anterior com informações trocadas verbalmente entre o produtor e o pai. Atividades esquecidas surgem no meio do dia e derrubam o que estava em execução.

Este é o módulo MVP do AgroecologIA: sem ele, nenhum outro módulo tem contexto para ser útil. A ordem do dia é o ponto de entrada do sistema na rotina do agricultor.

## Objective
Substituir a memória humana por uma visão estruturada e confiável do que precisa ser feito — apresentando tarefas priorizadas automaticamente por timing biológico, dependência e impacto financeiro, com agenda de horizonte de semanas e meses.

## Scope

### Includes
- [ ] Lista de tarefas do dia, ordenadas pelo critério: timing biológico > dependência > impacto financeiro
- [ ] Visualização de tarefas por executor (produtor, pai, funcionário)
- [ ] Agenda de horizonte futuro (próximos 7, 30 e 90 dias) com alertas antecipados
- [ ] Marcação de tarefa como concluída (gera entrada automática no caderno de campo)
- [ ] Criação de tarefa via linguagem natural ("preciso aplicar calcário no talhão 1 semana que vem")
- [ ] Envio automático da ordem do dia para o grupo WhatsApp toda manhã
- [ ] Visualização mobile (PWA) e desktop
- [ ] Override manual de tarefa: produtor pode adiar uma tarefa para outra data com justificativa livre (ex: "vai chover até sexta", "condições inadequadas") — o sistema reposiciona as demais automaticamente
- [ ] Funcionamento offline — tarefas criadas ou concluídas sem internet sincronizam ao reconectar

### Excludes
- [ ] Criação de tarefas recorrentes complexas (ciclos de culturas — isso é responsabilidade do módulo Culturas)
- [ ] Edição de permissões de usuário (módulo de admin)
- [ ] Integração com calendário externo (Google Calendar, etc.)
- [ ] Relatórios e histórico (módulo Caderno de Campo)

## Not Doing (e por quê)

- **Campo de impacto financeiro na criação de tarefas** — o agricultor não pensa em "impacto 3/5" ao criar uma tarefa; isso gera fricção sem valor. O peso financeiro é propriedade do *tipo de atividade*, não da instância. Decisão: `financial_score` existe no modelo de dados (para quando o mecanismo estiver pronto), mas é sempre 0 no MVP. O preenchimento virá via: (1) configuração admin de tipos de atividade com pesos padrão; (2) calibração automática pelo modelo de IA observando custo/hora por executor e padrões de impacto real. Ver iteração de admin de tipos de atividade.
- **Geração automática de tarefas a partir de ciclos de culturas** — o módulo Culturas ainda não existe; a agenda neste PRD trabalha com tarefas criadas manualmente ou via linguagem natural. A integração entre Culturas e Agenda vem em PRD posterior.
- **Notificações push** — o canal principal do funcionário é WhatsApp; para o produtor e pai, a abertura do app pela manhã é o comportamento esperado no MVP. Push notifications adicionam complexidade sem valor comprovado agora.
- **Reordenação livre por arrastar e soltar** — o usuário não reorganiza a lista livremente. O override é feito por tarefa individualmente: o produtor adia uma tarefa com justificativa (ex: "vai chover até sexta"), e o sistema reposiciona as demais. Drag-and-drop genérico sem contexto não agrega valor e pode mascarar urgências reais.
- **Integração com Google Calendar** — cria dependência de serviço externo; o sistema deve ser a fonte de verdade da agenda, não um espelho de outras ferramentas.
- **Delegação de tarefas com confirmação** — o funcionário recebe via WhatsApp sem precisar confirmar. Fluxo de confirmação bidirecional é complexidade desnecessária agora.

## User Stories

- Como **produtor**, quero ver ao abrir o app quais são as tarefas do dia já ordenadas por prioridade real, para não precisar reconstruir a ordem do dia de memória toda manhã.
- Como **produtor**, quero registrar uma nova tarefa falando em linguagem natural, para que o esforço de alimentar o sistema seja mínimo mesmo no meio de um dia de trabalho.
- Como **produtor**, quero ver o que vai chegar nas próximas semanas e meses, para antecipar insumos, mão de obra e decisões antes que virem urgência.
- Como **pai**, quero ver apenas as tarefas atribuídas a mim, para focar no que é minha responsabilidade sem me perder nas demais.
- Como **produtor**, quero que ao concluir uma tarefa ela vire automaticamente um registro no caderno de campo, para que o histórico se construa sem esforço adicional.
- Como **funcionário**, quero receber toda manhã no WhatsApp a lista das minhas tarefas do dia, para saber o que fazer sem precisar abrir nenhum app.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Princípio de interface: legível em 5 segundos por alguém com pouca familiaridade digital. Hierarquia visual clara: tarefa mais prioritária aparece maior e no topo.
- Mobile-first: a tela de ordem do dia é a tela inicial do app no mobile.

## Acceptance Criteria

**Ordem do dia**
- AC-1: Ao abrir o app, o usuário vê a lista de tarefas do dia ordenada por: (1) timing biológico, (2) dependência, (3) impacto financeiro.
- AC-2: Tarefas com timing biológico crítico (janela de execução expirando em menos de 24h) aparecem destacadas visualmente no topo.
- AC-3: Cada tarefa exibe: título, executor responsável, e indicador do critério de prioridade que a elevou.
- AC-4: O usuário consegue filtrar a lista por executor (ver só as suas tarefas, ou as do funcionário).

**Criação via linguagem natural**
- AC-5: O usuário pode digitar ou falar uma frase livre (ex: "aplicar calcário no talhão 1 na sexta") e o sistema cria a tarefa com data, executor e categoria inferidos.
- AC-6: Tarefas criadas offline ficam em fila local e são sincronizadas automaticamente quando a conexão retornar.

**Conclusão e caderno de campo**
- AC-7: Ao marcar uma tarefa como concluída, uma entrada é criada automaticamente no caderno de campo com: título, executor, data/hora de conclusão.
- AC-8: A tarefa concluída sai da lista do dia e aparece na seção "Concluído hoje" até meia-noite.

**Agenda de horizonte futuro**
- AC-9: O usuário consegue visualizar tarefas agendadas para os próximos 7, 30 e 90 dias em uma tela de agenda.
- AC-10: Tarefas com data futura que ainda não têm executor atribuído aparecem destacadas como "não atribuídas".

**WhatsApp**
- AC-11: Todo dia às 06h00 (horário configurável), o sistema envia automaticamente para o grupo WhatsApp configurado a lista de tarefas do dia, agrupadas por executor.
- AC-12: O envio do WhatsApp ocorre mesmo que o produtor não abra o app.
- AC-13: Se o envio falhar, o sistema registra o erro em log e tenta novamente em 15 minutos.

**Override manual**
- AC-14: O produtor pode adiar uma tarefa selecionando nova data e registrando uma justificativa em texto livre.
- AC-15: Ao adiar uma tarefa, a lista do dia é reordenada automaticamente com as tarefas restantes.
- AC-16: A justificativa do adiamento fica visível na tarefa e é registrada no caderno de campo junto com a data original.
- AC-17: Tarefas adiadas repetidamente (3x ou mais) geram um alerta visual indicando acúmulo — para o produtor perceber que a tarefa está sendo sistematicamente postergada.

**Offline**
- AC-18: Todas as funcionalidades de leitura (ver ordem do dia, ver agenda) funcionam sem conexão com internet.
- AC-19: Criação e conclusão de tarefas offline são enfileiradas localmente e sincronizadas sem perda de dados ao reconectar.

## Technical Decisions
- Algoritmo de priorização precisa de ADR próprio: como modelar "timing biológico" computacionalmente (campo `deadline_critical: bool` + `scheduled_window`), como tratar dependências entre tarefas, e como calcular impacto financeiro sem dados financeiros completos no MVP.
- Offline-first requer decisão sobre estratégia de sync (conflict resolution). Registrar em ADR.
- Integração WhatsApp via Evolution API — registrar configuração e formato da mensagem em runbook.
- Inferência de linguagem natural (criação de tarefa) usa a camada `AIProvider` plugável.

## Impact on Specs

- **Security:** tarefas contêm dados operacionais da propriedade. Acesso à agenda deve ser restrito por perfil de usuário. O funcionário recebe apenas via WhatsApp — nunca tem acesso ao app.
- **Observability:** logar falhas no envio do WhatsApp com alerta. Monitorar latência do sync offline.
- **Scalability:** sem impacto relevante no MVP (propriedade com ~3 usuários).
- **Accessibility:** interface mobile-first deve ser legível por usuário com baixa familiaridade digital. Fonte grande, contraste alto, ações com texto além de ícone.
- **Compliance:** sem dados pessoais sensíveis além de nome de usuário. Sem impacto legal no MVP.
- **i18n:** produto em PT-BR. Sem necessidade de internacionalização agora.

## Rollout
- [ ] Sem feature flag no MVP — é a funcionalidade central do produto
- [ ] Sem migração de dados — banco começa vazio
- [ ] Rollback: reverter deploy da API + PWA. Dados em SQLite local não são afetados.
- [ ] Antes do primeiro uso: configurar grupo WhatsApp + número do Evolution API no `.env`
