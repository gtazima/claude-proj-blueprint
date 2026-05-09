	# PRD: Módulo Caderno de Campo

## Context
Hoje o conhecimento gerado no campo — observações, decisões, problemas encontrados, condições do dia — vai para a cabeça do agricultor e some. Não existe registro sistemático de nada que não seja uma tarefa formal.

O caderno de campo é a interface de entrada de conhecimento não estruturado do sistema. Ele recebe dois tipos de entrada: automáticas (tarefas concluídas, colheitas registradas por outros módulos) e manuais (observações livres do agricultor em texto, áudio ou foto). A IA processa esse conteúdo e transforma observações em ações estruturadas: tarefas, alertas, atualizações de ciclo, insights sazonais.

Este é o módulo que transforma o AgroecologIA de um app de gestão em um sistema que aprende com a propriedade ao longo do tempo.

## Objective
Capturar todo o conhecimento gerado na propriedade — estruturado ou não — e transformá-lo automaticamente em memória de contexto ativa, alimentando a Agenda com tarefas inferidas e a IA com histórico real da operação.

## Scope

### Includes
- [ ] Registro de observação livre em texto digitado, áudio (transcrição automática) ou foto com descrição
- [ ] Entradas automáticas geradas por outros módulos: tarefa concluída (Agenda), colheita registrada (Culturas)
- [ ] Associação de cada entrada a: cultura/módulo relacionado, unidade de gestão (lote, talhão, enxame), executor, data/hora
- [ ] Processamento automático por IA: extrair de observações livres — tarefas sugeridas, datas de repetição, alertas, atualizações de ciclo
- [ ] Sugestões da IA apresentadas ao produtor para aprovação antes de virar ação (tarefa criada, ciclo atualizado, alerta disparado)
- [ ] Busca no histórico por cultura, data, executor, palavra-chave ou similaridade semântica
- [ ] Funcionamento offline: entradas criadas sem internet ficam em fila e sincronizam ao reconectar
- [ ] Transcrição de áudio offline (modelo local leve) ou na nuvem quando conectado

### Excludes
- [ ] Geração autônoma de ações sem aprovação do produtor — a IA sugere, o produtor decide
- [ ] Análise agronômica especializada (ex: diagnóstico de doença a partir de foto) — usa IA base; diagnósticos aprofundados são escopo futuro
- [ ] Exportação de relatórios formatados (módulo a definir)
- [ ] Comentários ou colaboração entre usuários em uma mesma entrada

## Not Doing (e por quê)

- **Ações automáticas sem aprovação** — o caderno pode identificar "contaminação por trichoderma no lote 003" e sugerir uma tarefa de inspeção e isolamento, mas nunca cria a tarefa sem o produtor confirmar. O agricultor tem contexto que o sistema não tem; autonomia total da IA aqui seria perigosa.
- **Vídeo** — texto e áudio cobrem os casos de uso principais com muito menos complexidade de armazenamento e processamento. Vídeo pode entrar no futuro se houver demanda comprovada.
- **Entrada via WhatsApp** — o funcionário usa WhatsApp apenas para receber. Criar uma via de entrada de dados por WhatsApp adiciona complexidade de parsing e abre superfície de erro. O produtor e o pai usam o app.
- **Edição retroativa de entradas automáticas** — entradas geradas automaticamente (tarefa concluída, colheita) são imutáveis para preservar integridade do histórico. O produtor pode adicionar uma observação complementar, mas não editar o registro original.
- **Categorização manual obrigatória** — o produtor não precisa classificar a entrada antes de salvar. A IA faz a categorização; o produtor valida. Obrigar categorização prévia aumenta o atrito e reduz o uso.

## User Stories

- Como **produtor**, quero falar em voz alta o que observei no campo e ter isso transcrito e processado automaticamente, para registrar conhecimento sem parar o trabalho ou tirar as mãos da terra.
- Como **produtor**, quero que ao dizer "as toras do lote 003 estão com trichoderma" o sistema me sugira automaticamente as próximas ações (inspecionar, isolar, registrar no ciclo do lote), para não precisar pensar no que fazer com a observação.
- Como **produtor**, quero buscar no histórico tudo que aconteceu com o shiitake no último ano, para entender padrões sazonais e tomar decisões melhores de inoculação.
- Como **produtor**, quero ver todas as entradas do dia agrupadas em uma linha do tempo, para ter uma visão do que foi feito e observado sem precisar navegar entre módulos.
- Como **produtor**, quero que tarefas concluídas e colheitas registradas apareçam automaticamente no caderno sem nenhuma ação extra da minha parte, para que o histórico se construa com o menor esforço possível.
- Como **pai**, quero registrar rapidamente uma observação sobre uma compra ou negociação associada a uma cultura, para que essa informação fique no histórico e seja considerada pela IA.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Interface principal: linha do tempo reversa (mais recente no topo) com entradas do dia agrupadas por data.
- Entrada rápida: botão flutuante sempre visível no mobile — um toque para abrir, escolher texto/áudio/foto e salvar. Fluxo máximo de 3 toques.
- Sugestões da IA aparecem como cards destacados abaixo da entrada que as originou, com ações de "Aprovar" e "Ignorar" bem visíveis.
- Entradas automáticas (tarefas concluídas, colheitas) aparecem com visual diferenciado (cor ou ícone) para distinguir de observações manuais.

## Acceptance Criteria

**Entrada manual**
- AC-1: O produtor consegue criar uma entrada de texto livre em no máximo 3 toques a partir de qualquer tela do app.
- AC-2: O produtor consegue gravar um áudio; o sistema transcreve automaticamente (offline: modelo local; online: API de transcrição) e salva texto + áudio original.
- AC-3: O produtor consegue tirar uma foto e adicionar uma descrição em texto; foto e texto são salvos juntos como uma entrada.
- AC-4: Toda entrada manual pode ser associada opcionalmente a uma cultura e unidade de gestão; se não associada, fica como entrada geral da propriedade.
- AC-5: Entradas criadas offline ficam em fila local com indicador visual de "pendente de sync" e sincronizam automaticamente ao reconectar.

**Entradas automáticas**
- AC-6: Ao concluir uma tarefa na Agenda, uma entrada é criada automaticamente no caderno com: título da tarefa, executor, data/hora de conclusão e justificativa de adiamento (se houver histórico de adiamentos).
- AC-7: Ao registrar uma colheita no módulo Culturas, uma entrada é criada automaticamente com: cultura, unidade de gestão, data, quantidades registradas e executor.
- AC-8: Entradas automáticas são marcadas visualmente como "gerado automaticamente" e não podem ser editadas — apenas complementadas com uma observação adicional.

**Processamento por IA**
- AC-9: Após salvar uma observação livre, a IA analisa o conteúdo e, quando relevante, apresenta sugestões em até 10 segundos (online) ou na próxima sincronização (offline).
- AC-10: Sugestões possíveis da IA incluem: criar tarefa, atualizar estágio de ciclo de uma unidade, registrar alerta recorrente, identificar padrão sazonal.
- AC-11: Cada sugestão exibe: o que será feito, por que foi sugerido (trecho da observação que a originou) e botões "Aprovar" / "Ignorar".
- AC-12: Sugestões aprovadas criam a ação correspondente no módulo correto (tarefa na Agenda, atualização no módulo Culturas) com referência à entrada do caderno que a originou.
- AC-13: Sugestões ignoradas ficam registradas como ignoradas — a IA não repete a mesma sugestão para a mesma observação.

**Busca e histórico**
- AC-14: O produtor consegue buscar entradas por: cultura, unidade de gestão, executor, intervalo de datas e palavra-chave no texto.
- AC-15: A busca semântica permite encontrar entradas por intenção (ex: buscar "problemas com fungo" retorna entradas sobre trichoderma, contaminação, mesmo sem essas palavras exatas).
- AC-16: A linha do tempo exibe entradas de todos os tipos (manuais + automáticas) em ordem cronológica reversa, com filtros por tipo e por cultura.

## Technical Decisions
- Transcrição de áudio offline requer modelo local leve (ex: Whisper tiny/base). Avaliar tamanho do modelo vs. qualidade aceitável para PT-BR. Registrar decisão em ADR.
- Busca semântica requer embeddings — definir se roda localmente ou via API do provedor de IA. Registrar em ADR de long-term memory (já existe spec em `docs/specs/long-term-memory/`).
- Pipeline de processamento de IA (observação → sugestões) deve usar a camada `AIProvider` plugável — nunca chamar provedor diretamente.
- Entradas do caderno são a principal fonte de memória de contexto da IA em toda a aplicação. O schema de armazenamento deve ser projetado para consulta eficiente por similaridade semântica.

## Impact on Specs

- **AI/ML:** módulo central para a camada de IA. Define o contrato entre entrada de dados não estruturados e geração de sugestões. Requer evals para medir qualidade das sugestões geradas.
- **Data Architecture:** entradas crescem continuamente e são consultadas por similaridade semântica. Requer estratégia de indexação e eventual arquivamento de entradas antigas sem perder capacidade de busca.
- **Security:** observações de campo podem conter informações sensíveis da operação. Acesso ao caderno deve seguir o mesmo controle por perfil da Agenda.
- **Observability:** logar taxa de aprovação vs. rejeição de sugestões da IA — métrica central para avaliar qualidade do processamento ao longo do tempo.
- **Accessibility:** entrada rápida no campo com mãos ocupadas — áudio é o modo principal. Interface deve funcionar com uma mão e tela suja.
- **Compliance:** áudios e fotos são dados gerados pelo usuário. Política de retenção e deleção deve ser definida antes do lançamento para outros produtores.
- **i18n:** PT-BR. Modelo de transcrição de áudio deve ter boa performance em PT-BR — validar antes de escolher.

## Rollout
- [ ] Sem feature flag — módulo que alimenta a memória da IA deve estar ativo desde o primeiro uso
- [ ] Entradas automáticas (Agenda + Culturas) funcionam desde o dia 1; entradas manuais dependem do app mobile estar disponível
- [ ] Modelo de transcrição offline deve ser baixado no primeiro uso do app (com indicador de progresso)
- [ ] Rollback: desativar processamento de IA não afeta o registro de entradas — o caderno continua funcionando como log simples
