CREATE TABLE IF NOT EXISTS purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'to_buy',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    bought_at TIMESTAMPTZ,
    google_task_id VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS ix_purchase_items_status ON purchase_items (status);

CREATE TABLE IF NOT EXISTS purchase_item_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_item_id UUID NOT NULL REFERENCES purchase_items(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_purchase_item_links_item ON purchase_item_links (purchase_item_id);
