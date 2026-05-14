import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { tasksApi, type TaskUpdatePayload } from "../api/tasks.ts";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UndoOp =
  | { type: "complete"; taskId: string; label: string }
  | { type: "delete";   taskId: string; label: string }
  | { type: "update";   taskId: string; previous: TaskUpdatePayload; label: string };

interface UndoCtx {
  push:     (op: UndoOp) => void;
  undo:     () => void;
  canUndo:  boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UndoContext = createContext<UndoCtx>({ push: () => {}, undo: () => {}, canUndo: false });

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UndoProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();

  const stackRef = useRef<UndoOp[]>([]);
  const [canUndo, setCanUndo]   = useState(false);
  const [toast, setToast]       = useState<{ msg: string; showBtn: boolean } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const showToast = useCallback((msg: string, showBtn: boolean) => {
    setToast({ msg, showBtn });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["tasks", "today"] });
    void qc.invalidateQueries({ queryKey: ["tasks", "completed-today"] });
  }, [qc]);

  const push = useCallback((op: UndoOp) => {
    stackRef.current = [...stackRef.current.slice(-9), op];
    setCanUndo(true);
    showToast(`${op.label}`, true);
  }, [showToast]);

  const undo = useCallback(() => {
    const stack = stackRef.current;
    if (stack.length === 0) return;
    const op = stack[stack.length - 1];
    stackRef.current = stack.slice(0, -1);
    setCanUndo(stackRef.current.length > 0);

    void (async () => {
      try {
        if (op.type === "complete") await tasksApi.uncomplete(op.taskId);
        else if (op.type === "delete")  await tasksApi.restore(op.taskId);
        else if (op.type === "update")  await tasksApi.update(op.taskId, op.previous);
        invalidate();
        showToast("Desfeito", false);
      } catch {
        stackRef.current = [...stackRef.current, op];
        setCanUndo(true);
        showToast("Não foi possível desfazer", false);
      }
    })();
  }, [invalidate, showToast]);

  return (
    <UndoContext.Provider value={{ push, undo, canUndo }}>
      {children}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-stone-800 text-white text-xs font-medium rounded-lg px-4 py-2.5 shadow-xl select-none">
          <span>{toast.msg}</span>
          {toast.showBtn && canUndo && (
            <button
              onClick={undo}
              className="shrink-0 rounded border border-stone-600 px-2 py-0.5 hover:bg-stone-700 transition-colors"
            >
              Desfazer (Ctrl+Z)
            </button>
          )}
        </div>
      )}
    </UndoContext.Provider>
  );
}

export function useUndo() {
  return useContext(UndoContext);
}
