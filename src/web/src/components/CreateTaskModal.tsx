import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { tasksApi, type Task, type TaskWithPriority } from "../api/tasks.ts";
import { useUndo } from "../contexts/UndoContext.tsx";
import {
  sortedByFrequency, incrementTagFrequency, buildTitle, parseTitle,
} from "../constants/activityTags.ts";
import { usePeople, useActivityTypes, useCultures } from "../hooks/useConfig.ts";

interface Props {
  onClose:       () => void;
  onSuccess:     (savedId?: string) => void;
  initialType?:  string;
  initialDate?:  string;
  task?:         Task | TaskWithPriority;
  initialTask?:  Task;
}

const LAST_EXECUTOR_KEY = "last_executor";
function readLastExecutor(): string {
  return localStorage.getItem(LAST_EXECUTOR_KEY) ?? "produtor";
}

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CreateTaskModal({ onClose, onSuccess, initialType, initialDate, task, initialTask }: Props) {
  const editSource = task ?? initialTask;
  const isEdit  = !!task;
  const { push: pushUndo } = useUndo();

  const { data: people = [] }        = usePeople();
  const { data: activityTypes = [] } = useActivityTypes();
  const { data: cultures = [] }      = useCultures();

  const typeNames    = activityTypes.map((t) => t.name);
  const cultureNames = cultures.map((c) => c.name);

  const parsed  = editSource ? parseTitle(editSource.title, typeNames, cultureNames) : null;

  const [baseTitle, setBaseTitle]   = useState(parsed?.base ?? "");
  const [description, setDescription] = useState(editSource?.description ?? "");
  const [executor, setExecutor]     = useState<string>(editSource?.executor ?? readLastExecutor());
  const [selType, setSelType]       = useState<string | null>(
    editSource ? (parsed?.type ?? null)
               : (initialType && typeNames.includes(initialType) ? initialType : null)
  );
  const [selCulture, setSelCulture] = useState<string | null>(
    editSource ? (parsed?.culture ?? null)
               : (initialType && cultureNames.includes(initialType) ? initialType : null)
  );
  const [windowEnd, setWindowEnd]   = useState(
    editSource?.scheduled_window_end
      ? toLocalDateKey(new Date(editSource.scheduled_window_end))
      : initialDate ?? ""
  );
  const [depSearch, setDepSearch]   = useState("");
  const [depIds, setDepIds]         = useState<string[]>(editSource?.dependency_ids ?? []);
  const [showDeps, setShowDeps]     = useState(false);

  const typeTags    = sortedByFrequency(typeNames.length > 0 ? typeNames : activityTypes.map((t) => t.name));
  const cultureTags = sortedByFrequency(cultureNames.length > 0 ? cultureNames : cultures.map((c) => c.name));
  const activePeople = people.filter((p) => p.is_active);

  const { data: allTasks = [] } = useQuery({
    queryKey: ["tasks", "today"],
    queryFn:  tasksApi.listToday,
    staleTime: 30_000,
  });

  const depCandidates = allTasks.filter((t) =>
    t.id !== task?.id &&
    !depIds.includes(t.id) &&
    (!depSearch.trim() || t.title.toLowerCase().includes(depSearch.toLowerCase()))
  );
  const selectedDeps = allTasks.filter((t) => depIds.includes(t.id));
  const toggleDep = (id: string) =>
    setDepIds((p) => p.includes(id) ? p.filter((d) => d !== id) : [...p, id]);

  const save = useMutation({
    mutationFn: () => {
      const title = buildTitle(baseTitle.trim(), selType, selCulture) || baseTitle.trim() || task?.title;
      const windowEndISO = windowEnd
        ? new Date(windowEnd + "T23:59:59").toISOString()
        : null;

      if (isEdit && task) {
        return tasksApi.update(task.id, {
          title:                title ?? task.title,
          description:          description.trim() || null,
          executor,
          dependency_ids:       depIds,
          scheduled_window_end: windowEndISO,
        });
      }

      return tasksApi.create({
        title:        title ?? "",
        description:  description.trim() || undefined,
        executor,
        financial_score: 0,
        dependency_ids: depIds,
        ...(windowEndISO ? { scheduled_window_end: windowEndISO } : {}),
      });
    },
    onSuccess: (data) => {
      if (!isEdit) localStorage.setItem(LAST_EXECUTOR_KEY, executor);
      if (selType)    incrementTagFrequency(selType);
      if (selCulture) incrementTagFrequency(selCulture);
      if (isEdit && task) {
        pushUndo({
          type: "update",
          taskId: task.id,
          previous: {
            title: task.title,
            description: task.description,
            executor: task.executor,
            scheduled_window_end: task.scheduled_window_end,
            dependency_ids: task.dependency_ids,
          },
          label: `"${task.title}" editada`,
        });
      }
      onSuccess(data?.id);
    },
  });

  const canSubmit = (baseTitle.trim().length >= 2 || selType !== null || selCulture !== null || isEdit)
    && !save.isPending;

  const titlePreview = buildTitle(baseTitle.trim() || "…", selType, selCulture);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.stopPropagation(); onClose(); }
        if (e.ctrlKey && e.key === "Enter" && canSubmit) { e.preventDefault(); save.mutate(); }
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-stone-800">
              {isEdit ? "Editar tarefa" : "Nova tarefa"}
            </h2>
            {(selType || selCulture) && (
              <span className="text-xs text-stone-400 font-mono truncate max-w-[220px]" title={titlePreview}>
                {titlePreview}
              </span>
            )}
          </div>

          {/* Executor */}
          <div className="flex gap-2 flex-wrap">
            {activePeople.map((p) => {
              const active = executor === p.slug;
              return (
                <button key={p.slug} type="button" onClick={() => setExecutor(p.slug)}
                  className={clsx(
                    "flex-1 min-w-[72px] flex flex-col items-center gap-1 rounded-lg border py-2.5 transition-all text-xs",
                    active ? "border-[color:var(--person-color)] bg-stone-50" : "border-stone-200 hover:border-stone-300"
                  )}
                  style={{ "--person-color": p.color } as React.CSSProperties}
                >
                  <span className={clsx(
                    "h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                  )}
                    style={{ background: active ? p.color : "#D1D5DB" }}
                  >
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className={clsx("font-medium", active ? "text-stone-800" : "text-stone-500")}>
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Type tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                Tipo de atividade
              </label>
              {selType && <button onClick={() => setSelType(null)} className="text-xs text-stone-400 hover:text-stone-600">Limpar</button>}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {typeTags.map((tag) => (
                <button key={tag} type="button"
                  onClick={() => setSelType(selType === tag ? null : tag)}
                  className={clsx(
                    "shrink-0 rounded border px-2.5 py-0.5 text-xs transition-colors",
                    selType === tag
                      ? "border-green-500 bg-green-100 text-green-800 font-medium"
                      : "border-stone-200 bg-stone-50 text-stone-600 hover:border-green-300"
                  )}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Culture tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                Cultura / área
              </label>
              {selCulture && <button onClick={() => setSelCulture(null)} className="text-xs text-stone-400 hover:text-stone-600">Limpar</button>}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {cultureTags.map((tag) => (
                <button key={tag} type="button"
                  onClick={() => setSelCulture(selCulture === tag ? null : tag)}
                  className={clsx(
                    "shrink-0 rounded border px-2.5 py-0.5 text-xs transition-colors",
                    selCulture === tag
                      ? "border-amber-500 bg-amber-100 text-amber-800 font-medium"
                      : "border-stone-200 bg-stone-50 text-stone-600 hover:border-amber-300"
                  )}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Base title */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-1">
              {selType || selCulture ? "Detalhe adicional" : "Título *"}
            </label>
            <input type="text" value={baseTitle}
              onChange={(e) => setBaseTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) save.mutate(); }}
              placeholder={selType || selCulture ? "ex: talhão norte, lote 07, 1ª aplicação…" : "O que precisa ser feito?"}
              autoFocus
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-1">
              Descrição (opcional)
            </label>
            <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto, observações, insumos…" rows={2}
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-1">
              Prazo{windowEnd && (
                <span className="ml-2 normal-case font-normal text-stone-400">
                  {new Date(windowEnd + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
              )}
            </label>
            <input type="date" lang="pt-BR" value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Dependencies */}
          <div>
            <button type="button" onClick={() => setShowDeps(!showDeps)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wide hover:text-stone-600 transition-colors">
              <svg className={clsx("h-3 w-3 transition-transform", showDeps && "rotate-90")}
                viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Vincular tarefas
              {depIds.length > 0 && (
                <span className="ml-1 bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-medium normal-case">
                  {depIds.length}
                </span>
              )}
            </button>

            {showDeps && (
              <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden">
                {selectedDeps.length > 0 && (
                  <div className="flex flex-wrap gap-1 p-2 border-b border-stone-200 bg-blue-50/50">
                    {selectedDeps.map((t) => (
                      <span key={t.id}
                        className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2 py-0.5 text-xs text-blue-700">
                        {t.title}
                        <button onClick={() => toggleDep(t.id)} className="text-blue-400 hover:text-blue-700 ml-0.5">✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="p-2 border-b border-stone-100">
                  <input type="text" value={depSearch} onChange={(e) => setDepSearch(e.target.value)}
                    placeholder="Buscar tarefa…"
                    className="w-full rounded border border-stone-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto">
                  {depCandidates.length === 0
                    ? <p className="text-xs text-stone-400 text-center py-3">Nenhuma tarefa encontrada</p>
                    : depCandidates.map((t) => (
                      <button key={t.id} type="button" onClick={() => toggleDep(t.id)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-50 transition-colors text-left">
                        <span className="h-3.5 w-3.5 rounded border border-stone-300 shrink-0" />
                        <span className="truncate">{t.title}</span>
                      </button>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-stone-200">
          <button onClick={onClose}
            className="flex-1 rounded-md border border-stone-300 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
            Cancelar
          </button>
          <button onClick={() => save.mutate()} disabled={!canSubmit}
            className="flex-1 rounded-md bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {save.isPending ? (isEdit ? "Salvando…" : "Criando…") : (isEdit ? "Salvar" : "Criar")}
          </button>
        </div>
      </div>
    </div>
  );
}
