# Post-mortem: Tarefas invisíveis + deploy Render com cache antigo

**Data:** 2026-05-27  
**Severidade:** Alta — todas as tarefas do app estavam invisíveis para o usuário  
**Duração do incidente:** Identificado ao longo de múltiplas sessões; resolvido em 2026-05-27  
**Status:** Resolvido ✅

---

## Resumo

O app exibia zero tarefas mesmo com 16 tarefas no banco. A causa raiz foi dupla: (1) o filtro `is_pending_review = False` na query `list_today` excluía silenciosamente tarefas importadas do Google Tasks; (2) o service worker do PWA mantinha em precache o bundle antigo (que chamava `/api` sem `/v1`), servindo esse bundle mesmo após deploys que corrigiam o problema.

---

## Linha do tempo

| Hora (aprox.) | Evento |
|---|---|
| Sessão anterior | Feature `is_pending_review` descartada do UX mas filtro permanece no código |
| Sessão anterior | Tarefas importadas do Google Tasks recebem `is_pending_review=True` |
| 2026-05-27 início | Usuário reporta: nenhuma tarefa aparece na agenda |
| 2026-05-27 | Diagnosticado: `list_today` filtrava `Task.is_pending_review == False` |
| 2026-05-27 | Fix aplicado: remoção completa de `is_pending_review` em 8 arquivos |
| 2026-05-27 | Deploy no Render — sem efeito: image hash idêntico (`sha256:e4fe7...`) |
| 2026-05-27 | Identificado: Render usou build cache — `COPY . .` não foi reexecutada |
| 2026-05-27 | "Clear build cache & deploy" → novo hash (`sha256:2991...`) |
| 2026-05-27 | Frontend ainda sem tarefas — Render logs mostram `/api/tasks/today` (sem `/v1`) |
| 2026-05-27 | Identificado: browser carregando bundle antigo `index-Ip0G7tYW.js` |
| 2026-05-27 | Root cause: service worker com precache antigo ainda ativo na janela anônima |
| 2026-05-27 | Fix: fechar janela anônima inteira + abrir nova → bundle novo carregado |
| 2026-05-27 | Tarefas aparecem ✅ |

---

## Causas raiz

### Causa 1: `is_pending_review` — filtro órfão

A feature de revisão de tarefas importadas foi descartada do produto, mas o campo e seus filtros permaneceram no código. O `google_sync.py` continuava criando tarefas com `is_pending_review=True`, e `list_today` excluía exatamente essas tarefas.

**Por que não foi pego antes:**  
O campo existia no modelo mas a rota `/pending-review` não estava exposta na UI. O filtro em `list_today` era o único efeito visível, e esse efeito (tarefas sumindo) não gerava nenhum erro — apenas silêncio.

### Causa 2: Render Docker build cache

O Render mantém cache agressivo das layers Docker. Mesmo com novos commits, o layer `COPY . .` era servido do cache porque nenhuma dependência mudou (o `pyproject.toml` e `uv.lock` não foram alterados nesta sessão). O mesmo image hash foi usado em múltiplos deploys consecutivos.

**Por que não foi pego antes:**  
O Render dashboard não deixa óbvio que o cache foi usado — o deploy aparece como "sucesso". Só inspecionando os logs de build linha a linha é visível que todos os steps mostram `CACHED`.

### Causa 3: PWA service worker com precache antigo

O vite-plugin-pwa com `registerType: "autoUpdate"` não substitui o SW ativo até que **todos os clientes (abas) sejam fechados**. Em modo anônimo, fechamos a *aba* mas não a *janela*, então o SW antigo permaneceu ativo. Ele tinha em precache o bundle `index-Ip0G7tYW.js`, que foi gerado quando `VITE_API_URL` apontava para `/api` (sem `/v1`).

**Efeito:**  
Mesmo com o novo bundle deployado no CDN, o browser servia o bundle antigo do precache. As chamadas de API iam para `https://agroecologia.onrender.com/api/tasks/today` em vez de `.../api/v1/tasks/today`, recebendo 404 Not Found.

---

## Impacto

- Todas as tarefas da propriedade ficaram invisíveis no app
- Google Tasks sync continuava rodando (registros no banco), mas nenhuma tarefa aparecia na UI
- Nenhuma perda de dados — as 16 tarefas estavam íntegras no banco Supabase

---

## Resolução

### Código
- `is_pending_review` removido de todos os arquivos: `task.py`, `task.py` (schemas), `tasks.py` (routes), `tasks.py` (services), `google_sync.py`, `tasks.ts`, `Today.tsx`
- `ReviewCard.tsx` deletado
- `migrations/006_drop_is_pending_review.sql` executado no Supabase SQL Editor

### Infraestrutura
- "Clear build cache & deploy" no Render para forçar rebuild completo
- SW antigo desregistrado manualmente (DevTools → Application → Service Workers → Unregister)
- Cache do site limpo (DevTools → Application → Storage → Clear site data)
- Janela anônima fechada completamente e reaberta

---

## Itens de ação

| Item | Responsável | Status |
|---|---|---|
| Remover `is_pending_review` do código | Claude | ✅ |
| Executar migration SQL no Supabase | Produtor | ✅ |
| Reautorizar Google Tasks após revogação do client secret | Produtor | ⏳ pendente |
| Corrigir URL do UptimeRobot (`/api/v1/health` → `/health`) | Produtor | ⏳ pendente |
| Limpar SW no browser normal (não-anônimo) | Produtor | ⏳ pendente |

---

## Lições aprendidas

### 1. Features descartadas devem ser removidas imediatamente
Quando uma feature é descartada do UX, o código correspondente deve ser removido na mesma sessão. Deixar filtros "inertes" é perigoso — eles continuam tendo efeito silencioso em runtime.

**Ação:** Qualquer feature removida do UX entra automaticamente no backlog de cleanup com prioridade alta. Nunca deixar o campo no modelo "só por precaução".

### 2. Render Docker cache não é transparente
Deploys com "sucesso" no Render não garantem novo código. Sempre verificar o log de build linha a linha ou usar o image hash como prova de rebuild.

**Ação:** Após todo deploy, verificar nos logs de runtime que o código novo está ativo (ex: checar log da versão ou timestamp de startup). Adicionar `ARG CACHEBUST` no Dockerfile se necessário.

### 3. PWA service worker sobrevive a "fechar aba"
Com `registerType: "autoUpdate"`, o SW antigo permanece até que **todas as janelas** do mesmo origin sejam fechadas. Em modo anônimo, "fechar aba" ≠ "fechar janela".

**Ação:** Adicionar ao runbook de deploy: "após deploy que altera o bundle JS, instruir usuários a fechar e reabrir completamente o browser (ou todas as janelas do site)". Considerar aumentar `networkTimeoutSeconds` (atualmente 5s) para acomodar cold starts do Render.

### 4. `VITE_API_URL` está baked no bundle em build time
Mudanças na variável de ambiente do frontend só têm efeito após rebuild + redeploy. Inspecionar o bundle deployado é a fonte da verdade.

---

## Gotchas para adicionar ao CLAUDE.md

```
- **Render Docker build cache:** "Deploy com sucesso" não garante novo código. Inspecionar image hash e logs de build. Usar "Clear build cache & deploy" quando o layer `COPY . .` precisa ser reexecutado.
- **PWA service worker com autoUpdate:** fechar a aba não ativa o SW novo — é preciso fechar TODAS as janelas do mesmo origin (incluindo anônimas). Para debug, sempre checar qual bundle JS está sendo carregado (DevTools Network → nome do arquivo .js principal).
- **VITE_API_URL é baked no bundle:** alterações no env do frontend só têm efeito após rebuild completo do Vite.
```
