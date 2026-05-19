# Product Vision — AgroecologIA

## Purpose

Pequenos agricultores que trabalham com alta diversidade de culturas precisam lidar com uma quantidade imensa de trabalhos com pouca mão de obra disponível. A dor central é a organização: nos perdemos no controle de atividades, manejos, manutenções, colheitas, comunicação e vendas.

O agricultor precisa reagir a dezenas de variáveis por dia — manejo, plantio, aplicações, maquinário, estruturas, casa, insumos. Manter o rastreamento de tudo e priorizar corretamente é tarefa quase impossível. Com pouca mão de obra e alta diversidade de culturas, a desorganização é um dos principais fatores que tornam pequenas propriedades inviáveis financeiramente.

Além disso, o agricultor lida com um **clima cada vez mais desequilibrado** e com **volatilidade política** que afeta diretamente produções e produtos. Decisões precisam ser tomadas com mais rapidez e com mais informação — exatamente o oposto do que a desorganização permite.

O propósito do AgroecologIA é ser a **memória externa da propriedade e o ajudante ativo do agricultor** — oferecendo sempre uma visão geral clara, com o menor esforço possível para alimentar o sistema. A IA atua como copiloto: proativa quando precisa alertar, responsiva quando o agricultor pergunta.

**Referências:**
- https://www.embrapa.br/busca-de-noticias/-/noticia/31505030/artigo---agricultura-familiar-desafios-e-oportunidades-rumo-a-inovacao
- https://eos.com/pt/blog/desafios-da-agricultura/

---

## Problem

### O problema central: a ordem do dia
O início de cada dia exige uma decisão crítica: o que fazer, em qual ordem, e quem faz o quê. Essa decisão é tomada de memória, combinando pendências do dia anterior com informações trocadas entre os membros da propriedade.

O problema não é falta de trabalho — é que **lembrar de tudo que precisa ser feito é impossível**. Atividades esquecidas surgem no meio do dia e derrubam o que estava em execução, causando perda de fluidez e eficiência.

### Fluxo atual (e onde ele quebra)
1. Manhã: produtor avalia pendências do dia anterior
2. Decisão conjunta com o pai sobre prioridades
3. Distribuição: tarefas estruturais/decisórias ficam com o produtor; tarefas mecânicas/repetitivas vão para o funcionário
4. Durante o dia: surgem lembranças ou imprevistos que alteram a ordem estabelecida
5. Resultado: perda de fluidez, retrabalho de priorização, trabalhos esquecidos acumulam

### Critérios reais de prioridade (ordem de peso)
1. **Timing biológico** — o que não pode esperar: shiitake no ponto de colheita, cultura que vai passar do ponto
2. **Dependência** — o que bloqueia outras tarefas: preciso fazer X antes de Y
3. **Impacto financeiro** — o que desbloqueie uma venda ou evite uma perda

---

## Domínios da propriedade

### 1. Manejo (dor principal: timing)
O problema não é falta de conhecimento técnico — é não perder o timing com tantos ciclos acontecendo em paralelo.

**Fungicultura — Shiitake em toras**
Ciclo complexo com múltiplas etapas simultâneas: produção de hífas, inoculação, incubação (controle de tempo por lote), frutificação, automação de temperatura e umidade, rastreamento de lote, corte de árvores (plantadas + nativas). Vários lotes em estágios diferentes ao mesmo tempo.

**Café em sistema agroflorestal**
Primeiro talhão recém-plantado. Gestão inclui: projeto de plantio (espaçamento, arranjo produtivo), análise e correção de solo, serviços terceirizados (subsolagem, gradagem), manejo, implantação e manutenção de irrigação. Consórcio com: melaleuca (óleo essencial e hidrolato), banana, limão, nativas com florada (apoio a abelhas), madeiras para shiitake.

**Gramíneas e biomassa**
Mombaça nas entrelinhas para produção de biomassa e mulch. Napier na barreira vegetal perimetral (proteção contra deriva de vizinhos + exigência de certificação orgânica). Manejo coordenado com demais atividades.

**Meliponicultura — Abelhas nativas**
Enxames capturados já na propriedade. Sem exploração comercial ainda. Parceria com amigos com interesse na área está sendo desenhada — esses parceiros são possíveis usuários do sistema com acesso restrito às informações das abelhas. Ciclos de manejo, produção e saúde dos enxames precisarão ser rastreados.

**Outras culturas**
- Canavial (potencial destilaria — não desenvolvido ainda)
- Cúrcuma (desidratação e venda em pó)

**Manutenções gerais**
Grama interna, matos, horta, composteira, galinheiro — todos concorrem com as demais atividades e são executados pelo próprio agricultor.

### 2. Colheita (dor principal: timing + rastreamento zero)
- **Ponto errado**: as referências de quando cada cultura atinge o ponto de colheita existem apenas na cabeça do produtor. Ninguém lembra de checar.
- **Sem rastreamento**: após a colheita (ou qualquer processo), a informação vai para a cabeça e some. Não há histórico de produção, volumes, datas ou lotes.

O sistema precisa ser a memória externa da propriedade — registrar o que foi feito e alertar quando algo precisa ser checado.

### 3. Vendas (oportunidade de crescimento)
Escoamento atual funciona minimamente, mas está abaixo do potencial. Visão ideal:
- Produtos processados e fracionados para o cliente final (cúrcuma em pó, shiitake desidratado, óleo essencial de melaleuca)
- Canal: e-commerce com envio por correio
- Posicionamento: produção pequena, alta qualidade, premium
- Prospecção de clientes com apoio de IA

O produto precisa impactar diretamente nos ganhos do agricultor, não apenas na organização interna. Gestão comercial (estoque disponível para venda, histórico de pedidos, relacionamento com clientes) faz parte do escopo.

### 4. Manutenção (dor principal: prevenção e histórico)
- Sem histórico: não se sabe o que foi feito, quando, em qual equipamento ou estrutura
- Sem alertas preventivos: manutenções simples são esquecidas até virar problema maior
- Sem lista de compras proativa: insumos chegam tarde porque ninguém foi lembrado no momento certo

Mesmo padrão da colheita: falta de memória externa para registrar e disparar alertas.

### 5. Financeiro (dor estratégica)
Informações parcialmente em planilhas desatualizadas. A propriedade sabe que não tem lucro, mas não sabe os custos por cultura ou ciclo — o que impede decisões estratégicas.

**Necessidade central:** custo por cultura e por ciclo (ex: quanto custa um ciclo de shiitake do início à frutificação?) para direcionar a estratégia.

**Integração bancária:** C6 hoje, possível migração para Caixa. Preferência por integração direta via Open Finance; fallback por notificações de e-mail ou importação manual de extrato (OFX/CSV).

---

## Target audience

**Persona primária — O produtor técnico**
Pequeno agricultor agroecológico com familiaridade básica em tecnologia. Gerencia com mínima mão de obra uma propriedade com alta diversidade de culturas. Conhece profundamente o sistema produtivo mas se perde na organização e priorização. É o usuário de referência na fase atual — o produto está sendo construído para resolver o problema do próprio criador.

**Persona secundária — O agricultor tradicional**
Produtor familiar com pouca ou nenhuma experiência com ferramentas digitais. A barreira de entrada precisa ser mínima. A linguagem natural com IA é o canal principal de interação — ele fala com o sistema como falaria com um assistente humano, sem precisar aprender interfaces complexas.

**Persona terciária — O funcionário de campo**
Baixo letramento digital. Sua interface já está definida: **WhatsApp**. O sistema envia automaticamente a ordem do dia para o grupo da propriedade toda manhã. Ele não interage com o produto — só recebe.

**Dinâmica de papéis (propriedade de referência)**
- Produtor principal: trabalhos pesados de campo + decisões técnicas de manejo
- Pai: compras, vendas, tarefas de menor exigência física
- Funcionário: execução de tarefas mecânicas/repetitivas

**Controle de acesso**
Perfis com permissões configuráveis por admin — o que cada usuário pode ver e fazer é definível. Prepara o produto para escalar para outras propriedades no futuro.

Um caso de uso concreto já identificado: parceiros externos de meliponicultura terão acesso apenas às informações de abelhas dentro do módulo de culturas — sem visibilidade sobre o restante da propriedade. O sistema precisa suportar acesso filtrado por cultura dentro de um módulo, não apenas por papel genérico.

---

## Filosofia do produto

### Princípio agroecológico como norte
O produto é construído sobre princípios agroecológicos, mas não é dogmático. Quando um agricultor pede uma solução fora desses princípios, o sistema atende — mas sempre priorizando sugerir alternativas ecológicas e economicamente viáveis.

### Vetor de transição
Muitos agricultores tradicionais não adotam práticas melhores por pura falta de informação. O produto faz **sugestões contextuais certeiras**, especialmente aquelas que unem ganho econômico e ganho ecológico. Quando o agricultor percebe que a alternativa agroecológica é também mais lucrativa, a transição acontece naturalmente.

### Progressividade por perfil
A influência filosófica é calibrada por perfil de usuário e aplicada incrementalmente — sem impor, sem julgar, sempre apontando o caminho. Um agricultor em início de transição recebe sugestões diferentes de um já consolidado na agroecologia.

### IA como assistência informada, não prescrição
Para técnicas agrícolas consolidadas, a IA responde com base no conhecimento já disponível. Para sugestões agroecológicas específicas (ex: análise de solo + cultura + localização → quais nutrientes aplicar), o sistema busca em literatura técnica atualizada (Embrapa, artigos científicos). O produto assiste com base em evidências — não emite laudos com responsabilidade legal.

### Impacto além da propriedade
A visão de longo prazo é que um produto bem feito, disperso entre muitos agricultores, pode ter impacto ambiental e social real. A filosofia cooperativa faz parte do modelo agroecológico — a arquitetura não deve fechar a porta para redes e cooperativas, mesmo que isso não seja escopo agora.

---

## Value proposition

Não existe alternativa acessível para este problema. O agricultor que quer resolver isso hoje precisa ter capacidade técnica para construir a própria ferramenta. O AgroecologIA democratiza o acesso a uma gestão integrada de propriedade com IA — algo que hoje só existe para grandes operações agroindustriais, não para a agricultura familiar diversificada.

---

## Fora do escopo (agora)

- **Não é marketplace** — apoia a organização e estratégia de vendas, mas não é a plataforma de venda. E-commerce é externo; o AgroecologIA integra e apoia.
- **Fiscal não é prioridade agora** — o foco inicial é o financeiro operacional (custos, receitas, custo por ciclo). Fechar o ciclo fiscal completo (NF, obrigações, contabilidade) é uma direção desejada no longo prazo; a arquitetura não deve fechar essa porta.
- **Não emite prescrições agronômicas com responsabilidade legal** — assiste com base em literatura técnica, mas não substitui agrônomo responsável.
- **Não gerencia folha de pagamento** — escopo atual é uma propriedade com 1 funcionário; pode evoluir no futuro.
- **Não é plataforma para cooperativas** — foco na propriedade individual agora; arquitetura deve permitir expansão futura.

---

## Automação e IoT

O pequeno agricultor com pouca mão de obra é altamente dependente de automação — quem já usa sabe que não volta atrás. O produto precisa integrar essas automações como parte central, não como add-on.

**Automações previstas**
- Irrigação por gotejamento (sistemas agroflorestais)
- Sensores de umidade (sistemas agroflorestais)
- Nebulizador (ambiente controlado — ex: câmara de frutificação do shiitake)
- Ar condicionado (ambiente controlado)
- Captura de dados climáticos: chuva, temperatura, vento e outros

**Nível de integração desejado**
Controle completo — não apenas monitoramento e alertas, mas controle direto pelo app (ligar/desligar, ajustar parâmetros).

**Status atual**
Todas as automações são ainda manuais/mecânicas. A stack de hardware (Arduino, ESP32, controladores comerciais, etc.) está sendo estudada e será definida em momento posterior. Quando a tecnologia for escolhida, esta seção será expandida com as especificações técnicas de integração.

---

## Infraestrutura e acesso

**Conectividade**
- Casa sede e oficina: excelente conectividade
- Campo: sem cobertura

**Requisitos derivados**
- Mobile offline-first: registra informações no campo sem internet, sincroniza ao retornar à área com conexão
- Desktop: versão completa para uso na casa sede (planejamento, análise, gestão)
- Mobile: interface simplificada, focada em facilidade de uso para agricultores com menos familiaridade digital

---

## MVP — menor versão com valor real

Uma tela com a **ordem do dia**: atividades priorizadas por timing biológico → dependência → impacto financeiro, com clareza sobre quem faz o quê.

Uma **agenda com insights**: visão das próximas semanas e meses mostrando o que vai chegar — lotes de shiitake próximos da frutificação, manejo de mombaça no prazo, manutenções preventivas agendadas.

Esse seria o impacto imediato no dia a dia — substituir a memória humana por uma visão estruturada e confiável do que precisa acontecer.

---

## Success metrics

**Adoção e uso (mensurável após 30 dias de uso real)**
- [ ] ≥80% dos dias úteis com a ordem do dia aberta antes das 7h
- [ ] ≥70% das tarefas do dia geradas automaticamente (sem criação manual)
- [ ] 100% das tarefas concluídas geram entrada no caderno de campo automaticamente
- [ ] Funcionário recebe a ordem do dia no WhatsApp toda manhã sem nenhuma intervenção manual

**Qualidade dos dados (mensurável após 90 dias)**
- [ ] 100% das colheitas registradas com peso/volume/quantidade
- [ ] Zero colheitas perdidas por timing esquecido
- [ ] Custo por ciclo de shiitake calculado automaticamente para todos os lotes ativos
- [ ] ≥90% das transações bancárias classificadas corretamente sem correção manual

**Valor estratégico (mensurável após 6 meses)**
- [ ] Histórico completo de produção por lote e por cultura disponível para consulta
- [ ] Pelo menos uma decisão estratégica tomada com base em dado do sistema (ex: parar de produzir uma cultura não rentável)
- [ ] Tempo médio entre observação no campo e tarefa estruturada: <24h

---

## Links
- Repo: [a definir]
- Design: [a definir]
- Production:
  - Frontend: https://agroecologia.g-tazima.workers.dev (Cloudflare Workers)
  - Backend: https://agroecologia.onrender.com (Render free tier)
  - Banco: Supabase PostgreSQL

## Relacionados

### PRDs por módulo
- [[feat-agenda]] — Ordem do dia, priorização, agenda futura, integração WhatsApp
- [[feat-culturas]] — Cultura, lote/talhão/enxame, ciclos, colheita, geração de tarefas
- [[feat-caderno-de-campo]] — Registro de observações, entradas automáticas, sugestões da IA
- [[feat-manutencao]] — Equipamentos, manutenções preventivas, lista de compras proativa
- [[feat-financeiro]] — Integração bancária, classificação por IA, custo por ciclo
- [[feat-gmail-financeiro]] — Leitura de e-mails bancários para alimentar Financeiro
- [[feat-vendas]] — Clientes, pedidos, estoque para venda, geração de conteúdo por IA
- [[feat-mapa]] — Visão geográfica integrada da propriedade
- [[feat-automacao]] — Sensores, controle remoto, automações condicionais
- [[feat-compras]] — Lista de compras com sync bidirecional Google Tasks
- [[feat-google-tasks-sync]] — Integração com a conta Google da propriedade
- [[feat-onboarding]] — Tempo até primeiro valor < 5 min; setup assistido por IA

### Decisões arquiteturais críticas
- [[adr-001-algoritmo-priorizacao-agenda]] — score timing×1000 + dependência×100 + financeiro×10
- [[adr-003-controle-acesso-por-cultura]] — RBAC + filtro por cultura (parceiros de meliponicultura)
- [[adr-004-camada-ia-plugavel]] — interface `AIProvider` + adapters
- [[adr-011-provedor-ia-capacity-planning]] — DeepSeek como default; custo ~$1-15/mês/usuário ativo
