/**
 * Themed replacement for the native Android/iOS Alert.
 *
 * Importing this file replaces `Alert.alert` from react-native with a dialog styled in the
 * SmileGuard palette, so every existing `Alert.alert(title, message, buttons, options)` call
 * keeps working unchanged. Render <AppAlertHost /> once near the app root.
 */

import React, { useEffect, useState } from "react";
import { Alert, AlertButton, AlertOptions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { AppColors } from "../../constants/theme";

type Tone = "info" | "success" | "warning" | "error";

interface AlertRequest {
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  cancelable: boolean;
  tone: Tone;
}

let queue: AlertRequest[] = [];
let nextId = 1;
const listeners = new Set<(q: AlertRequest[]) => void>();
const emit = () => listeners.forEach((l) => l([...queue]));

function guessTone(title: string, message: string | undefined, buttons: AlertButton[]): Tone {
  if (buttons.some((b) => b.style === "destructive")) return "warning";
  const text = `${title} ${message ?? ""}`.toLowerCase();
  if (/(fail|error|could not|couldn't|unable|invalid|denied|blocked|not found|wrong)/.test(text)) return "error";
  if (/(success|saved|sent|updated|approved|confirmed|created|complete|done|added|removed|deleted)/.test(text)) return "success";
  if (/(please|required|missing|must|warning|are you sure|confirm)/.test(text)) return "warning";
  return "info";
}

const themedAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) => {
  const list = buttons && buttons.length > 0 ? buttons : [{ text: "OK" }];
  queue.push({
    id: nextId++,
    title: title ?? "",
    message,
    buttons: list,
    cancelable: options?.cancelable !== false,
    tone: guessTone(title ?? "", message, list),
  });
  emit();
};

// Replace the native dialog app-wide.
Alert.alert = themedAlert as typeof Alert.alert;

const TONE: Record<Tone, { color: string; bg: string; glyph: string }> = {
  info: { color: AppColors.ai, bg: AppColors.aiBg, glyph: "i" },
  success: { color: AppColors.primaryDark, bg: AppColors.successBg, glyph: "✓" },
  warning: { color: "#B45309", bg: AppColors.warningBg, glyph: "!" },
  error: { color: AppColors.danger, bg: "#FEE2E2", glyph: "✕" },
};

export default function AppAlertHost() {
  const [items, setItems] = useState<AlertRequest[]>([]);

  useEffect(() => {
    listeners.add(setItems);
    setItems([...queue]);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  const current = items[0];

  const close = (req: AlertRequest, button?: AlertButton) => {
    queue = queue.filter((q) => q.id !== req.id);
    emit();
    button?.onPress?.();
  };

  if (!current) return null;

  const tone = TONE[current.tone];
  const cancelButton = current.buttons.find((b) => b.style === "cancel");
  const stacked = current.buttons.length > 2;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {
        if (current.cancelable) close(current, cancelButton);
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (current.cancelable) close(current, cancelButton);
        }}
      >
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.iconWrap, { backgroundColor: tone.bg }]}>
            <Text style={[styles.iconGlyph, { color: tone.color }]}>{tone.glyph}</Text>
          </View>

          {!!current.title && <Text style={styles.title}>{current.title}</Text>}
          {!!current.message && <Text style={styles.message}>{current.message}</Text>}

          <View style={[styles.buttons, stacked && styles.buttonsStacked]}>
            {current.buttons.map((button, index) => {
              const isCancel = button.style === "cancel";
              const isDestructive = button.style === "destructive";
              return (
                <Pressable
                  key={`${button.text}-${index}`}
                  onPress={() => close(current, button)}
                  style={({ pressed }) => [
                    styles.button,
                    stacked ? styles.buttonStacked : styles.buttonRow,
                    isCancel
                      ? styles.buttonCancel
                      : isDestructive
                        ? styles.buttonDanger
                        : styles.buttonPrimary,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      isCancel ? styles.buttonTextCancel : styles.buttonTextSolid,
                    ]}
                  >
                    {button.text ?? "OK"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: AppColors.backgroundAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppColors.borderLight,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  iconGlyph: {
    fontSize: 24,
    fontWeight: "800",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: AppColors.textPrimary,
    textAlign: "center",
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: AppColors.textSecondary,
    textAlign: "center",
    marginBottom: 4,
  },
  buttons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
    width: "100%",
  },
  buttonsStacked: {
    flexDirection: "column",
  },
  button: {
    minHeight: 46,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  buttonRow: {
    flex: 1,
  },
  buttonStacked: {
    width: "100%",
  },
  buttonPrimary: {
    backgroundColor: AppColors.primary,
    borderWidth: 1,
    borderColor: AppColors.primaryDark,
  },
  buttonDanger: {
    backgroundColor: AppColors.danger,
    borderWidth: 1,
    borderColor: "#B91C1C",
  },
  buttonCancel: {
    backgroundColor: AppColors.backgroundAlt,
    borderWidth: 1.5,
    borderColor: AppColors.border,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  buttonTextSolid: {
    color: "#FFFFFF",
  },
  buttonTextCancel: {
    color: AppColors.textSecondary,
  },
});
