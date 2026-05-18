import { useRef } from "react";
import type { Task } from "../api/tasks.ts";

interface Props {
  task: Task;
  isPending?: boolean;
  onClose: () => void;
  onComplete: (observation: string | undefined) => void;
}

export default function CompleteModal({ task, isPending, onClose, onComplete }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = (withNote: boolean) => {
    const obs = withNote ? textareaRef.current?.value.trim() || undefined : undefined;
    onComplete(obs);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-stone-900 mb-1">Concluir tarefa</h2>
        <p className="text-sm text-stone-500 mb-4 truncate">{task.title}</p>

        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            Observação{" "}
            <span className="font-normal text-stone-400">(opcional)</span>
          </label>
          <textarea
            ref={textareaRef}
            autoFocus
            placeholder="O que observou? Quantidade, condições, problemas…"
            rows={3}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "Enter") { e.preventDefault(); submit(true); }
              if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }}
            className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
          <p className="mt-1 text-[11px] text-stone-400">Ctrl+Enter para concluir com nota · Esc para cancelar</p>
        </div>

        <div className="flex gap-3 mt-4">
          <button
            onClick={() => submit(false)}
            disabled={isPending}
            className="flex-1 rounded-lg border border-stone-300 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50 transition-colors"
          >
            Sem nota
          </button>
          <button
            onClick={() => submit(true)}
            disabled={isPending}
            className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isPending ? "Concluindo…" : "Concluir"}
          </button>
        </div>
      </div>
    </div>
  );
}
