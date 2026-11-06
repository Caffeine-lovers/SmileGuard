import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle2, ChevronLeft, Send } from "lucide-react-native";
import { supabase } from "@smileguard/supabase-client";

export interface MySupportRequest {
  id: string;
  subject: string;
  message: string;
  status: string;
  resolution_note?: string | null;
  created_at: string;
}

export async function listMySupportRequests(userId: string): Promise<MySupportRequest[]> {
  const { data, error } = await supabase
    .from("support_requests")
    .select("id, subject, message, status, resolution_note, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as MySupportRequest[];
}

export async function submitSupportRequest(params: {
  userId: string;
  subject: string;
  message: string;
  platform: string;
}): Promise<void> {
  const { error } = await supabase.from("support_requests").insert({
    user_id: params.userId,
    subject: params.subject.trim(),
    message: params.message.trim(),
    platform: params.platform,
    status: "pending",
  });
  if (error) throw error;
}

interface SupportFeedbackModalProps {
  visible: boolean;
  userId?: string;
  onClose: () => void;
}

export default function SupportFeedbackModal({ visible, userId, onClose }: SupportFeedbackModalProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [requests, setRequests] = useState<MySupportRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      setRequests(await listMySupportRequests(userId));
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your messages.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) fetchRequests();
  }, [visible, fetchRequests]);

  const handleSend = async () => {
    if (!userId) return;
    if (!subject.trim() || !message.trim()) {
      Alert.alert("Missing Details", "Please enter a subject and a message.");
      return;
    }
    setSending(true);
    try {
      await submitSupportRequest({ userId, subject, message, platform: "mobile" });
      setSubject("");
      setMessage("");
      Alert.alert("Sent", "Your message was sent to the clinic administrator.");
      await fetchRequests();
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onClose} accessibilityLabel="Back">
            <ChevronLeft size={20} color="#0F172A" />
          </TouchableOpacity>
          <Text style={styles.title}>Contact Support</Text>
        </View>

        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>SUBJECT</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="What is this about?"
              placeholderTextColor="#94A3B8"
              maxLength={120}
            />

            <Text style={styles.label}>MESSAGE</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Share your feedback or describe the issue"
              placeholderTextColor="#94A3B8"
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />

            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending} activeOpacity={0.85}>
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Send size={15} color="#FFFFFF" />
                  <Text style={styles.sendBtnText}>Send</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Your Messages</Text>
            {loading ? (
              <ActivityIndicator size="small" color="#047857" />
            ) : loadError ? (
              <Text style={styles.emptyText}>{loadError}</Text>
            ) : requests.length === 0 ? (
              <Text style={styles.emptyText}>None yet</Text>
            ) : (
              requests.map((request) => (
                <View key={request.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardSubject} numberOfLines={1}>{request.subject || "No Subject"}</Text>
                    <Text style={[styles.status, request.status === "resolved" && styles.statusResolved]}>
                      {request.status.replace("_", " ").toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.cardMessage}>{request.message}</Text>
                  <Text style={styles.cardDate}>{new Date(request.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                  {request.resolution_note ? (
                    <View style={styles.replyBox}>
                      <CheckCircle2 size={13} color="#047857" />
                      <Text style={styles.replyText}>{request.resolution_note}</Text>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#0F172A",
  },
  textArea: {
    minHeight: 120,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#047857",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 14,
  },
  sendBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 24,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 12,
    color: "#94A3B8",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 10,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardSubject: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A",
  },
  status: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#D97706",
  },
  statusResolved: {
    color: "#047857",
  },
  cardMessage: {
    fontSize: 12.5,
    color: "#475569",
    marginTop: 4,
  },
  cardDate: {
    fontSize: 11,
    color: "#94A3B8",
    marginTop: 6,
  },
  replyBox: {
    flexDirection: "row",
    gap: 6,
    backgroundColor: "#ECFDF5",
    borderRadius: 8,
    padding: 9,
    marginTop: 8,
  },
  replyText: {
    flex: 1,
    fontSize: 12,
    color: "#065F46",
  },
});
