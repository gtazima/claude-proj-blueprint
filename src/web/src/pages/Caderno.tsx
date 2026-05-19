import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useFieldNotes, useCreateFieldNote } from "../hooks/useFieldNotes";
import type { FieldNote } from "../api/fieldNotes";

type FilterType = "todos" | "manual" | "task_completed" | "feedback";

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function groupLabel(isoString: string): string {
  const noteDate = new Date(isoString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(noteDate, today)) return "Hoje";
  if (isSameDay(noteDate, yesterday)) return "Ontem";
  return noteDate.toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
}

function groupNotesByDate(notes: FieldNote[]): { label: string; key: string; notes: FieldNote[] }[] {
  const groups: { label: string; key: string; notes: FieldNote[] }[] = [];
  for (const note of notes) {
    const key = new Date(note.created_at).toDateString();
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.notes.push(note);
    } else {
      groups.push({ label: groupLabel(note.created_at), key, notes: [note] });
    }
  }
  return groups;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  });
}

function NoteCard({ note }: { note: FieldNote }) {
  const isFeedback = note.entry_type === "feedback";
  const isAuto = note.entry_type === "task_completed";
  return (
    <div className={clsx(
      "rounded-lg border p-3 transition-colors",
      isFeedback
        ? "bg-amber-50 border-amber-200"
        : isAuto
          ? "bg-stone-50 border-stone-200"
          : "bg-white border-stone-200 hover:border-stone-300"
    )}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-stone-800 whitespace-pre-wrap flex-1 leading-relaxed">
          {note.content}
        </p>
        {isFeedback && (
          <span className="shrink-0 text-[10px] font-medium text-amber-600 bg-amber-100 rounded px-1.5 py-0.5 mt-0.5">
            ⚠ feedback
          </span>
        )}
        {isAuto && (
          <span className="shrink-0 text-[10px] font-medium text-stone-400 bg-stone-100 rounded px-1.5 py-0.5 mt-0.5">
            automático
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2 text-[11px] text-stone-400">
        <span>{formatTime(note.created_at)}</span>
        {note.executor && (
          <>
            <span className="text-stone-300">·</span>
            <span>{note.executor}</span>
          </>
        )}
        {isFeedback && note.management_unit && (
          <>
            <span className="text-stone-300">·</span>
            <span className="font-mono text-amber-500">{note.management_unit}</span>
          </>
        )}
        {!isFeedback && note.culture && (
          <>
            <span className="text-stone-300">·</span>
            <span className="text-amber-600 font-medium">{note.culture}</span>
          </>
        )}
      </div>
    </div>
  );
}

function todayCount(notes: FieldNote[]): number {
  const today = new Date();
  return notes.filter((n) => isSameDay(new Date(n.created_at), today)).length;
}

export default function CadernoPage() {
  const [content, setContent] = useState("");
  const [filter, setFilter] = useState<FilterType>("todos");
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 400);
    return () => clearTimeout(timer);
  }, [keyword]);

  const queryFilters = {
    ...(filter !== "todos" ? { entry_type: filter } : {}),
    ...(debouncedKeyword ? { keyword: debouncedKeyword } : {}),
    limit: 200,
  };

  const { data: notes = [], isLoading } = useFieldNotes(queryFilters);
  const createNote = useCreateFieldNote();

  const handleSubmit = async () => {
    const trimmed = content.trim();
    if (!trimmed || createNote.isPending) return;
    await createNote.mutateAsync({ content: trimmed });
    setContent("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      void handleSubmit();
    }
  };

  const groups = groupNotesByDate(notes);
  const count = todayCount(notes);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-green-600 text-white shrink-0">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-4 w-4">
                <rect x="4" y="2" width="12" height="16" rx="1.5" />
                <path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round" />
              </svg>
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-stone-900 leading-tight">Caderno de campo</h1>
              <p className="text-xs text-stone-400 leading-tight">
                <span className="font-semibold text-stone-600">{count}</span> entrada{count !== 1 ? "s" : ""} hoje
              </p>
            </div>
          </div>

          {/* Busca */}
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400 pointer-events-none"
              viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6.5" cy="6.5" r="4.5" />
              <path d="M10 10l3 3" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Buscar..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="pl-7 pr-3 py-1 text-xs border border-stone-200 rounded-md text-stone-700 placeholder:text-stone-400 outline-none focus:border-green-400 w-40 transition-colors"
            />
          </div>

          {/* Filtro por tipo */}
          <div className="flex items-center gap-0.5 rounded-md border border-stone-200 p-0.5">
            {(["todos", "manual", "task_completed", "feedback"] as FilterType[]).map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={clsx(
                  "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                  filter === f
                    ? f === "feedback" ? "bg-amber-500 text-white" : "bg-stone-900 text-white"
                    : "text-stone-500 hover:bg-stone-100"
                )}>
                {f === "todos" ? "Todos" : f === "manual" ? "Manual" : f === "task_completed" ? "Automático" : "⚠ Feedback"}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Entry form */}
        <div className="bg-white rounded-lg border border-stone-200 p-3 shadow-sm">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="O que você observou no campo hoje?"
            rows={3}
            className="w-full resize-none text-sm text-stone-800 placeholder:text-stone-400 outline-none leading-relaxed"
            autoFocus
          />
          <div className="flex items-center justify-end mt-2 pt-2 border-t border-stone-100">
            <button
              onClick={() => void handleSubmit()}
              disabled={!content.trim() || createNote.isPending}
              className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {createNote.isPending ? (
                <span className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M8 3v10M3 8h10" strokeLinecap="round" />
                </svg>
              )}
              Registrar
              <kbd className="ml-0.5 opacity-60 font-mono text-[10px] bg-green-700 rounded px-1">Ctrl+Enter</kbd>
            </button>
          </div>
        </div>

        {/* Timeline */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white rounded-lg border border-stone-200 animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-12 text-stone-400">
            <svg className="mx-auto h-10 w-10 mb-3 opacity-40" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="4" y="2" width="12" height="16" rx="1.5" />
              <path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round" />
            </svg>
            <p className="text-sm">
              {debouncedKeyword || filter !== "todos"
                ? "Nenhuma entrada encontrada para esse filtro."
                : "Nenhuma entrada ainda. Registre sua primeira observação acima."}
            </p>
          </div>
        ) : (
          groups.map(({ label, key, notes: groupNotes }) => (
            <div key={key}>
              <h3 className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider mb-2">
                {label}
              </h3>
              <div className="space-y-2">
                {groupNotes.map((note) => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
