# ADR-009: Autenticação e Gerenciamento de Sessão

## Status
Accepted

## Context
O AgroecologIA tem múltiplos requisitos de autenticação:

1. **Sign-in rápido** — onboarding (PRD `feat-onboarding.md`) exige sign-up + primeira tarefa em <5 minutos. Cadastro com formulário longo é gargalo.
2. **Múltiplos dispositivos** por usuário — desktop em casa + celular no campo. ADR-002 (sync offline) exige `device_id` autenticado.
3. **Convite de outros usuários** — admin convida pai e parceiros com permissões pré-configuradas (PRD onboarding + ADR-003).
4. **Tokens criptografados** — credenciais de Gmail (ADR-005) e bancos precisam ser armazenadas de forma segura.
5. **Funcionário não tem conta** — recebe via WhatsApp; nenhuma autenticação para ele.
6. **Modelo atual: uso próprio** — não há urgência de SSO empresarial, mas a arquitetura não pode fechar essa porta.

## Decision

Adotar **Supabase Auth como provedor único de identidade** com estratégia de sessão multi-dispositivo via JWT.

### Métodos de autenticação suportados

**No MVP:**
1. **Google Sign-In (recomendado)** — alinha com integração Gmail (ADR-005); o produtor já vai conectar Gmail mesmo, reaproveita o consentimento.
2. **E-mail + senha** — fallback para usuários sem Gmail.

**Não suportado no MVP:**
- Login passwordless por magic link
- Login por SMS
- Login social com Apple/Microsoft/etc.
- Anonymous sessions

### Fluxo de sessão multi-dispositivo

Cada login gera:
- **JWT de acesso** (válido por 1h, contém `user_id`, `property_id`, `module_permissions`, `culture_filter`)
- **Refresh token** (válido por 30 dias, persistente no dispositivo)
- **Device ID único** gerado no primeiro login do dispositivo, armazenado localmente — usado pelo sync offline (ADR-002)

```
Dispositivo Celular  ──[device_id: abc123]──┐
                                              ├──> usuário gtazi (mesmo user_id)
Dispositivo Desktop  ──[device_id: def456]──┘
```

O JWT é incluído em todo request HTTP via header `Authorization: Bearer <token>`. O refresh token nunca trafega no header — fica no localStorage criptografado e é usado apenas no endpoint de refresh.

### Revogação de dispositivos

O usuário consegue ver lista de dispositivos ativos e revogar individualmente cada um. Útil para:
- Celular perdido ou trocado
- Suspeita de acesso indevido
- Saída de funcionário/parceiro (admin revoga acesso)

### Convite de usuários

Fluxo do convite (alinhado com PRD onboarding e ADR-003):

1. Admin acessa "Configurações → Usuários" no app
2. Preenche: e-mail do convidado + módulos permitidos + filtro de cultura (opcional)
3. Sistema gera token de convite (UUID v4 + assinatura HMAC) com expiração de 24h
4. E-mail enviado ao convidado com link contendo o token
5. Convidado clica no link → redireciona para sign-up no app (Google ou e-mail/senha)
6. Após criar conta, sistema valida o token, cria registro na tabela `property_members` com permissões pré-configuradas, marca token como consumido
7. Convidado é redirecionado para a ordem do dia já filtrada conforme suas permissões

Tokens de convite são single-use e expiram em 24h. Revogados imediatamente se o admin cancelar antes do uso.

### Armazenamento seguro de credenciais externas

Tokens OAuth de terceiros (Gmail para parsing de e-mails, Google Drive para backup) **nunca são armazenados em pickle** (lição do código legado em `old/fazenda-dashboard/config/token.pkl`).

Decisão: **criptografia AES-256-GCM com chave derivada por usuário**.

```
master_key (variável de ambiente do servidor, rotativa)
    + user_id
    └─[HKDF-SHA256]─> chave de criptografia do usuário
                            │
                            └─[AES-GCM]─> tokens criptografados
```

Características:
- Cada usuário tem sua própria chave derivada — vazamento de um token não compromete os demais
- Chave derivada nunca é persistida — sempre recalculada em runtime
- `master_key` rotativa anualmente sem precisar re-criptografar tudo (versionar a chave)

### Refresh de sessão e revogação

- **Renovação silenciosa** — antes do JWT expirar (5 min de buffer), o cliente troca o refresh token por novo JWT sem interromper o uso
- **Logout** — invalida o refresh token no servidor (lista de revogação) e remove credenciais locais
- **Mudança de senha** — invalida todos os refresh tokens existentes; usuário precisa logar novamente em todos os dispositivos
- **Mudança de permissão** — JWT em circulação ainda tem as permissões antigas até expirar (1h). Para mudança imediata, admin pode forçar re-login do usuário

### Não autenticados — estado mínimo

Sem login, o usuário só pode:
- Ver tela de sign-up / sign-in
- Aceitar convite (se chegou via link de e-mail)

Nenhuma funcionalidade do produto roda sem autenticação. Isso é decisão consciente: o sync offline precisa de `device_id` autenticado para evitar dados anônimos órfãos.

### Multi-Factor Authentication (MFA)

**Não implementado no MVP.** Para o modelo atual (uso próprio), o overhead não compensa. Quando o produto escalar para outros usuários, MFA via TOTP entra como funcionalidade — preferencialmente como obrigatório para `role = admin` e opcional para demais.

A arquitetura não fecha porta: Supabase Auth suporta MFA nativamente — basta ativar.

## Alternatives considered

1. **Auth0** — pros: maduro, suporta tudo; cons: caro acima do free tier, vendor lock-in mais forte. Descartado para o estágio atual do produto.

2. **Keycloak self-hosted** — pros: total controle, open source; cons: complexidade operacional muito alta para uma propriedade individual. Descartado.

3. **Implementação própria com bcrypt + JWT manual** — pros: zero custo, total controle; cons: segurança é fácil de errar, não tem MFA pronto, não tem login social pronto, manutenção é trabalho contínuo. Descartado — estamos construindo um produto agrícola, não um sistema de auth.

4. **Firebase Auth** — pros: maduro; cons: parte do Google Cloud, custo escala mal acima do free tier, lock-in com Firebase como um todo. Descartado em favor de Supabase (que oferece também Postgres como banco principal — alinha com o stack).

5. **Supabase Auth (decisão atual)** — pros: integra bem com Postgres (já no stack), suporta Google Sign-In nativo, free tier generoso, MFA built-in para o futuro, JWT padrão; cons: dependência de SaaS — se Supabase mudar pricing, há custo de migração. Aceito — o vendor lock-in é mitigável (Supabase é open source e pode ser self-hosted no futuro).

## Consequences

- **Positivo:** sign-up em <30 segundos via Google Sign-In atende o requisito de onboarding rápido.
- **Positivo:** multi-dispositivo com `device_id` autenticado destrava o sync offline do ADR-002 sem retrabalho.
- **Positivo:** Supabase Auth é interoperável com o Postgres do projeto via Row Level Security — caminho natural para evoluir o controle de acesso (ADR-003) com defesa em profundidade.
- **Positivo:** convite de usuários por e-mail é fluxo padrão do Supabase — não precisamos reinventar.
- **Negativo:** dependência de serviço externo (Supabase) para autenticação. Indisponibilidade do Supabase = ninguém consegue logar.
- **Risco:** vazamento da `master_key` compromete todos os tokens criptografados. Mitigação: chave em vault (Doppler, HashiCorp Vault, Supabase secrets), nunca em código, com auditoria de acesso.
- **Risco:** JWT com permissões em payload significa que mudança de permissão demora até 1h para refletir (até expirar). Mitigação: para mudanças críticas de acesso, admin pode forçar logout do usuário.

## Impact on specs

- **Security spec** (`docs/specs/security/README.md`): este ADR define a base. A spec deve detalhar políticas de senha, regras de MFA futuro, lista de eventos auditáveis (login, logout, mudança de permissão, revogação de dispositivo).
- **API spec:** todo endpoint exceto `/auth/*` exige header `Authorization: Bearer <jwt>`. Padronizar resposta 401 vs 403 (não autenticado vs não autorizado).
- **Data Architecture:** tabelas `users`, `property_members`, `device_sessions`, `invitation_tokens`, `revoked_refresh_tokens` precisam ser definidas no schema inicial.
- **Onboarding (feat-onboarding.md):** AC-1, AC-16, AC-17 dependem deste ADR.
- **Sync offline (ADR-002):** o `device_id` exigido pelo operation log vem desta ADR.
- **Controle de acesso (ADR-003):** o JWT carrega `module_permissions` e `culture_filter` — middleware de filtro lê do JWT, não consulta banco a cada request.
- **Integração bancária (ADR-005):** tokens OAuth de Gmail são armazenados conforme política de criptografia desta ADR.

## References

- [[feat-onboarding]] — AC-1, AC-16, AC-17 dependem deste ADR
- [[feat-google-tasks-sync]] — tokens OAuth armazenados conforme política de criptografia deste ADR
- [[adr-002-sync-offline]] — fornece `device_id` para o operation log
- [[adr-003-controle-acesso-por-cultura]] — JWT carrega `module_permissions` + `culture_filter`
- [[adr-005-integracao-bancaria]] — tokens OAuth de Gmail criptografados conforme este ADR
