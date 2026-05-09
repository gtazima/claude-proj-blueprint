import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { tasksApi, type Task } from "../api/tasks.ts";

interface Props {
  task: Task;
  onClose: () => void;
  onSuccess: () => void;
}

export default function DeferModal({ task, onClose, onSuccess }: Props) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().slice(0, 10);

  const [date, setDate] = useState(defaultDate);
  const [reason, setReason] = useState("");

  const defer = useMutation({
    mutationFn: () =>
      tasksApi.defer(task.id, {
        new_scheduled_window_start: new Date(date + "T00:00:00").toISOString(),
        reason,
      }),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h2 className="text-lg font-semibold text-stone-900 mb-1">Adiar tarefa</h2>
        <p className="text-sm text-stone-500 mb-4 truncate">{task.title}</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Nova data
              {date && (
                <span className="ml-2 font-normal text-stone-500">
                  {new Date(date + "T00:00:00").toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </span>
              )}
            </label>
            <input
              type="date"
              lang="pt-BR"
              value={date}
              min={defaultDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Motivo
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: vai chover até sexta"
              rows={3}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-stone-300 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => defer.mutate()}
            disabled={!reason.trim() || defer.isPending}
            className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {defer.isPending ? "Adiando..." : "Adiar"}
          </button>
        </div>
      </div>
    </div>
  );
}
