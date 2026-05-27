-- Limpeza de cadeias corrompidas — rodar no Supabase SQL Editor
-- Contexto: sessão 2026-05-27 — picker permitia selecionar tarefas no meio
-- de cadeias, criando vínculos espúrios. Este script restaura o estado limpo.
--
-- ATENÇÃO: apaga TODOS os vínculos de cadeia existentes. Rodar apenas uma vez.
-- Após rodar, recriar os encadeamentos pelo app com a versão corrigida.

BEGIN;

-- 1. Restaura título original (base_title → title) em todas as tarefas afetadas
UPDATE task
SET title = base_title
WHERE base_title IS NOT NULL
  AND base_title <> ''
  AND deleted_at IS NULL;

-- 2. Limpa base_title
UPDATE task
SET base_title = NULL
WHERE base_title IS NOT NULL;

-- 3. Remove membros de cadeia (cascade não dispara aqui por ser DELETE manual)
DELETE FROM task_chain_member;

-- 4. Remove as cadeias em si
DELETE FROM task_chain;

COMMIT;

-- Verificação (deve retornar 0 em ambas as linhas)
SELECT COUNT(*) AS membros_restantes  FROM task_chain_member;
SELECT COUNT(*) AS cadeias_restantes  FROM task_chain;
