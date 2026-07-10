// Offline queue for collection submissions.
// Entries are held in AsyncStorage keyed by a local temp id; server dedupes via client_temp_id.

import NetInfo from "@react-native-community/netinfo";
import { storage } from "@/src/utils/storage";
import { api, Collection } from "@/src/api/client";

export type QueueEntry = {
  temp_id: string;
  donor_name: string;
  donor_phone: string;
  amount: number;
  payment_mode: "cash" | "upi";
  address?: string;
  notes?: string;
  queued_at: string;
};

const QUEUE_KEY = "jbm_offline_queue";

async function readQueue(): Promise<QueueEntry[]> {
  const raw = await storage.getItem(QUEUE_KEY, "[]" as string);
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: QueueEntry[]): Promise<void> {
  await storage.setItem(QUEUE_KEY, JSON.stringify(items));
}

export async function enqueue(entry: Omit<QueueEntry, "temp_id" | "queued_at">): Promise<QueueEntry> {
  const q = await readQueue();
  const item: QueueEntry = {
    ...entry,
    temp_id: `tmp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    queued_at: new Date().toISOString(),
  };
  q.push(item);
  await writeQueue(q);
  return item;
}

export async function getPendingCount(): Promise<number> {
  const q = await readQueue();
  return q.length;
}

export async function getPending(): Promise<QueueEntry[]> {
  return readQueue();
}

export async function isOnline(): Promise<boolean> {
  const s = await NetInfo.fetch();
  return !!(s.isConnected && s.isInternetReachable !== false);
}

export async function syncQueue(
  token: string,
): Promise<{ synced: Collection[]; failed: number }> {
  const q = await readQueue();
  if (!q.length) return { synced: [], failed: 0 };
  const synced: Collection[] = [];
  const remaining: QueueEntry[] = [];
  for (const item of q) {
    try {
      const res = await api.createCollection(token, {
        donor_name: item.donor_name,
        donor_phone: item.donor_phone,
        amount: item.amount,
        payment_mode: item.payment_mode,
        address: item.address,
        notes: item.notes,
        client_temp_id: item.temp_id,
      });
      synced.push(res);
    } catch (e) {
      remaining.push(item);
    }
  }
  await writeQueue(remaining);
  return { synced, failed: remaining.length };
}

export function subscribeOnline(cb: (online: boolean) => void): () => void {
  const unsub = NetInfo.addEventListener((state) => {
    cb(!!(state.isConnected && state.isInternetReachable !== false));
  });
  return unsub;
}
