# ADR-013: Notificações Multi-canal Configuráveis

## Status
Accepted

## Context
Durante a revisão dos PRDs identificamos um gap crítico: alertas urgentes precisam chegar ao produtor mesmo quando o app não está aberto. PRD da Agenda originalmente excluiu push notifications, mas situações como:

- Sensor de irrigação reportando vazamento
- Manutenção crítica atrasada há dias
- Lote de shiitake na janela final de colheita
- Sync falhou em todos os dispositivos por mais de 24h

...exigem comunicação proativa. Sem ela, o sistema falha em ser "memória externa ativa".

A decisão de produto durante a revisão: **combinação configurável por tipo de alerta**. O produtor decide qual canal recebe qual tipo de notificação. Sem imposição de canal único.

## Decision

Adotar **três canais de notificação** com matriz de configuração por tipo de alerta:

1. **Push notification do PWA** — canal principal, baixa fricção, gratuito
2. **E-mail** — canal de fallback robusto, assíncrono, persistente
3. **WhatsApp** (via Evolution API já configurada) — canal de máximo alcance, especialmente para alertas críticos

### Catálogo de tipos de alerta

| Tipo de alerta | Severidade | Canais sugeridos por padrão |
|---|---|---|
| Tarefa do dia disponível | Informativo | (nenhum — usuário abre o app) |
| Tarefa atrasada (>1 dia) | Atenção | Push |
| Tarefa com timing biológico em janela crítica | Urgente | Push + WhatsApp |
| Manutenção preventiva atrasada | Atenção | Push |
| Manutenção crítica atrasada | Urgente | Push + E-mail |
| Sensor de automação fora de faixa | Atenção | Push |
| Sensor crítico fora de faixa (irrigação vazando) | Urgente | Push + WhatsApp |
| Lote de shiitake na janela final de colheita | Urgente | Push + WhatsApp |
| Falha repetida de sync (>24h) | Atenção | Push + E-mail |
| Backup falhou (3 dias seguidos) | Atenção | Push + E-mail |
| Atingiu 80% da quota mensal de IA | Informativo | E-mail |
| Pagamento de consignação pendente há >30 dias | Atenção | Push + E-mail |
| Convite para usuário expirando | Informativo | E-mail (para o convidado) |
| Falha de envio do WhatsApp matinal | Atenção | Push (para o admin) |

Cada usuário pode **sobrescrever** os padrões em "Configurações → Notificações", marcando/desmarcando canais por tipo.

### Canal 1: Push notifications do PWA

**Stack:** Web Push API (padrão W3C) com VAPID keys próprias. Sem dependência de FCM (Firebase Cloud Messaging) ou similar.

Por quê Web Push em vez de FCM:
- Web Push é padrão aberto, suportado em Chrome, Edge, Firefox, Safari (16.4+)
- Funciona em PWA instalada como app nativo
- Sem dependência de Firebase/Google Cloud
- Single source da entrega — direto do servidor para o browser do usuário

**Limitações conhecidas:**
- iOS Safari requer PWA instalada na home screen (limitação da Apple)
- Algumas corporações bloqueiam Web Push em redes corporativas — irrelevante para o caso de uso

**Implementação:**
- Servidor armazena `push_subscription` por dispositivo na tabela `device_sessions` (mesmo registro do ADR-009)
- Backend usa biblioteca `pywebpush` para enviar
- Service Worker do PWA recebe e exibe a notificação

### Canal 2: E-mail

**Stack:** Resend API (serviço transacional moderno, free tier de 3k e-mails/mês).

Características:
- Templates HTML simples mas legíveis em qualquer cliente de e-mail
- Assunto traz contexto suficiente para decisão sem abrir ("⚠ Sensor irrigação vazando há 30min")
- Link único para a tela relevante no app
- Suporte a unsubscribe individual por tipo de alerta

Alternativas avaliadas: SendGrid (caro acima do free tier), AWS SES (configuração complexa para o estágio), Mailgun (similar ao Resend).

### Canal 3: WhatsApp

**Stack:** Evolution API self-hosted (já decidida no PRD da Agenda para envio matinal).

Reaproveitamento: a mesma instância da Evolution API que envia ordem do dia ao funcionário envia alertas urgentes ao produtor.

Diferença de público: ordem do dia matinal vai para o **grupo da propriedade** (todos os membros recebem). Alertas individuais vão para o **número direto do usuário relevante**.

Configuração:
- Cada usuário cadastra o próprio número WhatsApp ao aceitar o convite
- Sistema valida o número enviando código de confirmação
- Alertas só chegam após confirmação validada

**Limitação crítica:** WhatsApp Business API tem políticas rígidas sobre mensagens não solicitadas. Para conformidade:
- Toda mensagem enviada pela Evolution API deve ser **resposta** a uma janela de conversa aberta pelo usuário, OU
- Usar templates pré-aprovados (Message Templates) no formato oficial da Meta

Para o caso de uso atual (notificações para o próprio admin que iniciou a sessão WhatsApp), a primeira opção cobre. Se o produto for distribuído para outros produtores, será necessário processo de aprovação de templates — registrar como item futuro.

### Configuração pelo usuário

**Tela "Notificações"** em Configurações:

- Lista todos os tipos de alerta da tabela acima
- Toggle por canal (Push, E-mail, WhatsApp) para cada tipo
- "Não me avise" sobrescreve qualquer canal — silencia o tipo completamente
- Horário de silêncio configurável: "Não enviar push entre 22h e 5h" (alertas urgentes ignoram silêncio)
- Botão "Restaurar padrões" volta para os padrões da tabela

### Throttling e deduplicação

Para evitar spam:

- Mesmo alerta sobre a mesma entidade não é enviado duas vezes em <1 hora (push) / <6 horas (e-mail) / <12 horas (WhatsApp)
- Acumulador inteligente: 3 sensores diferentes fora de faixa em <5 min são consolidados em uma única notificação ("3 sensores precisam de atenção")
- Se o usuário acabou de abrir o app (<5 min), notificações informativas são canceladas — assume que ele já viu o estado

### Pipeline de notificação no servidor

```
Evento gerado (ex: sensor offline há 10 min)
        │
        ├──> Avaliador de regras (consulta config do usuário + throttling)
        │           │
        │           ├──> Não notificar
        │           ├──> Push (Web Push API)
        │           ├──> E-mail (Resend)
        │           └──> WhatsApp (Evolution API)
        │
        └──> Log em notification_log (auditoria)
```

Tabela `notification_log`:
```
id UUID PRIMARY KEY
user_id UUID
alert_type TEXT
channels_attempted TEXT[]
channels_succeeded TEXT[]
created_at TIMESTAMPTZ
content JSONB                  -- snapshot do que foi enviado
```

Permite auditoria: "por que não recebi alerta sobre X?" → consultar log.

## Alternatives considered

1. **Apenas push notifications no PWA** — pros: simples, gratuito; cons: Safari iOS é limitado, push perdido se dispositivo offline, sem fallback. Descartado.

2. **Apenas e-mail para tudo** — pros: confiável, persistente; cons: latência alta, e-mails ignorados, ruído. Descartado como canal único.

3. **WhatsApp para tudo** — pros: alta visibilidade; cons: políticas Meta dificultam mensagens não-solicitadas, custo escala mal, ruído alto se mal usado. Descartado como canal único.

4. **Telegram bot** — pros: API simples, sem restrições da Meta; cons: nicho de adoção no Brasil, requer instalação adicional. Descartado para o MVP.

5. **SMS** — pros: máximo alcance; cons: caro, sem riqueza de conteúdo, mal suportado por templates. Descartado.

6. **Combinação configurável de Push + E-mail + WhatsApp (decisão atual)** — pros: usuário escolhe o que recebe e onde, custo controlado, redundância para alertas críticos; cons: mais complexidade de implementação, mais código de teste. Aceito — flexibilidade compensa.

## Consequences

- **Positivo:** alertas críticos têm chance alta de chegar ao usuário no momento certo.
- **Positivo:** usuário tem controle total — sem ruído de notificação que leva a desativar tudo.
- **Positivo:** Web Push sem dependência de FCM/Google evita lock-in.
- **Negativo:** três canais significam três integrações para manter, monitorar, debugar.
- **Negativo:** WhatsApp Business tem restrições crescentes — precisa de revisão regular para manter conformidade.
- **Risco:** push em iOS pode falhar silenciosamente em algumas configurações. Mitigação: oferecer e-mail como fallback automático para iOS.
- **Risco:** spam de notificações é o caminho mais rápido para usuário desativar tudo. Throttling e deduplicação são mandatórios desde o dia 1.

## Impact on specs

- **Observability:** dashboard de notificações entregues vs. tentadas vs. falhas, por canal e por tipo de alerta.
- **Security:** Web Push usa VAPID keys — gerar par próprio, armazenar privada com mesmo nível de proteção do JWT secret.
- **Onboarding:** consentimento para push notifications é fluxo navegador-nativo no PWA. Adicionar passo opcional no checklist.
- **WhatsApp infrastructure:** Evolution API já provisionada precisa de configuração extra para envios individuais (não-grupo).
- **Data Architecture:** tabelas `notification_preferences`, `notification_log`, `push_subscriptions` precisam ser definidas.
- **Alert sources:** cada módulo que gera alertas (Agenda, Manutenção, Automação, Sync, Backup) deve declarar quais tipos publica.

## References
- PRD: `docs/product/feat-agenda.md` (alertas de tarefas)
- PRD: `docs/product/feat-manutencao.md` (alertas preventivos)
- PRD: `docs/product/feat-automacao.md` (alertas de sensor)
- ADR-009: autenticação (`device_sessions` armazena push subscriptions)
- Web Push Protocol: https://www.rfc-editor.org/rfc/rfc8030
