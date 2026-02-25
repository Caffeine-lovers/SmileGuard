import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase.ts";

// Types for sync operations
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

// Storage keys
const PENDING_TRANSACTIONS_KEY = "@smileguard_pending_transactions";
const LAST_SYNC_KEY = "@smileguard_last_sync";
const IS_ONLINE_KEY = "@smileguard_is_online";

// Generate unique ID for transactions
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Check if device is online
export const isOnline = async (): Promise<boolean> => {
  try {
    // Try to ping Supabase
    const { error } = await supabase.from("profiles").select("id").limit(1);
    await AsyncStorage.setItem(IS_ONLINE_KEY, "true");
    return !error;
  } catch {
    await AsyncStorage.setItem(IS_ONLINE_KEY, "false");
    return false;
  }
};

// Get pending transactions from local storage
export const getPendingTransactions = async (): Promise<PendingTransaction[]> => {
  try {
    const data = await AsyncStorage.getItem(PENDING_TRANSACTIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error getting pending transactions:", error);
    return [];
  }
};

// Save transaction to local storage (for offline use)
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

// Sync all pending transactions to the cloud
export const syncPendingTransactions = async (): Promise<SyncResult> => {
  const result: SyncResult = {
    success: true,
    syncedCount: 0,
    failedCount: 0,
    errors: [],
  };

  const pending = await getPendingTransactions();
  
  if (pending.length === 0) {
    return result;
  }

  // Check if online first
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
            const { error: insertError } = await supabase
              .from("appointments")
              .insert(transaction.data);
            error = insertError;
          } else if (transaction.operation === "UPDATE") {
            const { error: updateError } = await supabase
              .from("appointments")
              .update(transaction.data)
              .eq("id", transaction.data.id);
            error = updateError;
          } else if (transaction.operation === "DELETE") {
            const { error: deleteError } = await supabase
              .from("appointments")
              .delete()
              .eq("id", transaction.data.id);
            error = deleteError;
          }
          break;

        case "patients":
          if (transaction.operation === "INSERT") {
            const { error: insertError } = await supabase
              .from("patients")
              .insert(transaction.data);
            error = insertError;
          } else if (transaction.operation === "UPDATE") {
            const { error: updateError } = await supabase
              .from("patients")
              .update(transaction.data)
              .eq("id", transaction.data.id);
            error = updateError;
          } else if (transaction.operation === "DELETE") {
            const { error: deleteError } = await supabase
              .from("patients")
              .delete()
              .eq("id", transaction.data.id);
            error = deleteError;
          }
          break;

        case "treatments":
          if (transaction.operation === "INSERT") {
            const { error: insertError } = await supabase
              .from("treatments")
              .insert(transaction.data);
            error = insertError;
          } else if (transaction.operation === "UPDATE") {
            const { error: updateError } = await supabase
              .from("treatments")
              .update(transaction.data)
              .eq("id", transaction.data.id);
            error = updateError;
          } else if (transaction.operation === "DELETE") {
            const { error: deleteError } = await supabase
              .from("treatments")
              .delete()
              .eq("id", transaction.data.id);
            error = deleteError;
          }
          break;

        case "billings":
          if (transaction.operation === "INSERT") {
            const { error: insertError } = await supabase
              .from("billings")
              .insert(transaction.data);
            error = insertError;
          } else if (transaction.operation === "UPDATE") {
            const { error: updateError } = await supabase
              .from("billings")
              .update(transaction.data)
              .eq("id", transaction.data.id);
            error = updateError;
          }
          break;

        default:
          result.errors.push(`Unknown table: ${transaction.table}`);
          result.failedCount++;
          continue;
      }

      if (error) {
        // Increment retry count and keep if under limit
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
      
      // Keep transaction for retry if under limit
      if (transaction.retryCount < 3) {
        transaction.retryCount++;
        remainingTransactions.push(transaction);
      }
    }
  }

  // Save remaining transactions back to storage
  await AsyncStorage.setItem(
    PENDING_TRANSACTIONS_KEY,
    JSON.stringify(remainingTransactions)
  );

  // Update last sync time
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());

  result.success = result.failedCount === 0;
  return result;
};

// Get last sync time
export const getLastSyncTime = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(LAST_SYNC_KEY);
  } catch {
    return null;
  }
};

// Clear all pending transactions (after successful sync)
export const clearPendingTransactions = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PENDING_TRANSACTIONS_KEY);
  } catch (error) {
    console.error("Error clearing pending transactions:", error);
  }
};

// Get count of pending transactions
export const getPendingCount = async (): Promise<number> => {
  const pending = await getPendingTransactions();
  return pending.length;
};

// Check if there are pending transactions
export const hasPendingTransactions = async (): Promise<boolean> => {
  const count = await getPendingCount();
  return count > 0;
};

