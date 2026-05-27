import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

type Stage = "loading" | "ready" | "success" | "invalid";

export default function ResetPasswordPage() {
  const navigate           = useNavigate();
  const { updatePassword } = useAuth();
  const [stage, setStage]         = useState<Stage>("loading");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  // Supabase processa o hash #access_token=...&type=recovery automaticamente
  // e emite PASSWORD_RECOVERY via onAuthStateChange
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setStage("ready");
      }
    });

    // Timeout: se não receber PASSWORD_RECOVERY em 5s, o link é inválido
    const timeout = setTimeout(() => {
      setStage((prev) => prev === "loading" ? "invalid" : prev);
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(newPassword);
      setStage("success");
      // Redireciona para o app após 2s
      setTimeout(() => navigate("/tarefas", { replace: true }), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-xl border border-stone-200 shadow-sm p-8">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-green-600 text-white shrink-0">
            <svg className="h-4.5 w-4.5" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
              <path d="M10 17V9M10 9C10 9 6 7 4 3c3 0 6 2 6 6zM10 9c0 0 4-2 6-6-3 0-6 2-6 6z"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-base font-bold text-green-700 tracking-tight">AgroecologIA</span>
        </div>

        {/* ── Loading ────────────────────────────────────────── */}
        {stage === "loading" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-stone-400">Verificando link…</p>
          </div>
        )}

        {/* ── Inválido ───────────────────────────────────────── */}
        {stage === "invalid" && (
          <>
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-red-50 mb-4">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M6 6l8 8M14 6l-8 8" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-sm font-semibold text-stone-800 mb-1">Link inválido ou expirado</h1>
            <p className="text-xs text-stone-500 mb-6">
              Este link de redefinição não é mais válido. Links expiram após 24 horas ou após o primeiro uso.
            </p>
            <button
              type="button"
              onClick={() => navigate("/login", { replace: true })}
              className="w-full bg-green-600 text-white text-sm font-medium rounded-md px-4 py-2 hover:bg-green-700 transition-colors"
            >
              Voltar ao login
            </button>
          </>
        )}

        {/* ── Formulário ─────────────────────────────────────── */}
        {stage === "ready" && (
          <>
            <h1 className="text-sm font-semibold text-stone-800 mb-1">Criar nova senha</h1>
            <p className="text-xs text-stone-400 mb-6">Escolha uma senha com pelo menos 6 caracteres.</p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoFocus
                  minLength={6}
                  className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-600 mb-1">Confirmar senha</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white text-sm font-medium rounded-md px-4 py-2 hover:bg-green-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
              >
                {loading ? "Salvando…" : "Salvar nova senha"}
              </button>
            </form>
          </>
        )}

        {/* ── Sucesso ────────────────────────────────────────── */}
        {stage === "success" && (
          <>
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-50 mb-4">
              <svg className="h-5 w-5 text-green-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.75">
                <path d="M4 10l4 4 8-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className="text-sm font-semibold text-stone-800 mb-1">Senha atualizada</h1>
            <p className="text-xs text-stone-500">Redirecionando para o app…</p>
          </>
        )}
      </div>
    </div>
  );
}
