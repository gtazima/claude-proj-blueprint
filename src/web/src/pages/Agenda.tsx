import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { tasksApi, type TaskWithPriority } from "../api/tasks.ts";
import CreateTaskModal from "../components/CreateTaskModal.tsx";

type AgendaView = "week" | "fortnight" | "month";

// ─── Date helpers ─────────────────────────────────────────────────────────────

function startOfDay(d = new Date()): Date {
  const r = new Date(d); r.setHours(0, 0, 0, 0); return r;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
function toLocalKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekMonday(d: Date): Date {
  const dow = d.getDay();
  return addDays(startOfDay(d), -(dow === 0 ? 6 : dow - 1));
}

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const VIEW_LABELS: Record<AgendaView, string> = {
  week: "Semana", fortnight: "Quinzena", month: "Mês",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgendaPage() {
  const [view, setView]         = useState<AgendaView>("week");
  const [anchor, setAnchor]     = useState(() => startOfDay());
  const [editTask, setEditTask] = useState<TaskWithPriority | null>(null);
  const [createDate, setCreateDate] = useState<string | undefined>(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const qc = useQueryClient();

  const navigate = (dir: -1 | 1) => {
    setAnchor((prev) => {
      if (view === "week")      return addDays(prev, dir * 7);
      if (view === "fortnight") return addDays(prev, dir * 14);
      return new Date(prev.getFullYear(), prev.getMonth() + dir, 1);
    });
  };

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    void qc.invalidateQueries({ queryKey: ["tasks", "upcoming"] });
  };

  const { data: todayTasks = [] } = useQuery<TaskWithPriority[]>({
    queryKey: ["tasks", "today"],
    queryFn:  tasksApi.listToday,
    refetchInterval: 60_000,
  });
  const { data: upcomingTasks = [] } = useQuery<TaskWithPriority[]>({
    queryKey: ["tasks", "upcoming", 90],
    queryFn:  () => tasksApi.listUpcoming(90),
    refetchInterval: 60_000,
  });

  const tasksByDate = useMemo(() => {
    const seen = new Set<string>();
    const all: TaskWithPriority[] = [];
    for (const t of [...todayTasks, ...upcomingTasks]) {
      if (!seen.has(t.id)) { seen.add(t.id); all.push(t); }
    }
    const m: Record<string, TaskWithPriority[]> = {};
    for (const t of all) {
      if (!t.scheduled_window_end) continue;
      const key = toLocalKey(new Date(t.scheduled_window_end));
      (m[key] ??= []).push(t);
    }
    return m;
  }, [todayTasks, upcomingTasks]);

  const todayKey      = toLocalKey(startOfDay());
  const wStart        = weekMonday(anchor);
  const weekDates     = Array.from({ length: 7  }, (_, i) => addDays(wStart, i));
  const mFirstDay     = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const mGridStart    = weekMonday(mFirstDay);
  const monthDates    = Array.from({ length: 42 }, (_, i) => addDays(mGridStart, i));

  // ── Period label ──────────────────────────────────────────────────────────
  function periodLabel(): string {
    const fmt = {
      d: (d: Date) => d.getDate(),
      m: (d: Date) => d.toLocaleDateString("pt-BR", { month: "short" }),
      y: (d: Date) => d.getFullYear(),
    };
    if (view === "month")
      return anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

    const s = view === "fortnight" ? wStart : weekDates[0];
    const e = addDays(s, view === "fortnight" ? 13 : 6);
    if (s.getMonth() === e.getMonth())
      return `${fmt.d(s)}–${fmt.d(e)} ${fmt.m(e)} ${fmt.y(e)}`;
    return `${fmt.d(s)} ${fmt.m(s)} – ${fmt.d(e)} ${fmt.m(e)} ${fmt.y(e)}`;
  }

  const openCreate = (dateKey?: string) => {
    setCreateDate(dateKey);
    setShowCreate(true);
  };

  // ── Reusable day cell (week / fortnight rows) ─────────────────────────────
  function DayCell({ date }: { date: Date }) {
    const key      = toLocalKey(date);
    const dayTasks = tasksByDate[key] ?? [];
    const isToday  = key === todayKey;
    const dow      = date.getDay();
    const isWeekend = dow === 0 || dow === 6;

    return (
      <div className={clsx(
        "flex flex-col overflow-hidden",
        isToday   ? "bg-green-50/30"
        : isWeekend ? "bg-stone-50"
        : "bg-white"
      )}>
        <div className={clsx(
          "flex items-center justify-between px-2 pt-1.5 pb-1 border-b border-stone-100 shrink-0",
          isToday ? "bg-green-50" : "bg-white"
        )}>
          <span className={clsx(
            "inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold",
            isToday ? "bg-green-600 text-white" : "text-stone-600"
          )}>
            {date.getDate()}
          </span>
          <button onClick={() => openCreate(key)}
            className="p-0.5 rounded text-stone-300 hover:text-stone-600 hover:bg-stone-100 transition-colors">
            <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2v8M2 6h8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-1 space-y-1">
          {dayTasks.map((task) => (
            <button key={task.id}
              onClick={() => setEditTask(task)}
              title={task.title}
              className={clsx(
                "w-full text-left rounded px-1.5 py-1 text-[11px] leading-snug truncate transition-colors border-l-[3px]",
                task.completed_at
                  ? "bg-stone-100 text-stone-400 line-through border-l-stone-300"
                  : task.priority_score >= 100_000 ? "bg-red-50 border-l-red-400 text-stone-700 hover:bg-red-100"
                  : task.priority_score >= 90_000  ? "bg-orange-50 border-l-orange-400 text-stone-700 hover:bg-orange-100"
                  : task.priority_score >= 50_000  ? "bg-yellow-50 border-l-yellow-400 text-stone-700 hover:bg-yellow-100"
                  : "bg-white border-l-stone-200 text-stone-700 hover:bg-green-50"
              )}>
              {task.title}
            </button>
          ))}
          {dayTasks.length === 0 && (
            <button onClick={() => openCreate(key)}
              className="w-full h-8 rounded text-[11px] text-stone-300 hover:text-stone-500 hover:bg-stone-50 transition-colors border-2 border-dashed border-transparent hover:border-stone-200">
              + adicionar
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Header ── */}
      <header className="bg-white border-b border-stone-200 px-4 py-2 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)}
            className="p-1.5 rounded hover:bg-stone-100 text-stone-500 transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 4L6 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button onClick={() => setAnchor(startOfDay())}
            className="px-2.5 py-1 text-xs rounded border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors font-medium">
            Hoje
          </button>
          <button onClick={() => navigate(1)}
            className="p-1.5 rounded hover:bg-stone-100 text-stone-500 transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <h1 className="flex-1 text-sm font-semibold text-stone-800 capitalize">{periodLabel()}</h1>

        <button onClick={() => openCreate()}
          className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-green-700 transition-colors shrink-0">
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          Nova
        </button>

        <div className="flex items-center gap-0.5 bg-stone-100 rounded-lg p-0.5">
          {(["week", "fortnight", "month"] as AgendaView[]).map((v) => (
            <button key={v} onClick={() => setView(v)}
              className={clsx(
                "px-2.5 py-1 text-xs font-medium rounded-md transition-colors",
                view === v ? "bg-white text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-700"
              )}>
              {VIEW_LABELS[v]}
            </button>
          ))}
        </div>
      </header>

      {/* ── Weekday name row (sticky) ── */}
      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 shrink-0">
        {WEEKDAYS.map((d) => (
          <div key={d}
            className="py-1.5 text-center text-[11px] font-semibold text-stone-400 uppercase tracking-wide border-r border-stone-100 last:border-r-0">
            {d}
          </div>
        ))}
      </div>

      {/* ── Week ── */}
      {view === "week" && (
        <div className="flex-1 grid grid-cols-7 divide-x divide-stone-200 overflow-hidden">
          {weekDates.map((date) => <DayCell key={toLocalKey(date)} date={date} />)}
        </div>
      )}

      {/* ── Fortnight (2 × 7 rows) ── */}
      {view === "fortnight" && (
        <div className="flex-1 flex flex-col overflow-hidden divide-y divide-stone-300">
          {[0, 7].map((offset) => (
            <div key={offset} className="flex-1 grid grid-cols-7 divide-x divide-stone-200 overflow-hidden">
              {Array.from({ length: 7 }, (_, i) => addDays(wStart, offset + i)).map((date) => (
                <DayCell key={toLocalKey(date)} date={date} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Month ── */}
      {view === "month" && (
        <div className="flex-1 overflow-auto">
          <div className="grid grid-cols-7 divide-x divide-stone-100">
            {monthDates.map((date) => {
              const key      = toLocalKey(date);
              const dayTasks = tasksByDate[key] ?? [];
              const isToday  = key === todayKey;
              const isThisMo = date.getMonth() === anchor.getMonth();

              return (
                <div key={key}
                  className={clsx(
                    "min-h-[110px] border-b border-stone-100 p-1.5 flex flex-col gap-1",
                    isToday   && "bg-green-50/40",
                    !isThisMo && "bg-stone-50/60"
                  )}>
                  <div className="flex items-center justify-between">
                    <span className={clsx(
                      "inline-flex items-center justify-center h-5 w-5 rounded-full text-[11px] font-semibold",
                      isToday   ? "bg-green-600 text-white"
                      : isThisMo ? "text-stone-700"
                      : "text-stone-300"
                    )}>
                      {date.getDate()}
                    </span>
                    <button onClick={() => openCreate(key)}
                      className="p-0.5 rounded text-stone-300 hover:text-stone-500 hover:bg-stone-100 transition-colors">
                      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M6 2v8M2 6h8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  {dayTasks.slice(0, 3).map((task) => (
                    <button key={task.id}
                      onClick={() => setEditTask(task)}
                      title={task.title}
                      className={clsx(
                        "w-full text-left rounded px-1.5 py-0.5 text-[10px] leading-snug truncate transition-colors",
                        task.completed_at
                          ? "bg-stone-100 text-stone-400 line-through"
                          : "bg-white border border-stone-200 text-stone-700 hover:border-green-300 hover:bg-green-50"
                      )}>
                      {task.title}
                    </button>
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[10px] text-stone-400 pl-1">
                      +{dayTasks.length - 3} mais
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {editTask && (
        <CreateTaskModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSuccess={() => { setEditTask(null); invalidate(); }}
        />
      )}
      {showCreate && (
        <CreateTaskModal
          initialDate={createDate}
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); invalidate(); }}
        />
      )}
    </div>
  );
}
