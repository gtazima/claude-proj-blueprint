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

export interface PurchaseLink {
  id: string;
  url: string;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  name: string;
  notes: string | null;
  status: "to_buy" | "bought";
  created_at: string;
  bought_at: string | null;
  links: PurchaseLink[];
}

export interface CreatePurchasePayload {
  name: string;
  notes?: string | null;
  links?: string[];
}

export interface UpdatePurchasePayload {
  name?: string;
  notes?: string | null;
}

export const purchaseApi = {
  list: (status?: "to_buy" | "bought", keyword?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (keyword) params.set("keyword", keyword);
    const qs = params.toString();
    return request<PurchaseItem[]>(`/purchase-items${qs ? `?${qs}` : ""}`);
  },

  get: (id: string) => request<PurchaseItem>(`/purchase-items/${id}`),

  create: (payload: CreatePurchasePayload) =>
    request<PurchaseItem>("/purchase-items", { method: "POST", body: JSON.stringify(payload) }),

  update: (id: string, payload: UpdatePurchasePayload) =>
    request<PurchaseItem>(`/purchase-items/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),

  delete: (id: string) =>
    request<void>(`/purchase-items/${id}`, { method: "DELETE" }),

  markBought: (id: string) =>
    request<PurchaseItem>(`/purchase-items/${id}/buy`, { method: "POST" }),

  markToBuy: (id: string) =>
    request<PurchaseItem>(`/purchase-items/${id}/unbuy`, { method: "POST" }),

  addLink: (id: string, url: string) =>
    request<PurchaseLink>(`/purchase-items/${id}/links`, {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  removeLink: (id: string, linkId: string) =>
    request<void>(`/purchase-items/${id}/links/${linkId}`, { method: "DELETE" }),
};
