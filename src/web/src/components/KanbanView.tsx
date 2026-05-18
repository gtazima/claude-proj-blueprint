import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useUndo } from "../contexts/UndoContext.tsx";
import { tasksApi, type TaskWithPriority } from "../api/tasks.ts";
import {
  parseTitle, buildTitle, sortedByFrequency,
} from "../constants/activityTags.ts";
import TaskCard from "./TaskCard.tsx";

// ─── Types ────────────────────────────────────────────────────────────────────

export type KanbanMode = "type" | "culture" | "date";
export type DateDelta  = 1 | 2 | 3 | 7 | 14 | 30;

interface Props {
  tasks:         TaskWithPriority[];
  mode:          KanbanMode;
  dateDelta:     DateDelta;
  onAddTask:     (type: string) => void;
  typeNames?:    string[];
  cultureNames?: string[];
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(d = new Date()): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return toLocalDateKey(startOfDay());
}

// Returns the ordered list of day columns for the given delta.
// Each entry is a YYYY-MM-DD local date string.
function getWindowDates(delta: DateDelta): string[] {
  const today = startOfDay();
  const dates: string[] = [];

  if (delta === 1) {
    dates.push(toLocalDateKey(today));
  } else if (delta === 2) {
    dates.push(toLocalDateKey(today));
    dates.push(toLocalDateKey(addDays(today, 1)));
  } else if (delta === 3) {
    // ontem · hoje · amanhã
    for (let i = -1; i <= 1; i++) dates.push(toLocalDateKey(addDays(today, i)));
  } else if (delta === 7) {
    // full ISO week (Mon–Sun) containing today
    const dow     = today.getDay();
    const monday  = addDays(today, -(dow === 0 ? 6 : dow - 1));
    for (let i = 0; i < 7; i++) dates.push(toLocalDateKey(addDays(monday, i)));
  } else if (delta === 14) {
    // two full ISO weeks starting from this week's Monday
    const dow     = today.getDay();
    const monday  = addDays(today, -(dow === 0 ? 6 : dow - 1));
    for (let i = 0; i < 14; i++) dates.push(toLocalDateKey(addDays(monday, i)));
  } else {
    // all days of the current calendar month
    const year  = today.getFullYear();
    const month = today.getMonth();
    const days  = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= days; i++) dates.push(toLocalDateKey(new Date(year, month, i)));
  }

  return dates;
}

function dayLabel(isoKey: string): string {
  const date = new Date(isoKey + "T12:00:00"); // noon avoids DST boundary issues
  const diff  = Math.round((startOfDay(date).getTime() - startOfDay().getTime()) / 86_400_000);
  if (diff === -1) return "Ontem";
  if (diff === 0)  return "Hoje";
  if (diff === 1)  return "Amanhã";
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

// ─── Grouping ─────────────────────────────────────────────────────────────────

function groupByType(tasks: TaskWithPriority[], typeNames: string[]) {
  const g: Record<string, TaskWithPriority[]> = {};
  for (const t of tasks) {
    const col = parseTitle(t.title, typeNames).type ?? "__other__";
    (g[col] ??= []).push(t);
  }
  const ordered = [
    ...sortedByFrequency(typeNames),
    ...(g["__other__"] ? ["__other__"] : []),
  ];
  return { grouped: g, columns: ordered };
}

function groupByCulture(tasks: TaskWithPriority[], cultureNames: string[]) {
  const g: Record<string, TaskWithPriority[]> = {};
  for (const t of tasks) {
    const col = parseTitle(t.title, undefined, cultureNames).culture ?? "__other__";
    (g[col] ??= []).push(t);
  }
  const ordered = [
    ...sortedByFrequency(cultureNames),
    ...(g["__other__"] ? ["__other__"] : []),
  ];
  return { grouped: g, columns: ordered };
}

function groupByDate(tasks: TaskWithPriority[], delta: DateDelta) {
  const windowDates = getWindowDates(delta);
  const windowSet   = new Set(windowDates);
  const windowStart = windowDates[0];
  const g: Record<string, TaskWithPriority[]> = {};

  for (const t of tasks) {
    if (!t.scheduled_window_end) {
      (g["__nodate__"] ??= []).push(t);
      continue;
    }
    const taskKey = toLocalDateKey(new Date(t.scheduled_window_end));
    if (windowSet.has(taskKey)) {
      (g[taskKey] ??= []).push(t);
    } else if (taskKey < windowStart) {
      (g["__overdue__"] ??= []).push(t);
    } else {
      (g["__future__"] ??= []).push(t);
    }
  }

  // Always include all window day columns, even empty ones
  const columns = [
    ...(g["__overdue__"] ? ["__overdue__"] : []),
    ...windowDates,
    ...(g["__future__"]  ? ["__future__"]  : []),
    ...(g["__nodate__"]  ? ["__nodate__"]  : []),
  ];

  return { grouped: g, columns };
}

// ─── Column label ─────────────────────────────────────────────────────────────

function colLabel(key: string, mode: KanbanMode): string {
  if (key === "__other__")   return mode === "type" ? "Sem tipo" : "Sem cultura";
  if (key === "__overdue__") return "Atrasadas";
  if (key === "__future__")  return "Futuras";
  if (key === "__nodate__")  return "Sem prazo";
  if (mode === "date")       return dayLabel(key);
  return key;
}

// ─── Column order persistence ─────────────────────────────────────────────────

const COL_ORDER_KEY = (mode: KanbanMode) => `kanban_col_order_${mode}`;

function loadOrder(mode: KanbanMode, defaults: string[]): string[] {
  try {
    const s = JSON.parse(localStorage.getItem(COL_ORDER_KEY(mode)) ?? "null") as string[] | null;
    if (!s) return defaults;
    return [...s.filter((c) => defaults.includes(c)), ...defaults.filter((c) => !s.includes(c))];
  } catch { return defaults; }
}

// ─── Column color palettes ────────────────────────────────────────────────────

interface ColPalette { border: string; bg: string; header: string; text: string }

const FALLBACK_PALETTE: ColPalette = {
  border: "border-stone-200", bg: "bg-white",
  header: "bg-stone-100 hover:bg-stone-200 border-stone-200", text: "text-stone-700",
};

const TYPE_PALETTES: Record<string, ColPalette> = {
  "Irrigação":          { border: "border-sky-200",     bg: "bg-sky-50/40",     header: "bg-sky-100 hover:bg-sky-200 border-sky-200",         text: "text-sky-800" },
  "Adubação":           { border: "border-lime-200",    bg: "bg-lime-50/40",    header: "bg-lime-100 hover:bg-lime-200 border-lime-200",       text: "text-lime-800" },
  "Plantio":            { border: "border-teal-200",    bg: "bg-teal-50/40",    header: "bg-teal-100 hover:bg-teal-200 border-teal-200",       text: "text-teal-800" },
  "Colheita":           { border: "border-amber-200",   bg: "bg-amber-50/40",   header: "bg-amber-100 hover:bg-amber-200 border-amber-200",    text: "text-amber-800" },
  "Poda":               { border: "border-violet-200",  bg: "bg-violet-50/40",  header: "bg-violet-100 hover:bg-violet-200 border-violet-200", text: "text-violet-800" },
  "Manejo":             { border: "border-stone-300",   bg: "bg-stone-50",      header: "bg-stone-200 hover:bg-stone-300 border-stone-300",    text: "text-stone-700" },
  "Roçar":              { border: "border-green-200",   bg: "bg-green-50/40",   header: "bg-green-100 hover:bg-green-200 border-green-200",    text: "text-green-800" },
  "Limpeza":            { border: "border-cyan-200",    bg: "bg-cyan-50/40",    header: "bg-cyan-100 hover:bg-cyan-200 border-cyan-200",       text: "text-cyan-800" },
  "Manutenção":         { border: "border-rose-200",    bg: "bg-rose-50/40",    header: "bg-rose-100 hover:bg-rose-200 border-rose-200",       text: "text-rose-800" },
  "Monitoramento":      { border: "border-indigo-200",  bg: "bg-indigo-50/40",  header: "bg-indigo-100 hover:bg-indigo-200 border-indigo-200", text: "text-indigo-800" },
  "Controle de pragas": { border: "border-yellow-200",  bg: "bg-yellow-50/40",  header: "bg-yellow-100 hover:bg-yellow-200 border-yellow-200", text: "text-yellow-800" },
  "Venda":              { border: "border-emerald-200", bg: "bg-emerald-50/40", header: "bg-emerald-100 hover:bg-emerald-200 border-emerald-200", text: "text-emerald-800" },
  "Transporte":         { border: "border-slate-200",   bg: "bg-slate-50/40",   header: "bg-slate-100 hover:bg-slate-200 border-slate-200",    text: "text-slate-700" },
};

const CULTURE_PALETTES: Record<string, ColPalette> = {
  "Shiitake":  { border: "border-orange-200", bg: "bg-orange-50/40", header: "bg-orange-100 hover:bg-orange-200 border-orange-200", text: "text-orange-900" },
  "Café SAF":  { border: "border-amber-300",  bg: "bg-amber-50/40",  header: "bg-amber-200 hover:bg-amber-300 border-amber-300",    text: "text-amber-900" },
  "Abelhas":   { border: "border-yellow-200", bg: "bg-yellow-50/40", header: "bg-yellow-100 hover:bg-yellow-200 border-yellow-200", text: "text-yellow-900" },
  "Cúrcuma":   { border: "border-orange-300", bg: "bg-orange-50/40", header: "bg-orange-200 hover:bg-orange-300 border-orange-300", text: "text-orange-900" },
  "Canavial":  { border: "border-green-200",  bg: "bg-green-50/40",  header: "bg-green-100 hover:bg-green-200 border-green-200",   text: "text-green-900" },
};

function getColPalette(col: string, mode: KanbanMode): ColPalette {
  if (mode === "type")    return TYPE_PALETTES[col]    ?? FALLBACK_PALETTE;
  if (mode === "culture") return CULTURE_PALETTES[col] ?? FALLBACK_PALETTE;
  return FALLBACK_PALETTE;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KanbanView({ tasks, mode, dateDelta, onAddTask, typeNames = [], cultureNames = [] }: Props) {
  const qc = useQueryClient();
  const { push: pushUndo } = useUndo();

  const { grouped, columns: rawColumns } =
    mode === "culture" ? groupByCulture(tasks, cultureNames)
    : mode === "date"  ? groupByDate(tasks, dateDelta)
    : groupByType(tasks, typeNames);

  const [colOrder, setColOrder] = useState<string[]>(() =>
    mode === "date" ? rawColumns : loadOrder(mode, rawColumns)
  );
  const [dragCol, setDragCol] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);

  // Respect saved order; append any new columns (e.g. after frequency re-sort)
  const columns = mode === "date"
    ? rawColumns
    : [...colOrder.filter((c) => rawColumns.includes(c)), ...rawColumns.filter((c) => !colOrder.includes(c))];

  const saveOrder = (order: string[]) => {
    if (mode === "date") return;
    setColOrder(order);
    localStorage.setItem(COL_ORDER_KEY(mode), JSON.stringify(order));
  };

  // ── Task move between columns ────────────────────────────────────────────
  const moveTask = useMutation({
    mutationFn: async ({ taskId, targetCol }: { taskId: string; targetCol: string }) => {
      if (["__overdue__", "__future__", "__nodate__", "__other__"].includes(targetCol)) return;

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      if (mode === "type") {
        const newType = typeNames.find((t) => t === targetCol) ?? null;
        const p = parseTitle(task.title);
        if (p.type === newType) return;
        const previous = { title: task.title };
        await tasksApi.update(taskId, { title: buildTitle(p.base || task.title, newType, p.culture) });
        return { taskId, previous, label: `Tarefa movida para ${targetCol}` };
      }

      if (mode === "culture") {
        const newCulture = cultureNames.find((c) => c === targetCol) ?? null;
        const p = parseTitle(task.title);
        if (p.culture === newCulture) return;
        const previous = { title: task.title };
        await tasksApi.update(taskId, { title: buildTitle(p.base || task.title, p.type, newCulture) });
        return { taskId, previous, label: `Tarefa movida para ${targetCol}` };
      }

      if (mode === "date") {
        const newEnd = new Date(targetCol + "T23:59:00").toISOString();
        const previous = { scheduled_window_end: task.scheduled_window_end };
        await tasksApi.update(taskId, { scheduled_window_end: newEnd });
        return { taskId, previous, label: "Data da tarefa alterada" };
      }
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
      if (data) pushUndo({ type: "update", taskId: data.taskId, previous: data.previous, label: data.label });
    },
  });

  // ── Column reorder ───────────────────────────────────────────────────────
  const handleColReorder = (target: string) => {
    if (!dragCol || dragCol === target || mode === "date") return;
    const next = [...columns];
    next.splice(next.indexOf(dragCol), 1);
    next.splice(next.indexOf(target), 0, dragCol);
    saveOrder(next);
    setDragCol(null); setOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, col: string) => {
    e.preventDefault();
    const colKey = e.dataTransfer.getData("kanban-col");
    if (colKey) { handleColReorder(col); return; }
    const taskId = e.dataTransfer.getData("task-id");
    if (taskId) { moveTask.mutate({ taskId, targetCol: col }); setOverCol(null); return; }
    setOverCol(null);
  };

  return (
    <div className="flex gap-3 h-full overflow-x-auto">
      {columns.map((col) => {
        const colTasks  = grouped[col] ?? [];
        const label     = colLabel(col, mode);
        const isOver    = overCol === col && dragCol !== col;
        const draggable = mode !== "date";
        const isSpecial = col.startsWith("__");
        const isToday   = mode === "date" && col === todayKey();
        const palette   = getColPalette(col, mode);

        return (
          <div
            key={col}
            className={clsx(
              "flex flex-col w-60 shrink-0 rounded-lg border transition-all duration-100",
              isOver ? "border-blue-400 bg-blue-50/50 ring-1 ring-blue-300"
              : `${palette.border} ${palette.bg}`
            )}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (dragCol !== col) setOverCol(col);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null);
            }}
            onDrop={(e) => handleDrop(e, col)}
          >
            {/* Header */}
            <div
              draggable={draggable}
              onDragStart={draggable ? (e) => {
                e.dataTransfer.setData("kanban-col", col);
                e.dataTransfer.effectAllowed = "move";
                setDragCol(col);
              } : undefined}
              onDragEnd={() => { setDragCol(null); setOverCol(null); }}
              className={clsx(
                "flex items-center justify-between px-3 py-2.5 rounded-t-lg border-b select-none",
                draggable && "cursor-grab active:cursor-grabbing",
                dragCol === col ? "bg-stone-200 opacity-50 border-stone-300"
                : isToday       ? "bg-green-50 hover:bg-green-100 border-stone-200"
                : palette.header
              )}
            >
              <span className={clsx(
                "text-sm font-bold truncate",
                isToday   ? "text-green-700"
                : isSpecial ? "text-stone-400"
                : palette.text
              )}>
                {label}
              </span>
              <span className={clsx(
                "text-xs font-medium rounded-full px-1.5 py-0.5 shrink-0 ml-2",
                colTasks.length > 0 ? "bg-stone-100 text-stone-400" : "bg-stone-50 text-stone-300"
              )}>
                {colTasks.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-0">
              {colTasks.map((task) => {
                const p = parseTitle(task.title, typeNames, cultureNames);
                const aux = mode === "type"    ? p.culture
                          : mode === "culture" ? p.type
                          : [p.type, p.culture].filter(Boolean).join(" · ") || null;
                const auxVariant = mode === "type" ? "culture" : mode === "culture" ? "type" : "neutral";
                // Strip the primary-dimension tag from the card title to avoid redundancy with the column header
                const displayTitle = mode === "date" ? task.title : (p.base || task.title);
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    auxiliaryLabel={aux}
                    auxiliaryVariant={auxVariant}
                    displayTitle={displayTitle}
                  />
                );
              })}
              {colTasks.length === 0 && (
                <div className="h-10 flex items-center justify-center text-xs text-stone-300 border-2 border-dashed border-stone-200 rounded-lg">
                  Arraste aqui
                </div>
              )}
            </div>

            {/* Add */}
            {mode !== "date" && (
              <button
                onClick={() => onAddTask(col === "__other__" ? "" : col)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-b-lg transition-colors border-t border-stone-200 w-full"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
                Adicionar
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
