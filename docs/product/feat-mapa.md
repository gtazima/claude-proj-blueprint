# PRD: Módulo Mapa

## Context
A propriedade tem talhões, estruturas, sistemas de irrigação e pontos de automação distribuídos geograficamente. Hoje não existe uma forma visual de ver o estado de tudo ao mesmo tempo — o produtor precisa navegar entre módulos separados para entender o que está acontecendo em cada área.

O mapa é o dashboard gerencial da propriedade. Ele não armazena dados próprios — consome informações dos outros módulos (Culturas, Agenda, Automação) e apresenta tudo com contexto espacial. Uma tarefa pendente no talhão 2, um setor de irrigação ligado há 3 horas, um lote de shiitake em janela de frutificação — tudo visível em uma única tela.

## Objective
Oferecer uma visão geográfica integrada da propriedade onde o produtor vê o estado atual de talhões, estruturas e automações, acessa alertas e navega para a informação relevante sem sair do mapa.

## Scope

### Includes
- [ ] Importação de KML/KMZ exportado do Google Earth para criar a base do mapa da propriedade
- [ ] Desenho e edição de áreas (talhões, estruturas) diretamente na ferramenta com polígonos e marcadores
- [ ] Associação de cada área desenhada a uma cultura/unidade de gestão do módulo Culturas
- [ ] Overlay de status por área: cultura atual, estágio do ciclo, indicador visual de saúde (verde/amarelo/vermelho)
- [ ] Marcadores de sensores e pontos de automação com estado em tempo real (ligado/desligado, valor atual, tempo decorrido)
- [ ] Alertas visuais no mapa: tarefas pendentes urgentes, manutenções atrasadas, colheitas na janela — com acesso rápido à informação completa
- [ ] Toque em qualquer elemento do mapa abre painel lateral com resumo e link para o módulo correspondente
- [ ] Funcionamento offline com última versão sincronizada do mapa

### Excludes
- [ ] Sincronização bidirecional com Google Earth
- [ ] Análise geoespacial avançada (NDVI, sensoriamento remoto, imagens de satélite atualizadas)
- [ ] Rastreamento GPS de pessoas ou equipamentos em movimento
- [ ] Mapa colaborativo com edição simultânea por múltiplos usuários

## Not Doing (e por quê)

- **Sincronização bidirecional com Google Earth** — importar KML é simples e suficiente. Manter sincronização bidirecional exige integração contínua com a API do Google Earth e adiciona complexidade sem valor proporcional. O mapa no AgroecologIA é a fonte de verdade após a importação inicial.
- **Imagens de satélite atualizadas** — Google Maps/Satellite já oferece isso como camada base. Imagens proprietárias atualizadas (ex: Planet, Sentinel) são custo e complexidade desnecessários no MVP.
- **Análise de vegetação por NDVI ou drones** — tecnologia avançada para um estágio posterior quando a propriedade tiver instrumentação adequada.
- **Edição colaborativa simultânea** — a propriedade tem poucos usuários; conflitos de edição simultânea são improvável e a solução seria desproporcional ao problema.

## User Stories

- Como **produtor**, quero importar meu KML do Google Earth e ter a propriedade já mapeada no sistema sem precisar redesenhar tudo do zero, para não perder o trabalho já feito.
- Como **produtor**, quero ver no mapa o status atual de cada talhão (qual cultura, em que estágio, algum alerta), para ter uma leitura rápida da propriedade sem navegar entre módulos.
- Como **produtor**, quero ver no mapa onde está cada sensor de umidade e se o setor de irrigação correspondente está ligado — com o tempo decorrido e o tempo restante programado, para acompanhar a irrigação de qualquer ponto da propriedade.
- Como **produtor**, quero tocar em um talhão com alerta vermelho e ser levado diretamente à tarefa urgente ou ao registro de colheita correspondente, para agir rapidamente sem perder tempo navegando.
- Como **produtor**, quero desenhar um novo talhão diretamente no mapa quando faço um novo plantio, para manter o mapa atualizado sem sair da ferramenta.
- Como **pai**, quero abrir o mapa e ver de relance se alguma área tem alerta crítico, para ter consciência situacional da propriedade mesmo sem acompanhar o dia a dia do campo.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Camada base: Google Maps Satellite (imagem aérea da propriedade como fundo).
- Polígonos de talhões sobrepostos com preenchimento semitransparente colorido por status: verde (normal), amarelo (atenção — tarefa próxima ou estágio de transição), vermelho (alerta — tarefa urgente, manutenção atrasada, colheita na janela).
- Marcadores de sensores/automações com ícone e indicador de estado (verde = ativo/normal, cinza = inativo, vermelho = alerta).
- Painel lateral deslizável: ao tocar em qualquer elemento, abre resumo compacto com dados do módulo correspondente e botão "Ver detalhes".
- Mobile: mapa ocupa tela inteira com controles mínimos; painel lateral ocupa 60% da tela quando aberto.

## Acceptance Criteria

**Importação e desenho**
- AC-1: O produtor importa um arquivo KML ou KMZ exportado do Google Earth; polígonos e marcadores são renderizados corretamente sobre a imagem de satélite.
- AC-2: O produtor desenha um novo polígono diretamente no mapa tocando em vértices sequenciais; o polígono é salvo com nome e associado a uma cultura/unidade de gestão.
- AC-3: O produtor edita um polígono existente movendo vértices ou renomeando a área.
- AC-4: Cada área desenhada pode ser associada a uma ou mais unidades de gestão do módulo Culturas (ex: talhão 1 de café, lotes de shiitake na estufa).

**Status e overlays**
- AC-5: Cada área associada a uma cultura exibe cor de status baseada no estado atual: verde (sem alertas), amarelo (tarefa agendada nos próximos 3 dias ou estágio de transição), vermelho (tarefa urgente, manutenção atrasada ou colheita na janela).
- AC-6: Ao tocar em uma área, o painel lateral exibe: cultura, unidade de gestão, estágio atual, próxima tarefa agendada e eventuais alertas.
- AC-7: O painel lateral tem botão "Ver detalhes" que navega para o módulo correspondente (Culturas, Agenda ou Manutenção).

**Sensores e automações**
- AC-8: Pontos de sensor e automação são marcados no mapa com ícone diferenciado por tipo (sensor de umidade, sensor de temperatura, válvula de irrigação, nebulizador, outro).
- AC-9: Marcadores de automação ativa exibem: estado (ligado/desligado), tempo decorrido desde ativação e tempo restante programado (quando aplicável).
- AC-10: Marcadores com leitura fora do intervalo esperado (ex: umidade muito baixa) exibem alerta visual em vermelho.
- AC-11: Ao tocar em um marcador de sensor/automação, o painel lateral exibe leitura atual, histórico das últimas 24h em gráfico simples e controles de acionamento (quando o módulo Automação estiver ativo).

**Offline**
- AC-12: O mapa funciona offline com a última versão sincronizada — polígonos, marcadores e status são visíveis sem conexão.
- AC-13: No modo offline, sensores e automações exibem o último valor conhecido com indicador de "dados offline — última atualização às HH:MM".

## Technical Decisions
- Biblioteca de mapas: Mapbox GL JS ou Leaflet com plugin de desenho — avaliar custo (Mapbox tem free tier generoso) vs. flexibilidade. Registrar decisão em ADR.
- Importação KML/KMZ: parsear no frontend com biblioteca como `@tmcw/togeojson` e converter para GeoJSON — formato padrão para armazenamento e renderização.
- Overlays de status são calculados em tempo real cruzando dados de Culturas, Agenda e Automação — o mapa não armazena estado próprio, apenas consome APIs internas.
- Controles de automação no mapa (ligar/desligar irrigação diretamente) dependem do módulo Automação estar implementado — o mapa renderiza os controles mas delega a ação à API de Automação.

## Impact on Specs

- **Security:** o mapa revela o layout físico completo da propriedade — dado sensível. Acesso deve seguir o modelo de perfis; usuários com acesso restrito por cultura não devem ver áreas de outras culturas no mapa.
- **Data Architecture:** GeoJSON é o formato de armazenamento para geometrias. Polígonos e marcadores são entidades separadas com referências para os módulos que representam.
- **Observability:** sem métricas críticas específicas. Logar falhas de importação KML.
- **Scalability:** sem impacto relevante — uma propriedade pequena tem dezenas de polígonos, não milhares.
- **Accessibility:** mapa é inerentemente visual — garantir que informações críticas (alertas, status) também estejam acessíveis via lista textual alternativa para usuários que não conseguem interpretar o mapa.
- **i18n:** PT-BR. Sem necessidade agora.

## Rollout
- [ ] Sem feature flag
- [ ] Primeira configuração: importar KML do Google Earth ou desenhar a propriedade do zero
- [ ] Sensores e automações no mapa ficam inativos até o módulo Automação estar implementado — marcadores aparecem sem dados em tempo real
- [ ] Rollback: módulo puramente visual — desativar não afeta nenhum outro módulo
- [ ] Validação: verificar importação do KML da propriedade específica antes de considerar o módulo pronto

## Relacionados

- [[adr-014-biblioteca-de-mapas]] — decisão Mapbox GL JS; plano de saída para MapLibre
- [[adr-003-controle-acesso-por-cultura]] — usuários com filtro de cultura veem apenas áreas das suas culturas permitidas
- [[adr-002-sync-offline]] — AC-12 e AC-13: mapa offline com última versão cacheada
- [[feat-automacao]] — sensores e dispositivos aparecem como marcadores com dados em tempo real
- [[feat-culturas]] — talhões do mapa são vinculados a culturas e ciclos
- [[feat-agenda]] — alertas visuais no mapa (AC-5, AC-6) levam à tarefa pendente
