import clsx from "clsx";
import type { Person, Tag } from "../api/config.ts";

export interface ActiveFilters {
  executors:     string[];
  cultures:      string[];
  activityTypes: string[];
  ambientes:     string[];
  lotes:         string[];
}

export function emptyFilters(): ActiveFilters {
  return { executors: [], cultures: [], activityTypes: [], ambientes: [], lotes: [] };
}

export function hasActiveFilters(f: ActiveFilters): boolean {
  return Object.values(f).some((a) => a.length > 0);
}

export function activeFilterCount(f: ActiveFilters): number {
  return Object.values(f).reduce((s, a) => s + a.length, 0);
}

interface Props {
  filters:       ActiveFilters;
  onChange:      (f: ActiveFilters) => void;
  people:        Person[];
  cultures:      Tag[];
  activityTypes: Tag[];
  ambientes:     Tag[];
  lotes:         Tag[];
}

function toggle(arr: string[], val: string): string[] {
  return arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
}

function FilterChip({
  name, color, active, onClick,
}: {
  slug: string; name: string; color?: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs transition-colors select-none shrink-0",
        active
          ? "border-stone-700 bg-stone-800 text-white"
          : "border-stone-200 bg-white text-stone-600 hover:border-stone-400 hover:text-stone-800"
      )}
    >
      {color && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: active ? "#fff" : color }}
        />
      )}
      {name}
    </button>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide shrink-0 select-none">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function KanbanFilterBar({
  filters, onChange, people, cultures, activityTypes, ambientes, lotes,
}: Props) {
  const sections = [
    people.length > 0 && (
      <Section key="exec" label="Responsável">
        {people.map((p) => (
          <FilterChip
            key={p.slug} slug={p.slug} name={p.name} color={p.color}
            active={filters.executors.includes(p.slug)}
            onClick={() => onChange({ ...filters, executors: toggle(filters.executors, p.slug) })}
          />
        ))}
      </Section>
    ),
    activityTypes.length > 0 && (
      <Section key="type" label="Tipo">
        {activityTypes.map((t) => (
          <FilterChip
            key={t.slug} slug={t.slug} name={t.name} color={t.color}
            active={filters.activityTypes.includes(t.slug)}
            onClick={() => onChange({ ...filters, activityTypes: toggle(filters.activityTypes, t.slug) })}
          />
        ))}
      </Section>
    ),
    cultures.length > 0 && (
      <Section key="cult" label="Cultura">
        {cultures.map((c) => (
          <FilterChip
            key={c.slug} slug={c.slug} name={c.name} color={c.color}
            active={filters.cultures.includes(c.slug)}
            onClick={() => onChange({ ...filters, cultures: toggle(filters.cultures, c.slug) })}
          />
        ))}
      </Section>
    ),
    ambientes.length > 0 && (
      <Section key="amb" label="Ambiente">
        {ambientes.map((a) => (
          <FilterChip
            key={a.slug} slug={a.slug} name={a.name} color={a.color}
            active={filters.ambientes.includes(a.slug)}
            onClick={() => onChange({ ...filters, ambientes: toggle(filters.ambientes, a.slug) })}
          />
        ))}
      </Section>
    ),
    lotes.length > 0 && (
      <Section key="lot" label="Lote">
        {lotes.map((l) => (
          <FilterChip
            key={l.slug} slug={l.slug} name={l.name} color={l.color}
            active={filters.lotes.includes(l.slug)}
            onClick={() => onChange({ ...filters, lotes: toggle(filters.lotes, l.slug) })}
          />
        ))}
      </Section>
    ),
  ].filter(Boolean);

  if (sections.length === 0) return null;

  const isActive = hasActiveFilters(filters);

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 border-b border-stone-100 overflow-x-auto scrollbar-none bg-stone-50/60">
      {sections.map((s, i) => (
        <span key={i} className="contents">
          {i > 0 && <span className="w-px h-4 bg-stone-200 shrink-0" />}
          {s}
        </span>
      ))}
      {isActive && (
        <button
          onClick={() => onChange(emptyFilters())}
          className="ml-auto shrink-0 text-[10px] text-stone-400 hover:text-red-600 transition-colors px-1.5 py-0.5 rounded hover:bg-red-50"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
