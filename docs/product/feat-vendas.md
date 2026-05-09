# PRD: Módulo Vendas

## Context
Hoje a propriedade tem dois clientes fixos: um feirante que compra shiitake fresco em consignação, e uma agroindústria que processa melaleuca, capim-cidreira, cúrcuma e shiitake. O escoamento funciona, mas está abaixo do potencial.

A visão de médio prazo é criar um ciclo próprio de comercialização: receber de volta a metade da produção processada pela agroindústria (óleos essenciais, hidrolatos, cúrcuma em pó, shiitake desidratado) e vender diretamente ao consumidor final via e-commerce, redes sociais, WhatsApp e marketplaces.

O principal gargalo não é falta de produto — é que o produtor precisa focar na produção e não tem capacidade de gerenciar vendas manualmente. A IA precisa automatizar o máximo possível dos processos comerciais: criação de conteúdo, postagens em redes sociais, comunicação em grupos.

## Objective
Centralizar a gestão dos clientes atuais e criar a infraestrutura para o ciclo próprio de comercialização — com automação por IA dos processos de venda que consomem tempo do produtor.

## Scope

### Includes
- [ ] Cadastro de clientes com tipo (feirante, agroindústria, consumidor final), histórico de compras e canal de comunicação preferido
- [ ] Registro de pedido/entrega por cliente com produtos, quantidades e condição de pagamento (à vista, consignação, produto processado)
- [ ] Rastreamento de estoque disponível para venda por produto, alimentado pelo módulo Culturas (colheitas registradas)
- [ ] Visão de receita pendente por cliente (consignações aguardando pagamento — integrado com módulo Financeiro)
- [ ] Geração de conteúdo para redes sociais por IA com base no estoque disponível, sazonalidade e histórico de engajamento
- [ ] Rascunho de mensagens para grupos de WhatsApp e comunicação direta com clientes, gerados por IA e aprovados pelo produtor antes do envio
- [ ] Registro de canal de venda por pedido (feirante, agroindústria, Instagram, Mercado Livre, WhatsApp direto, outros)
- [ ] Visão consolidada de receita por canal e por produto no período

### Excludes
- [ ] Loja virtual própria (e-commerce hospedado) — o produto apoia a gestão, não hospeda a loja
- [ ] Integração direta com Mercado Livre, Instagram Shopping ou outros marketplaces para processar pedidos — registros são feitos manualmente no MVP
- [ ] Postagem automática em redes sociais sem aprovação do produtor
- [ ] Gestão de logística e fretes
- [ ] Emissão de nota fiscal (módulo Financeiro / ciclo fiscal futuro)

## Not Doing (e por quê)

- **Postagem automática sem aprovação** — conteúdo publicado em nome da propriedade representa a marca. A IA gera o rascunho; o produtor aprova e posta. Autonomia total aqui é risco de reputação.
- **Loja virtual hospedada no AgroecologIA** — manter uma loja virtual é um produto por si só (pagamentos, carrinho, checkout, logística). O foco é gestão da operação agrícola; canais de venda são externos.
- **CRM completo com funil de vendas** — a operação atual tem dois clientes fixos e venda direta ao consumidor. Um funil de vendas estruturado é prematuro; o módulo foca em rastreamento simples de pedidos e relacionamento.
- **Automação de respostas a clientes** — responder mensagens de clientes de forma autônoma exige validação humana no loop. A IA sugere respostas; o produtor envia.
- **Gestão de devoluções e reclamações** — volume baixo no MVP; tratado manualmente.

## User Stories

- Como **produtor**, quero ver quanto estoque de cada produto processado tenho disponível para vender hoje, para saber o que oferecer sem precisar ir verificar fisicamente.
- Como **produtor**, quero que a IA gere um rascunho de post para o Instagram com base nos produtos disponíveis esta semana, para eu só revisar e publicar sem precisar criar do zero.
- Como **produtor**, quero registrar uma entrega ao feirante com quantidade e condição de pagamento, para que a receita apareça como pendente no financeiro automaticamente.
- Como **pai**, quero ver a lista de pedidos pendentes de entrega desta semana, para organizar as entregas sem depender de lembrar ou de conversa verbal.
- Como **produtor**, quero receber um rascunho de mensagem para enviar no grupo de clientes de WhatsApp anunciando a disponibilidade de cúrcuma em pó, para comunicar sem esforço de escrita.
- Como **produtor**, quero ver quanto recebi por canal (feirante, agroindústria, venda direta) no último trimestre, para entender qual canal está sendo mais rentável e direcionar esforço.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Tela principal: estoque disponível para venda por produto (cards) + pedidos pendentes de entrega + receita pendente de recebimento.
- Geração de conteúdo: fluxo em 3 passos — selecionar produto/contexto → IA gera rascunho → produtor edita e copia para canal externo.
- Rascunhos de mensagem: aparecem como sugestões associadas ao cliente ou canal, com botão "Copiar para WhatsApp".

## Acceptance Criteria

**Clientes e pedidos**
- AC-1: O produtor cadastra um cliente com: nome, tipo (feirante, agroindústria, consumidor final), canal de comunicação (WhatsApp, e-mail, outro) e condição de pagamento padrão.
- AC-2: O produtor registra uma entrega/pedido com: cliente, produtos e quantidades entregues, data, canal de venda e condição de pagamento (à vista, consignação, produto processado).
- AC-3: Pedidos em consignação criam automaticamente uma receita não consolidada no módulo Financeiro com os valores correspondentes.
- AC-4: O produtor vê todos os pedidos pendentes de entrega da semana em uma lista ordenada por data.

**Estoque disponível para venda**
- AC-5: O estoque disponível para venda é calculado automaticamente a partir das colheitas registradas no módulo Culturas, descontando o que já foi entregue em pedidos anteriores.
- AC-6: Quando o estoque de um produto cai abaixo de um limite configurável, o sistema gera um alerta na Agenda.
- AC-7: O produtor visualiza o estoque disponível por produto com unidade de medida correta (kg, unidades, litros, etc.).

**Geração de conteúdo por IA**
- AC-8: O produtor solicita um rascunho de conteúdo para redes sociais selecionando: produto, canal (Instagram, WhatsApp grupo, outros) e tom (informal, técnico, promocional).
- AC-9: A IA gera o rascunho considerando: estoque disponível, sazonalidade (época do ano, clima), histórico de conteúdos anteriores e princípios agroecológicos do produto.
- AC-10: O rascunho gerado pode ser editado livremente pelo produtor antes de ser copiado para o canal externo.
- AC-11: O produtor pode solicitar uma nova versão do rascunho com orientação adicional em linguagem natural ("mais curto", "destacar que é orgânico", "tom mais descontraído").
- AC-12: Rascunhos aprovados são salvos no histórico associados ao produto e canal — a IA usa esse histórico para melhorar gerações futuras.

**Receita por canal**
- AC-13: O produtor visualiza receita total por canal de venda no período selecionado (mês, trimestre, ano).
- AC-14: O produtor visualiza receita total por produto no período selecionado.
- AC-15: Receitas pendentes (consignação) e receitas confirmadas são exibidas separadamente com totais distintos.

## Technical Decisions
- Geração de conteúdo usa a camada `AIProvider` plugável. O prompt de geração deve considerar: produtos disponíveis (API interna), histórico de conteúdos (caderno de campo), sazonalidade (data atual + dados climáticos futuros do módulo Automação) e filosofia agroecológica (CLAUDE.md). Registrar contrato de prompt em ADR.
- Postagem em redes sociais (Instagram, etc.) requer APIs de terceiros com autenticação OAuth — avaliar viabilidade e limitações de cada plataforma antes de implementar. Stack técnica a definir em ADR específico.
- Estoque disponível para venda é calculado em tempo real cruzando colheitas (Culturas) com entregas (Vendas) — definir contrato de integração em ADR.

## Impact on Specs

- **AI/ML:** geração de conteúdo é o primeiro caso de uso de IA generativa voltado ao exterior (conteúdo publicado). Requer avaliação de qualidade de output — o conteúdo representa a marca da propriedade.
- **Security:** credenciais de redes sociais (tokens OAuth) devem ser armazenadas de forma segura. Acesso ao módulo de vendas deve ser restrito a admin e perfis autorizados.
- **Observability:** logar taxa de aprovação de rascunhos gerados pela IA — métrica central de qualidade do módulo.
- **Scalability:** sem impacto no MVP com volume baixo de clientes e pedidos.
- **Accessibility:** geração de conteúdo deve suportar entrada por voz para descrever o contexto ("quero anunciar a cúrcuma nova colhida essa semana").
- **i18n:** PT-BR. Conteúdo gerado pela IA deve ser sempre em PT-BR por padrão.

## Rollout
- [ ] Sem feature flag
- [ ] Seed: cadastrar os dois clientes atuais (feirante e agroindústria) na primeira configuração
- [ ] Geração de conteúdo: funciona desde o primeiro uso, mas melhora com histórico — qualidade inicial pode ser básica
- [ ] Rollback: módulo independente — desativar não afeta outros módulos
- [ ] Validação: testar geração de conteúdo com os primeiros 5 produtos antes de usar em produção
