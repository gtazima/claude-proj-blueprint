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

export interface GoogleStatus {
  connected: boolean;
  email: string | null;
  sync_enabled?: boolean;
}

export const settingsApi = {
  googleStatus: () => request<GoogleStatus>("/settings/google/status"),

  googleAuthUrl: () => request<{ url: string }>("/settings/google/auth-url"),

  googleConnect: (code: string) =>
    request<{ connected: boolean; email: string }>("/settings/google/connect", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  googleDisconnect: () =>
    request<void>("/settings/google/disconnect", { method: "DELETE" }),
};
