import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import clsx from "clsx";
import { useAuth } from "../contexts/AuthContext";

const MODULES = [
  {
    to: "/agenda",
    label: "Agenda",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
        <rect x="3" y="4" width="14" height="14" rx="2" strokeLinecap="round" />
        <path d="M7 2v4M13 2v4M3 9h14" strokeLinecap="round" />
        <path d="M7 13h2M11 13h2M7 16h2" strokeLinecap="round" />
      </svg>
    ),
    ready: true,
  },
  {
    to: "/tarefas",
    label: "Tarefas",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
        <rect x="3" y="3" width="14" height="14" rx="2" />
        <path d="M3 8h14M8 3v14" strokeLinecap="round" />
      </svg>
    ),
    ready: true,
  },
  {
    to: "/culturas",
    label: "Culturas",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
        <path d="M10 17V9M10 9C10 9 6 7 4 3c3 0 6 2 6 6zM10 9c0 0 4-2 6-6-3 0-6 2-6 6z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    ready: false,
  },
  {
    to: "/caderno",
    label: "Caderno de campo",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
        <rect x="4" y="2" width="12" height="16" rx="1.5" />
        <path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round" />
      </svg>
    ),
    ready: true,
  },
  {
    to: "/mapa",
    label: "Mapa",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
        <path d="M7 3L2 5v12l5-2 6 2 5-2V3l-5 2-6-2z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M7 3v12M13 5v12" strokeLinecap="round" />
      </svg>
    ),
    ready: false,
  },
  {
    to: "/manutencao",
    label: "Manutenção",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
        <path d="M14.5 3.5a3 3 0 00-4.24 4.24L3.5 14.5a1.5 1.5 0 002.12 2.12l6.76-6.76a3 3 0 004.24-4.24l-2.12 2.12-1.42-1.42 2.12-2.12z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    ready: false,
  },
  {
    to: "/financeiro",
    label: "Financeiro",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
        <path d="M10 3v14M6 6h6a2 2 0 010 4H8a2 2 0 000 4h7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    ready: false,
  },
  {
    to: "/vendas",
    label: "Vendas",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4">
        <path d="M3 3h2l.4 2M7 13h10l2-8H5.4M7 13L5.4 5M7 13a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    ready: false,
  },
] as const;

interface Props {
  children: ReactNode;
}

export default function Layout({ children }: Props) {
  const { user, signOut } = useAuth();

  return (
    <div className="flex h-screen bg-stone-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-44 bg-white border-r border-stone-200 flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-stone-100">
          <span className="text-sm font-bold text-green-700 tracking-tight">AgroecologIA</span>
        </div>

        <nav className="flex-1 py-2 overflow-y-auto">
          {MODULES.map((mod) =>
            mod.ready ? (
              <NavLink
                key={mod.to}
                to={mod.to}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-2.5 px-3 py-1.5 mx-1 rounded-md text-sm transition-colors",
                    isActive
                      ? "bg-green-50 text-green-800 font-medium"
                      : "text-stone-600 hover:bg-stone-50"
                  )
                }
              >
                {mod.icon}
                {mod.label}
              </NavLink>
            ) : (
              <div
                key={mod.to}
                title="Em desenvolvimento"
                className="flex items-center gap-2.5 px-3 py-1.5 mx-1 rounded-md text-sm text-stone-300 cursor-default select-none"
              >
                {mod.icon}
                {mod.label}
              </div>
            )
          )}
        </nav>

        <div className="px-3 py-3 border-t border-stone-100">
          <p className="text-xs text-stone-500 font-medium truncate mb-2" title={user?.email}>
            {user?.email}
          </p>
          <NavLink
            to="/configuracoes"
            className={({ isActive }) =>
              `block text-xs mb-1 transition-colors ${isActive ? "text-stone-700 font-medium" : "text-stone-400 hover:text-stone-600"}`
            }
          >
            Configurações
          </NavLink>
          <button
            onClick={() => void signOut()}
            className="w-full text-left text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">{children}</div>
    </div>
  );
}
