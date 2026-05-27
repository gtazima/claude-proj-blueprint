import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { UndoProvider } from "./contexts/UndoContext.tsx";
import Layout from "./components/Layout.tsx";
import LoginPage from "./pages/Login.tsx";
import AgendaPage from "./pages/Agenda.tsx";
import CadernoPage from "./pages/Caderno.tsx";
import TarefasPage from "./pages/Today.tsx";
import SettingsPage from "./pages/Settings.tsx";
import GoogleCallbackPage from "./pages/GoogleCallback.tsx";
import ComprasPage from "./pages/Compras.tsx";
import ResetPasswordPage from "./pages/ResetPassword.tsx";

function ProtectedRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;

  return (
    <UndoProvider>
    <Layout>
      <Routes>
        <Route path="/"                               element={<Navigate to="/tarefas" replace />} />
        <Route path="/hoje"                           element={<Navigate to="/tarefas" replace />} />
        <Route path="/agenda"                         element={<AgendaPage />} />
        <Route path="/caderno"                        element={<CadernoPage />} />
        <Route path="/tarefas"                        element={<TarefasPage />} />
        <Route path="/compras"                        element={<ComprasPage />} />
        <Route path="/configuracoes"                  element={<SettingsPage />} />
        <Route path="/configuracoes/google/callback"  element={<GoogleCallbackPage />} />
      </Routes>
    </Layout>
    </UndoProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login"            element={<LoginWithRedirect />} />
        {/* Rota pública — callback do e-mail de redefinição de senha */}
        <Route path="/redefinir-senha"  element={<ResetPasswordPage />} />
        <Route path="/*"                element={<ProtectedRoutes />} />
      </Routes>
    </AuthProvider>
  );
}

function LoginWithRedirect() {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) return <Navigate to="/tarefas" replace />;
  return <LoginPage />;
}
