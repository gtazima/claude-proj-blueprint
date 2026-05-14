import { supabase } from "../lib/supabase";

const BASE = import.meta.env.VITE_API_URL || "/api";

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

export interface Person {
  id: string;
  name: string;
  slug: string;
  color: string;
  supabase_user_id: string | null;
  whatsapp_number: string | null;
  is_active: boolean;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  color: string;
}

export interface PersonCreate {
  name: string;
  slug: string;
  color?: string;
  supabase_user_id?: string;
  whatsapp_number?: string;
}

export interface PersonUpdate {
  name?: string;
  color?: string;
  supabase_user_id?: string;
  whatsapp_number?: string;
  is_active?: boolean;
}

export interface TagCreate {
  name: string;
  slug: string;
  color?: string;
}

export interface TagUpdate {
  name?: string;
  color?: string;
}

export const configApi = {
  listPeople: () => request<Person[]>("/config/people"),
  createPerson: (p: PersonCreate) =>
    request<Person>("/config/people", { method: "POST", body: JSON.stringify(p) }),
  updatePerson: (slug: string, p: PersonUpdate) =>
    request<Person>(`/config/people/${slug}`, { method: "PATCH", body: JSON.stringify(p) }),
  deletePerson: (slug: string) =>
    request<void>(`/config/people/${slug}`, { method: "DELETE" }),

  listActivityTypes: () => request<Tag[]>("/config/activity-types"),
  createActivityType: (t: TagCreate) =>
    request<Tag>("/config/activity-types", { method: "POST", body: JSON.stringify(t) }),
  updateActivityType: (slug: string, t: TagUpdate) =>
    request<Tag>(`/config/activity-types/${slug}`, { method: "PATCH", body: JSON.stringify(t) }),
  deleteActivityType: (slug: string) =>
    request<void>(`/config/activity-types/${slug}`, { method: "DELETE" }),

  listCultures: () => request<Tag[]>("/config/cultures"),
  createCulture: (t: TagCreate) =>
    request<Tag>("/config/cultures", { method: "POST", body: JSON.stringify(t) }),
  updateCulture: (slug: string, t: TagUpdate) =>
    request<Tag>(`/config/cultures/${slug}`, { method: "PATCH", body: JSON.stringify(t) }),
  deleteCulture: (slug: string) =>
    request<void>(`/config/cultures/${slug}`, { method: "DELETE" }),
};
