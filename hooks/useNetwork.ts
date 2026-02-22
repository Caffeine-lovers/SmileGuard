import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import {
  isOnline,
  syncPendingTransactions,
  getPendingCount,
  getLastSyncTime,
  SyncResult,
} from "../lib/syncService";

export interface NetworkStatus {
  isConnected: boolean | null;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncTime: string | null;
  pendingCount: number;
  lastSyncResult: SyncResult | null;
}

export function useNetwork() {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isConnected: null,
  });

  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    isSyncing: false,
    lastSyncTime: null,
    pendingCount: 0,
    lastSyncResult: null,
  });

  const appState = useRef(AppState.currentState);
  const checkInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check network status by trying to reach the server
  const checkNetworkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const online = await isOnline();
      setNetworkStatus({ isConnected: online });
      return online;
    } catch {
      setNetworkStatus({ isConnected: false });
      return false;
    }
  }, []);

  // Update pending count
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setSyncStatus((prev) => ({ ...prev, pendingCount: count }));
    } catch (error) {
      console.error("Error updating pending count:", error);
    }
  }, []);

  // Update last sync time
  const updateLastSyncTime = useCallback(async () => {
    try {
      const time = await getLastSyncTime();
      setSyncStatus((prev) => ({ ...prev, lastSyncTime: time }));
    } catch (error) {
      console.error("Error updating last sync time:", error);
    }
  }, []);

  // Perform sync
  const performSync = useCallback(async (): Promise<SyncResult> => {
    if (syncStatus.isSyncing) {
      return { 
        success: false, 
        syncedCount: 0, 
        failedCount: 0, 
        errors: ["Sync already in progress"] 
      };
    }

    setSyncStatus((prev) => ({ ...prev, isSyncing: true }));

    try {
      // Check if online
      const online = await isOnline();
      if (!online) {
        const result: SyncResult = {
          success: false,
          syncedCount: 0,
          failedCount: 0,
          errors: ["No internet connection"],
        };
        setSyncStatus((prev) => ({
          ...prev,
          isSyncing: false,
          lastSyncResult: result,
        }));
        return result;
      }

      // Perform sync
      const result = await syncPendingTransactions();

      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncResult: result,
        pendingCount: result.failedCount,
      }));

      await updateLastSyncTime();
      await updatePendingCount();
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Sync failed";
      const result: SyncResult = {
        success: false,
        syncedCount: 0,
        failedCount: 0,
        errors: [errorMessage],
      };
      setSyncStatus((prev) => ({
        ...prev,
        isSyncing: false,
        lastSyncResult: result,
      }));
      return result;
    }
  }, [syncStatus.isSyncing, updateLastSyncTime, updatePendingCount]);

  // Set up periodic network checks and app state listeners
  useEffect(() => {
    // Initial checks
    checkNetworkStatus();
    updatePendingCount();
    updateLastSyncTime();

    // Check network status periodically (every 30 seconds)
    checkInterval.current = setInterval(() => {
      checkNetworkStatus();
      updatePendingCount();
    }, 30000);

    // Listen for app state changes (foreground/background)
    const subscription = AppState.addEventListener(
      "change",
      async (nextAppState: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === "active"
        ) {
          // App came to foreground - check network and sync
          console.log("App came to foreground - checking network...");
          const online = await checkNetworkStatus();
          if (online) {
            await performSync();
          }
        } else if (
          appState.current === "active" &&
          nextAppState.match(/inactive|background/)
        ) {
          // App going to background
          console.log("App going to background");
        }

        appState.current = nextAppState;
      }
    );

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
      subscription.remove();
    };
  }, [
    checkNetworkStatus,
    updatePendingCount,
    updateLastSyncTime,
    performSync,
  ]);

  return {
    networkStatus,
    syncStatus,
    checkNetworkStatus,
    performSync,
    updatePendingCount,
  };
}
