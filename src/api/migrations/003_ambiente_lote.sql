-- Novas dimensões de tag: Ambiente e Lote
-- Aplicar no Supabase SQL Editor antes de fazer deploy.

-- Tabelas de configuração
CREATE TABLE IF NOT EXISTS ambiente (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(60) NOT NULL UNIQUE,
    color VARCHAR(20) NOT NULL DEFAULT '#6B7280'
);

CREATE TABLE IF NOT EXISTS lote (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(60) NOT NULL UNIQUE,
    color VARCHAR(20) NOT NULL DEFAULT '#6B7280'
);

-- Colunas de slug nas tarefas
ALTER TABLE task ADD COLUMN IF NOT EXISTS activity_type_slug VARCHAR(60);
ALTER TABLE task ADD COLUMN IF NOT EXISTS culture_slug VARCHAR(60);
ALTER TABLE task ADD COLUMN IF NOT EXISTS ambiente_slug VARCHAR(60);
ALTER TABLE task ADD COLUMN IF NOT EXISTS lote_slug VARCHAR(60);

-- Índices nas colunas de slug de tarefas
CREATE INDEX IF NOT EXISTS ix_task_activity_type_slug ON task(activity_type_slug);
CREATE INDEX IF NOT EXISTS ix_task_culture_slug ON task(culture_slug);
CREATE INDEX IF NOT EXISTS ix_task_ambiente_slug ON task(ambiente_slug);
CREATE INDEX IF NOT EXISTS ix_task_lote_slug ON task(lote_slug);

-- Colunas de slug no caderno de campo
ALTER TABLE fieldnote ADD COLUMN IF NOT EXISTS activity_type_slug VARCHAR(60);
ALTER TABLE fieldnote ADD COLUMN IF NOT EXISTS culture_slug VARCHAR(60);
ALTER TABLE fieldnote ADD COLUMN IF NOT EXISTS ambiente_slug VARCHAR(60);
ALTER TABLE fieldnote ADD COLUMN IF NOT EXISTS lote_slug VARCHAR(60);

-- Índices nas colunas de slug do caderno
CREATE INDEX IF NOT EXISTS ix_fieldnote_activity_type_slug ON fieldnote(activity_type_slug);
CREATE INDEX IF NOT EXISTS ix_fieldnote_culture_slug ON fieldnote(culture_slug);
CREATE INDEX IF NOT EXISTS ix_fieldnote_ambiente_slug ON fieldnote(ambiente_slug);
CREATE INDEX IF NOT EXISTS ix_fieldnote_lote_slug ON fieldnote(lote_slug);

-- Seed de Ambientes (idempotente)
INSERT INTO ambiente (name, slug, color) VALUES
    ('SAF Piloto',    'saf_piloto',   '#4CAF50'),
    ('SAF 1',         'saf_1',        '#66BB6A'),
    ('SAF 2',         'saf_2',        '#2E7D32'),
    ('Fotovoltaico',  'fotovoltaico', '#FF8F00'),
    ('Reservatório',  'reservatorio', '#0288D1')
ON CONFLICT (slug) DO NOTHING;
