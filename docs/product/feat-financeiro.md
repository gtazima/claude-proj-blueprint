# PRD: Módulo Financeiro

## Context
O financeiro da propriedade hoje está parcialmente em planilhas desatualizadas. A propriedade sabe que não tem lucro, mas não consegue identificar onde está perdendo — porque não existe custo por cultura ou por ciclo. Sem saber quanto custa um ciclo de shiitake do início à frutificação, é impossível decidir se vale a pena expandir, reduzir ou abandonar uma cultura.

A integração bancária (C6, com possível migração para Caixa) permite importar transações reais sem entrada manual. A IA classifica as despesas automaticamente e sugere a associação com culturas — o produtor corrige quando necessário.

## Objective
Dar ao produtor uma visão clara do custo real por cultura e por ciclo, do fluxo de caixa da propriedade e do caminho para fechar o ciclo fiscal — com o menor esforço possível de entrada de dados.

## Scope

### Includes
- [ ] Integração bancária: C6 e Caixa via Open Finance; fallback por importação de extrato OFX/CSV ou leitura de notificações de e-mail
- [ ] Importação automática de transações bancárias (receitas e despesas)
- [ ] Classificação automática por IA com sugestão de: categoria, tags e cultura associada
- [ ] Interface rápida de correção de classificação (um toque para aprovar, dois para corrigir)
- [ ] Tags livres para classificação flexível (ex: "casa sede", "insumo", "manutenção", "frete")
- [ ] Associação de despesa a uma ou mais culturas/unidades de gestão
- [ ] Custo por cultura acumulado: total de despesas associadas a cada cultura no período
- [ ] Custo por ciclo: despesas associadas a um lote/talhão específico desde sua criação
- [ ] Fluxo de caixa da propriedade: entradas, saídas e saldo por período
- [ ] Receitas não consolidadas (consignação): criadas pelo módulo Culturas, confirmadas aqui quando o pagamento é recebido
- [ ] Registro manual de transação para despesas em dinheiro ou sem rastro bancário
- [ ] Entrada por voz para registro manual rápido

### Excludes
- [ ] Emissão de nota fiscal ou gestão de obrigações fiscais (escopo futuro)
- [ ] Contabilidade formal (DRE, balanço patrimonial)
- [ ] Gestão de folha de pagamento
- [ ] Separação financeiro pessoal vs. propriedade — tudo que entra no sistema é considerado da propriedade; a casa sede é uma categoria de despesa

## Not Doing (e por quê)

- **Classificação totalmente automática sem revisão** — a IA sugere, o produtor confirma ou corrige. Classificar errado uma despesa como cultura errada distorce o custo por ciclo — dado que o produtor usa para tomar decisões reais. A revisão rápida protege a integridade dos dados.
- **Múltiplas contas bancárias com reconciliação automática** — no MVP, uma conta principal por vez. Suporte a múltiplas contas com reconciliação é complexidade desnecessária agora.
- **Orçamento e metas financeiras** — o primeiro passo é entender o que está acontecendo (custo real por cultura). Planejar metas vem depois, quando o produtor tiver histórico suficiente para projetar.
- **Relatórios fiscais e contábeis** — a arquitetura preserva rastreabilidade para habilitar isso no futuro, mas a geração de relatórios fiscais não é prioridade agora.
- **Integração com sistema de e-commerce para receitas** — vendas online são registradas manualmente ou via importação bancária no MVP. Integração direta com plataforma de e-commerce é escopo do módulo Vendas.

## User Stories

- Como **produtor**, quero que as transações do banco sejam importadas automaticamente e classificadas pela IA, para não precisar digitar cada despesa manualmente.
- Como **produtor**, quero ver em um toque quanto custou o ciclo atual do lote 003 de shiitake desde a inoculação, para saber se esse lote está sendo lucrativo.
- Como **produtor**, quero corrigir rapidamente a classificação de uma transação quando a IA errou, para manter os dados confiáveis sem esforço excessivo.
- Como **produtor**, quero ver o fluxo de caixa do mês — quanto entrou, quanto saiu, qual o saldo — para ter clareza do estado financeiro da propriedade.
- Como **pai**, quero confirmar o recebimento de um pagamento de consignação para fechar o ciclo financeiro de uma venda, para que a receita entre no fluxo de caixa no momento correto.
- Como **produtor**, quero registrar por voz uma compra feita em dinheiro na feira ("gastei 80 reais em substrato para shiitake"), para que despesas sem rastro bancário também entrem no histórico.

## Design
- Sem Figma. Usar design tokens definidos em `docs/specs/design-system/`.
- Tela principal: resumo do mês (saldo, total entradas, total saídas) + lista de transações pendentes de classificação no topo.
- Classificação rápida: card deslizável — deslizar para direita aprova sugestão da IA, deslizar para esquerda abre correção.
- Custo por cultura: visão de cards por cultura com total acumulado no período e indicador de tendência.
- Receitas não consolidadas: lista separada com valor total pendente de recebimento em destaque.

## Acceptance Criteria

**Integração bancária**
- AC-1: O produtor conecta a conta C6 via Open Finance; transações dos últimos 30 dias são importadas automaticamente na primeira conexão.
- AC-2: Novas transações são importadas automaticamente a cada 24h (ou sob demanda com botão de atualizar).
- AC-3: Quando Open Finance não está disponível, o produtor pode importar extrato em formato OFX ou CSV.
- AC-4: O sistema lê notificações de e-mail do banco (C6/Caixa) para capturar transações como fallback adicional quando nenhuma integração direta está disponível.

**Classificação por IA**
- AC-5: Cada transação importada recebe automaticamente uma sugestão de: categoria (insumo, manutenção, serviço terceirizado, utilidades, outros), tags livres e cultura associada (quando inferível pela descrição).
- AC-6: O produtor aprova ou corrige a classificação em no máximo 2 interações. Aprovação: um toque. Correção: selecionar categoria/cultura corretas em lista filtrada.
- AC-7: A IA aprende com as correções — transações do mesmo fornecedor ou com descrição similar são classificadas corretamente nas próximas importações.
- AC-8: Transações classificadas incorretamente 3 ou mais vezes pelo mesmo padrão geram alerta para o produtor revisar a regra de classificação.

**Custo por cultura e por ciclo**
- AC-9: A tela de cada cultura exibe o total de despesas associadas no período selecionado (mês, trimestre, ciclo completo).
- AC-10: A tela de cada lote/talhão exibe o custo acumulado desde sua criação — todas as despesas associadas a aquela unidade de gestão.
- AC-11: Uma despesa pode ser associada a múltiplas culturas com rateio percentual (ex: 60% shiitake, 40% café).
- AC-12: O sistema calcula e exibe o custo médio por frutificação de um lote de shiitake, cruzando despesas associadas com o número de frutificações registradas.

**Fluxo de caixa**
- AC-13: A tela de fluxo de caixa exibe: total de entradas, total de saídas e saldo líquido para o período selecionado (semana, mês, ano).
- AC-14: O produtor filtra o fluxo de caixa por tag, categoria ou cultura para isolar um centro de custo específico.

**Receitas não consolidadas**
- AC-15: Receitas criadas pelo módulo Culturas (consignação) aparecem em lista separada com status "aguardando pagamento".
- AC-16: Ao confirmar o recebimento, o produtor informa o valor recebido (que pode diferir do valor original) e a receita entra no fluxo de caixa com a data de confirmação.
- AC-17: O histórico preserva tanto o valor original da consignação quanto o valor efetivamente recebido.

**Registro manual**
- AC-18: O produtor registra uma transação manual por texto ou voz, informando: valor, tipo (receita/despesa), descrição e data.
- AC-19: Transações manuais passam pelo mesmo fluxo de classificação por IA que as importadas do banco.

## Technical Decisions
- Open Finance no Brasil requer certificado digital e aprovação no Banco Central — avaliar complexidade e tempo de aprovação antes de comprometer o MVP com essa integração. Pode ser que OFX/CSV seja o caminho inicial e Open Finance venha depois. Registrar decisão em ADR.
- Leitura de e-mails de notificação bancária usa o mesmo módulo de Gmail já explorado no projeto anterior (`old/fazenda-dashboard`). Avaliar reaproveitamento do código de parsing.
- Classificação por IA usa a camada `AIProvider` plugável — nunca chamar provedor diretamente.
- Custo por ciclo requer junção entre tabelas de transações financeiras e unidades de gestão do módulo Culturas — definir contrato de integração em ADR.

## Impact on Specs

- **Security:** dados bancários e financeiros são altamente sensíveis. Tokens de Open Finance devem ser armazenados criptografados. Acesso ao módulo financeiro deve ser restrito a admin e perfis explicitamente autorizados.
- **Compliance:** integração Open Finance requer conformidade com regulamentações do Banco Central. Registrar em ADR antes de implementar. Estrutura de dados deve preservar rastreabilidade para ciclo fiscal futuro.
- **Data Architecture:** transações financeiras são append-only — nunca deletar, apenas estornar. Schema deve refletir isso desde o início.
- **Observability:** logar falhas de sincronização bancária com alertas. Monitorar taxa de correção de classificações da IA como métrica de qualidade.
- **Scalability:** sem impacto relevante no MVP. Volume de transações de uma pequena propriedade é baixo.
- **Accessibility:** correção de classificação deve ser possível com uma mão — gestos simples, sem formulários complexos.
- **i18n:** PT-BR. Formatação de moeda BRL desde o início.

## Rollout
- [ ] Sem feature flag
- [ ] Primeira configuração: conectar conta bancária ou importar extrato histórico para ter dados iniciais
- [ ] Seed de categorias e tags padrão para a propriedade (insumo, manutenção, frete, utilidades, casa sede, etc.)
- [ ] Rollback: módulo independente — desativar não afeta Agenda, Culturas ou Caderno de Campo
- [ ] Validação: revisar com o produtor as primeiras 20 classificações automáticas antes de confiar no fluxo de aprovação rápida

## Relacionados

- [[adr-005-integracao-bancaria]] — estratégia OFX/CSV + e-mail no MVP, Open Finance pós-MVP
- [[adr-009-autenticacao]] — tokens OAuth bancários armazenados com criptografia AES-GCM por usuário
- [[adr-004-camada-ia-plugavel]] — classificação de transações usa esta camada (AC-5, AC-7)
- [[adr-011-provedor-ia-capacity-planning]] — classificação bancária é caso de uso de alta frequência; prompt caching reduz custo
- [[adr-015-moderacao-conteudo-ia]] — confidence threshold de classificação automática definido aqui
- [[feat-gmail-financeiro]] — alimenta este módulo com transações extraídas de e-mails bancários
- [[feat-culturas]] — custo por ciclo requer junção entre transações e unidades de gestão de culturas
- [[feat-vendas]] — receitas de consignação confirmadas aqui após pagamento
