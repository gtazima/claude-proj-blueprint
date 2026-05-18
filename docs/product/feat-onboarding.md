# PRD: Onboarding e Configuração Inicial

## Context
O AgroecologIA tem 8 módulos interdependentes — Agenda, Culturas, Caderno de Campo, Manutenção, Financeiro, Vendas, Mapa, Automação. Cada módulo exige configuração antes de entregar valor: cadastrar culturas e ciclos, desenhar o mapa, cadastrar equipamentos, conectar banco, configurar grupo do WhatsApp, importar histórico.

Se essa configuração for apresentada como um wizard linear no primeiro uso, o usuário desiste. Se for adiada por completo, o sistema fica vazio e não entrega valor. O desafio é equilibrar **valor imediato** com **configuração progressiva** — sem bloquear o uso por falta de configuração e sem deixar o usuário perdido sobre o que configurar a seguir.

Adicionalmente, há um patrimônio histórico já existente: ~250 registros do caderno de campo de 2024 (catalogados em `docs/runbooks/inventario-codigo-legado.md`). Esses dados precisam ser migrados na primeira inicialização para que a IA tenha contexto real desde o dia 1, em vez de aprender a partir do zero.

## Objective
Garantir que o agricultor obtenha valor do produto em **menos de 5 minutos** após instalar, e desbloqueie todo o potencial do sistema em até **30 dias de uso real** — sem nenhuma etapa de configuração que bloqueie o uso de uma funcionalidade dependente.

## Scope

### Includes
- [ ] Criação de conta com Google sign-in ou e-mail/senha
- [ ] Cadastro mínimo da propriedade (nome) durante o sign-up — único campo obrigatório
- [ ] Tela inicial pós-instalação: "ordem do dia" mesmo vazia, com CTA óbvio para registrar a primeira tarefa por voz
- [ ] Setup assistido por IA: usuário descreve sua propriedade em voz/texto livre, IA pré-configura culturas com ciclos padrão para revisão
- [ ] Migração assistida do histórico de 2024 (~250 registros do caderno de campo legado)
- [ ] Checklist de progresso de valor com 6-8 marcos, mostrando apenas os próximos 1-2 itens (progressive disclosure)
- [ ] Configuração just-in-time: cada feature pede configuração apenas quando o usuário tenta usá-la
- [ ] Convite de outros usuários (pai, parceiros) com permissões pré-configuradas
- [ ] Configuração do WhatsApp da propriedade (Evolution API + número do grupo)
- [ ] Conexão com Gmail para parsing de e-mails bancários (reutiliza fluxo OAuth do código legado)
- [ ] Importação de KML do Google Earth para o mapa (opcional)
- [ ] Geração automática de exemplos a partir do histórico migrado: "vimos que você fez X em Y datas — quer transformar em ciclo automático?"

### Excludes
- [ ] Tutorial passo a passo obrigatório
- [ ] Tour de produto com tooltips bloqueantes
- [ ] Configuração de automações IoT no onboarding (depende de hardware ainda não definido)
- [ ] Página de "configurações iniciais" extensa que precisa ser preenchida antes de usar

## Not Doing (e por quê)

- **Wizard linear obrigatório no primeiro uso** — força configuração antes do valor. Usuários desistem em wizards longos. A configuração é distribuída ao longo do uso real, sempre amarrada a uma necessidade concreta do agricultor.
- **Tutorial guiado com tooltips** — interfere no fluxo natural. O design do produto precisa ser autoexplicativo o suficiente para dispensar tutorial. Se algo precisa de tutorial, é sinal que o design está errado.
- **Importar dados de planilhas genéricas no MVP** — o caso real (planilha do produtor) será feito uma vez, manualmente, na migração inicial. Suporte genérico a importação de planilhas é complexidade desnecessária — a IA processa o registro de 2024 que já está em `importar_caderno.py`.
- **Cadastro manual de culturas como única opção** — o usuário pode descrever a propriedade em voz e a IA pré-configura. O cadastro manual existe como fallback, mas nunca é o caminho principal sugerido.
- **Bloquear funcionalidades por falta de configuração** — exemplo: o módulo Financeiro não bloqueia uso se o banco não estiver conectado. O usuário pode registrar transações manualmente até decidir conectar. Cada bloqueio é uma oportunidade de desistência.
- **Onboarding diferente para usuários convidados** — pai e parceiros recebem o app com permissões já configuradas pelo admin; eles fazem só o sign-in. A complexidade fica com quem instala primeiro (admin), não com quem é convidado.

## User Stories

- Como **produtor que acabou de instalar**, quero ver a tela principal da ordem do dia em menos de 30 segundos após o sign-up, para sentir que o produto é leve e direto.
- Como **produtor que acabou de instalar**, quero registrar minha primeira tarefa por voz em até 1 minuto após abrir o app pela primeira vez, sem precisar configurar nada antes.
- Como **produtor**, quero descrever minha propriedade em voz livre ("tenho shiitake em toras, café em SAF, abelhas nativas e cúrcuma") e ter a IA pré-configurar as culturas com ciclos padrão, para evitar preencher formulários para cada cultura.
- Como **produtor**, quero importar meu caderno de campo de 2024 com um único toque, para que a IA tenha contexto histórico desde o dia 1 e gere sugestões relevantes desde o início.
- Como **produtor**, quero ver claramente qual é o próximo passo recomendado para extrair mais valor do sistema, sem ser bombardeado com uma lista enorme de coisas a configurar.
- Como **produtor**, quero configurar a integração com WhatsApp apenas quando estiver pronto para incluir o funcionário, e não como pré-requisito para usar o sistema sozinho.
- Como **pai convidado pelo produtor**, quero abrir o app, fazer login, e já estar dentro do sistema com minhas permissões corretas — sem nenhum onboarding adicional.
- Como **produtor**, quero saber a qualquer momento qual é o estado da minha configuração (o que falta para extrair mais valor), sem que isso seja insistente ou bloqueante.

## Design

### Princípios

1. **Tempo até primeiro valor < 5 minutos**, ainda sem configuração extensa
2. **Configuração just-in-time** — cada feature pede o que precisa, no momento que precisa
3. **IA reduz fricção em todo passo** — voz e linguagem natural sempre que possível
4. **Progressive disclosure** — mostrar 1-2 próximos passos, nunca a lista inteira
5. **Nenhum bloqueio por configuração** — funcionalidades com config faltante usam defaults razoáveis ou pedem só quando o usuário tenta usar
6. **Convidados não fazem onboarding** — admin configura; convidado só faz login

### Fluxo do produtor (admin / first-time installer)

**Etapa 1 — Sign-up (30 segundos)**
- Tela única: Google sign-in ou e-mail/senha
- Campo único: nome da propriedade
- Botão: "Começar"

**Etapa 2 — Tela inicial (5 segundos depois)**
- Ordem do dia, vazia
- Card destacado: "Comece registrando sua primeira tarefa" com botão de microfone grande
- Abaixo, discreto: checklist de progresso ("Você completou: 1/8 marcos")

**Etapa 3 — Primeira tarefa (60 segundos)**
- Usuário fala: "preciso aplicar calcário no talhão 1 na sexta"
- IA processa: identifica que "talhão 1" não está cadastrado e pergunta inline
  - "Qual cultura é o talhão 1?"
  - Usuário responde por voz
  - IA pré-configura cultura + talhão + tarefa em uma única passada
- Tarefa aparece na ordem do dia. Primeiro valor entregue.

**Etapa 4 — Sugestão de configuração da propriedade (após primeira tarefa)**
- Banner não-bloqueante: "Quer configurar todas as suas culturas de uma vez? Descreva sua propriedade que eu pré-configuro tudo."
- Se usuário aceita: tela de voz/texto livre, IA processa e mostra culturas pré-configuradas para revisão
- Se usuário ignora: o banner reaparece após 24h ou após 3 tarefas criadas

**Etapa 5 — Migração de histórico (qualquer momento)**
- Card no checklist: "Importar histórico de 2024" (250 registros disponíveis)
- Toque único inicia migração com indicador de progresso
- Após migração, IA gera relatório: "Identifiquei estes ciclos no seu histórico — quer ativá-los?" (ex: "limpeza do filtro de irrigação a cada ~3 semanas", "colheita de capim-cidreira a cada ~90 dias")

**Etapa 6+ — Marcos opcionais (configuração progressiva)**
Cada marco aparece no checklist conforme contexto, com clareza sobre o valor que desbloqueia:

| Marco | Valor desbloqueado | Quando aparece |
|---|---|---|
| Importar histórico | IA aprende padrões reais da propriedade | Imediato |
| Cadastrar equipamentos | Alertas preventivos automáticos | Após 7 dias OU ao tentar criar tarefa de manutenção |
| Configurar mapa | Visão geográfica da propriedade | Após 14 dias OU ao falar de talhão pela 3ª vez |
| Conectar banco | Custo por cultura calculado automaticamente | Após 14 dias OU ao perguntar sobre custos |
| Configurar WhatsApp | Funcionário recebe ordem do dia automaticamente | Após criar tarefa atribuída a outro executor |
| Convidar pai/parceiros | Compartilhar gestão da propriedade | Quando o produtor mencionar pai ou parceiro |
| Cadastrar clientes | Rastrear vendas e receita por canal | Ao registrar primeira colheita |

### Fluxo do convidado (pai / parceiro de meliponicultura)

1. Recebe e-mail com link de convite
2. Clica → cria conta (Google sign-in ou senha)
3. Cai diretamente na ordem do dia (já filtrada conforme permissões configuradas pelo admin)
4. Primeira tarefa: a mesma do admin — registrar uma tarefa por voz

Sem checklist de configuração para convidados. O admin é quem configura; convidados consomem.

## Acceptance Criteria

**Sign-up e primeiro acesso**
- AC-1: O usuário completa sign-up (Google ou e-mail/senha) + nome da propriedade em ≤30 segundos.
- AC-2: A primeira tela útil (ordem do dia) carrega em ≤2 segundos após o sign-up.
- AC-3: O usuário consegue registrar a primeira tarefa por voz em ≤60 segundos a partir do sign-up — sem nenhuma configuração intermediária obrigatória.

**Setup assistido por IA**
- AC-4: O usuário pode descrever a propriedade em voz/texto livre; a IA pré-configura culturas com ciclos padrão e apresenta lista para revisão em uma única tela.
- AC-5: A IA usa contexto agroecológico para sugerir ciclos: shiitake (incubação ~70-90 dias, frutificação após choque, intervalo entre choques ~21 dias), café em SAF, mombaça, etc.
- AC-6: O usuário aprova ou edita as culturas pré-configuradas em uma única passada — sem precisar abrir cada cultura individualmente.

**Migração de histórico**
- AC-7: O sistema oferece migração do histórico de 2024 (~250 registros) como ação de toque único no checklist de onboarding.
- AC-8: Durante a migração, a IA classifica cada registro automaticamente em: cultura, tipo de atividade, lote (quando mencionado), e identifica padrões cíclicos.
- AC-9: Após a migração, o sistema apresenta relatório resumido com ciclos detectados e sugere ativação de tarefas recorrentes.
- AC-10: A migração funciona offline — registros ficam disponíveis no caderno de campo imediatamente; classificação por IA acontece em background quando há conexão.

**Checklist de progresso**
- AC-11: O checklist mostra no máximo 2 próximos passos por vez, com descrição clara do valor desbloqueado por cada um.
- AC-12: Marcos completados ficam visíveis em uma seção "feito" que pode ser expandida sob demanda.
- AC-13: O checklist nunca interrompe um fluxo — pode ser fechado, mas reaparece em momentos contextuais (ex: ao tentar criar tarefa de manutenção sem ter cadastrado nenhum equipamento).

**Configuração just-in-time**
- AC-14: Nenhuma funcionalidade do produto exige configuração prévia para ser usada minimamente. Exemplo: criar tarefa antes de cadastrar culturas é permitido (a IA cria a cultura inferida na hora).
- AC-15: Quando uma funcionalidade depende de config faltante (ex: WhatsApp para enviar ordem do dia), o sistema explica o que falta no momento exato e oferece atalho para configurar.

**Convite de usuários**
- AC-16: O produtor convida outro usuário (pai, parceiro) por e-mail, com módulos e filtro de cultura pré-selecionados (ADR-003).
- AC-17: O convidado completa sign-up em ≤30 segundos e cai diretamente na ordem do dia já filtrada conforme suas permissões — sem nenhum onboarding adicional.

**Configuração de WhatsApp**
- AC-18: A configuração da Evolution API + grupo da propriedade é apresentada quando o produtor cria a primeira tarefa atribuída a um executor diferente de si mesmo.
- AC-19: O sistema valida a configuração enviando uma mensagem de teste e confirmando o recebimento.

**Conexão com Gmail (para banco)**
- AC-20: Conexão OAuth com Gmail reutiliza fluxo testado em `old/fazenda-dashboard/modules/google_client.py` adaptado para armazenamento criptografado de token (não usar pickle).
- AC-21: O sistema oferece a primeira leitura de e-mails bancários (últimos 30 dias) imediatamente após a conexão, com indicador de progresso.

**Importação de KML do mapa**
- AC-22: O usuário pode importar KML/KMZ do Google Earth na configuração inicial do mapa ou em qualquer momento posterior.
- AC-23: Áreas importadas são apresentadas para associação com culturas em uma única tela — não obrigatório completar todas as associações de uma vez.

## Technical Decisions
- Sign-up exige autenticação na nuvem (Supabase Auth) por causa do sync offline (ADR-002) e do backup em Google Drive — não há modo "totalmente local". Documentar essa decisão em ADR separado se necessário.
- Migração de `importar_caderno.py` usa pipeline: parser do JSON existente → classificação por IA via `AIProvider` (ADR-004) → inserção no caderno de campo com `origem = "migracao_2024"` → análise de padrões cíclicos com IA → sugestão de ciclos automáticos.
- Checklist de progresso é dado armazenado no banco do usuário, não em código. Marcos podem ser adicionados/removidos via configuração sem novo deploy.
- "Configuração just-in-time" requer que cada módulo declare suas dependências de config e como pedir cada item inline. Padronizar via componente `<RequiresConfig />` ou similar.

## Impact on Specs

- **AI/ML:** setup assistido por IA é um caso de uso central. Requer prompt especializado para extrair culturas + ciclos a partir de descrição em linguagem natural. Evals desse prompt são prioridade.
- **Security:** convite por e-mail precisa de tokens com expiração curta (24h) e single-use. Validação rigorosa antes de conceder permissões configuradas.
- **Data Architecture:** estado do checklist de onboarding é por usuário; tabela `user_onboarding_progress` com timestamps de cada marco completado.
- **Observability:** medir conversão por marco do checklist é o KPI principal de UX do produto. Logar tempo entre sign-up e primeira tarefa, entre primeira tarefa e import histórico, etc.
- **Accessibility:** sign-up e primeira tarefa devem funcionar via voz para o usuário com baixa familiaridade digital.
- **i18n:** PT-BR no MVP. Marcos do checklist e prompts da IA assumem agroecologia brasileira como contexto.
- **Compliance:** sem dados sensíveis no onboarding além de e-mail. Política de privacidade simples para uso próprio é suficiente no MVP.

## Rollout
- [ ] Sem feature flag — onboarding é parte central do produto
- [ ] Migração de 2024 deve ser testada extensivamente antes do primeiro uso real, pois é one-shot — re-importação geraria duplicação
- [ ] Métricas de funil do checklist devem estar instrumentadas desde o dia 1 — sem isso, não há feedback sobre onde os usuários travam
- [ ] Validação: o próprio produtor é o primeiro usuário do onboarding (dogfooding) — se ele desistir em algum ponto, é bug crítico
- [ ] Plano de fallback: se setup assistido por IA falhar (timeout, erro de classificação), oferecer cadastro manual de culturas com defaults razoáveis pré-preenchidos

## Métricas de sucesso do onboarding

- **Tempo até primeiro valor:** ≤5 minutos do sign-up à primeira tarefa criada (meta P95)
- **Conclusão de marcos críticos em 30 dias:** ≥80% dos usuários (no caso atual: 100% — o produtor)
  - Importar histórico de 2024
  - Cadastrar pelo menos 3 culturas
  - Configurar pelo menos 1 equipamento
  - Conectar Gmail OU importar primeiro extrato
- **Taxa de abandono no onboarding:** 0% (single-user MVP — qualquer abandono é bug)

## Relacionados

- [[adr-009-autenticacao]] — AC-1, AC-16, AC-17: fluxo de sign-up, convites, setup de dispositivo
- [[adr-012-backup-google-drive]] — consentimento para Drive faz parte do fluxo Google Sign-In
- [[adr-014-biblioteca-de-mapas]] — AC-22: importação KML da propriedade no onboarding
- [[feat-gmail-financeiro]] — conexão Gmail é marco crítico dos primeiros 30 dias
- [[feat-culturas]] — cadastro de culturas e ciclos é marco crítico do onboarding
