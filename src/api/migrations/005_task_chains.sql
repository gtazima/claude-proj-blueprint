-- Cadeias de tarefas (grupos de tarefas sequencialmente relacionadas)
CREATE TABLE IF NOT EXISTS task_chain (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Membros de cada cadeia com posição explícita na sequência
CREATE TABLE IF NOT EXISTS task_chain_member (
    chain_id UUID NOT NULL REFERENCES task_chain(id) ON DELETE CASCADE,
    task_id  UUID NOT NULL REFERENCES task(id)       ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (chain_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_chain_member_task ON task_chain_member(task_id);

-- Título original da tarefa antes de qualquer sufixo de cadeia
ALTER TABLE task ADD COLUMN IF NOT EXISTS base_title VARCHAR(200);
