-- Migration 007: restaura títulos corrompidos pelo encadeamento
-- O sistema anterior modificava task.title com sufixos " | pos/total".
-- A partir de agora, os títulos nunca são modificados — o badge é exibido
-- apenas no frontend usando os dados de ChainInfo.

-- Restaura o título original para todas as tarefas que tinham base_title salvo
UPDATE task
SET title      = base_title,
    base_title = NULL
WHERE base_title IS NOT NULL
  AND base_title <> '';

-- Zera eventuais base_title vazios por precaução
UPDATE task SET base_title = NULL WHERE base_title = '';
