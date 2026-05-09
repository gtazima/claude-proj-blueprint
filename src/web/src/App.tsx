import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout.tsx";
import AgendaPage from "./pages/Agenda.tsx";
import TarefasPage from "./pages/Today.tsx";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"        element={<Navigate to="/tarefas" replace />} />
        <Route path="/hoje"    element={<Navigate to="/tarefas" replace />} />
        <Route path="/agenda"  element={<AgendaPage />} />
        <Route path="/tarefas" element={<TarefasPage />} />
      </Routes>
    </Layout>
  );
}
