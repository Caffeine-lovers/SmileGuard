import AsyncStorageLib from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

// @ts-ignore - AsyncStorage type mismatch across different React Native versions
const AsyncStorage = AsyncStorageLib.default || AsyncStorageLib;

export interface PendingTransaction {
  id: string;
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  failedCount: number;
  errors: string[];
}

const PENDING_TRANSACTIONS_KEY = "@smileguard_pending_transactions";
const LAST_SYNC_KEY            = "@smileguard_last_sync";

const generateId = (): string =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// ─────────────────────────────────────────
// FIX: isOnline no longer depends on the profiles table query.
// Previously, any RLS error or permission issue on profiles
// caused isOnline() to return false → every booking saved offline
// instead of Supabase, silently.
// Now uses a lightweight HEAD request to the Supabase REST endpoint.
// ─────────────────────────────────────────
export const isOnline = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      "https://yffvnvusiazjnwmdylji.supabase.co/rest/v1/",
      { method: "HEAD", signal: controller.signal }
    );
    clearTimeout(timeout);
    return response.status < 500;
  } catch {
    return false;
  }
};

export const getPendingTransactions = async (): Promise<PendingTransaction[]> => {
  try {
    const data = await AsyncStorage.getItem(PENDING_TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting pending transactions:", error);
    return [];
  }
};

export const saveTransactionLocally = async (
  table: string,
  operation: "INSERT" | "UPDATE" | "DELETE",
  data: Record<string, unknown>
): Promise<string> => {
  const transaction: PendingTransaction = {
    id: generateId(),
    table,
    operation,
    data,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };

  try {
    const pending = await getPendingTransactions();
    pending.push(transaction);
    await AsyncStorage.setItem(PENDING_TRANSACTIONS_KEY, JSON.stringify(pending));
    return transaction.id;
  } catch (error) {
    console.error("Error saving transaction locally:", error);
    throw new Error("Failed to save transaction. Please try again.");
  }
};

export const syncPendingTransactions = async (): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  const pending = await getPendingTransactions();
  if (pending.length === 0) return result;

  const online = await isOnline();
  if (!online) {
    result.success = false;
    result.errors.push("No internet connection. Transactions will sync when online.");
    return result;
  }

  const remainingTransactions: PendingTransaction[] = [];

  for (const transaction of pending) {
    try {
      let error = null;

      switch (transaction.table) {
        case "appointments":
          if (transaction.operation === "INSERT") {
            const { error: e } = await supabase.from("appointments").insert(transaction.data);
            error = e;
          } else if (transaction.operation === "UPDATE") {
            const { error: e } = await supabase.from("appointments").update(transaction.data).eq("id", transaction.data.id);
            error = e;
          } else if (transaction.operation === "DELETE") {
            const { error: e } = await supabase.from("appointments").delete().eq("id", transaction.data.id);
            error = e;
          }
          break;

        case "patients":
          if (transaction.operation === "INSERT") {
            const { error: e } = await supabase.from("patients").insert(transaction.data);
            error = e;
          } else if (transaction.operation === "UPDATE") {
            const { error: e } = await supabase.from("patients").update(transaction.data).eq("id", transaction.data.id);
            error = e;
          } else if (transaction.operation === "DELETE") {
            const { error: e } = await supabase.from("patients").delete().eq("id", transaction.data.id);
            error = e;
          }
          break;

        case "treatments":
          if (transaction.operation === "INSERT") {
            const { error: e } = await supabase.from("treatments").insert(transaction.data);
            error = e;
          } else if (transaction.operation === "UPDATE") {
            const { error: e } = await supabase.from("treatments").update(transaction.data).eq("id", transaction.data.id);
            error = e;
          } else if (transaction.operation === "DELETE") {
            const { error: e } = await supabase.from("treatments").delete().eq("id", transaction.data.id);
            error = e;
          }
          break;

        case "billings":
          if (transaction.operation === "INSERT") {
            const { error: e } = await supabase.from("billings").insert(transaction.data);
            error = e;
          } else if (transaction.operation === "UPDATE") {
            const { error: e } = await supabase.from("billings").update(transaction.data).eq("id", transaction.data.id);
            error = e;
          }
          break;

        default:
          result.errors.push(`Unknown table: ${transaction.table}`);
          result.failedCount++;
          continue;
      }

      if (error) {
        if (transaction.retryCount < 3) {
          transaction.retryCount++;
          remainingTransactions.push(transaction);
        }
        result.errors.push(`Failed to sync ${transaction.table}: ${error.message}`);
        result.failedCount++;
      } else {
        result.syncedCount++;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      result.errors.push(`Error syncing ${transaction.table}: ${errorMessage}`);
      result.failedCount++;
      if (transaction.retryCount < 3) {
        transaction.retryCount++;
        remainingTransactions.push(transaction);
      }
    }
  }

  await AsyncStorage.setItem(PENDING_TRANSACTIONS_KEY, JSON.stringify(remainingTransactions));
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  result.success = result.failedCount === 0;
  return result;
};

export const getLastSyncTime = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
};

export const clearPendingTransactions = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PENDING_TRANSACTIONS_KEY);
  } catch (error) {
    console.error("Error clearing pending transactions:", error);
  }
};

export const getPendingCount = async (): Promise<number> => {
  const pending = await getPendingTransactions();
  return pending.length;
};

export const hasPendingTransactions = async (): Promise<boolean> => {
  const count = await getPendingCount();
  return count > 0;
};