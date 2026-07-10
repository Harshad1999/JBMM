import Constants from "expo-constants";

const runtimeExtra =
  (Constants.expoConfig?.extra as Record<string, string> | undefined) ?? {};

const rawBase =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  runtimeExtra.EXPO_PUBLIC_BACKEND_URL ||
  "";

export const API_BASE = rawBase.replace(/\/+$/, "") + "/api";

export type Role = "admin" | "volunteer";

export interface AppUser {
  user_id: string;
  name: string;
  email: string;
  picture?: string | null;
  role: Role;
  active: boolean;
  created_at: string;
}

export interface Collection {
  id: string;
  receipt_no: string;
  donor_name: string;
  donor_phone: string;
  amount: number;
  payment_mode: "cash" | "upi";
  address: string;
  notes: string;
  collector_id: string;
  collector_name: string;
  created_at: string;
  status: string;
}

async function request<T>(
  path: string,
  opts: {
    method?: string;
    body?: unknown;
    token?: string | null;
    query?: Record<string, string | undefined>;
  } = {},
): Promise<T> {
  const { method = "GET", body, token, query } = opts;
  let url = `${API_BASE}${path}`;
  if (query) {
    const usp = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") usp.append(k, v);
    });
    const qs = usp.toString();
    if (qs) url += `?${qs}`;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {}
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export const api = {
  authSession: (id_token: string) =>
    request<{ session_token: string; user: AppUser }>("/auth/session", {
      method: "POST",
      body: { id_token },
    }),
  me: (token: string) => request<AppUser>("/auth/me", { token }),
  logout: (token: string) =>
    request<{ ok: boolean }>("/auth/logout", { method: "POST", token }),
  listUsers: (token: string) => request<AppUser[]>("/users", { token }),
  setRole: (token: string, uid: string, role: Role) =>
    request<AppUser>(`/users/${uid}/role`, {
      method: "PATCH",
      body: { role },
      token,
    }),
  setActive: (token: string, uid: string, active: boolean) =>
    request<AppUser>(`/users/${uid}/active`, {
      method: "PATCH",
      body: { active },
      token,
    }),
  createCollection: (
    token: string,
    payload: {
      donor_name: string;
      donor_phone: string;
      amount: number;
      payment_mode: "cash" | "upi";
      address?: string;
      notes?: string;
      client_temp_id?: string;
    },
  ) =>
    request<Collection>("/collections", {
      method: "POST",
      body: payload,
      token,
    }),
  listCollections: (
    token: string,
    q: {
      start?: string;
      end?: string;
      volunteer_id?: string;
      payment_mode?: string;
      search?: string;
    } = {},
  ) => request<Collection[]>("/collections", { token, query: q }),
  getCollection: (token: string, id: string) =>
    request<Collection>(`/collections/${id}`, { token }),
  dashboard: (token: string) =>
    request<{
      total: { amount: number; count: number };
      today: { amount: number; count: number };
      week: { amount: number; count: number };
      by_mode: {
        cash: { total: number; count: number };
        upi: { total: number; count: number };
      };
      leaderboard: {
        user_id: string;
        name: string;
        total: number;
        count: number;
      }[];
    }>("/dashboard/stats", { token }),
  exportUrl: (token: string) => `${API_BASE}/collections/export.csv`,
};
