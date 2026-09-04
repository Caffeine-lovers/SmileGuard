import React, { useState, useEffect } from "react";
import {
  View, Text, TextInput,
  TouchableOpacity, StyleSheet, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@smileguard/supabase-client";

export default function ResetPassword() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Try to get hash parameters from URL (web only)
    if (typeof globalThis !== "undefined" && "location" in globalThis) {
      const hash = ((globalThis as unknown) as { location: { hash: string } }).location.hash;
      
      if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        
        if (accessToken) {
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          }).then(() => {
            verifySession();
          }).catch((error) => {
            setMessage(`Error: ${error.message}`);
            setReady(true);
          });
          return;
        }
      }
    }

    // If no hash found, just verify existing session
    verifySession();
  }, []);

  const verifySession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (session?.user) {
        setReady(true);
      } else {
        setMessage("This reset link is invalid or has expired. Please request a new one.");
        setReady(true);
      }
    } catch (error) {
      setMessage("Error retrieving session. Please try again.");
      setReady(true);
    }
  };

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
      setMessage(" Password updated! Redirecting...");
      setTimeout(() => router.replace("/"), 1500);
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <View style={styles.container}>
        {message ? (
          <Text style={styles.message}>{message}</Text>
        ) : (
          <>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.sub}>Verifying reset link…</Text>
          </>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set New Password</Text>
      <Text style={styles.sub}>Enter your new password below.</Text>
      <TextInput
        style={styles.input}
        placeholder="New password (at least 8 characters)"
        placeholderTextColor="#94A3B8"
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
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, backgroundColor: "#F8FAFC" },
  title: { fontSize: 24, fontWeight: "800", color: "#0F172A", marginBottom: 8 },
  sub: { color: "#64748B", marginBottom: 24, textAlign: "center", fontSize: 14 },
  input: {
    backgroundColor: "#FFFFFF", padding: 14,
    borderRadius: 6, width: "100%", marginBottom: 14,
    borderWidth: 1.5, borderColor: "#CBD5E1",
    fontSize: 14, color: "#0F172A",
  },
  btn: {
    backgroundColor: "#10B981", padding: 14,
    borderRadius: 6, width: "100%", alignItems: "center",
    borderWidth: 1.5, borderTopColor: "#34D399", borderLeftColor: "#34D399",
    borderBottomColor: "#047857", borderRightColor: "#047857",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  message: { color: "#EF4444", marginBottom: 12, textAlign: "center", fontSize: 13 },
});