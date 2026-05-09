# PRD: Módulo Manutenção

## Context
Manutenções preventivas simples são esquecidas até virar problema maior. Não existe histórico de o que foi feito, quando, em qual equipamento ou estrutura. Insumos para manutenção chegam tarde porque ninguém foi lembrado de comprar no momento certo.

O padrão é idêntico ao da colheita: falta de memória externa para registrar e disparar alertas. Um equipamento que precisaria de troca de óleo a cada 100 horas nunca recebe essa manutenção no prazo porque ninguém sabe quantas horas ele rodou.

## Objective
Construir o histórico de manutenção de todos os equipamentos e estruturas da propriedade, com alertas preventivos automáticos e geração proativa de lista de compras de insumos antes que a manutenção chegue.

## Scope

### Includes
- [ ] Cadastro de equipamentos e estruturas com nome, tipo, data de aquisição e observações
- [ ] Registro de manutenção realizada: data, tipo (preventiva/corretiva), descrição, executor, insumos utilizados e custo
- [ ] Configuração de intervalos de manutenção preventiva por equipamento (ex: troca de óleo a cada 3 meses ou 100h de uso)
- [ ] Alertas automáticos na Agenda quando manutenção preventiva está se aproximando
- [ ] Lista de compras proativa: quando uma manutenção preventiva se aproxima, listar os insumos necessários com antecedência configurável (ex: 2 semanas antes)
- [ ] Histórico completo de manutenções por equipamento/estrutura
- [ ] Registro de horas de uso para equipamentos com intervalo baseado em uso (não apenas tempo)
- [ ] Entrada por voz para registro rápido no campo
- [ ] Anexo de manual do equipamento: upload de PDF com indicação de página de referência por item de manutenção — acessível diretamente da tela do equipamento

### Excludes
- [ ] Gestão de garantia ou contratos de assistência técnica
- [ ] Orçamentos e cotações de peças ou serviços
- [ ] Integração com fornecedores externos

## Not Doing (e por quê)

- **Rastreamento automático de horas de uso via sensor** — requer integração com IoT ainda não definida. No MVP, horas de uso são registradas manualmente pelo produtor. Automação vem com o módulo de Automação.
- **Gestão de estoque de peças e insumos de manutenção** — a lista de compras proativa é suficiente para o MVP. Um módulo de estoque completo é complexidade prematura para uma propriedade de pequeno porte.
- **Manutenção de veículos com integração OBD** — fora do escopo; aumenta complexidade sem valor proporcional no contexto agroecológico.
- **Notificação para fornecedores ou prestadores de serviço** — o sistema gera a tarefa e a lista de compras; o contato com terceiros é feito pelo produtor.

## User Stories

- Como **produtor**, quero receber uma tarefa na Agenda antes da data de uma manutenção preventiva, para nunca deixar um equipamento crítico passar da data sem manutenção.
- Como **produtor**, quero ver a lista de insumos que precisarei comprar para as manutenções das próximas 2 semanas, para fazer uma compra planejada sem viagens de urgência.
- Como **produtor**, quero registrar rapidamente por voz que fiz a troca de óleo do trator hoje, para que o histórico seja atualizado sem esforço.
- Como **produtor**, quero ver o histórico completo de um equipamento, para entender o padrão de falhas e decidir se vale reparar ou substituir.
- Como **pai**, quero ver a lista de compras de insumos de manutenção gerada automaticamente, para incluir esses itens nas compras que já faço regularmente.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Duas visões principais: lista de equipamentos/estruturas com indicador de status da próxima manutenção (verde/amarelo/vermelho por proximidade), e linha do tempo de histórico por item.
- Lista de compras de manutenção deve ser exportável ou compartilhável (copiar para WhatsApp) — o pai usa isso para as compras.
- Registro rápido: campo de voz com um toque, associado ao equipamento selecionado.

## Acceptance Criteria

**Cadastro**
- AC-1: O produtor pode cadastrar um equipamento ou estrutura com: nome, tipo (equipamento motorizado, equipamento manual, estrutura, sistema de irrigação, outro), data de aquisição e observações livres.
- AC-2: Cada equipamento pode ter múltiplos intervalos de manutenção preventiva configurados (ex: troca de óleo a cada 3 meses E revisão completa a cada 12 meses).
- AC-3: Intervalos de manutenção podem ser definidos por tempo (dias) ou por uso (horas), ou ambos — o que chegar primeiro dispara o alerta.

**Registro de manutenção**
- AC-4: O produtor registra uma manutenção realizada informando: data, tipo (preventiva/corretiva), descrição em texto ou voz, executor e lista de insumos utilizados com quantidades.
- AC-5: Ao registrar uma manutenção preventiva, o sistema recalcula automaticamente a data da próxima manutenção com base no intervalo configurado.
- AC-6: O registro de manutenção gera automaticamente uma entrada no caderno de campo com os mesmos dados.
- AC-7: O produtor pode registrar horas de uso de um equipamento; o sistema usa esse valor para calcular quando a próxima manutenção baseada em uso é devida.

**Alertas e lista de compras**
- AC-8: Quando uma manutenção preventiva está a N dias (configurável por equipamento, padrão: 14 dias), o sistema cria automaticamente uma tarefa na Agenda com prioridade calculada pelo prazo.
- AC-9: A lista de compras proativa consolida todos os insumos necessários para manutenções previstas nas próximas 2 semanas (configurável), agrupados por categoria.
- AC-10: A lista de compras pode ser copiada como texto simples para envio por WhatsApp.
- AC-11: Equipamentos com manutenção atrasada (data já passou sem registro) aparecem destacados em vermelho na lista de equipamentos.

**Histórico**
- AC-12: O produtor vê o histórico completo de manutenções de um equipamento em ordem cronológica, com todos os registros e insumos utilizados.
- AC-13: O sistema exibe o intervalo médio real entre manutenções corretivas de um equipamento — para identificar padrões de falha recorrente.
- AC-14: O produtor pode anexar um PDF de manual ao equipamento e indicar o número de página relevante para cada item de manutenção configurado; o PDF abre direto na página indicada.
- AC-15: Manuais anexados ficam disponíveis offline após o primeiro download.

## Technical Decisions
- Lista de compras proativa deve consolidar insumos de Manutenção e futuramente de outros módulos (ex: insumos agrícolas do módulo Culturas) em uma única visão de compras. Registrar integração futura em ADR.
- Alertas de manutenção usam o mesmo mecanismo de geração de tarefas automáticas da Agenda definido no módulo Culturas — não criar sistema paralelo.

## Impact on Specs

- **Security:** sem dados sensíveis além dos já cobertos pelo modelo de perfis de usuário existente.
- **Observability:** logar alertas de manutenção gerados e taxa de execução no prazo — métrica de valor do módulo.
- **Accessibility:** registro por voz é crítico — o produtor frequentemente registra manutenções com mãos sujas ou ocupadas.
- **Scalability:** sem impacto relevante no MVP. Histórico de manutenções cresce lentamente.
- **Compliance:** registros de manutenção de equipamentos podem ser relevantes para certificação orgânica e segurança do trabalho no futuro. Estrutura de dados deve preservar rastreabilidade.
- **i18n:** PT-BR. Sem necessidade agora.

## Rollout
- [ ] Sem feature flag
- [ ] Seed inicial: produtor cadastra manualmente os equipamentos e estruturas da propriedade na primeira configuração
- [ ] Rollback: sem dependências críticas de outros módulos — pode ser desativado sem impacto na Agenda ou Culturas
- [ ] Validação: revisar com o produtor os intervalos de manutenção configurados antes de ativar alertas automáticos
