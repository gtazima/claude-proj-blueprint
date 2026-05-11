import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar com Google");
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

        <h1 className="text-sm font-semibold text-stone-800 mb-1">Entrar na propriedade</h1>
        <p className="text-xs text-stone-400 mb-6">Acesso restrito aos membros da equipe.</p>

        {/* Google */}
        <button
          type="button"
          onClick={handleGoogle}
          className="w-full flex items-center justify-center gap-2 border border-stone-200 rounded-lg px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors mb-4"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Entrar com Google
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-stone-100" />
          <span className="text-xs text-stone-400">ou</span>
          <div className="flex-1 h-px bg-stone-100" />
        </div>

        {/* Email + senha */}
        <form onSubmit={handleEmail} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="w-full border border-stone-200 rounded-md px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="seu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-600 mb-1">Senha</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
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
            {loading ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
