import { useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { fieldNotesApi } from "../api/fieldNotes";

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const location = useLocation();
  const qc = useQueryClient();

  const send = useMutation({
    mutationFn: () =>
      fieldNotesApi.create({
        content: text.trim(),
        management_unit: location.pathname,
        entry_type: "feedback",
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["field-notes"] });
      setText("");
      setOpen(false);
    },
  });

  const canSend = text.trim().length >= 3 && !send.isPending;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Reportar problema"
        className="fixed bottom-4 right-4 z-40 h-9 w-9 rounded-full bg-white border border-stone-200 shadow-md flex items-center justify-center text-stone-400 hover:text-amber-500 hover:border-amber-300 transition-colors"
      >
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
          <path d="M10 3a7 7 0 100 14A7 7 0 0010 3z" />
          <path d="M10 11V9m0 4v.5" strokeLinecap="round" />
          <path d="M8 7.5C8 6.4 8.9 5.5 10 5.5s2 .9 2 2c0 1-1 1.5-1.5 2S10 11 10 11" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-72 bg-white border border-amber-200 rounded-xl shadow-xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <span className="text-amber-500 text-sm">⚠</span>
          <span className="text-xs font-semibold text-stone-700">Reportar problema</span>
        </div>
        <button
          onClick={() => { setOpen(false); setText(""); }}
          className="text-stone-300 hover:text-stone-600 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="px-4 pt-2 pb-1">
        <p className="text-[10px] text-stone-400 font-mono mb-2">{location.pathname}</p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); setText(""); }
            if (e.ctrlKey && e.key === "Enter" && canSend) { e.preventDefault(); send.mutate(); }
          }}
          placeholder="O que está errado?"
          rows={3}
          className="w-full resize-none text-sm text-stone-800 placeholder:text-stone-400 outline-none leading-relaxed"
        />
      </div>

      <div className="flex gap-2 px-4 pb-3">
        <button
          onClick={() => send.mutate()}
          disabled={!canSend}
          className="flex-1 rounded-md bg-amber-500 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
        >
          {send.isPending ? "Salvando…" : "Registrar"}
          {!send.isPending && <kbd className="ml-1.5 opacity-70 font-mono text-[10px] bg-amber-600 rounded px-1">Ctrl+↵</kbd>}
        </button>
      </div>

      {send.isError && (
        <p className="px-4 pb-2 text-[10px] text-red-500">Erro ao salvar. Tente novamente.</p>
      )}
    </div>
  );
}
