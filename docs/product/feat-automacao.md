# PRD: Módulo Automação

## Context
Hoje todas as automações da propriedade são manuais ou mecânicas — irrigação por timer físico, temperatura e umidade controladas manualmente. O produtor com pouca mão de obra é altamente dependente de automação; quem já usa sabe que não volta atrás.

A stack de hardware ainda está sendo estudada (Arduino, ESP32, controladores comerciais). Este PRD define o que o sistema precisa fazer — monitorar, alertar e controlar — sem comprometer a escolha tecnológica, que será definida em ADR específico quando o hardware for escolhido.

## Objective
Integrar sensores e dispositivos de automação da propriedade ao AgroecologIA, oferecendo monitoramento em tempo real, alertas automáticos fora de faixa e controle remoto dos sistemas — com os dados alimentando os demais módulos (Mapa, Culturas, Caderno de Campo).

## Scope

### Includes
- [ ] Monitoramento em tempo real de sensores: umidade do solo, temperatura ambiente, umidade relativa do ar, pluviômetro, anemômetro
- [ ] Controle remoto de dispositivos: válvulas de irrigação por gotejamento (por setor), nebulizador, ar condicionado de ambientes controlados
- [ ] Configuração de faixas de operação por sensor/dispositivo (ex: umidade do solo entre 60-80%)
- [ ] Alertas automáticos na Agenda quando leitura sai da faixa configurada
- [ ] Automações condicionais simples: se umidade < X%, ligar irrigação do setor Y por Z minutos
- [ ] Histórico de leituras por sensor com visualização em gráfico por período
- [ ] Programação de horários para dispositivos (ex: irrigar setor 1 às 06h por 30 minutos)
- [ ] Log de acionamentos: quando cada dispositivo foi ligado, por quanto tempo, por qual gatilho (manual, horário, automação condicional)
- [ ] Dados climáticos externos: integração com API meteorológica para temperatura, chuva e vento previstos
- [ ] Camada de abstração de hardware: interface única independente do fabricante/protocolo do dispositivo

### Excludes
- [ ] Desenvolvimento de firmware para hardware específico
- [ ] Automações complexas com lógica encadeada (se A e B então C senão D) — interface progressiva: formulário simples para regras básicas, editor avançado para usuários com maior capacidade técnica
- [ ] Integração com sistemas SCADA industriais
- [ ] Controle de equipamentos motorizados pesados (trator, roçadeira)

## Not Doing (e por quê)

- **Automação totalmente autônoma sem supervisão** — ligar ou desligar irrigação automaticamente com base em sensor é válido para regras simples e bem definidas. Ações com maior impacto (ex: ligar ar condicionado da câmara de frutificação de shiitake) devem notificar o produtor antes de agir. O nível de autonomia é configurável por dispositivo.
- **Firmware e hardware próprios** — o produto é software. A camada de abstração de hardware garante que qualquer dispositivo compatível (MQTT, HTTP, Modbus) possa ser integrado sem alterar o núcleo do sistema.
- **Interface visual de fluxos no MVP (tipo Node-RED)** — lógica encadeada é suportada, mas a interface visual de programação por blocos é complexidade de UI para o MVP. A lógica avançada é configurada via editor de regras estruturado no MVP e pode evoluir para interface visual em versão futura.
- **Integração com estação meteorológica própria no MVP** — sensores físicos de clima são parte do roadmap de hardware. No MVP, dados climáticos vêm de API externa (INMET, OpenWeatherMap). Quando os sensores físicos estiverem instalados, substituem a API.

## User Stories

- Como **produtor**, quero receber um alerta na Agenda quando a umidade do solo do talhão de café cair abaixo do mínimo configurado, para acionar a irrigação antes de estressar as plantas.
- Como **produtor**, quero ligar o nebulizador da câmara de frutificação do shiitake diretamente pelo app sem precisar ir até lá fisicamente, para economizar tempo e deslocamento.
- Como **produtor**, quero configurar a irrigação do setor 1 para ligar automaticamente às 06h por 30 minutos todos os dias, para não depender de lembrar de fazer isso manualmente.
- Como **produtor**, quero ver no histórico quanto tempo o setor de irrigação 2 ficou ligado nos últimos 30 dias, para entender o consumo de água e identificar vazamentos.
- Como **produtor**, quero que o sistema não acione a irrigação quando a previsão do tempo indica chuva nas próximas 12 horas, para não desperdiçar água.
- Como **produtor**, quero ver no mapa quais setores de irrigação estão ligados agora e há quanto tempo, para ter visibilidade sem precisar ir ao campo verificar.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Tela principal: lista de dispositivos agrupados por área/setor com estado atual (ligado/desligado, leitura atual).
- Cada sensor exibe: valor atual, faixa configurada, gráfico sparkline das últimas 24h e status (normal/atenção/alerta).
- Controle manual: botão de ligar/desligar com seleção de duração — ação confirmada antes de executar.
- Automações configuradas: lista de regras ativas com on/off individual.
- Integração com Mapa: os mesmos dados são exibidos geograficamente no módulo Mapa.

## Acceptance Criteria

**Monitoramento**
- AC-1: O sistema exibe leituras em tempo real de sensores cadastrados com atualização a cada intervalo configurável (padrão: 60 segundos).
- AC-2: Quando uma leitura ultrapassa a faixa configurada, o sistema cria automaticamente uma tarefa na Agenda com prioridade calculada pela severidade do desvio.
- AC-3: O histórico de leituras de cada sensor é armazenado e visualizável em gráfico para períodos de 24h, 7 dias e 30 dias.
- AC-4: Sensores sem comunicação por mais de N minutos (configurável) exibem alerta de "sem sinal" e notificam o produtor.

**Controle remoto**
- AC-5: O produtor liga ou desliga qualquer dispositivo cadastrado pelo app, com confirmação antes da execução ("Ligar nebulizador da câmara 1 por 30 minutos — confirmar?").
- AC-6: Todo acionamento manual é registrado no log com: usuário, dispositivo, ação, duração e horário.
- AC-7: O produtor programa horários fixos para um dispositivo (ex: ligar às 06h por 30 min, dias da semana configuráveis).

**Automações condicionais**
- AC-8: O produtor configura regras de automação com complexidade progressiva: regras simples (sensor X < valor → ligar dispositivo Y por Z minutos) via formulário; regras encadeadas (se A e B então C, senão D) via editor de condições estruturado.
- AC-8b: Regras encadeadas suportam: múltiplas condições com operadores AND/OR, ações sequenciais, ações condicionais (senão) e referência a outros dispositivos ou sensores como condição.
- AC-9: Regras condicionais respeitam restrições configuradas: não acionar irrigação se chuva prevista > N mm nas próximas 12h (dados da API meteorológica).
- AC-9b: Se chuva for detectada pelo pluviômetro físico durante uma irrigação em andamento, o sistema desliga o setor automaticamente e registra o evento no caderno de campo.
- AC-9c: O produtor pode configurar uma lista de dispositivos para desligamento seguro automático em caso de chuva detectada (ex: irrigação, nebulizador externo) — dispositivos críticos como ar condicionado da câmara de shiitake exigem aprovação antes de desligar.
- AC-9d: O sistema distingue desligamento seguro por automação de queda de energia — log registra a causa do desligamento para fins de diagnóstico e proteção de equipamentos.
- AC-10: Cada acionamento por regra condicional gera uma entrada no caderno de campo com: regra disparada, sensor que a ativou, valor lido e ação executada.
- AC-11: O produtor pode configurar por dispositivo o nível de autonomia: "executar automaticamente" ou "notificar e aguardar aprovação".

**Dados climáticos externos**
- AC-12: O sistema exibe temperatura atual, umidade, velocidade do vento e previsão de chuva para as próximas 24h e 7 dias, obtidos de API meteorológica (INMET ou equivalente).
- AC-13: Dados climáticos são exibidos no contexto das automações — "irrigação programada para 06h: previsão de chuva de 12mm, acionamento será cancelado".

**Camada de abstração de hardware**
- AC-14: O sistema suporta integração de dispositivos via MQTT e HTTP REST como protocolos base do MVP.
- AC-15: Adicionar um novo dispositivo requer apenas: nome, tipo, protocolo e endereço/tópico — sem necessidade de alterar código do sistema.

## Technical Decisions
- Protocolo de comunicação com hardware (MQTT, HTTP, WebSocket, Modbus) — decisão crítica que define toda a arquitetura de IoT. Registrar em ADR quando o hardware for escolhido.
- Broker MQTT: self-hosted (Mosquitto) vs. gerenciado (HiveMQ Cloud, AWS IoT) — avaliar custo, latência e complexidade de operação. Registrar em ADR.
- Armazenamento de séries temporais de sensores: PostgreSQL com TimescaleDB ou banco dedicado (InfluxDB) — volume de leituras pode crescer rapidamente com múltiplos sensores. Registrar em ADR.
- API meteorológica: INMET (gratuito, Brasil) como primeira opção. Avaliar cobertura e confiabilidade para a localização da propriedade.
- A camada de abstração de hardware (`src/workers/automacao/`) deve seguir o padrão Adapter já estabelecido para a camada de IA — cada protocolo/fabricante é um adapter.

## Impact on Specs

- **Security:** controle remoto de dispositivos físicos é superfície de ataque crítica. Autenticação obrigatória para qualquer ação de controle. Tokens de dispositivos devem ser rotativos. Registrar em ADR de segurança.
- **Data Architecture:** leituras de sensores são séries temporais — volume alto, append-only, consultas por intervalo de tempo. Requer estratégia dedicada de armazenamento e retenção de dados.
- **Observability:** monitorar latência de comandos de controle (tempo entre envio e confirmação de execução). Alertar quando dispositivos ficam sem comunicação.
- **Scalability:** séries temporais crescem continuamente — definir política de retenção (ex: manter leituras brutas por 90 dias, agregações por 2 anos).
- **Accessibility:** controles de dispositivos devem ser acionáveis por voz ("ligar irrigação setor 1 por 20 minutos") — especialmente útil quando o produtor está no campo.
- **i18n:** PT-BR. Sem necessidade agora.

## Rollout
- [ ] Feature flag recomendado — módulo depende de hardware físico instalado; deve ser ativado apenas quando os primeiros dispositivos estiverem configurados
- [ ] Sem seed de dados — dispositivos são cadastrados conforme instalação física
- [ ] MVP parcial aceitável: módulo pode ser entregue primeiro apenas com dados climáticos externos (sem hardware físico) e evoluir conforme os sensores forem instalados
- [ ] Rollback: módulo independente — desativar remove dados em tempo real do Mapa mas não afeta outros módulos
- [ ] Validação: testar com um único sensor antes de integrar todos os dispositivos

## Relacionados

- [[feat-mapa]] — sensores e dispositivos aparecem como marcadores no mapa com dados em tempo real
- [[feat-manutencao]] — alertas de sensor offline geram itens de manutenção preventiva
- [[feat-caderno-de-campo]] — acionamentos por regra condicional geram entradas (AC-10)
- [[feat-agenda]] — sensores fora de faixa geram tarefas com prioridade calculada pela severidade (AC-2)
- [[adr-013-notificacoes-multicanal]] — alertas de sensor (offline, threshold) entregues via push/e-mail/WhatsApp
- [[adr-002-sync-offline]] — leituras de sensores seguem modelo append-only; séries temporais aguardam ADR-007
