# PRD: Integração Google Calendar e Google Tasks

## Context
A propriedade tem uma conta Google dedicada ("conta da propriedade") que centraliza Calendar, Tasks, Drive e e-mail da operação — separada das contas pessoais dos usuários do app. Compromissos externos, visitas técnicas e entregas são registrados nessa conta. Hoje, um evento no Calendar da propriedade não aparece na ordem do dia do AgroecologIA, e uma tarefa criada no app não aparece no calendário. Isso força dupla manutenção manual.

A integração resolve isso em duas direções: o AgroecologIA empurra todas as tarefas da propriedade para o Google Tasks da conta da propriedade (que aparece nativamente no Google Calendar), e eventos criados diretamente no Calendar entram no AgroecologIA como tarefas em fila de revisão. Cada tarefa carrega a etiqueta do executor para identificar responsabilidades no Calendar. O resultado é uma visão unificada operada por uma única conta Google, sem que nenhum usuário precise manter dois sistemas em paralelo.

## Objective
Manter o AgroecologIA como fonte de verdade das tarefas da propriedade enquanto reflete essas tarefas no Google Calendar — e captura compromissos externos criados diretamente no Calendar, sem exigir dupla entrada de dados.

## Scope

### Includes
- [ ] Sincronização de tarefas com data (`scheduled_window_end`) do AgroecologIA → Google Tasks (lista "AgroecologIA")
- [ ] Sincronização de tarefas sem data do AgroecologIA → Google Tasks lista "memória", refletidas como coluna "sem data" no Kanban
- [ ] Google Tasks ↔ Google Calendar: gerenciado nativamente pelo Google; o app não precisa interfacear com o Calendar diretamente para esse fluxo
- [ ] Polling do Google Calendar a cada 1 minuto via worker assíncrono para capturar eventos criados diretamente no Calendar
- [ ] Eventos novos no Calendar (não originados do AgroecologIA) entram como rascunho na fila "tarefas para revisar" no Kanban
- [ ] Interface de revisão de tarefas importadas: produtor confirma, edita ou descarta cada item da fila
- [ ] Conflito de edição resolvido por "última edição ganha" (last write wins por `updated_at`)
- [ ] Tarefa concluída no AgroecologIA → marcada como concluída no Google Tasks → evento aparece com risco no Calendar (comportamento nativo do Google)
- [ ] Novo campo `duration_minutes` no modelo Task (opcional) → duração do evento no Google Calendar
- [ ] Novo campo `calendar_event_id` no modelo Task (opcional) → rastreia vínculo com evento específico no Calendar
- [ ] Novo campo `google_task_id` no modelo Task (opcional) → rastreia vínculo com task no Google Tasks
- [ ] OAuth 2.0 com escopo mínimo necessário (Tasks + Calendar read) — autenticação da **conta da propriedade**, configurada pelo admin; compartilhada por toda a propriedade
- [ ] Worker assíncrono dedicado para polling e sincronização

### Excludes
- [ ] Sincronização de contatos ou outros recursos Google
- [ ] Suporte a múltiplas contas Google simultâneas por propriedade
- [ ] Conexão de contas Google pessoais individuais por usuário
- [ ] Sincronização bidirecional de subtarefas ou checklists
- [ ] Criação de eventos recorrentes via AgroecologIA → Calendar
- [ ] Notificações/lembretes do Calendar gerenciadas pelo AgroecologIA
- [ ] Integração com Google Meet ou outros produtos Google além de Tasks e Calendar

## Not Doing (e por quê)

- **Integração direta AgroecologIA ↔ Google Calendar** — a cadeia AgroecologIA → Google Tasks → Google Calendar (nativo) evita manter dois mapeamentos de sincronização. O Google resolve Tasks ↔ Calendar; o app só fala com Tasks. Menos superfície de integração, menos pontos de falha.
- **Resolução inteligente de conflitos de edição** — "última edição ganha" é suficiente para o caso de uso real (o produtor é o único editor na prática). Lógica de merge por campo adicionaria complexidade sem benefício comprovado no MVP.
- **Sync em tempo real (webhook)** — Google Calendar push notifications requerem endpoint público com verificação de domínio e renovação de canal a cada 7 dias. Polling a cada 1 minuto atende o caso de uso sem essa complexidade operacional.
- **Importação automática sem fila de revisão** — eventos do Calendar entram como rascunho por design: o AgroecologIA não conhece o contexto de um evento externo. Forçar a revisão protege a integridade do Kanban.

## User Stories

- Como **produtor (admin)**, quero conectar a conta Google da propriedade nas configurações do app, para que todas as tarefas da propriedade sejam sincronizadas sem que cada usuário precise configurar nada.
- Como **produtor**, quero que as tarefas com data do AgroecologIA apareçam automaticamente no Calendar da propriedade, para ter uma visão unificada do dia sem precisar abrir dois sistemas.
- Como **produtor**, quero que tarefas sem data fiquem visíveis na lista do Google Tasks da propriedade, para que eu possa consultá-las no celular mesmo sem abrir o app.
- Como **produtor**, quero que cada tarefa no Calendar mostre quem é o executor (produtor, pai, etc.) como etiqueta, para conseguir identificar responsabilidades de relance no Calendar.
- Como **produtor**, quero que eventos criados diretamente no Calendar da propriedade apareçam no AgroecologIA para revisão, para não perder compromissos externos na ordem do dia.
- Como **produtor**, quero revisar e confirmar cada evento importado do Calendar antes que ele entre no Kanban, para que só tarefas relevantes à propriedade contaminem a agenda.
- Como **produtor**, quero que ao concluir uma tarefa no AgroecologIA o evento correspondente apareça como concluído no Calendar, para que o histórico reflita o que realmente aconteceu.
- Como **produtor**, quero informar a duração estimada de uma tarefa, para que o evento no Google Calendar ocupe o bloco de tempo correto.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Coluna "Tarefas para revisar" no Kanban: aparece à esquerda da coluna "Sem data" apenas quando há itens na fila. Desaparece quando a fila está vazia.
- Card de revisão: exibe título do evento, data/hora, e ações "Confirmar", "Editar" e "Descartar". Editar abre o formulário de tarefa pré-preenchido com os dados do evento.
- Indicador de sync: ícone de status (sincronizado / pendente / erro) visível nas configurações do módulo.
- Configuração OAuth: tela de configurações com botão "Conectar conta Google" e status da conexão por usuário.

## Acceptance Criteria

**Autenticação OAuth — conta da propriedade**
- AC-1: O admin (produtor) conecta a conta Google da propriedade via OAuth 2.0 nas configurações da propriedade; o token é armazenado de forma criptografada no banco vinculado à propriedade, não ao usuário individual.
- AC-2: O fluxo de reconexão é disparado automaticamente quando o token expira, sem perda de dados; o admin recebe alerta na interface para reautenticar.
- AC-3: O admin pode desconectar a conta Google da propriedade a qualquer momento; a desconexão para o sync sem apagar tarefas já criadas no AgroecologIA.

**AgroecologIA → Google Tasks**
- AC-4: Toda tarefa com `scheduled_window_end` preenchido é enviada para a lista "AgroecologIA" no Google Tasks com: título, descrição, data de vencimento e etiqueta do executor.
- AC-5: Toda tarefa sem `scheduled_window_end` é enviada para a lista "memória" no Google Tasks e aparece na coluna "Sem data" do Kanban.
- AC-6: Se `duration_minutes` estiver preenchido, o evento correspondente no Google Calendar (gerado nativamente pelo Tasks) é criado com a duração correta.
- AC-7: Edições no título, descrição, data ou executor de uma tarefa no AgroecologIA são propagadas para o Google Tasks em até 2 minutos.
- AC-8: Tarefas deletadas no AgroecologIA são removidas do Google Tasks.

**Google Calendar → AgroecologIA**
- AC-9: O worker faz polling do Google Calendar a cada 1 minuto e detecta eventos criados ou modificados desde o último polling.
- AC-10: Eventos detectados que não possuem `calendar_event_id` correspondente em nenhuma tarefa do AgroecologIA entram na fila "tarefas para revisar" como rascunhos.
- AC-11: O rascunho importado contém: título do evento, data/hora, e os campos padrão `executor: nao_atribuido` e `financial_score: 0`.
- AC-12: O produtor revisa cada item da fila e pode: confirmar (a tarefa entra no Kanban), editar antes de confirmar, ou descartar (o evento não é importado e não aparece novamente).
- AC-13: Eventos descartados pelo produtor não reaparecem na fila em pollings subsequentes.

**Conflito de edição**
- AC-14: Quando uma tarefa é editada simultaneamente no AgroecologIA e no Google Tasks, a versão com `updated_at` mais recente prevalece.
- AC-15: O sistema registra em log toda resolução de conflito com os valores anteriores e posteriores, para auditoria.

**Conclusão**
- AC-16: Ao marcar uma tarefa como concluída no AgroecologIA, o item correspondente no Google Tasks é marcado como concluído; o evento no Calendar exibe o risco nativo do Google.
- AC-17: A conclusão é propagada ao Google Tasks em até 2 minutos.

**Worker e resiliência**
- AC-18: O worker de sync registra falhas de comunicação com a API do Google em log com nível de erro, e tenta novamente no ciclo seguinte de 1 minuto.
- AC-19: Falhas consecutivas (5 ou mais ciclos) geram alerta para o produtor na interface do app.
- AC-20: O worker opera de forma independente — falhas de sync não impactam o funcionamento normal do Kanban ou da Agenda.

## Technical Decisions
- OAuth 2.0 com escopos: `https://www.googleapis.com/auth/tasks` e `https://www.googleapis.com/auth/calendar.readonly`. Escopo de Calendar é somente leitura — o app não cria eventos diretamente no Calendar, apenas lê.
- Google Tasks API v1 para criação/atualização/exclusão de tasks e gerenciamento de listas.
- Google Calendar API v3 para leitura de eventos (polling com `updatedMin` para buscar apenas eventos modificados desde o último ciclo).
- Token OAuth armazenado criptografado (AES-256) no banco, vinculado à entidade `property` (não ao `user`) — nunca em texto simples. Um único token por propriedade.
- Worker implementado em `src/workers/` como job assíncrono separado. Intervalo configurável via variável de ambiente `GOOGLE_SYNC_POLL_INTERVAL_SECONDS` (default: 60).
- Registrar decisão de polling vs. webhooks em ADR.
- Campos novos no modelo `Task`:
  - `duration_minutes: int | None` — duração estimada em minutos (opcional)
  - `calendar_event_id: str | None` — ID do evento no Google Calendar (opcional)
  - `google_task_id: str | None` — ID da task no Google Tasks (opcional)
- Status novo: `pending_review` — usado para tarefas importadas do Calendar aguardando confirmação do produtor.
- Migration de banco necessária para adicionar os três campos ao modelo Task.

## Impact on Specs

- **Security:** tokens OAuth são dados altamente sensíveis — armazenar criptografados, nunca logar. O escopo de Calendar é read-only para minimizar superfície de ataque. Acesso às configurações de integração Google restrito ao admin da propriedade.
- **Compliance:** a integração lê eventos do calendário pessoal do produtor. Documentar claramente quais dados são lidos e armazenados; dados do Calendar não devem ser persistidos além do necessário para o mapeamento de IDs.
- **Scalability:** 1 polling/minuto por conta Google conectada. No MVP (1 propriedade, 2–3 contas) o volume é trivial. Avaliar rate limits da Google API antes de escalar para múltiplas propriedades.
- **Observability:** logar cada ciclo de polling (sucesso/falha/número de eventos processados). Métricas: `sync_poll_latency_ms`, `sync_conflicts_resolved_total`, `sync_errors_consecutive`.
- **Accessibility:** a fila de revisão deve ser operável com uma mão no mobile — ações de confirmar/descartar com gestos ou botões grandes.
- **i18n:** PT-BR. Nomes das listas no Google Tasks ("AgroecologIA", "memória") são criados em português.

## Rollout
- [ ] Feature flag: `FEATURE_GOOGLE_SYNC_ENABLED` (default: false até validação completa)
- [ ] Migração de banco: adicionar `duration_minutes`, `calendar_event_id`, `google_task_id` à tabela `tasks`
- [ ] Criar listas "AgroecologIA" e "memória" no Google Tasks na primeira autenticação (idempotente)
- [ ] Rollback: desativar feature flag para a propriedade; worker para de executar; tarefas existentes no Google Tasks permanecem mas param de ser atualizadas
- [ ] Validação pré-produção: testar ciclo completo (criar tarefa → verificar no Calendar → criar evento no Calendar → verificar na fila de revisão) em conta Google de teste
- [ ] Documentar configuração OAuth (Client ID, Client Secret) no `.env.example`

## Métricas de Sucesso
- Redução do tempo que o produtor passa alternando entre app e Google Calendar (meta: zero alternância para tarefas da propriedade)
- Taxa de itens da fila de revisão confirmados vs. descartados (meta: >60% confirmados indica que o polling está capturando eventos relevantes)
- Taxa de erros do worker de sync (meta: <1% dos ciclos com erro após estabilização)
- Latência média de propagação de tarefas do AgroecologIA ao Google Tasks (meta: <2 minutos)
