import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { tasksApi, type TaskWithPriority, type Task } from "../api/tasks.ts";
import { useUndo } from "../contexts/UndoContext.tsx";
import {
  sortedByFrequency, incrementTagFrequency, buildTitle,
} from "../constants/activityTags.ts";
import { useActivityTypes, useCultures } from "../hooks/useConfig.ts";
import KanbanView, { type KanbanMode, type DateDelta } from "../components/KanbanView.tsx";
import CompletedTaskRow from "../components/CompletedTaskRow.tsx";
import CreateTaskModal from "../components/CreateTaskModal.tsx";
import ReviewCard from "../components/ReviewCard.tsx";
import AgendaSettingsDrawer from "../components/AgendaSettingsDrawer.tsx";

const LAST_EXECUTOR_KEY = "last_executor";
const MODE_KEY          = "kanban_mode";
const DELTA_KEY         = "kanban_delta";

function readLastExecutor(): string {
  return localStorage.getItem(LAST_EXECUTOR_KEY) ?? "produtor";
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
  return tasks.map((t) => ({ ...t, priority_score: 0 }));
}

export default function TodayPage() {
  const [mode, setMode]             = useState<KanbanMode>(readMode);
  const [delta, setDelta]           = useState<DateDelta>(readDelta);
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<string | undefined>(undefined);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const qc = useQueryClient();
  const { undo, canUndo } = useUndo();

  const { data: activityTypes = [] } = useActivityTypes();
  const { data: cultures = [] }      = useCultures();
  const typeNames    = activityTypes.map((t) => t.name);
  const cultureNames = cultures.map((c) => c.name);
  const typeColorMap    = Object.fromEntries(activityTypes.map((t) => [t.name, t.color]));
  const cultureColorMap = Object.fromEntries(cultures.map((c) => [c.name, c.color]));

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

  const { data: pendingReview = [] } = useQuery<Task[]>({
    queryKey: ["tasks", "pending-review"],
    queryFn:  tasksApi.listPendingReview,
    refetchInterval: 60_000,
  });

  const confirmReview = useMutation({
    mutationFn: (id: string) => tasksApi.confirmReview(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks", "pending-review"] });
      void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    },
  });

  const discardReview = useMutation({
    mutationFn: (id: string) => tasksApi.discardReview(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tasks", "pending-review"] }),
  });

  const [reviewEditTask, setReviewEditTask] = useState<Task | undefined>(undefined);

  const kanbanTasks = useMemo<TaskWithPriority[]>(() =>
    showCompleted ? [...active, ...completedAsActive(completed)] : active,
    [active, completed, showCompleted]
  );

  const quickCreate = useMutation({
    mutationFn: (tag: string) => {
      const isType    = typeNames.length > 0
        ? typeNames.some((t) => t.toLowerCase() === tag.toLowerCase())
        : true;
      const isCulture = cultureNames.length > 0
        ? cultureNames.some((c) => c.toLowerCase() === tag.toLowerCase())
        : false;
      return tasksApi.create({
        title: buildTitle("", isType ? tag : null, isCulture ? tag : null) || tag,
        executor: readLastExecutor(),
        financial_score: 0,
      });
    },
    onSuccess: (_data, tag) => { incrementTagFrequency(tag); invalidate(); },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName);
      if (e.ctrlKey && e.key === "z") { e.preventDefault(); if (canUndo) undo(); return; }
      if (e.ctrlKey && (e.key === "n" || e.key === "N")) { e.preventDefault(); openCreate(); return; }
      if (e.key === "Escape") { setShowCreate(false); return; }
      if (!inInput && (e.key === "n" || e.key === "N")) { e.preventDefault(); openCreate(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [undo, canUndo]);

  const openCreate = (type?: string) => { setCreateType(type); setShowCreate(true); };

  const typeTags    = sortedByFrequency(typeNames.length > 0 ? typeNames : []);
  const cultureTags = sortedByFrequency(cultureNames.length > 0 ? cultureNames : []);

  const chipClass = "shrink-0 inline-flex items-center gap-1 cursor-grab active:cursor-grabbing rounded border border-stone-200 bg-white px-2 py-0.5 text-xs text-stone-600 select-none transition-colors hover:border-stone-400 hover:text-stone-800 disabled:opacity-40";

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
          <button onClick={() => openCreate()} title="Nova tarefa (Ctrl+N)"
            className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors shrink-0">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M8 3v10M3 8h10" strokeLinecap="round" />
            </svg>
            Nova
            <kbd className="ml-1 opacity-60 font-mono text-[10px] bg-green-700 rounded px-1">Ctrl+N</kbd>
          </button>

          {/* Settings */}
          <button onClick={() => setShowSettings(true)} title="Configurações da Agenda"
            className="flex items-center justify-center h-7 w-7 rounded-md border border-stone-200 text-stone-400 hover:text-stone-700 hover:border-stone-300 transition-colors shrink-0">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" />
              <path d="M13.3 10a1.3 1.3 0 001.7 1.8l-1 1.7a1.3 1.3 0 00-2.2.5H6.2a1.3 1.3 0 00-2.2-.5l-1-1.7A1.3 1.3 0 004.7 10a1.3 1.3 0 00-1.7-1.8l1-1.7A1.3 1.3 0 006.2 6h3.6a1.3 1.3 0 002.2-.5l1 1.7A1.3 1.3 0 0011.3 10z" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Tag bar */}
        <div className="flex items-center gap-1.5 px-4 py-1.5 border-b border-stone-100 overflow-x-auto scrollbar-none">
          {typeTags.map((tag) => (
            <button key={tag} draggable
              onDragStart={(e) => { e.dataTransfer.setData("tag", tag); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => { incrementTagFrequency(tag); quickCreate.mutate(tag); }}
              onContextMenu={(e) => { e.preventDefault(); openCreate(tag); }}
              disabled={quickCreate.isPending}
              className={chipClass}
            >
              {typeColorMap[tag] && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: typeColorMap[tag] }} />}
              {tag}
            </button>
          ))}
          {typeTags.length > 0 && cultureTags.length > 0 && (
            <span className="w-px h-4 bg-stone-200 mx-0.5 shrink-0" />
          )}
          {cultureTags.map((tag) => (
            <button key={tag} draggable
              onDragStart={(e) => { e.dataTransfer.setData("tag", tag); e.dataTransfer.effectAllowed = "copy"; }}
              onClick={() => { incrementTagFrequency(tag); quickCreate.mutate(tag); }}
              onContextMenu={(e) => { e.preventDefault(); openCreate(tag); }}
              disabled={quickCreate.isPending}
              className={chipClass}
            >
              {cultureColorMap[tag] && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cultureColorMap[tag] }} />}
              {tag}
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

      {/* ── Fila de revisão (tarefas importadas do Google Tasks) ── */}
      {pendingReview.length > 0 && (
        <div className="shrink-0 px-3 pt-3">
          <details open className="bg-amber-50 rounded-lg border border-amber-200">
            <summary className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-amber-800 cursor-pointer select-none list-none hover:bg-amber-100 rounded-lg">
              <svg className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 4h10M3 8h10M3 12h6" strokeLinecap="round" />
              </svg>
              <span className="font-semibold">{pendingReview.length}</span>
              {pendingReview.length === 1 ? "tarefa" : "tarefas"} do Google Tasks para revisar
            </summary>
            <div className="flex flex-wrap gap-2 px-3 pb-3 pt-1">
              {pendingReview.map((task) => (
                <ReviewCard
                  key={task.id}
                  task={task}
                  disabled={confirmReview.isPending || discardReview.isPending}
                  onConfirm={() => confirmReview.mutate(task.id, {
                    onSuccess: () => { setReviewEditTask(task); setShowCreate(true); },
                  })}
                  onEdit={() => { setReviewEditTask(task); setShowCreate(true); }}
                  onDiscard={() => discardReview.mutate(task.id)}
                />
              ))}
            </div>
          </details>
        </div>
      )}

      {/* ── Kanban ── */}
      <div className="flex-1 overflow-hidden p-3 flex flex-col gap-3 min-h-0">
        {isLoading ? (
          <div className="flex gap-3 h-full">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-60 shrink-0 rounded-lg border border-stone-200 bg-stone-50 animate-pulse" />
            ))}
          </div>
        ) : (
          <KanbanView tasks={kanbanTasks} mode={mode} dateDelta={delta} onAddTask={openCreate} typeNames={typeNames} cultureNames={cultureNames} typeColors={typeColorMap} cultureColors={cultureColorMap} />
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
          task={reviewEditTask}
          onClose={() => { setShowCreate(false); setReviewEditTask(undefined); }}
          onSuccess={(savedId) => {
            setShowCreate(false);
            if (reviewEditTask && savedId) confirmReview.mutate(savedId);
            setReviewEditTask(undefined);
            invalidate();
          }}
        />
      )}

      {showSettings && <AgendaSettingsDrawer onClose={() => setShowSettings(false)} />}
    </div>
  );
}
