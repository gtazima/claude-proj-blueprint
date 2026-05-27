-- Migration 006: Remove is_pending_review column
-- Feature foi descartada do produto. O campo causava tarefas importadas do
-- Google Tasks ficarem invisíveis na agenda silenciosamente.
-- Executar no Supabase SQL Editor após deploy do backend.

-- Garantia: zerar qualquer registro remanescente antes de remover
UPDATE task SET is_pending_review = false WHERE is_pending_review = true;

-- Remove a coluna
ALTER TABLE task DROP COLUMN IF EXISTS is_pending_review;
