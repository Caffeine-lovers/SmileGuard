import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
  Platform,
  Modal,
} from 'react-native';
// Safely load expo-updates: in Expo Go or dev environments where the native
// module is not linked, requireNativeModule('ExpoUpdates') throws an uncaught exception.
let Updates: typeof import('expo-updates') | null = null;
try {
  Updates = require('expo-updates');
} catch {
  Updates = null;
}
import {
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowDownCircle,
  X,
} from 'lucide-react-native';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'ready'
  | 'up-to-date'
  | 'error';

// Simple global listener to allow triggering from Settings or anywhere in the app
type UpdateListener = (status: UpdateStatus, message?: string) => void;
const listeners = new Set<UpdateListener>();

export const notifyUpdateListeners = (status: UpdateStatus, message?: string) => {
  listeners.forEach((listener) => listener(status, message));
};

let globalTriggerCheck: ((interactive?: boolean) => Promise<void>) | null = null;

export const triggerManualUpdateCheck = (interactive = true) => {
  if (globalTriggerCheck) {
    return globalTriggerCheck(interactive);
  }
  return Promise.resolve();
};

export default function AppUpdateManager() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showReadyModal, setShowReadyModal] = useState<boolean>(false);
  const [isInteractive, setIsInteractive] = useState<boolean>(false);
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);

  const showBanner = () => {
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 60,
      friction: 9,
    }).start();
  };

  const hideBanner = () => {
    Animated.timing(slideAnim, {
      toValue: -120,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setStatus('idle');
      setStatusMessage('');
    });
  };

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const checkAndApplyUpdates = async (interactive = false) => {
    setIsInteractive(interactive);

    // 1. If in development or updates disabled natively
    if (__DEV__) {
      if (interactive) {
        setStatus('up-to-date');
        setStatusMessage('Development mode: Over-The-Air updates are disabled.');
        showBanner();
        hideTimerRef.current = setTimeout(hideBanner, 3000);
      }
      return;
    }

    if (!Updates || !Updates.isEnabled) {
      if (interactive) {
        setStatus('error');
        setStatusMessage('EAS Updates are not enabled in this build.');
        showBanner();
        hideTimerRef.current = setTimeout(hideBanner, 4000);
      }
      return;
    }

    try {
      clearHideTimer();
      setStatus('checking');
      setStatusMessage('Checking for clinic updates...');
      notifyUpdateListeners('checking', 'Checking for clinic updates...');
      showBanner();

      const check = await Updates.checkForUpdateAsync();

      if (check.isAvailable) {
        setStatus('downloading');
        setStatusMessage('Downloading new clinical update...');
        notifyUpdateListeners('downloading', 'Downloading new clinical update...');

        await Updates.fetchUpdateAsync();

        setStatus('ready');
        setStatusMessage('Update downloaded! Ready to apply.');
        notifyUpdateListeners('ready', 'Update downloaded! Ready to apply.');
        setShowReadyModal(true);
        hideBanner();
      } else {
        setStatus('up-to-date');
        setStatusMessage('App is up to date with the latest clinical features.');
        notifyUpdateListeners('up-to-date', 'App is up to date.');
        hideTimerRef.current = setTimeout(hideBanner, interactive ? 3000 : 1500);
      }
    } catch (err: any) {
      console.warn('[AppUpdateManager] Update check failed:', err);
      const errMsg = err?.message || 'Could not reach update server';
      setStatus('error');
      setStatusMessage(`Update check failed: ${errMsg}`);
      notifyUpdateListeners('error', errMsg);
      hideTimerRef.current = setTimeout(hideBanner, 4000);
    }
  };

  useEffect(() => {
    globalTriggerCheck = checkAndApplyUpdates;

    // Check automatically on app startup
    const startTimer = setTimeout(() => {
      checkAndApplyUpdates(false);
    }, 1500);

    return () => {
      clearTimeout(startTimer);
      clearHideTimer();
      globalTriggerCheck = null;
    };
  }, []);

  const handleRestartNow = async () => {
    try {
      setShowReadyModal(false);
      if (Updates) {
        await Updates.reloadAsync();
      }
    } catch (err: any) {
      console.error('[AppUpdateManager] Reload failed:', err);
      setShowReadyModal(false);
    }
  };

  const isBannerVisible = status !== 'idle' && status !== 'ready';

  return (
    <>
      {/* Top Floating Notification Banner */}
      {isBannerVisible && (
        <Animated.View
          style={[
            styles.bannerContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View
            style={[
              styles.bannerContent,
              status === 'error'
                ? styles.bannerError
                : status === 'up-to-date'
                ? styles.bannerSuccess
                : styles.bannerActive,
            ]}
          >
            {status === 'checking' || status === 'downloading' ? (
              <ActivityIndicator
                size="small"
                color="#047857"
                style={{ marginRight: 8 }}
              />
            ) : status === 'up-to-date' ? (
              <CheckCircle2 size={16} color="#047857" style={{ marginRight: 8 }} />
            ) : (
              <AlertCircle size={16} color="#B91C1C" style={{ marginRight: 8 }} />
            )}

            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.bannerTitle,
                  status === 'error'
                    ? styles.bannerTitleError
                    : styles.bannerTitleNormal,
                ]}
                numberOfLines={1}
              >
                {status === 'checking'
                  ? 'Checking for Updates'
                  : status === 'downloading'
                  ? 'Updating SmileGuard'
                  : status === 'up-to-date'
                  ? 'Up to Date'
                  : 'Update Notice'}
              </Text>
              <Text
                style={[
                  styles.bannerSubtext,
                  status === 'error'
                    ? styles.bannerSubtextError
                    : styles.bannerSubtextNormal,
                ]}
                numberOfLines={2}
              >
                {statusMessage}
              </Text>
            </View>

            <TouchableOpacity
              onPress={hideBanner}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.closeBtn}
            >
              <X size={14} color="#64748B" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Update Ready Modal with One-Tap Reload */}
      <Modal
        visible={showReadyModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowReadyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconBox}>
              <Sparkles size={28} color="#047857" />
            </View>

            <Text style={styles.modalTitle}>Clinical Update Ready!</Text>
            <Text style={styles.modalBody}>
              A new update has been downloaded with the latest chronological agenda,
              productivity tools, and doctor dashboard fixes.
            </Text>

            <View style={styles.modalMetaRow}>
              <Text style={styles.modalMetaText}>
                Channel: <Text style={{ fontWeight: '700' }}>{Updates?.channel || 'preview'}</Text>
              </Text>
              <Text style={styles.modalMetaText}>
                Version: <Text style={{ fontWeight: '700' }}>{Updates?.runtimeVersion || '1.0.0'}</Text>
              </Text>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.laterBtn}
                onPress={() => setShowReadyModal(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.laterBtnText}>Later</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.restartBtn}
                onPress={handleRestartNow}
                activeOpacity={0.85}
              >
                <RefreshCw size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.restartBtnText}>Restart Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute',
    top: Platform.OS === 'android' ? 36 : 48,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  bannerActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#10B981',
  },
  bannerSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  bannerError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  bannerTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bannerTitleNormal: {
    color: '#065F46',
  },
  bannerTitleError: {
    color: '#991B1B',
  },
  bannerSubtext: {
    fontSize: 11,
    marginTop: 1,
  },
  bannerSubtextNormal: {
    color: '#334155',
  },
  bannerSubtextError: {
    color: '#7F1D1D',
  },
  closeBtn: {
    padding: 4,
    marginLeft: 8,
  },
  // Ready Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 10000,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderBottomWidth: 4,
    borderBottomColor: '#CBD5E1',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  modalIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#A7F3D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  modalMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalMetaText: {
    fontSize: 11,
    color: '#64748B',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  laterBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  laterBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  restartBtn: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 3,
    borderBottomColor: '#022C22',
  },
  restartBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
