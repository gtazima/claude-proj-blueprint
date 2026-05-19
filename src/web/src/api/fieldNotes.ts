import { supabase } from "../lib/supabase";

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
    throw Object.assign(new Error(body.detail ?? res.statusText), { status: res.status });
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface FieldNote {
  id: string;
  content: string;
  entry_type: "manual" | "task_completed" | "feedback";
  source_task_id: string | null;
  culture: string | null;
  management_unit: string | null;
  executor: string | null;
  activity_type_slug: string | null;
  culture_slug: string | null;
  ambiente_slug: string | null;
  lote_slug: string | null;
  created_at: string;
}

export interface CreateFieldNotePayload {
  content: string;
  culture?: string | null;
  management_unit?: string | null;
  executor?: string | null;
  entry_type?: "manual" | "feedback";
}

export interface FieldNoteFilters {
  culture?: string;
  executor?: string;
  entry_type?: string;
  keyword?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export const fieldNotesApi = {
  list: (filters: FieldNoteFilters = {}) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    return request<FieldNote[]>(`/field-notes${qs ? `?${qs}` : ""}`);
  },

  create: (payload: CreateFieldNotePayload) =>
    request<FieldNote>("/field-notes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
