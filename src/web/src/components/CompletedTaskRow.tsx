import { useMutation, useQueryClient } from "@tanstack/react-query";
import { tasksApi, type Task } from "../api/tasks.ts";
import { useUndo } from "../contexts/UndoContext.tsx";

interface Props {
  task: Task;
}

export default function CompletedTaskRow({ task }: Props) {
  const qc = useQueryClient();
  const { push: pushUndo } = useUndo();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    void qc.invalidateQueries({ queryKey: ["tasks", "completed-today"] });
  };

  const uncomplete = useMutation({
    mutationFn: () => tasksApi.uncomplete(task.id),
    onSuccess: () => {
      pushUndo({ type: "complete", taskId: task.id, label: `"${task.title}" reaberta` });
      invalidate();
    },
  });

  return (
    <button
      onClick={() => uncomplete.mutate()}
      disabled={uncomplete.isPending}
      title="Clique para reabrir"
      className="flex items-center gap-1.5 rounded border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-400 hover:border-green-300 hover:bg-green-50 hover:text-green-700 disabled:opacity-50 transition-colors max-w-xs"
    >
      <svg className="h-3 w-3 text-green-500 shrink-0" viewBox="0 0 12 12" fill="none">
        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="line-through truncate">{task.title}</span>
    </button>
  );
}
