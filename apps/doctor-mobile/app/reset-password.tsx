/* eslint-disable @typescript-eslint/no-unused-vars */
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
    console.log("🔄 Reset password component mounted");
    
    // Try to get hash parameters from URL (web only)
    if (typeof globalThis !== "undefined" && "location" in globalThis) {
      const hash = ((globalThis as unknown) as { location: { hash: string } }).location.hash;
      console.log("📍 Current hash:", hash);
      
      if (hash && hash.includes("access_token")) {
        console.log("✅ Found access_token in hash, parsing...");
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const type = params.get("type");
        
        console.log("📋 Parsed recovery params:", { hasAccessToken: !!accessToken, type, hasRefreshToken: !!refreshToken });
        
        if (accessToken) {
          console.log("🔐 Setting session from recovery token...");
          supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || "",
          }).then(() => {
            console.log("✅ Session set, verifying...");
            verifySession();
          }).catch((error) => {
            console.error("❌ Error setting session:", error);
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
    console.log("🔍 Verifying session...");
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log("📊 Session status:", {
        hasSession: !!session,
        userId: session?.user?.id,
        email: session?.user?.email,
        error: error?.message,
      });
      
      if (session?.user) {
        console.log("✅ Valid session found, ready to reset password");
        setReady(true);
      } else {
        console.warn("❌ No session found!");
        setMessage("This reset link is invalid or has expired. Please request a new one.");
        setReady(true);
      }
    } catch (error) {
      console.error("❌ Error verifying session:", error);
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
      setMessage("✅ Password updated! Redirecting...");
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
            <ActivityIndicator size="large" color="#0b7fab" />
            <Text style={styles.sub}>Verifying reset link…</Text>
          </>
        )}
      </View>
    );
  }

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