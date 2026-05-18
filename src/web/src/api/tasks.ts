export type Executor = string;

export interface Task {
  id: string;
  title: string;
  description: string | null;
  executor: string;
  scheduled_window_start: string | null;
  scheduled_window_end: string | null;
  financial_score: number;
  dependency_ids: string[];
  deferral_count: number;
  last_deferral_reason: string | null;
  completed_at: string | null;
  repeatedly_deferred: boolean;
  created_at: string;
  updated_at: string;
  is_pending_review: boolean;
  duration_minutes: number | null;
}

export interface TaskWithPriority extends Task {
  priority_score: number;
}

export interface CreateTaskPayload {
  title: string;
  executor: Executor;
  financial_score: number;
  scheduled_window_end?: string;
  description?: string;
  dependency_ids?: string[];
}

export interface DeferTaskPayload {
  new_scheduled_window_start: string;
  reason: string;
}

export interface TaskUpdatePayload {
  title?: string;
  executor?: Executor;
  scheduled_window_end?: string | null;
  description?: string | null;
  dependency_ids?: string[];
}

import { supabase } from "../lib/supabase";

// Em dev o proxy do Vite resolve /api → localhost:8000.
// Em produção, VITE_API_URL aponta para https://agroecologia.onrender.com/api/v1
const BASE = import.meta.env.VITE_API_URL || "/api/v1";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw Object.assign(new Error(body.detail ?? res.statusText), {
      status: res.status,
    });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const tasksApi = {
  listToday: () => request<TaskWithPriority[]>("/tasks/today"),

  listPendingReview: () => request<Task[]>("/tasks/pending-review"),

  confirmReview: (id: string) =>
    request<Task>(`/tasks/${id}/confirm-review`, { method: "POST" }),

  discardReview: (id: string) =>
    request<void>(`/tasks/${id}/discard-review`, { method: "POST" }),

  listCompletedToday: () => request<Task[]>("/tasks/completed-today"),

  get: (id: string) => request<Task>(`/tasks/${id}`),

  create: (payload: CreateTaskPayload) =>
    request<Task>("/tasks", { method: "POST", body: JSON.stringify(payload) }),

  complete: (id: string, observation?: string) =>
    request<Task>(`/tasks/${id}/complete`, {
      method: "POST",
      ...(observation !== undefined ? { body: JSON.stringify({ observation }) } : {}),
    }),

  uncomplete: (id: string) =>
    request<Task>(`/tasks/${id}/uncomplete`, { method: "POST" }),

  defer: (id: string, payload: DeferTaskPayload) =>
    request<Task>(`/tasks/${id}/defer`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  update: (id: string, payload: TaskUpdatePayload) =>
    request<Task>(`/tasks/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  listUpcoming: (days: number) =>
    request<TaskWithPriority[]>(`/tasks/upcoming?days=${days}`),

  softDelete: (id: string) =>
    request<void>(`/tasks/${id}`, { method: "DELETE" }),

  restore: (id: string) =>
    request<Task>(`/tasks/${id}/restore`, { method: "POST" }),
};
