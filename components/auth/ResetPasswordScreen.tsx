/** @jsx React.jsx */
import { useState } from "react";
import React from "react";
import {
  View, Text, TextInput,
  TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { supabase } from "../../lib/supabase.ts";

export default function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleReset = async () => {
    if (newPassword.length < 8) {
      setMessage("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      setMessage(error.message);
    } else {
      setMessage("✅ Password updated!");
      setTimeout(() => onDone(), 1500);
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔐 Set New Password</Text>
      <Text style={styles.sub}>Enter your new password below.</Text>
      <TextInput
        style={styles.input}
        placeholder="New password"
        secureTextEntry
        value={newPassword}
        onChangeText={setNewPassword}
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <TouchableOpacity style={styles.btn} onPress={handleReset} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.btnText}>Update Password</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 8 },
  sub: { color: "#6b7280", marginBottom: 24, textAlign: "center" },
  input: {
    backgroundColor: "#f3f4f6", padding: 16,
    borderRadius: 12, width: "100%", marginBottom: 14,
  },
  btn: {
    backgroundColor: "#0b7fab", padding: 16,
    borderRadius: 12, width: "100%", alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700" },
  message: { color: "#ef4444", marginBottom: 12, textAlign: "center" },
});
