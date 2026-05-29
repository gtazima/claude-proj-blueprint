import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { tasksApi, type ChainInfo } from "../api/tasks.ts";

interface Props {
  chain: ChainInfo;
  currentTaskId: string;
  onClose: () => void;
  onUnlink: (otherId: string) => void;
}

export default function ChainModal({ chain, currentTaskId, onClose, onUnlink }: Props) {
  const { data: chainTasks = [], isLoading } = useQuery({
    queryKey: ["chain", chain.chain_id, "tasks"],
    queryFn: () => tasksApi.getChainTasks(chain.chain_id),
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleUnlink = () => {
    const otherId = chain.task_ids.find((id) => id !== currentTaskId);
    if (otherId) onUnlink(otherId);
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-stone-900">
            Cadeia de tarefas{" "}
            <span className="text-stone-400 font-normal">
              {chain.position}/{chain.total}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-xs rounded px-1.5 py-0.5 hover:bg-stone-100 transition-colors"
            aria-label="Fechar"
          >
            Esc
          </button>
        </div>

        {/* Task list */}
        {isLoading ? (
          <div className="py-6 text-center text-sm text-stone-400">Carregando…</div>
        ) : (
          <ol className="space-y-0.5">
            {chainTasks.map((t, i) => {
              const isCurrent = t.id === currentTaskId;
              return (
                <li
                  key={t.id}
                  className={clsx(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm",
                    isCurrent
                      ? "bg-stone-100 font-medium text-stone-900"
                      : "text-stone-500"
                  )}
                >
                  <span className="tabular-nums w-4 text-right text-stone-400 shrink-0">
                    {i + 1}
                  </span>
                  <span
                    className={clsx(
                      "flex-1 truncate",
                      t.completed_at && "line-through text-stone-400"
                    )}
                    title={t.title}
                  >
                    {t.title}
                  </span>
                  {isCurrent && (
                    <span className="text-[10px] text-stone-400 shrink-0">← esta</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-stone-100 flex justify-end">
          <button
            onClick={handleUnlink}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
          >
            Desvincular desta cadeia
          </button>
        </div>
      </div>
    </div>
  );
}
