import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { tasksApi, type Task, type TaskWithPriority } from "../api/tasks.ts";
import { useUndo } from "../contexts/UndoContext.tsx";
import {
  sortedByFrequency, incrementTagFrequency, buildTitle, parseTitle,
} from "../constants/activityTags.ts";
import { usePeople, useActivityTypes, useCultures, useAmbientes, useLotes } from "../hooks/useConfig.ts";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  onClose:       () => void;
  onSuccess:     (savedId?: string) => void;
  initialType?:  string;
  initialDate?:  string;
  task?:         Task | TaskWithPriority;
  initialTask?:  Task;
}

const LAST_EXECUTOR_KEY = "last_executor";
function readLastExecutor(): string {
  return localStorage.getItem(LAST_EXECUTOR_KEY) ?? "produtor";
}

function toLocalDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CreateTaskModal({ onClose, onSuccess, initialType, initialDate, task, initialTask }: Props) {
  const editSource = task ?? initialTask;
  const isEdit  = !!task;
  const { push: pushUndo } = useUndo();
  const qc = useQueryClient();

  const { data: people = [] }        = usePeople();
  const { data: activityTypes = [] } = useActivityTypes();
  const { data: cultures = [] }      = useCultures();
  const { data: ambientes = [] }     = useAmbientes();
  const { data: lotes = [] }         = useLotes();

  const typeNames    = activityTypes.map((t) => t.name);
  const cultureNames = cultures.map((c) => c.name);

  const parsed  = editSource ? parseTitle(editSource.title, typeNames, cultureNames) : null;

  const [baseTitle, setBaseTitle]   = useState(parsed?.base ?? "");
  const [description, setDescription] = useState(editSource?.description ?? "");
  const [executor, setExecutor]     = useState<string>(editSource?.executor ?? readLastExecutor());
  const [selType, setSelType]       = useState<string | null>(
    editSource ? (parsed?.type ?? null)
               : (initialType && typeNames.includes(initialType) ? initialType : null)
  );
  const [selCulture, setSelCulture] = useState<string | null>(
    editSource ? (parsed?.culture ?? null)
               : (initialType && cultureNames.includes(initialType) ? initialType : null)
  );
  const [selAmbiente, setSelAmbiente] = useState<string | null>(
    editSource?.ambiente_slug
      ? (ambientes.find((a) => a.slug === editSource.ambiente_slug)?.slug ?? null)
      : null
  );
  const [selLote, setSelLote] = useState<string | null>(
    editSource?.lote_slug
      ? (lotes.find((l) => l.slug === editSource.lote_slug)?.slug ?? null)
      : null
  );
  const [windowEnd, setWindowEnd]   = useState(
    editSource?.scheduled_window_end
      ? toLocalDateKey(new Date(editSource.scheduled_window_end))
      : initialDate ?? ""
  );
  const [chainSearch, setChainSearch] = useState("");
  const [showChain, setShowChain]     = useState(false);
  // IDs de tarefas a vincular após salvar (apenas para tarefa nova — edição usa link direto)
  const [pendingLinks, setPendingLinks] = useState<string[]>([]);

  const typeTags    = sortedByFrequency(typeNames.length > 0 ? typeNames : activityTypes.map((t) => t.name));
  const cultureTags = sortedByFrequency(cultureNames.length > 0 ? cultureNames : cultures.map((c) => c.name));
  const activePeople = people.filter((p) => p.is_active);

  // Helpers: name ↔ slug lookup
  const typeSlug    = (name: string | null) => name ? (activityTypes.find((t) => t.name === name)?.slug ?? null) : null;
  const cultureSlug = (name: string | null) => name ? (cultures.find((c) => c.name === name)?.slug ?? null) : null;

  // Caudas das cadeias existentes (picker de vincular)
  const { data: chainTails = [] } = useQuery({
    queryKey: ["tasks", "chain-tails"],
    queryFn:  tasksApi.listChainTails,
    staleTime: 10_000,
  });

  // Todas as tarefas (fallback quando não há cadeias)
  const { data: allTasks = [] } = useQuery({
    queryKey: ["tasks", "today"],
    queryFn:  tasksApi.listToday,
    staleTime: 30_000,
  });

  // Cadeias atuais desta tarefa (para modo edição)
  const currentChains = task?.chains ?? [];

  // Candidatos no picker:
  //   1. Tarefas já encadeadas (priorizadas) — mais provável ter relação
  //   2. Tarefas sem cadeia
  // Inclui chain tails de outros dias não presentes em allTasks.
  const todayIds = new Set(allTasks.map((t) => t.id));
  const allAvailableTasks = [
    ...allTasks,
    ...chainTails.filter((t) => !todayIds.has(t.id)),
  ];
  const selfId = task?.id ?? "";
  const allCandidates = [
    ...allAvailableTasks.filter((t) => t.id !== selfId && (t.chains?.length ?? 0) > 0),
    ...allAvailableTasks.filter((t) => t.id !== selfId && (t.chains?.length ?? 0) === 0),
  ];
  const chainCandidates = allCandidates.filter((t) =>
    !chainSearch.trim() || t.title.toLowerCase().includes(chainSearch.toLowerCase())
  );

  // Mutação de link direto (para modo edição)
  const linkTask = useMutation({
    mutationFn: (relatedId: string) => tasksApi.linkTask(task!.id, relatedId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const unlinkTask = useMutation({
    mutationFn: ({ otherId }: { otherId: string }) =>
      tasksApi.unlinkTask(task!.id, otherId),
    onSuccess: (updatedTask) => {
      // Atualiza o título imediatamente no cache sem esperar refetch
      qc.setQueryData<import("../api/tasks.ts").TaskWithPriority[]>(["tasks", "today"], (old) =>
        old?.map((t) => t.id === updatedTask.id ? { ...t, ...updatedTask } : t)
      );
      void qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const title = buildTitle(baseTitle.trim(), selType, selCulture) || baseTitle.trim() || task?.title;
      const windowEndISO = windowEnd
        ? new Date(windowEnd + "T23:59:59").toISOString()
        : null;

      if (isEdit && task) {
        return tasksApi.update(task.id, {
          title:                title ?? task.title,
          description:          description.trim() || null,
          executor,
          scheduled_window_end: windowEndISO,
          activity_type_slug:   typeSlug(selType),
          culture_slug:         cultureSlug(selCulture),
          ambiente_slug:        selAmbiente,
          lote_slug:            selLote,
        });
      }

      const created = await tasksApi.create({
        title:              title ?? "",
        description:        description.trim() || undefined,
        executor,
        financial_score:    0,
        activity_type_slug: typeSlug(selType),
        culture_slug:       cultureSlug(selCulture),
        ambiente_slug:      selAmbiente,
        lote_slug:          selLote,
        ...(windowEndISO ? { scheduled_window_end: windowEndISO } : {}),
      });

      // Cria vínculos de cadeia pendentes
      for (const relatedId of pendingLinks) {
        await tasksApi.linkTask(created.id, relatedId);
      }

      return created;
    },
    onSuccess: (data) => {
      if (!isEdit) localStorage.setItem(LAST_EXECUTOR_KEY, executor);
      if (selType)    incrementTagFrequency(selType);
      if (selCulture) incrementTagFrequency(selCulture);
      if (isEdit && task) {
        pushUndo({
          type: "update",
          taskId: task.id,
          previous: {
            title: task.title,
            description: task.description,
            executor: task.executor,
            scheduled_window_end: task.scheduled_window_end,
          },
          label: `"${task.title}" editada`,
        });
      }
      onSuccess(data?.id);
    },
  });

  const canSubmit = (baseTitle.trim().length >= 2 || selType !== null || selCulture !== null || isEdit)
    && !save.isPending;

  const titlePreview = buildTitle(baseTitle.trim() || "…", selType, selCulture);

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") { e.stopPropagation(); onClose(); }
        if (e.ctrlKey && e.key === "Enter" && canSubmit) { e.preventDefault(); save.mutate(); }
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-bold text-stone-800">
              {isEdit ? "Editar tarefa" : "Nova tarefa"}
            </h2>
            {(selType || selCulture) && (
              <span className="text-xs text-stone-400 font-mono truncate max-w-[220px]" title={titlePreview}>
                {titlePreview}
              </span>
            )}
          </div>

          {/* Responsável */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-1">
              Responsável
            </label>
            <select
              value={executor}
              onChange={(e) => setExecutor(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              {activePeople.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Type tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                Tipo de atividade
              </label>
              {selType && <button onClick={() => setSelType(null)} className="text-xs text-stone-400 hover:text-stone-600">Limpar</button>}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {typeTags.map((tag) => (
                <button key={tag} type="button"
                  onClick={() => setSelType(selType === tag ? null : tag)}
                  className={clsx(
                    "shrink-0 rounded border px-2.5 py-0.5 text-xs transition-colors",
                    selType === tag
                      ? "border-green-500 bg-green-100 text-green-800 font-medium"
                      : "border-stone-200 bg-stone-50 text-stone-600 hover:border-green-300"
                  )}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Culture tags */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                Cultura
              </label>
              {selCulture && <button onClick={() => setSelCulture(null)} className="text-xs text-stone-400 hover:text-stone-600">Limpar</button>}
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {cultureTags.map((tag) => (
                <button key={tag} type="button"
                  onClick={() => setSelCulture(selCulture === tag ? null : tag)}
                  className={clsx(
                    "shrink-0 rounded border px-2.5 py-0.5 text-xs transition-colors",
                    selCulture === tag
                      ? "border-amber-500 bg-amber-100 text-amber-800 font-medium"
                      : "border-stone-200 bg-stone-50 text-stone-600 hover:border-amber-300"
                  )}>
                  {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Local */}
          {ambientes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                  Local
                </label>
                {selAmbiente && <button onClick={() => setSelAmbiente(null)} className="text-xs text-stone-400 hover:text-stone-600">Limpar</button>}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {ambientes.map((a) => (
                  <button key={a.slug} type="button"
                    onClick={() => setSelAmbiente(selAmbiente === a.slug ? null : a.slug)}
                    className={clsx(
                      "shrink-0 rounded border px-2.5 py-0.5 text-xs transition-colors",
                      selAmbiente === a.slug
                        ? "border-[color:var(--amb-color)] bg-green-50 font-medium"
                        : "border-stone-200 bg-stone-50 text-stone-600 hover:border-green-300"
                    )}
                    style={selAmbiente === a.slug ? { "--amb-color": a.color, color: a.color } as React.CSSProperties : undefined}>
                    {a.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lote */}
          {lotes.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide">
                  Lote
                </label>
                {selLote && <button onClick={() => setSelLote(null)} className="text-xs text-stone-400 hover:text-stone-600">Limpar</button>}
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                {lotes.map((l) => (
                  <button key={l.slug} type="button"
                    onClick={() => setSelLote(selLote === l.slug ? null : l.slug)}
                    className={clsx(
                      "shrink-0 rounded border px-2.5 py-0.5 text-xs transition-colors",
                      selLote === l.slug
                        ? "border-blue-400 bg-blue-50 text-blue-700 font-medium"
                        : "border-stone-200 bg-stone-50 text-stone-600 hover:border-blue-300"
                    )}>
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Base title */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-1">
              {selType || selCulture ? "Detalhe adicional" : "Título *"}
            </label>
            <input type="text" value={baseTitle}
              onChange={(e) => setBaseTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) save.mutate(); }}
              placeholder={selType || selCulture ? "ex: talhão norte, lote 07, 1ª aplicação…" : "O que precisa ser feito?"}
              autoFocus
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-1">
              Descrição (opcional)
            </label>
            <textarea value={description ?? ""} onChange={(e) => setDescription(e.target.value)}
              placeholder="Contexto, observações, insumos…" rows={2}
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-1">
              Prazo{windowEnd && (
                <span className="ml-2 normal-case font-normal text-stone-400">
                  {new Date(windowEnd + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </span>
              )}
            </label>
            <input type="date" lang="pt-BR" value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
              className="w-full rounded-md border border-stone-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {/* Encadeamento */}
          <div>
            <button type="button" onClick={() => setShowChain(!showChain)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wide hover:text-stone-600 transition-colors">
              <svg className={clsx("h-3 w-3 transition-transform", showChain && "rotate-90")}
                viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 2l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Vincular à cadeia
              {(isEdit ? currentChains.length : pendingLinks.length) > 0 && (
                <span className="ml-1 bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-medium normal-case">
                  {isEdit ? currentChains.length : pendingLinks.length}
                </span>
              )}
            </button>

            {showChain && (
              <div className="mt-2 border border-stone-200 rounded-lg overflow-hidden">
                {/* Cadeias atuais (modo edição) */}
                {isEdit && currentChains.length > 0 && (
                  <div className="flex flex-wrap gap-1 p-2 border-b border-stone-200 bg-blue-50/50">
                    {currentChains.map((chain) => (
                      <span key={chain.chain_id}
                        className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2 py-0.5 text-xs text-blue-700">
                        cadeia {chain.position}/{chain.total}
                        <button
                          type="button"
                          onClick={() => unlinkTask.mutate({
                            otherId: chain.task_ids.find((id) => id !== task!.id) ?? "",
                          })}
                          className="text-blue-400 hover:text-blue-700 ml-0.5"
                        >✕</button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Links pendentes (modo criação) */}
                {!isEdit && pendingLinks.length > 0 && (
                  <div className="flex flex-wrap gap-1 p-2 border-b border-stone-200 bg-blue-50/50">
                    {pendingLinks.map((id) => {
                      const t = allTasks.find((t) => t.id === id) ?? chainTails.find((t) => t.id === id);
                      return (
                        <span key={id}
                          className="inline-flex items-center gap-1 rounded border border-blue-200 bg-white px-2 py-0.5 text-xs text-blue-700">
                          {t?.title ?? id}
                          <button type="button" onClick={() => setPendingLinks((p) => p.filter((d) => d !== id))}
                            className="text-blue-400 hover:text-blue-700 ml-0.5">✕</button>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="p-2 border-b border-stone-100">
                  <input type="text" value={chainSearch} onChange={(e) => setChainSearch(e.target.value)}
                    placeholder="Buscar tarefa para encadear…"
                    className="w-full rounded border border-stone-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                <div className="max-h-40 overflow-y-auto">
                  {chainCandidates.length === 0
                    ? <p className="text-xs text-stone-400 text-center py-3">Nenhuma tarefa encontrada</p>
                    : chainCandidates.map((t) => {
                      const alreadyLinked = isEdit
                        ? currentChains.some((c) => c.task_ids.includes(t.id))
                        : pendingLinks.includes(t.id);
                      const chainInfo = t.chains?.[0];
                      return (
                        <button key={t.id} type="button"
                          disabled={alreadyLinked}
                          onClick={() => {
                            if (isEdit && task) {
                              linkTask.mutate(t.id);
                            } else {
                              setPendingLinks((p) => [...p, t.id]);
                            }
                          }}
                          className={clsx(
                            "flex items-center gap-2 w-full px-3 py-1.5 text-xs text-left transition-colors",
                            alreadyLinked
                              ? "text-stone-300 cursor-default"
                              : "text-stone-700 hover:bg-stone-50"
                          )}
                        >
                          <span className={clsx(
                            "h-3.5 w-3.5 rounded border shrink-0",
                            alreadyLinked ? "border-blue-400 bg-blue-100" : "border-stone-300"
                          )} />
                          <span className="truncate flex-1">{t.title}</span>
                          {chainInfo && (
                            <span className="shrink-0 text-blue-400 font-medium">{chainInfo.position}/{chainInfo.total}</span>
                          )}
                        </button>
                      );
                    })
                  }
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 px-5 py-3 border-t border-stone-200">
          <button onClick={onClose}
            className="flex-1 rounded-md border border-stone-300 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 transition-colors">
            Cancelar
          </button>
          <button onClick={() => save.mutate()} disabled={!canSubmit}
            className="flex-1 rounded-md bg-green-600 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {save.isPending ? (isEdit ? "Salvando…" : "Criando…") : (isEdit ? "Salvar" : "Criar")}
          </button>
        </div>
      </div>
    </div>
  );
}
