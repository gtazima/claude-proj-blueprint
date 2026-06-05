import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { settingsApi } from "../api/settings";
import {
  configApi,
  type Person,
  type Tag,
  type PersonCreate,
  type TagCreate,
  type TagUpdate,
  type PersonUpdate,
} from "../api/config.ts";
import { usePeople, useActivityTypes, useCultures, useAmbientes, useLotes } from "../hooks/useConfig.ts";

// ─── Constants ────────────────────────────────────────────────────────────────

type Section = "google" | "people" | "types" | "cultures" | "ambientes" | "lotes";

const SYSTEM_SLUGS = ["produtor", "pai", "funcionario", "nao_atribuido"];

const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7",
  "#ec4899", "#f43f5e", "#78716c", "#334155",
];

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

// ─── Color picker ─────────────────────────────────────────────────────────────

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1 p-2 bg-white border border-stone-200 rounded-lg shadow-md">
      {PALETTE.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={clsx(
            "w-5 h-5 rounded-full border-2 transition-transform hover:scale-110",
            value === c ? "border-stone-700 scale-110" : "border-transparent"
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function ColorDot({ color, onClick }: { color: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "w-4 h-4 rounded-full border border-white shadow-sm shrink-0 transition-transform",
        onClick && "hover:scale-125 cursor-pointer"
      )}
      style={{ backgroundColor: color }}
    />
  );
}

// ─── Tag item row ─────────────────────────────────────────────────────────────

function TagItemRow({
  tag,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  tag: Tag;
  onUpdate: (slug: string, u: TagUpdate) => void;
  onDelete: (slug: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName]       = useState(tag.name);
  const [color, setColor]     = useState(tag.color);
  const [showPicker, setShowPicker] = useState(false);

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onUpdate(tag.slug, { name: trimmed, color });
    setEditing(false);
    setShowPicker(false);
  };

  const cancel = () => {
    setName(tag.name); setColor(tag.color);
    setEditing(false); setShowPicker(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="relative">
          <ColorDot color={color} onClick={() => setShowPicker((v) => !v)} />
          {showPicker && (
            <div className="absolute left-0 top-6 z-10">
              <ColorPicker value={color} onChange={(c) => { setColor(c); setShowPicker(false); }} />
            </div>
          )}
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button onClick={save} disabled={!name.trim() || isUpdating}
          className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors">
          Salvar
        </button>
        <button onClick={cancel}
          className="text-xs px-2 py-1 rounded border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-2 group">
      <ColorDot color={tag.color} />
      <span className="flex-1 text-sm text-stone-800">{tag.name}</span>
      <span className="text-[11px] text-stone-400 font-mono">{tag.slug}</span>
      <button
        onClick={() => setEditing(true)}
        className="invisible group-hover:visible text-stone-300 hover:text-stone-600 transition-colors p-0.5 rounded"
        title="Editar"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        onClick={() => onDelete(tag.slug)}
        disabled={isDeleting}
        className="invisible group-hover:visible text-stone-300 hover:text-red-500 transition-colors p-0.5 rounded disabled:opacity-40"
        title="Remover"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

// ─── Person item row ──────────────────────────────────────────────────────────

function PersonItemRow({
  person,
  onUpdate,
  onDelete,
  isUpdating,
  isDeleting,
}: {
  person: Person;
  onUpdate: (slug: string, u: PersonUpdate) => void;
  onDelete: (slug: string) => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [editing, setEditing]   = useState(false);
  const [name, setName]         = useState(person.name);
  const [color, setColor]       = useState(person.color);
  const [showPicker, setShowPicker] = useState(false);
  const isSystem = SYSTEM_SLUGS.includes(person.slug);

  const save = () => {
    onUpdate(person.slug, { name: name.trim(), color });
    setEditing(false); setShowPicker(false);
  };

  const cancel = () => {
    setName(person.name); setColor(person.color);
    setEditing(false); setShowPicker(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2">
        <div className="relative">
          <ColorDot color={color} onClick={() => setShowPicker((v) => !v)} />
          {showPicker && (
            <div className="absolute left-0 top-6 z-10">
              <ColorPicker value={color} onChange={(c) => { setColor(c); setShowPicker(false); }} />
            </div>
          )}
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="flex-1 rounded border border-stone-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button onClick={save} disabled={!name.trim() || isUpdating}
          className="text-xs px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 transition-colors">
          Salvar
        </button>
        <button onClick={cancel}
          className="text-xs px-2 py-1 rounded border border-stone-200 text-stone-500 hover:bg-stone-100 transition-colors">
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 py-2 group">
      <ColorDot color={person.color} />
      <span className="flex-1 text-sm text-stone-800">{person.name}</span>
      <span className="text-[11px] text-stone-400 font-mono">{person.slug}</span>
      {person.supabase_user_id && (
        <span className="text-[10px] text-blue-500 border border-blue-200 rounded px-1 py-0.5 shrink-0">login</span>
      )}
      {isSystem ? (
        <span className="text-[10px] text-stone-300 px-1 shrink-0">sistema</span>
      ) : (
        <>
          <button
            onClick={() => setEditing(true)}
            className="invisible group-hover:visible text-stone-300 hover:text-stone-600 transition-colors p-0.5 rounded"
            title="Editar"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(person.slug)}
            disabled={isDeleting}
            className="invisible group-hover:visible text-stone-300 hover:text-red-500 transition-colors p-0.5 rounded disabled:opacity-40"
            title="Remover"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

// ─── Add tag form ─────────────────────────────────────────────────────────────

function AddTagForm({ onAdd, isPending }: { onAdd: (t: TagCreate) => void; isPending: boolean }) {
  const [name, setName]   = useState("");
  const [color, setColor] = useState(PALETTE[4]);
  const [showPicker, setShowPicker] = useState(false);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ name: trimmed, slug: slugify(trimmed), color });
    setName("");
  };

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100">
      <div className="relative">
        <ColorDot color={color} onClick={() => setShowPicker((v) => !v)} />
        {showPicker && (
          <div className="absolute left-0 bottom-6 z-10">
            <ColorPicker value={color} onChange={(c) => { setColor(c); setShowPicker(false); }} />
          </div>
        )}
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="Nome…"
        className="flex-1 rounded border border-stone-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <span className="text-[11px] text-stone-400 font-mono w-24 truncate">{slugify(name) || "slug"}</span>
      <button
        onClick={submit}
        disabled={!name.trim() || isPending}
        className="rounded bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors shrink-0"
      >
        Adicionar
      </button>
    </div>
  );
}

// ─── Add person form ──────────────────────────────────────────────────────────

function AddPersonForm({ onAdd, isPending }: { onAdd: (p: PersonCreate) => void; isPending: boolean }) {
  const [name, setName]   = useState("");
  const [color, setColor] = useState(PALETTE[8]);
  const [showPicker, setShowPicker] = useState(false);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd({ name: trimmed, slug: slugify(trimmed), color });
    setName("");
  };

  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-stone-100">
      <div className="relative">
        <ColorDot color={color} onClick={() => setShowPicker((v) => !v)} />
        {showPicker && (
          <div className="absolute left-0 bottom-6 z-10">
            <ColorPicker value={color} onChange={(c) => { setColor(c); setShowPicker(false); }} />
          </div>
        )}
      </div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="Nome do responsável…"
        className="flex-1 rounded border border-stone-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <button
        onClick={submit}
        disabled={!name.trim() || isPending}
        className="rounded bg-green-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-green-700 disabled:opacity-40 transition-colors shrink-0"
      >
        Adicionar
      </button>
    </div>
  );
}

// ─── Section panels ───────────────────────────────────────────────────────────

function SectionCard({ title, description, children }: {
  title: string; description?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-5">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
        {description && <p className="text-xs text-stone-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function GoogleSection() {
  const qc = useQueryClient();

  const { data: googleStatus, isLoading } = useQuery({
    queryKey: ["settings", "google"],
    queryFn: settingsApi.googleStatus,
  });

  const connect = useMutation({
    mutationFn: async () => { const { url } = await settingsApi.googleAuthUrl(); window.location.href = url; },
  });

  const disconnect = useMutation({
    mutationFn: settingsApi.googleDisconnect,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["settings", "google"] }),
  });

  return (
    <SectionCard
      title="Conta Google da propriedade"
      description="Sincroniza tarefas com Google Tasks."
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-50 shrink-0">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>
        {isLoading ? (
          <div className="h-5 w-40 bg-stone-100 rounded animate-pulse" />
        ) : googleStatus?.connected ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="inline-flex h-2 w-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-sm text-stone-700 truncate">{googleStatus.email}</span>
            {googleStatus.sync_enabled && (
              <span className="text-[11px] text-stone-400 shrink-0">(sync ativo)</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-stone-400">Não conectado</span>
        )}
      </div>

      {!isLoading && (
        googleStatus?.connected ? (
          <button
            onClick={() => disconnect.mutate()}
            disabled={disconnect.isPending}
            className="text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
          >
            Desconectar
          </button>
        ) : (
          <button
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
            className="flex items-center gap-2 text-xs font-medium bg-stone-900 text-white px-3 py-2 rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
          >
            {connect.isPending ? "Redirecionando..." : "Conectar conta Google"}
          </button>
        )
      )}
    </SectionCard>
  );
}

function PeopleSection() {
  const { data: people = [], isLoading } = usePeople();
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: (p: PersonCreate) => configApi.createPerson(p),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["config", "people"] }),
  });
  const update = useMutation({
    mutationFn: ({ slug, u }: { slug: string; u: PersonUpdate }) => configApi.updatePerson(slug, u),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["config", "people"] }),
  });
  const remove = useMutation({
    mutationFn: (slug: string) => configApi.deletePerson(slug),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["config", "people"] });
      void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    },
  });

  return (
    <SectionCard title="Responsáveis" description="Pessoas que executam tarefas na propriedade.">
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-8 bg-stone-100 rounded animate-pulse" />)}</div>
      ) : (
        <>
          <div className="divide-y divide-stone-100">
            {people.map((p) => (
              <PersonItemRow
                key={p.slug} person={p}
                onUpdate={(slug, u) => update.mutate({ slug, u })}
                onDelete={(slug) => remove.mutate(slug)}
                isUpdating={update.isPending}
                isDeleting={remove.isPending}
              />
            ))}
            {people.length === 0 && <p className="text-sm text-stone-400 py-3">Nenhum responsável cadastrado.</p>}
          </div>
          <AddPersonForm onAdd={(p) => create.mutate(p)} isPending={create.isPending} />
        </>
      )}
    </SectionCard>
  );
}

function TagEntitySection({
  title, description,
  data, isLoading,
  onCreate, onUpdate, onDelete,
  isCreating, isUpdating, isDeleting,
}: {
  title: string; description?: string;
  data: Tag[]; isLoading: boolean;
  onCreate: (t: TagCreate) => void;
  onUpdate: (slug: string, u: TagUpdate) => void;
  onDelete: (slug: string) => void;
  isCreating: boolean; isUpdating: boolean; isDeleting: boolean;
}) {
  return (
    <SectionCard title={title} description={description}>
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-8 bg-stone-100 rounded animate-pulse" />)}</div>
      ) : (
        <>
          <div className="divide-y divide-stone-100">
            {data.map((t) => (
              <TagItemRow
                key={t.slug} tag={t}
                onUpdate={onUpdate}
                onDelete={onDelete}
                isUpdating={isUpdating}
                isDeleting={isDeleting}
              />
            ))}
            {data.length === 0 && <p className="text-sm text-stone-400 py-3">Nenhum item cadastrado.</p>}
          </div>
          <AddTagForm onAdd={onCreate} isPending={isCreating} />
        </>
      )}
    </SectionCard>
  );
}

function TypesSection() {
  const { data = [], isLoading } = useActivityTypes();
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["config", "activity-types"] });
    void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
  };
  const create = useMutation({ mutationFn: (t: TagCreate) => configApi.createActivityType(t), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ slug, u }: { slug: string; u: TagUpdate }) => configApi.updateActivityType(slug, u), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (slug: string) => configApi.deleteActivityType(slug), onSuccess: invalidate });
  return (
    <TagEntitySection
      title="Tipos de atividade" description="Categorias de trabalho (ex: Plantio, Colheita, Irrigação)."
      data={data} isLoading={isLoading}
      onCreate={(t) => create.mutate(t)}
      onUpdate={(slug, u) => update.mutate({ slug, u })}
      onDelete={(slug) => remove.mutate(slug)}
      isCreating={create.isPending} isUpdating={update.isPending} isDeleting={remove.isPending}
    />
  );
}

function CulturesSection() {
  const { data = [], isLoading } = useCultures();
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["config", "cultures"] });
    void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
  };
  const create = useMutation({ mutationFn: (t: TagCreate) => configApi.createCulture(t), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ slug, u }: { slug: string; u: TagUpdate }) => configApi.updateCulture(slug, u), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (slug: string) => configApi.deleteCulture(slug), onSuccess: invalidate });
  return (
    <TagEntitySection
      title="Culturas" description="Cultivos da propriedade (ex: Shiitake, Café, Cúrcuma)."
      data={data} isLoading={isLoading}
      onCreate={(t) => create.mutate(t)}
      onUpdate={(slug, u) => update.mutate({ slug, u })}
      onDelete={(slug) => remove.mutate(slug)}
      isCreating={create.isPending} isUpdating={update.isPending} isDeleting={remove.isPending}
    />
  );
}

function AmbientesSection() {
  const { data = [], isLoading } = useAmbientes();
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["config", "ambientes"] });
  const create = useMutation({ mutationFn: (t: TagCreate) => configApi.createAmbiente(t), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ slug, u }: { slug: string; u: TagUpdate }) => configApi.updateAmbiente(slug, u), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (slug: string) => configApi.deleteAmbiente(slug), onSuccess: invalidate });
  return (
    <TagEntitySection
      title="Ambientes" description="Áreas físicas da propriedade (ex: Galpão shiitake, Mata, Horta)."
      data={data} isLoading={isLoading}
      onCreate={(t) => create.mutate(t)}
      onUpdate={(slug, u) => update.mutate({ slug, u })}
      onDelete={(slug) => remove.mutate(slug)}
      isCreating={create.isPending} isUpdating={update.isPending} isDeleting={remove.isPending}
    />
  );
}

function LotesSection() {
  const { data = [], isLoading } = useLotes();
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["config", "lotes"] });
  const create = useMutation({ mutationFn: (t: TagCreate) => configApi.createLote(t), onSuccess: invalidate });
  const update = useMutation({ mutationFn: ({ slug, u }: { slug: string; u: TagUpdate }) => configApi.updateLote(slug, u), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (slug: string) => configApi.deleteLote(slug), onSuccess: invalidate });
  return (
    <TagEntitySection
      title="Lotes" description="Subdivisões dos ambientes (ex: Lote 01 — toras, Talhão norte)."
      data={data} isLoading={isLoading}
      onCreate={(t) => create.mutate(t)}
      onUpdate={(slug, u) => update.mutate({ slug, u })}
      onDelete={(slug) => remove.mutate(slug)}
      isCreating={create.isPending} isUpdating={update.isPending} isDeleting={remove.isPending}
    />
  );
}

// ─── Nav ──────────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  {
    id: "google", label: "Google",
    icon: <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
  },
  {
    id: "people", label: "Responsáveis",
    icon: <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6" strokeLinecap="round"/></svg>,
  },
  {
    id: "types", label: "Tipos de atividade",
    icon: <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>,
  },
  {
    id: "cultures", label: "Culturas",
    icon: <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 14V8M8 8C8 4 3 3 3 3s1 5 5 5zM8 8c0-4 5-5 5-5s-1 5-5 5" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  },
  {
    id: "ambientes", label: "Ambientes",
    icon: <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 13L6 7l3 4 2-3 3 5" strokeLinecap="round" strokeLinejoin="round"/><path d="M2 13h12" strokeLinecap="round"/></svg>,
  },
  {
    id: "lotes", label: "Lotes",
    icon: <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M2 8h12M8 2v12" strokeLinecap="round"/></svg>,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("google");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-stone-700 text-white shrink-0">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="8" cy="8" r="2.5" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l-1.41 1.41M4.95 11.05l-1.41 1.41" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-sm font-bold text-stone-900">Configurações</h1>
          </div>
        </div>
      </header>

      {/* Body — nav + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left nav */}
        <nav className="w-48 shrink-0 border-r border-stone-200 bg-stone-50 overflow-y-auto py-3">
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={clsx(
                "w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-left transition-colors",
                section === id
                  ? "bg-white text-stone-900 border-r-2 border-green-600"
                  : "text-stone-500 hover:text-stone-800 hover:bg-white/60"
              )}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        {/* Right content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-xl space-y-4">
            {section === "google"    && <GoogleSection />}
            {section === "people"    && <PeopleSection />}
            {section === "types"     && <TypesSection />}
            {section === "cultures"  && <CulturesSection />}
            {section === "ambientes" && <AmbientesSection />}
            {section === "lotes"     && <LotesSection />}
          </div>
        </main>
      </div>
    </div>
  );
}
