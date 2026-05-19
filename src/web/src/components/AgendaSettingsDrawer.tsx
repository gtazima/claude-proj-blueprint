import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import {
  configApi,
  type Person,
  type Tag,
  type PersonCreate,
  type TagCreate,
} from "../api/config.ts";
import { usePeople, useActivityTypes, useCultures, useAmbientes, useLotes } from "../hooks/useConfig.ts";

type Tab = "people" | "types" | "cultures" | "ambientes" | "lotes";

interface Props {
  onClose: () => void;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ─── Shared tag row ───────────────────────────────────────────────────────────

function TagRow({
  tag,
  onDelete,
}: {
  tag: Tag;
  onDelete: (slug: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <span
        className="h-3 w-3 rounded-full shrink-0 border border-white shadow-sm"
        style={{ background: tag.color }}
      />
      <span className="flex-1 text-sm text-stone-700">{tag.name}</span>
      <button
        onClick={() => onDelete(tag.slug)}
        className="invisible group-hover:visible text-stone-300 hover:text-red-500 transition-colors text-xs px-1"
        title={`Remover ${tag.name}`}
      >
        ✕
      </button>
    </div>
  );
}

// ─── Add tag form ─────────────────────────────────────────────────────────────

function AddTagForm({
  onAdd,
  isPending,
}: {
  onAdd: (name: string, slug: string) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed, slugify(trimmed));
    setName("");
  };

  return (
    <div className="flex gap-2 mt-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="Nome da tag…"
        className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <button
        onClick={submit}
        disabled={!name.trim() || isPending}
        className="rounded border border-green-500 bg-green-50 px-3 py-1 text-sm text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
      >
        Adicionar
      </button>
    </div>
  );
}

// ─── People tab ───────────────────────────────────────────────────────────────

function PeopleTab() {
  const { data: people = [], isLoading } = usePeople();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const create = useMutation({
    mutationFn: (p: PersonCreate) => configApi.createPerson(p),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["config", "people"] });
      setName("");
    },
  });

  const remove = useMutation({
    mutationFn: (slug: string) => configApi.deletePerson(slug),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["config", "people"] });
      void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    },
  });

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    create.mutate({ name: trimmed, slug: slugify(trimmed) });
  };

  if (isLoading) return <p className="text-sm text-stone-400 py-4 text-center">Carregando…</p>;

  return (
    <div>
      <div className="divide-y divide-stone-100">
        {people.map((p) => (
          <PersonRow key={p.slug} person={p} onDelete={(slug) => remove.mutate(slug)} />
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
          placeholder="Nome do responsável…"
          className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={handleAdd}
          disabled={!name.trim() || create.isPending}
          className="rounded border border-green-500 bg-green-50 px-3 py-1 text-sm text-green-700 hover:bg-green-100 disabled:opacity-40 transition-colors"
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

function PersonRow({ person, onDelete }: { person: Person; onDelete: (slug: string) => void }) {
  const SYSTEM_SLUGS = ["produtor", "pai", "funcionario", "nao_atribuido"];
  const isSystem = SYSTEM_SLUGS.includes(person.slug);

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <span
        className="h-3 w-3 rounded-full shrink-0 border border-white shadow-sm"
        style={{ background: person.color }}
      />
      <span className="flex-1 text-sm text-stone-700">{person.name}</span>
      {person.supabase_user_id && (
        <span className="text-[10px] text-blue-500 border border-blue-200 rounded px-1 py-0.5">login</span>
      )}
      {isSystem ? (
        <span className="text-[10px] text-stone-300 px-1">sistema</span>
      ) : (
        <button
          onClick={() => onDelete(person.slug)}
          className="invisible group-hover:visible text-stone-300 hover:text-red-500 transition-colors text-xs px-1"
          title={`Remover ${person.name}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}

// ─── Types tab ────────────────────────────────────────────────────────────────

function TypesTab() {
  const { data: types = [], isLoading } = useActivityTypes();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (t: TagCreate) => configApi.createActivityType(t),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["config", "activity-types"] }),
  });

  const remove = useMutation({
    mutationFn: (slug: string) => configApi.deleteActivityType(slug),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["config", "activity-types"] });
      void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    },
  });

  if (isLoading) return <p className="text-sm text-stone-400 py-4 text-center">Carregando…</p>;

  return (
    <div>
      <div className="divide-y divide-stone-100">
        {types.map((t) => (
          <TagRow key={t.slug} tag={t} onDelete={(slug) => remove.mutate(slug)} />
        ))}
      </div>
      <AddTagForm
        onAdd={(name, slug) => create.mutate({ name, slug })}
        isPending={create.isPending}
      />
    </div>
  );
}

// ─── Cultures tab ─────────────────────────────────────────────────────────────

function CulturesTab() {
  const { data: cultures = [], isLoading } = useCultures();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (t: TagCreate) => configApi.createCulture(t),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["config", "cultures"] }),
  });

  const remove = useMutation({
    mutationFn: (slug: string) => configApi.deleteCulture(slug),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["config", "cultures"] });
      void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    },
  });

  if (isLoading) return <p className="text-sm text-stone-400 py-4 text-center">Carregando…</p>;

  return (
    <div>
      <div className="divide-y divide-stone-100">
        {cultures.map((c) => (
          <TagRow key={c.slug} tag={c} onDelete={(slug) => remove.mutate(slug)} />
        ))}
      </div>
      <AddTagForm
        onAdd={(name, slug) => create.mutate({ name, slug })}
        isPending={create.isPending}
      />
    </div>
  );
}

// ─── Ambientes tab ────────────────────────────────────────────────────────────

function AmbientesTab() {
  const { data: ambientes = [], isLoading } = useAmbientes();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (t: TagCreate) => configApi.createAmbiente(t),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["config", "ambientes"] }),
  });

  const remove = useMutation({
    mutationFn: (slug: string) => configApi.deleteAmbiente(slug),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["config", "ambientes"] });
      void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    },
  });

  if (isLoading) return <p className="text-sm text-stone-400 py-4 text-center">Carregando…</p>;

  return (
    <div>
      <div className="divide-y divide-stone-100">
        {ambientes.map((a) => (
          <TagRow key={a.slug} tag={a} onDelete={(slug) => remove.mutate(slug)} />
        ))}
      </div>
      <AddTagForm
        onAdd={(name, slug) => create.mutate({ name, slug })}
        isPending={create.isPending}
      />
    </div>
  );
}

// ─── Lotes tab ────────────────────────────────────────────────────────────────

function LotesTab() {
  const { data: lotes = [], isLoading } = useLotes();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (t: TagCreate) => configApi.createLote(t),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["config", "lotes"] }),
  });

  const remove = useMutation({
    mutationFn: (slug: string) => configApi.deleteLote(slug),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["config", "lotes"] });
      void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    },
  });

  if (isLoading) return <p className="text-sm text-stone-400 py-4 text-center">Carregando…</p>;

  return (
    <div>
      <p className="text-xs text-stone-400 mb-3">
        Lotes de produção dentro de cada ambiente (ex: Lote 01 shiitake, Talhão norte…)
      </p>
      <div className="divide-y divide-stone-100">
        {lotes.map((l) => (
          <TagRow key={l.slug} tag={l} onDelete={(slug) => remove.mutate(slug)} />
        ))}
        {lotes.length === 0 && (
          <p className="text-xs text-stone-400 py-2 text-center">Nenhum lote cadastrado ainda.</p>
        )}
      </div>
      <AddTagForm
        onAdd={(name, slug) => create.mutate({ name, slug })}
        isPending={create.isPending}
      />
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

const TAB_LABELS: { id: Tab; label: string }[] = [
  { id: "people",    label: "Responsáveis" },
  { id: "types",     label: "Tipos" },
  { id: "cultures",  label: "Culturas" },
  { id: "ambientes", label: "Ambientes" },
  { id: "lotes",     label: "Lotes" },
];

export default function AgendaSettingsDrawer({ onClose }: Props) {
  const [tab, setTab] = useState<Tab>("people");

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-80 flex-col bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
          <h2 className="text-sm font-bold text-stone-800">Configurações da Agenda</h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-700 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Tabs — two rows to fit 5 tabs */}
        <div className="border-b border-stone-200">
          <div className="flex">
            {TAB_LABELS.slice(0, 3).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  "flex-1 py-2 text-[11px] font-medium transition-colors",
                  tab === id
                    ? "border-b-2 border-green-600 text-green-700"
                    : "text-stone-500 hover:text-stone-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex border-t border-stone-100">
            {TAB_LABELS.slice(3).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={clsx(
                  "flex-1 py-2 text-[11px] font-medium transition-colors",
                  tab === id
                    ? "border-b-2 border-green-600 text-green-700"
                    : "text-stone-500 hover:text-stone-700"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === "people"    && <PeopleTab />}
          {tab === "types"     && <TypesTab />}
          {tab === "cultures"  && <CulturesTab />}
          {tab === "ambientes" && <AmbientesTab />}
          {tab === "lotes"     && <LotesTab />}
        </div>
      </div>
    </>
  );
}
