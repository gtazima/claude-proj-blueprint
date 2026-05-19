import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { purchaseApi, type PurchaseItem } from "../api/purchase";

// ─── helpers ──────────────────────────────────────────────────────────────────

function domainLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 30);
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

// ─── AddItemForm ──────────────────────────────────────────────────────────────

function AddItemForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
  };

  return (
    <div className="flex gap-2 p-3 border-b border-stone-200 bg-white">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="Adicionar item…"
        autoFocus
        className="flex-1 rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <button
        onClick={submit}
        disabled={!name.trim()}
        className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40 transition-colors"
      >
        +
      </button>
    </div>
  );
}

// ─── ItemRow ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  selected,
  onSelect,
  onToggle,
}: {
  item: PurchaseItem;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const bought = item.status === "bought";

  return (
    <div
      onClick={onSelect}
      className={clsx(
        "flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-stone-100",
        selected ? "bg-green-50" : "hover:bg-stone-50"
      )}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className={clsx(
          "h-4 w-4 rounded border shrink-0 flex items-center justify-center transition-colors",
          bought ? "bg-green-600 border-green-600 text-white" : "border-stone-300 hover:border-green-400"
        )}
      >
        {bought && (
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-2.5 w-2.5">
            <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={clsx("text-sm truncate", bought ? "line-through text-stone-400" : "text-stone-800")}>
          {item.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {item.links.length > 0 && (
            <span className="text-[10px] text-stone-400">
              {item.links.length} link{item.links.length > 1 ? "s" : ""}
            </span>
          )}
          {item.notes && (
            <span className="text-[10px] text-stone-400">· notas</span>
          )}
          {bought && item.bought_at && (
            <span className="text-[10px] text-stone-400">· {formatDate(item.bought_at)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ItemDetail ───────────────────────────────────────────────────────────────

function ItemDetail({
  item,
  onClose,
}: {
  item: PurchaseItem;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(item.name);
  const [notes, setNotes] = useState(item.notes ?? "");
  const [newLink, setNewLink] = useState("");

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["purchase-items"] });

  const updateItem = useMutation({
    mutationFn: (payload: { name?: string; notes?: string | null }) =>
      purchaseApi.update(item.id, payload),
    onSuccess: invalidate,
  });

  const addLink = useMutation({
    mutationFn: (url: string) => purchaseApi.addLink(item.id, url),
    onSuccess: () => { invalidate(); setNewLink(""); },
  });

  const removeLink = useMutation({
    mutationFn: (linkId: string) => purchaseApi.removeLink(item.id, linkId),
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: () => purchaseApi.delete(item.id),
    onSuccess: () => { invalidate(); onClose(); },
  });

  const toggle = useMutation({
    mutationFn: () =>
      item.status === "to_buy" ? purchaseApi.markBought(item.id) : purchaseApi.markToBuy(item.id),
    onSuccess: invalidate,
  });

  const saveName = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== item.name) updateItem.mutate({ name: trimmed });
    setEditingName(false);
  };

  const saveNotes = () => {
    const trimmed = notes.trim() || null;
    if (trimmed !== item.notes) updateItem.mutate({ notes: trimmed });
  };

  const submitLink = () => {
    const trimmed = newLink.trim();
    if (!trimmed) return;
    addLink.mutate(trimmed);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 px-5 py-4 border-b border-stone-200">
        <div className="flex-1 min-w-0">
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(item.name); setEditingName(false); } }}
              className="w-full text-sm font-semibold text-stone-900 border-b border-green-500 outline-none pb-0.5"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className={clsx(
                "text-sm font-semibold text-left w-full",
                item.status === "bought" ? "line-through text-stone-400" : "text-stone-900 hover:text-green-700"
              )}
            >
              {item.name}
            </button>
          )}
          <p className="text-[10px] text-stone-400 mt-0.5">
            Criado em {formatDate(item.created_at)}
            {item.bought_at && ` · Comprado em ${formatDate(item.bought_at)}`}
          </p>
        </div>
        <button onClick={onClose} className="text-stone-300 hover:text-stone-600 text-lg leading-none shrink-0">×</button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Marcar como comprado */}
        <button
          onClick={() => toggle.mutate()}
          disabled={toggle.isPending}
          className={clsx(
            "w-full flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors",
            item.status === "to_buy"
              ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
              : "border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50"
          )}
        >
          {item.status === "to_buy" ? (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M2 8l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Marcar como comprado
            </>
          ) : (
            <>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                <path d="M3 8h10" strokeLinecap="round" />
              </svg>
              Desfazer compra
            </>
          )}
        </button>

        {/* Links */}
        <div>
          <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
            Links de pesquisa
          </label>
          <div className="space-y-1.5 mb-2">
            {item.links.map((link) => (
              <div key={link.id} className="flex items-center gap-2 group rounded-md border border-stone-200 px-2.5 py-1.5">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-xs text-blue-600 hover:underline truncate"
                >
                  {domainLabel(link.url)}
                </a>
                <button
                  onClick={() => removeLink.mutate(link.id)}
                  className="invisible group-hover:visible text-stone-300 hover:text-red-500 text-xs transition-colors"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="url"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitLink(); }}
              placeholder="https://…"
              className="flex-1 rounded-md border border-stone-300 px-2.5 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={submitLink}
              disabled={!newLink.trim() || addLink.isPending}
              className="rounded-md border border-green-400 bg-green-50 px-2.5 py-1 text-xs text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
            >
              Adicionar
            </button>
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
            Notas / especificações
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={saveNotes}
            placeholder="Modelo, especificação técnica, onde pesquisar…"
            rows={4}
            className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-stone-100">
        <button
          onClick={() => deleteItem.mutate()}
          disabled={deleteItem.isPending}
          className="text-xs text-red-400 hover:text-red-600 transition-colors"
        >
          Excluir item
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Tab = "to_buy" | "bought";

export default function ComprasPage() {
  const [tab, setTab] = useState<Tab>("to_buy");
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["purchase-items", tab, keyword],
    queryFn: () => purchaseApi.list(tab, keyword || undefined),
  });

  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  const addItem = useMutation({
    mutationFn: (name: string) => purchaseApi.create({ name }),
    onSuccess: (item) => {
      void qc.invalidateQueries({ queryKey: ["purchase-items"] });
      setSelectedId(item.id);
    },
  });

  const toggle = useMutation({
    mutationFn: (item: PurchaseItem) =>
      item.status === "to_buy" ? purchaseApi.markBought(item.id) : purchaseApi.markToBuy(item.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["purchase-items"] }),
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-green-600 text-white shrink-0">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
                <path d="M3 3h2l.4 2M7 13h10l2-8H5.4M7 13L5.4 5M7 13a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h1 className="text-sm font-bold text-stone-900 leading-tight">Compras</h1>
              <p className="text-xs text-stone-400 leading-tight">
                {tab === "to_buy"
                  ? `${items.length} item${items.length !== 1 ? "s" : ""} a comprar`
                  : `${items.length} comprado${items.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none"
              viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6.5" cy="6.5" r="4.5" /><path d="M10 10l3 3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Buscar…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs border border-stone-200 rounded-md text-stone-700 placeholder:text-stone-400 outline-none focus:border-green-400 w-36 transition-colors"
            />
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-0.5 rounded-md border border-stone-200 p-0.5">
            {(["to_buy", "bought"] as Tab[]).map((t) => (
              <button key={t} onClick={() => { setTab(t); setSelectedId(null); }}
                className={clsx(
                  "rounded px-2.5 py-0.5 text-xs font-medium transition-colors",
                  tab === t ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"
                )}>
                {t === "to_buy" ? "A comprar" : "Comprados"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Body — split panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="w-72 flex flex-col border-r border-stone-200 bg-white shrink-0 overflow-hidden">
          {tab === "to_buy" && (
            <AddItemForm onAdd={(name) => addItem.mutate(name)} />
          )}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-px pt-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-12 bg-stone-50 animate-pulse mx-3 my-1 rounded" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-12 text-stone-400">
                <svg className="mx-auto h-8 w-8 mb-2 opacity-40" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M3 3h2l.4 2M7 13h10l2-8H5.4M7 13L5.4 5M7 13a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-xs">
                  {tab === "to_buy" ? "Lista vazia. Adicione o primeiro item acima." : "Nenhuma compra registrada."}
                </p>
              </div>
            ) : (
              items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onSelect={() => setSelectedId(item.id)}
                  onToggle={() => toggle.mutate(item)}
                />
              ))
            )}
          </div>
        </div>

        {/* Detail */}
        <div className="flex-1 overflow-hidden bg-white">
          {selectedItem ? (
            <ItemDetail
              key={selectedItem.id}
              item={selectedItem}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-stone-400">
              <div className="text-center">
                <svg className="mx-auto h-10 w-10 mb-3 opacity-30" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M3 3h2l.4 2M7 13h10l2-8H5.4M7 13L5.4 5M7 13a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <p className="text-sm">Selecione um item para ver detalhes</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
