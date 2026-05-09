import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { tasksApi, type TaskWithPriority, type Executor } from "../api/tasks.ts";
import { parseTitle, buildTitle, TYPE_TAGS } from "../constants/activityTags.ts";
import PriorityBadge from "./PriorityBadge.tsx";
import CreateTaskModal from "./CreateTaskModal.tsx";
import DeferModal from "./DeferModal.tsx";

interface Props {
  task:              TaskWithPriority;
  auxiliaryLabel?:   string | null;
  auxiliaryVariant?: "type" | "culture" | "neutral"; // drives badge color
  displayTitle?:     string;
}

// Returns border + background together so isDragOver can cleanly override both.
function cardPriorityClass(score: number, isDragOver: boolean): string {
  if (isDragOver) return "ring-2 ring-green-400 border-green-300 bg-green-50 border-l-[3px]";
  if (score >= 100_000) return "border-l-[3px] border-l-red-400    bg-red-50";
  if (score >= 90_000)  return "border-l-[3px] border-l-orange-400  bg-orange-50";
  if (score >= 50_000)  return "border-l-[3px] border-l-yellow-400  bg-yellow-50";
  return "border-l-[3px] border-l-stone-200 bg-white";
}

const EXECUTOR_LABEL: Record<Executor, string> = {
  produtor:      "Produtor",
  pai:           "Pai",
  funcionario:   "Funcionário",
  nao_atribuido: "Não Atribuído",
};

const ALL_EXECUTORS: Executor[] = ["produtor", "pai", "funcionario", "nao_atribuido"];

export default function TaskCard({ task, auxiliaryLabel, auxiliaryVariant = "neutral", displayTitle }: Props) {
  const [showEdit, setShowEdit]   = useState(false);
  const [showDefer, setShowDefer] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const qc = useQueryClient();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    void qc.invalidateQueries({ queryKey: ["tasks", "completed-today"] });
  };

  const complete    = useMutation({ mutationFn: () => tasksApi.complete(task.id), onSuccess: invalidate });
  const uncomplete  = useMutation({
    mutationFn: () => tasksApi.uncomplete(task.id),
    onSuccess: invalidate,
    onError: (err: Error & { status?: number }) => {
      if (err.status === 409) alert("A janela de 5 minutos para desfazer expirou.");
    },
  });
  const remove   = useMutation({ mutationFn: () => tasksApi.softDelete(task.id), onSuccess: invalidate });

  const applyTag = useMutation({
    mutationFn: (tag: string) => {
      const p      = parseTitle(task.title);
      const isType = (TYPE_TAGS as readonly string[]).includes(tag);
      // Replace only the matching dimension; preserve the other dimension and base
      const newTitle = buildTitle(
        p.base,
        isType ? tag : p.type,
        isType ? p.culture : tag,
      );
      return tasksApi.update(task.id, { title: newTitle || tag });
    },
    onSuccess: invalidate,
  });

  const changeExecutor = useMutation({
    mutationFn: (executor: Executor) => tasksApi.update(task.id, { executor }),
    onSuccess: invalidate,
  });

  const isCompleted = task.completed_at !== null;
  const isLoading   = complete.isPending || uncomplete.isPending || remove.isPending ||
                      applyTag.isPending || changeExecutor.isPending;
  const otherExecutors = ALL_EXECUTORS.filter((e) => e !== task.executor);
  const depCount = task.dependency_ids.length;

  return (
    <>
      <div
        draggable={!isCompleted}
        onDoubleClick={() => { if (!isCompleted) setShowEdit(true); }}
        onDragStart={(e) => {
          e.dataTransfer.setData("task-id", task.id);
          e.dataTransfer.effectAllowed = "move";
          setIsDragging(true);
        }}
        onDragEnd={() => setIsDragging(false)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onDragOver={(e) => {
          // Only accept tag chip drops (not card drops — those go to the column)
          if (e.dataTransfer.types.includes("tag")) {
            e.preventDefault();
            e.stopPropagation();
            setIsDragOver(true);
          }
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          const tag = e.dataTransfer.getData("tag");
          if (tag) { e.stopPropagation(); applyTag.mutate(tag); }
          setIsDragOver(false);
        }}
        className={clsx(
          "rounded-lg border p-3 transition-all duration-100 select-none",
          cardPriorityClass(task.priority_score, isDragOver),
          !isCompleted && "cursor-grab active:cursor-grabbing",
          isDragging    && "opacity-40 scale-95",
          isCompleted   && "opacity-60",
          isLoading     && "pointer-events-none opacity-50"
        )}
      >
        <div className="flex items-start gap-2">
          {/* Checkbox */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); isCompleted ? uncomplete.mutate() : complete.mutate(); }}
            className={clsx(
              "mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
              isCompleted ? "bg-green-500 border-green-500 text-white" : "border-stone-300 hover:border-green-400"
            )}
            aria-label={isCompleted ? "Desfazer conclusão" : "Concluir"}
          >
            {isCompleted && (
              <svg className="h-2.5 w-2.5" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-1.5 flex-wrap">
              <span className={clsx("text-sm font-medium leading-snug", isCompleted && "line-through text-stone-400")}>
                {displayTitle ?? task.title}
              </span>
            </div>

            <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-400 flex-wrap">
              <PriorityBadge score={task.priority_score} />
              <span>{EXECUTOR_LABEL[task.executor]}</span>
              {task.scheduled_window_end && (
                <span>
                  {new Date(task.scheduled_window_end).toLocaleDateString("pt-BR", {
                    day: "2-digit", month: "2-digit", year: "2-digit",
                  })}
                </span>
              )}
              {auxiliaryLabel && (
                <span className={clsx(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium border",
                  auxiliaryVariant === "culture" && "bg-amber-50 text-amber-800 border-amber-200",
                  auxiliaryVariant === "type"    && "bg-green-50 text-green-800 border-green-200",
                  auxiliaryVariant === "neutral" && "bg-stone-100 text-stone-500 border-stone-200"
                )}>
                  {auxiliaryLabel}
                </span>
              )}
              {depCount > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 text-blue-500 font-medium"
                  title={`Vinculada a ${depCount} tarefa${depCount > 1 ? "s" : ""}`}
                >
                  <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 6a3 3 0 010 4M6 10a3 3 0 010-4M8 2v1M8 13v1M2 8h1M13 8h1" strokeLinecap="round" />
                  </svg>
                  {depCount}
                </span>
              )}
              {task.deferral_count > 0 && (
                <span className={clsx(
                  "font-medium",
                  task.repeatedly_deferred ? "text-amber-600" : "text-stone-400"
                )}>
                  adiada {task.deferral_count}×
                </span>
              )}
            </div>

            {/* Deferral reason (AC-16) */}
            {task.last_deferral_reason && (
              <p className="mt-1 text-[11px] text-stone-400 italic truncate" title={task.last_deferral_reason}>
                ↩ {task.last_deferral_reason}
              </p>
            )}

            {/* Hover suggestions */}
            {isHovered && !isCompleted && (
              <div className="mt-2 pt-1.5 border-t border-stone-100 flex items-center gap-1.5 flex-wrap">
                {otherExecutors.map((ex) => (
                  <button
                    key={ex}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); changeExecutor.mutate(ex); }}
                    className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[11px] text-stone-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                  >
                    → {EXECUTOR_LABEL[ex]}
                  </button>
                ))}
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); setShowDefer(true); }}
                  className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[11px] text-stone-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-700 transition-colors"
                  title="Adiar tarefa"
                >
                  Adiar
                </button>
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); remove.mutate(); }}
                  className="ml-auto rounded px-1.5 py-0.5 text-[11px] text-stone-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>

        {isDragOver && (
          <div className="mt-1.5 text-center text-[11px] text-green-600 font-medium">
            Soltar para adicionar tipo
          </div>
        )}
      </div>

      {showEdit && (
        <CreateTaskModal
          task={task}
          onClose={() => setShowEdit(false)}
          onSuccess={() => { setShowEdit(false); invalidate(); }}
        />
      )}
      {showDefer && (
        <DeferModal
          task={task}
          onClose={() => setShowDefer(false)}
          onSuccess={() => { setShowDefer(false); invalidate(); }}
        />
      )}
    </>
  );
}
