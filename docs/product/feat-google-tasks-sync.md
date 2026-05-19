# PRD: Integração Google Tasks

## Context
A propriedade tem uma conta Google dedicada ("conta da propriedade") que centraliza Calendar, Tasks, Drive e e-mail da operação — separada das contas pessoais dos usuários do app. Compromissos externos, visitas técnicas e entregas são registrados nessa conta.

A integração mantém o AgroecologIA como fonte de verdade das tarefas: todas as tarefas do app são empurradas para o Google Tasks da conta da propriedade. O Google Tasks reflete-se nativamente no Google Calendar — sem que o app precise falar com o Calendar diretamente. Tarefas criadas diretamente no Google Tasks entram no app como rascunhos para revisão.

A integração com o Google Calendar foi deliberadamente removida. O vínculo Calendar → AgroecologIA criava um laço fraco e incompleto: a informação chegava sem contexto suficiente (executor, cultura, tipo, impacto financeiro), exigindo revisão obrigatória para 100% dos itens. A cadeia AgroecologIA → Google Tasks → Google Calendar (nativo) cobre o caso de uso real sem essa complexidade.

## Objective
Manter o AgroecologIA como fonte de verdade das tarefas da propriedade enquanto as reflete automaticamente no Google Calendar via Google Tasks — sem exigir dupla manutenção.

## Scope

### Includes
- [x] Sincronização de todas as tarefas do AgroecologIA → Google Tasks (lista única "AgroecologIA") — decisão atualizada em 2026-05-13: lista "memória" foi removida; tarefas com e sem data vão para a mesma lista
- [x] Sync instantâneo via `BackgroundTasks` — após cada write no AgroecologIA, `push_task_now(task_id)` dispara fire-and-forget para o Google Tasks (latência ~1s, não 60s)
- [x] Google Tasks ↔ Google Calendar: gerenciado nativamente pelo Google; o app não interfaceia com o Calendar
- [x] Polling do Google Tasks a cada 60s como **fallback de reconciliação** — captura tarefas criadas diretamente no Google Tasks
- [x] Tarefas novas no Google Tasks entram como rascunho na fila "tarefas para revisar" (`is_pending_review = true`)
- [x] Interface de revisão: produtor confirma (confirma + abre modal de edição), edita ou descarta cada item
- [x] Tarefa concluída no AgroecologIA → marcada como concluída no Google Tasks → evento com risco no Calendar (comportamento nativo)
- [x] Campo `duration_minutes` no modelo Task (opcional) → informa duração estimada
- [x] OAuth 2.0 com escopo mínimo: `tasks` — autenticação da conta da propriedade, configurada pelo admin
- [x] Worker assíncrono dedicado para polling/reconciliação

### Excludes
- [ ] Integração direta com Google Calendar API
- [ ] Polling de eventos do Google Calendar
- [ ] Importação de eventos do Calendar como tarefas
- [ ] Sincronização de contatos ou outros recursos Google
- [ ] Suporte a múltiplas contas Google simultâneas por propriedade
- [ ] Conexão de contas Google pessoais individuais por usuário
- [ ] Sincronização bidirecional de subtarefas ou checklists
- [ ] Criação de eventos recorrentes via AgroecologIA → Calendar
- [ ] Notificações/lembretes do Calendar gerenciadas pelo AgroecologIA

## Not Doing (e por quê)

- **Integração direta AgroecologIA ↔ Google Calendar** — o vínculo Calendar → AgroecologIA cria tarefas fracas: sem executor, cultura, tipo ou impacto financeiro. 100% dos itens precisam de revisão manual, o que anula o benefício. A cadeia AgroecologIA → Google Tasks → Calendar (nativo) resolve o sentido útil sem essa complexidade.
- **Resolução inteligente de conflitos de edição** — "última edição ganha" é suficiente. O app é fonte de verdade; edições feitas diretamente no Google Tasks em tarefas existentes são ignoradas.
- **Sync em tempo real (webhook)** — Google Tasks não suporta push notifications recebidos. Mas o sentido AgroecologIA → Google é instantâneo via `BackgroundTasks` (não polling). O polling de 60s só existe para o sentido Google → AgroecologIA (capturar tarefas criadas direto no Google Tasks).
- **Importação automática sem fila de revisão** — tarefas criadas diretamente no Google Tasks entram como rascunho por design: o AgroecologIA não conhece o contexto. A revisão protege a integridade do Kanban.

## User Stories

- Como **produtor (admin)**, quero conectar a conta Google da propriedade nas configurações do app, para que todas as tarefas da propriedade sejam sincronizadas sem que cada usuário precise configurar nada.
- Como **produtor**, quero que as tarefas com data do AgroecologIA apareçam automaticamente no Calendar da propriedade via Google Tasks, para ter uma visão unificada do dia sem abrir dois sistemas.
- Como **produtor**, quero que tarefas sem data fiquem visíveis na lista "memória" do Google Tasks, para consultá-las no celular mesmo sem abrir o app.
- Como **produtor**, quero que cada tarefa no Google Tasks mostre quem é o executor como etiqueta nas notes, para identificar responsabilidades de relance.
- Como **produtor**, quero que tarefas criadas diretamente no Google Tasks apareçam no AgroecologIA para revisão, para não perder itens adicionados fora do app.
- Como **produtor**, quero revisar e confirmar cada tarefa importada antes que ela entre no Kanban, para que só tarefas relevantes contaminem a agenda.
- Como **produtor**, quero que ao concluir uma tarefa no AgroecologIA o item correspondente apareça como concluído no Google Tasks, para que o Calendar reflita o que aconteceu.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Faixa "Tarefas do Google Tasks para revisar": aparece no topo do Kanban apenas quando há itens na fila. Desaparece quando a fila está vazia.
- Card de revisão: exibe título, data (se houver), e ações "Confirmar", "Editar" e "Descartar".
- Indicador de sync: ícone de status visível nas configurações.
- Configuração OAuth: tela de configurações com botão "Conectar conta Google" e status da conexão.

## Acceptance Criteria

**Autenticação OAuth — conta da propriedade**
- AC-1: O admin conecta a conta Google da propriedade via OAuth 2.0 nas configurações; o token é armazenado criptografado no banco vinculado à propriedade, não ao usuário.
- AC-2: O fluxo de reconexão é disparado quando o token expira; o admin recebe alerta para reautenticar.
- AC-3: O admin pode desconectar a conta Google a qualquer momento; a desconexão para o sync sem apagar tarefas já criadas no AgroecologIA.

**AgroecologIA → Google Tasks**
- AC-4: Toda tarefa do AgroecologIA é enviada para a lista única "AgroecologIA" com: título, notas, data de vencimento (se houver `scheduled_window_end`) e etiqueta `[executor: ...]`.
- AC-5: (removido em 2026-05-13 — lista "memória" eliminada; todas as tarefas vão para a lista única).
- AC-6: Edições no título, descrição, data ou executor de uma tarefa no AgroecologIA são propagadas ao Google Tasks **instantaneamente** via `BackgroundTasks` (latência ~1s).
- AC-7: Tarefas deletadas no AgroecologIA são removidas do Google Tasks.

**Google Tasks → AgroecologIA**
- AC-8: O worker faz polling do Google Tasks a cada 60s (fallback de reconciliação) e detecta tarefas novas criadas diretamente lá.
- AC-9: Tarefas detectadas que não possuem `google_task_id` correspondente no AgroecologIA entram na fila "tarefas para revisar".
- AC-10: O rascunho importado contém: título, data (se houver), `executor: nao_atribuido` e `financial_score: 0`.
- AC-11: O produtor pode: confirmar (a tarefa entra no Kanban), editar antes de confirmar, ou descartar.
- AC-12: Tarefas descartadas não reaparecem na fila em pollings subsequentes.
- AC-13: Edições feitas diretamente no Google Tasks em tarefas já existentes no app são ignoradas (app é fonte de verdade).

**Conclusão**
- AC-14: Ao marcar uma tarefa como concluída no AgroecologIA, o item correspondente no Google Tasks é marcado como concluído; o evento no Calendar exibe o risco nativo.
- AC-15: A conclusão é propagada ao Google Tasks instantaneamente via `BackgroundTasks` (latência ~1s).

**Worker e resiliência**
- AC-16: O worker registra falhas em log com nível de erro e tenta novamente no ciclo seguinte.
- AC-17: Falhas consecutivas (5 ou mais ciclos) geram alerta para o produtor na interface.
- AC-18: Falhas de sync não impactam o funcionamento normal do Kanban ou da Agenda.

## Technical Decisions
- OAuth 2.0 com escopo: `https://www.googleapis.com/auth/tasks` apenas. Sem acesso ao Calendar.
- Google Tasks API v1 para criação/atualização/exclusão de tasks e gerenciamento de listas.
- Token OAuth armazenado criptografado (AES-256) no banco, vinculado à entidade `property`. Um único token por propriedade. Ver [[adr-009-autenticacao]].
- Sync instantâneo: `push_task_now(task_id)` via `BackgroundTasks` do FastAPI em todo endpoint de write (`POST/PUT/PATCH/DELETE /tasks`).
- Worker de reconciliação em `main.py` (lifespan) para `poll_tasks()`. Intervalo configurável via `GOOGLE_SYNC_POLL_INTERVAL_SECONDS` (default: 60).
- Campos no modelo `Task`:
  - `duration_minutes: int | None` — duração estimada em minutos (opcional)
  - `google_task_id: str | None` — ID da task no Google Tasks
  - `is_pending_review: bool` — tarefa importada aguardando confirmação do produtor
- App é fonte de verdade: edições no Google Tasks em tarefas já existentes são ignoradas no pull.

## Impact on Specs

- **Security:** tokens OAuth armazenados criptografados, nunca logados. Escopo limitado a Tasks (sem Calendar). Acesso às configurações de integração restrito ao admin da propriedade.
- **Scalability:** 1 polling/minuto por conta Google conectada. No MVP o volume é trivial.
- **Observability:** logar cada ciclo (sucesso/falha/número de tarefas processadas).

## Rollout
- [x] Feature flag: `FEATURE_GOOGLE_SYNC_ENABLED` (ativo em produção)
- [x] Migração de banco: `google_task_id`, `is_pending_review`, `duration_minutes` — já aplicados
- [x] Migration 002: remoção de `calendar_event_id` (task) e `google_last_poll_token` (property_settings)
- [x] Lista única "AgroecologIA" criada na primeira autenticação (idempotente) — lista "memória" foi removida em 2026-05-13
- [ ] Reconexão OAuth necessária: o escopo mudou (removido `calendar.readonly`); o token atual ainda funciona para Tasks, mas na próxima reconexão o escopo será menor. Não há urgência.

## Relacionados

- [[adr-009-autenticacao]] — política de armazenamento de tokens OAuth Google (criptografados)
- [[adr-002-sync-offline]] — operation log conceitual aplicável quando o sync offline for implementado
- [[feat-agenda]] — tarefas sincronizadas aparecem no Kanban da Agenda
- [[feat-compras]] — próxima feature que estende esta integração (lista "lista de compras")
- [[feat-gmail-financeiro]] — reutiliza o mesmo fluxo OAuth Google (escopo Gmail adicional)
- [[feat-onboarding]] — admin conecta a conta Google da propriedade no fluxo de setup inicial
