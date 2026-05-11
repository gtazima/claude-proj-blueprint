import type { Task } from "../api/tasks";

interface Props {
  task: Task;
  onConfirm: () => void;
  onEdit: () => void;
  onDiscard: () => void;
  disabled?: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Sem data";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export default function ReviewCard({ task, onConfirm, onEdit, onDiscard, disabled }: Props) {
  return (
    <div className="bg-white rounded-lg border border-amber-200 p-3 flex flex-col gap-2 min-w-0">
      <div className="flex items-start gap-2">
        <div className="flex items-center justify-center h-5 w-5 rounded bg-amber-100 shrink-0 mt-0.5">
          <svg className="h-3 w-3 text-amber-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="3" width="12" height="11" rx="1.5" />
            <path d="M5 1.5v3M11 1.5v3M2 7h12" strokeLinecap="round" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-stone-900 leading-snug break-words">{task.title}</p>
          {task.scheduled_window_start && (
            <p className="text-[11px] text-stone-400 mt-0.5">{formatDate(task.scheduled_window_start)}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 justify-end">
        <button
          onClick={onDiscard}
          disabled={disabled}
          className="text-[11px] text-stone-400 hover:text-red-500 transition-colors px-1.5 py-0.5 rounded disabled:opacity-50"
        >
          Descartar
        </button>
        <button
          onClick={onEdit}
          disabled={disabled}
          className="text-[11px] text-stone-600 hover:text-stone-800 transition-colors border border-stone-200 px-2 py-0.5 rounded disabled:opacity-50"
        >
          Editar
        </button>
        <button
          onClick={onConfirm}
          disabled={disabled}
          className="text-[11px] font-medium text-white bg-green-600 hover:bg-green-700 transition-colors px-2 py-0.5 rounded disabled:opacity-50"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}
