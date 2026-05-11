import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { settingsApi } from "../api/settings";

export default function GoogleCallbackPage() {
  const navigate = useNavigate();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const error = params.get("error");

    if (error || !code) {
      navigate("/configuracoes?error=google_auth_failed", { replace: true });
      return;
    }

    settingsApi
      .googleConnect(code)
      .then(() => navigate("/configuracoes?connected=true", { replace: true }))
      .catch(() => navigate("/configuracoes?error=google_connect_failed", { replace: true }));
  }, [navigate]);

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-stone-500">Conectando conta Google…</p>
      </div>
    </div>
  );
}
