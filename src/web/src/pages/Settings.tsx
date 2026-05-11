import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsApi } from "../api/settings";

export default function SettingsPage() {
  const qc = useQueryClient();

  const { data: googleStatus, isLoading } = useQuery({
    queryKey: ["settings", "google"],
    queryFn: settingsApi.googleStatus,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      const { url } = await settingsApi.googleAuthUrl();
      window.location.href = url;
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: settingsApi.googleDisconnect,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["settings", "google"] }),
  });

  return (
    <div className="flex flex-col h-full overflow-auto">
      <header className="bg-white border-b border-stone-200 shrink-0">
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-stone-700 text-white shrink-0">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                <circle cx="8" cy="8" r="2.5" />
                <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M11.54 4.46l-1.41 1.41M4.95 11.05l-1.41 1.41" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-sm font-bold text-stone-900">Configurações</h1>
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 max-w-xl">
        <section className="bg-white rounded-xl border border-stone-200 p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-blue-50 shrink-0">
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-semibold text-stone-900">Conta Google da propriedade</h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Sincroniza tarefas com Google Tasks e importa eventos do Google Calendar.
              </p>
            </div>
          </div>

          {isLoading ? (
            <div className="h-8 bg-stone-100 rounded animate-pulse" />
          ) : googleStatus?.connected ? (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs text-stone-700 truncate">{googleStatus.email}</span>
                {googleStatus.sync_enabled && (
                  <span className="text-[11px] text-stone-400">(sync ativo)</span>
                )}
              </div>
              <button
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
                className="shrink-0 text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
              >
                Desconectar
              </button>
            </div>
          ) : (
            <button
              onClick={() => connectMutation.mutate()}
              disabled={connectMutation.isPending}
              className="flex items-center gap-2 text-xs font-medium bg-stone-900 text-white px-3 py-2 rounded-lg hover:bg-stone-700 transition-colors disabled:opacity-50"
            >
              {connectMutation.isPending ? "Redirecionando..." : "Conectar conta Google"}
            </button>
          )}
        </section>
      </div>
    </div>
  );
}
