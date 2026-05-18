# ADR-003: Controle de Acesso por Cultura

## Status
Accepted

## Context
O modelo de permissões do AgroecologIA precisa ir além de papéis genéricos (admin, usuário, somente leitura). O caso de uso concreto que definiu esse requisito: parceiros externos de meliponicultura precisam acessar apenas as informações de abelhas — sem ver finanças, tarefas gerais, outras culturas ou qualquer outro dado da propriedade.

Outros cenários previstos:
- Funcionário recebe apenas via WhatsApp — sem acesso ao app
- Pai acessa Agenda, Culturas e Financeiro — sem acesso a Vendas ou Automação
- Futuro técnico agrônomo contratado acessa apenas Culturas de uma cultura específica para consultoria

O sistema precisa ser configurável o suficiente para cobrir esses casos sem exigir desenvolvimento customizado para cada novo perfil.

## Decision

Adotar modelo **RBAC com restrições por recurso (Resource-scoped RBAC)** — combinação de papéis com permissões granulares por módulo e por entidade de cultura.

### Estrutura de permissões

Cada usuário tem:
```
user_id
property_id         → qual propriedade pode acessar
role                → papel base: "admin" | "member" | "viewer" | "external"
module_permissions  → lista de módulos permitidos (ex: ["agenda", "culturas", "financeiro"])
culture_filter      → lista de culture_ids permitidos, ou null (null = todas)
```

### Papéis base

| Papel | Descrição | Módulos padrão |
|---|---|---|
| `admin` | Controle total — configura permissões de outros usuários | Todos |
| `member` | Usuário ativo da propriedade | Configurável pelo admin |
| `viewer` | Acesso somente leitura | Configurável pelo admin |
| `external` | Acesso externo restrito | Apenas os módulos explicitamente concedidos |

### Filtro por cultura

`culture_filter` é aplicado como camada adicional sobre `module_permissions`:

- `culture_filter = null` → sem restrição de cultura (vê tudo nos módulos permitidos)
- `culture_filter = [uuid_abelhas]` → vê apenas dados relacionados à cultura "abelhas nativas" nos módulos permitidos

O filtro se propaga por todos os módulos: Culturas, Caderno de Campo, Agenda (tarefas associadas à cultura), Mapa (apenas áreas daquela cultura).

### Configuração dos usuários atuais da propriedade

| Usuário | Papel | Módulos | Filtro de cultura |
|---|---|---|---|
| Produtor | `admin` | Todos | null |
| Pai | `member` | agenda, culturas, financeiro, vendas, manutencao | null |
| Funcionário | — | Nenhum (recebe via WhatsApp) | — |
| Parceiro meliponicultura | `external` | Configurável pelo admin | [abelhas_nativas] |

Os dois eixos são independentes: o admin escolhe **quais módulos** o parceiro pode acessar, e o `culture_filter` restringe **quais dados** ele vê dentro de cada módulo. Por exemplo, o admin pode conceder acesso a `culturas`, `agenda` e `caderno-de-campo` para o parceiro de meliponicultura — ele verá apenas tarefas, registros e anotações relacionadas às abelhas em todos esses módulos. O filtro é sempre aplicado, independente de quantos módulos forem liberados.

### Enforcement

Permissões são verificadas em duas camadas:

1. **API (backend):** toda rota verifica `module_permissions` do usuário autenticado. Queries de banco aplicam `culture_filter` como cláusula WHERE automática via middleware — nenhuma query retorna dados de culturas fora do filtro do usuário, independente do código da rota.

2. **Frontend (PWA):** menus e navegação ocultam módulos sem permissão. Isso é UX — a validação real é sempre no backend.

### Propagação do filtro de cultura no banco

O `culture_filter` é injetado automaticamente como condição em todas as queries que envolvem dados de cultura:

```sql
-- Sem filtro (admin/member sem restrição)
SELECT * FROM tasks WHERE property_id = ?

-- Com filtro de cultura
SELECT * FROM tasks 
WHERE property_id = ? 
AND (culture_id IS NULL OR culture_id = ANY(?::uuid[]))
```

O middleware de contexto de request injeta o `culture_filter` do usuário autenticado em todas as queries via repositório — o código de negócio nunca lida com isso explicitamente.

### Convite de usuários externos

Admins convidam usuários externos por e-mail com permissões pré-configuradas. O usuário aceita o convite e cria sua conta já com as restrições aplicadas. Admins podem revogar acesso a qualquer momento.

## Alternatives considered

1. **RBAC simples com papéis fixos** (admin, member, viewer) — pros: simples de implementar; cons: não cobre o caso de parceiro com acesso apenas a abelhas — exigiria um papel customizado por caso de uso. Não escala para múltiplos produtores com necessidades diferentes. Descartado.

2. **ABAC (Attribute-Based Access Control)** — pros: máxima flexibilidade, políticas expressivas; cons: complexidade de implementação e administração muito alta para o contexto. Um agricultor não deveria precisar entender políticas ABAC para convidar um parceiro. Descartado.

3. **Multi-tenancy por sub-propriedade** — criar uma "propriedade virtual" apenas com as culturas do parceiro; cons: duplica dados, cria inconsistência, não reflete a realidade (as abelhas são da mesma propriedade). Descartado.

4. **Resource-scoped RBAC (decisão atual)** — pros: cobre todos os casos identificados, configurável pelo admin sem desenvolvimento, propagação automática via middleware elimina risco de vazamento de dados por esquecimento no código; cons: `culture_filter` em todas as queries adiciona complexidade de middleware. Aceito — a complexidade fica encapsulada no middleware, invisível ao código de negócio.

## Consequences

- **Positivo:** admin configura qualquer perfil de acesso via UI sem necessidade de desenvolvimento customizado.
- **Positivo:** filtro de cultura aplicado no banco via middleware elimina risco de vazamento de dados por erro de implementação em uma rota específica.
- **Positivo:** modelo escala naturalmente para múltiplas propriedades quando o produto crescer — `property_id` já está no modelo.
- **Negativo:** middleware de filtro de cultura adiciona complexidade às queries. Precisa de testes explícitos garantindo que o filtro é aplicado corretamente em todos os módulos.
- **Risco:** se um novo módulo for criado sem integrar o middleware de filtro, dados de culturas restritas podem vazar. Mitigação: teste automatizado que verifica aplicação do filtro em todas as rotas que retornam dados de cultura. Adicionar ao checklist de code review.

## Impact on specs

- **Security:** enforcement duplo (API + banco) é obrigatório. Testes de penetração devem verificar que usuário `external` com `culture_filter = [abelhas]` não consegue acessar dados de outras culturas por nenhuma rota, mesmo manipulando requisições diretamente.
- **Data Architecture:** `culture_id` deve ser uma foreign key presente em todas as tabelas que representam dados associáveis a uma cultura: tasks, field_notes, harvests, maintenance_records, map_areas. Schema precisa refletir isso desde o início.
- **API:** middleware de injeção de `culture_filter` precisa ser aplicado globalmente no router do FastAPI — não por rota individual.
- **Culturas (feat-culturas.md):** AC-12 e AC-13 dependem diretamente deste ADR.
- **Mapa (feat-mapa.md):** usuários com filtro de cultura só veem áreas associadas às suas culturas permitidas.
- **Caderno de Campo (feat-caderno-de-campo.md):** entradas associadas a culturas restritas ficam invisíveis para usuários sem permissão.

## References

- [[feat-culturas]] — AC-12 e AC-13: filtro de cultura para parceiros de meliponicultura
- [[feat-agenda]] — tarefas filtradas por cultura no Kanban e na ordem do dia
- [[feat-caderno-de-campo]] — entradas de culturas restritas invisíveis para usuários sem permissão
- [[feat-mapa]] — áreas do mapa filtradas por cultura
- [[adr-009-autenticacao]] — JWT carrega `module_permissions` + `culture_filter` lidos pelo middleware
