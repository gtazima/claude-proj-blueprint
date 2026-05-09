import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { tasksApi, type TaskWithPriority, type Task } from "../api/tasks.ts";
import {
  sortedTypeTags, sortedCultureTags,
  incrementTagFrequency, buildTitle,
  TYPE_TAGS, CULTURE_TAGS,
} from "../constants/activityTags.ts";
import KanbanView, { type KanbanMode, type DateDelta } from "../components/KanbanView.tsx";
import CompletedTaskRow from "../components/CompletedTaskRow.tsx";
import CreateTaskModal from "../components/CreateTaskModal.tsx";

const LAST_EXECUTOR_KEY = "last_executor";
const MODE_KEY          = "kanban_mode";
const DELTA_KEY         = "kanban_delta";

function readLastExecutor(): "produtor" | "pai" | "funcionario" | "nao_atribuido" {
  return (localStorage.getItem(LAST_EXECUTOR_KEY) as "produtor" | "pai" | "funcionario" | "nao_atribuido" | null) ?? "produtor";
}
function readMode(): KanbanMode {
  return (localStorage.getItem(MODE_KEY) as KanbanMode | null) ?? "type";
}
const KANBAN_DELTAS = [1, 2, 3] as const;
function readDelta(): DateDelta {
  const v = Number(localStorage.getItem(DELTA_KEY)) as DateDelta;
  return (KANBAN_DELTAS as readonly number[]).includes(v) ? v : 3;
}

function todayLabel(): string {
  return new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

const DATE_DELTAS: { value: DateDelta; label: string }[] = [
  { value: 1, label: "Hoje"   },
  { value: 2, label: "2 dias" },
  { value: 3, label: "3 dias" },
];

function completedAsActive(tasks: Task[]): TaskWithPriority[] {
  return tasks.map((t) => ({ ...t, priority_score: 0, can_undo_completion: !t.completion_locked }));
}

export default function TodayPage() {
  const [mode, setMode]             = useState<KanbanMode>(readMode);
  const [delta, setDelta]           = useState<DateDelta>(readDelta);
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<string | undefined>(undefined);
  const [showCompleted, setShowCompleted] = useState(false);
  const qc = useQueryClient();

  const changeMode  = (m: KanbanMode) => { setMode(m);  localStorage.setItem(MODE_KEY, m); };
  const changeDelta = (d: DateDelta)  => { setDelta(d); localStorage.setItem(DELTA_KEY, String(d)); };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    void qc.invalidateQueries({ queryKey: ["tasks", "completed-today"] });
  };

  const { data: active = [], isLoading } = useQuery<TaskWithPriority[]>({
    queryKey: ["tasks", "today"],
    queryFn:  tasksApi.listToday,
    refetchInterval: 60_000,
  });

  const { data: completed = [] } = useQuery<Task[]>({
    queryKey: ["tasks", "completed-today"],
    queryFn:  tasksApi.listCompletedToday,
    refetchInterval: 60_000,
  });

  const kanbanTasks = useMemo<TaskWithPriority[]>(() =>
    showCompleted ? [...active, ...completedAsActive(completed)] : active,
    [active, completed, showCompleted]
  );

  const quickCreate = useMutation({
    mutationFn: (tag: string) => {
      const isType    = (TYPE_TAGS as readonly string[]).includes(tag);
      const isCulture = (CULTURE_TAGS as readonly string[]).includes(tag);
      return tasksApi.create({
        title: buildTitle("", isType ? tag : null, isCulture ? tag : null) || tag,
        executor: readLastExecutor(),
        financial_score: 0,
      });
    },
    onSuccess: (_data, tag) => { incrementTagFrequency(tag); invalidate(); },
  });

  // Keyboard shortcut N → new task
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === "n" || e.key === "N") { e.preventDefault(); openCreate(); }
      if (e.key === "Escape") setShowCreate(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const openCreate = (type?: string) => { setCreateType(type); setShowCreate(true); };

  const typeTags    = sortedTypeTags();
  const cultureTags = sortedCultureTags();

  const typeChipClass = clsx(
    "shrink-0 cursor-grab active:cursor-grabbing rounded border px-2 py-0.5 text-xs select-none transition-colors",
    mode === "culture"
      ? "border-stone-200 bg-stone-50 text-stone-400 hover:border-stone-300"
      : "border-stone-200 bg-stone-50 text-stone-600 hover:border-green-400 hover:bg-green-50 hover:text-green-800"
  );
  const cultureChipClass = clsx(
    "shrink-0 cursor-grab active:cursor-grabbing rounded border px-2 py-0.5 text-xs select-none transition-colors",
    mode === "type"
      ? "border-stone-200 bg-stone-50 text-stone-400 hover:border-stone-300"
      : "border-stone-200 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100"
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Toolbar ── */}
      <header className="bg-white border-b border-stone-200 shrink-0">
        {/* Top row — module identity + stats + action */}
        <div className="flex items-center gap-3 px-4 py-2 border-b border-stone-100">
          {/* Module badge */}
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-green-600 text-white shrink-0">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                <rect x="1" y="2" width="4" height="12" rx="1" />
                <rect x="6" y="2" width="4" height="8"  rx="1" />
                <rect x="11" y="2" width="4" height="5" rx="1" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-stone-900 leading-tight">Tarefas</h1>
              <p className="text-xs text-stone-400 capitalize leading-tight">{todayLabel()}</p>
            </div>
          </div>

          {/* Counts */}
          <div className="flex items-center gap-1.5 text-xs text-stone-500 shrink-0">
            <span className="font-semibold text-stone-800">{active.length}</span> pend.
            <span className="text-stone-300 mx-0.5">·</span>
            <span className="font-semibold text-green-600">{completed.length}</span> concl.
          </div>

          {/* Nova button */}
          <button onClick={() => openCreate()} title="Nova tarefa (N)"
            className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors shrink-0">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
            Nova
            <kbd className="ml-1 opacity-60 font-mono text-[10px] bg-green-700 rounded px-1">N</kbd>
          </button>
        </div>

        {/* Tag bar */}
        <div className="flex items-center gap-1.5 px-4 py-1 border-b border-stone-100 overflow-x-auto scrollbar-none">
          <span className="text-[11px] text-stone-400 shrink-0 font-medium">Tipo:</span>
          {typeTags.map((tag) => (
            <button key={tag} draggable
              onDragStart={(e) => { e.dataTransfer.setData("tag", tag); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => { incrementTagFrequency(tag); quickCreate.mutate(tag); }}
              onContextMenu={(e) => { e.preventDefault(); openCreate(tag); }}
              disabled={quickCreate.isPending}
              className={typeChipClass}>{tag}
            </button>
          ))}
          <span className="w-px h-4 bg-stone-200 mx-1 shrink-0" />
          <span className="text-[11px] text-stone-400 shrink-0 font-medium">Cultura:</span>
          {cultureTags.map((tag) => (
            <button key={tag} draggable
              onDragStart={(e) => { e.dataTransfer.setData("tag", tag); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => { incrementTagFrequency(tag); quickCreate.mutate(tag); }}
              onContextMenu={(e) => { e.preventDefault(); openCreate(tag); }}
              disabled={quickCreate.isPending}
              className={cultureChipClass}>{tag}
            </button>
          ))}
        </div>

        {/* Mode selector + completed toggle */}
        <div className="flex items-center gap-1 px-4 py-1.5">
          {(["type", "culture", "date"] as KanbanMode[]).map((m) => (
            <button key={m} onClick={() => changeMode(m)}
              className={clsx(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                mode === m ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100"
              )}>
              {m === "type" ? "Por tipo" : m === "culture" ? "Por cultura" : "Por data"}
            </button>
          ))}

          {mode === "date" && (
            <>
              <span className="w-px h-4 bg-stone-200 mx-1.5" />
              {DATE_DELTAS.map((d) => (
                <button key={d.value} onClick={() => changeDelta(d.value)}
                  className={clsx(
                    "rounded px-2 py-0.5 text-xs transition-colors",
                    delta === d.value ? "bg-stone-700 text-white" : "text-stone-500 hover:bg-stone-100"
                  )}>
                  {d.label}
                </button>
              ))}
            </>
          )}

          {/* Completed toggle — right-aligned */}
          <div className="ml-auto flex items-center">
            <button onClick={() => setShowCompleted((v) => !v)}
              title={showCompleted ? "Ocultar concluídas no kanban" : "Exibir concluídas no kanban"}
              className={clsx(
                "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                showCompleted
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "text-stone-400 hover:bg-stone-100 border border-transparent"
              )}>
              <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Concluídas
            </button>
          </div>
        </div>
      </header>

      {/* ── Kanban ── */}
      <div className="flex-1 overflow-hidden p-3 flex flex-col gap-3 min-h-0">
        {isLoading ? (
          <div className="flex gap-3 h-full">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-60 shrink-0 rounded-lg border border-stone-200 bg-stone-50 animate-pulse" />
            ))}
          </div>
        ) : (
          <KanbanView tasks={kanbanTasks} mode={mode} dateDelta={delta} onAddTask={openCreate} />
        )}

        {/* Completed strip — hidden when already shown in kanban */}
        {completed.length > 0 && !showCompleted && (
          <details className="shrink-0 bg-white rounded-lg border border-stone-200">
            <summary className="flex items-center gap-2 px-3 py-2 text-xs text-stone-500 cursor-pointer hover:bg-stone-50 rounded-lg select-none list-none">
              <svg className="h-3.5 w-3.5 text-green-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 8l4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-medium text-green-700">{completed.length}</span>
              concluída{completed.length !== 1 ? "s" : ""} hoje — clique para expandir
            </summary>
            <div className="flex flex-wrap gap-2 px-3 pb-3 pt-1">
              {completed.map((task) => <CompletedTaskRow key={task.id} task={task} />)}
            </div>
          </details>
        )}
      </div>

      {showCreate && (
        <CreateTaskModal
          initialType={createType}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); invalidate(); }}
        />
      )}
    </div>
  );
}
