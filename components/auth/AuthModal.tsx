import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FormData } from "../../types";

interface AuthModalProps {
  visible: boolean;
  role: "patient" | "doctor";
  onClose: () => void;
  onSuccess: (userData: { name: string; email: string; role: string }) => void;
  onLogin: (email: string, password: string, role: string) => Promise<any>;
  onRegister: (formData: FormData, role: string) => Promise<any>;
}

export default function AuthModal({
  visible,
  role,
  onClose,
  onSuccess,
  onLogin,
  onRegister,
}: AuthModalProps) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<"register" | "login">("register");
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    service: "",
    name: "",
    email: "",
    password: "",
  });

  // Reset state when modal closes or reopens
  React.useEffect(() => {
    if (visible) {
      setStep(0);
      setMode("register");
      setFormData({ service: "", name: "", email: "", password: "" });
    }
  }, [visible]);

  const handleChoice = (selectedMode: "register" | "login") => {
    setMode(selectedMode);
    // Patients registering need to select a service first (Step 1)
    // Doctors or Logins go straight to Credentials (Step 2)
    if (selectedMode === "login" || role === "doctor") {
      setStep(2);
    } else {
      setStep(1);
    }
  };

  const handleNext = () => setStep((s) => s + 1);

  const handleFinalize = async () => {
    if (!formData.email || !formData.password) {
      Alert.alert("Missing Info", "Please complete all required fields.");
      return;
    }

    if (mode === "register" && !formData.name) {
      Alert.alert("Missing Info", "Please enter your full name.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "login") {
        await performLogin();
      } else {
        await performRegister();
      }
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const performLogin = async () => {
    const userData = await onLogin(formData.email, formData.password, role);
    onSuccess(userData);
  };

  const performRegister = async () => {
    await onRegister(formData, role);
    // Move to Success Screen
    setStep(3);
  };

  const enterDashboardAfterSuccess = () => {
    onSuccess({
      name: formData.name,
      email: formData.email,
      role: role,
    });
  };

  return (
    <Modal visible={visible} animationType="slide">
      <SafeAreaView style={styles.modalFull}>
        <View style={styles.bordercard}>
          <View style={styles.stepContent}>
            {/* Step 0: Portal Entry Choice */}
            {step === 0 && (
              <View style={{ alignItems: "center" }}>
                <Text style={styles.h2}>
                  {role === "doctor" ? "Doctor" : "Patient"} Access
                </Text>
                <Text style={[styles.p, { marginBottom: 40 }]}>
                  Please select an option to continue to your dashboard.
                </Text>

                <TouchableOpacity
                  style={[
                    styles.btn,
                    styles.choiceBtn,
                    styles.modalbtn,
                    { marginBottom: 30, width: "80%" },
                  ]}
                  onPress={() => handleChoice("login")}
                >
                  <Text style={styles.choiceBtnText}>
                    I have an account (Login)
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.outlineChoiceBtn, { width: "80%" }]}
                  onPress={() => handleChoice("register")}
                >
                  <Text style={styles.outlineChoiceText}>
                    New to SmileGuard? (Register)
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 1: Service Intake (Patient Register Only) */}
            {step === 1 && (
              <View>
                <Text style={styles.h2}>Service Intake</Text>
                {["Cleaning", "AI-Diagnostic Scan", "Root Canal"].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={styles.radioRow}
                    onPress={() => setFormData({ ...formData, service: s })}
                  >
                    <View
                      style={[
                        styles.radio,
                        formData.service === s && styles.radioActive,
                      ]}
                    />
                    <Text>{s}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.btn, styles.primaryBtn]}
                  onPress={handleNext}
                >
                  <Text style={styles.btnText}>Next: Details</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 2: Credentials */}
            {step === 2 && (
              <View>
                <Text style={styles.h2}>
                  {mode === "login" ? "Welcome Back" : "Create Account"}
                </Text>

                {/* Name field is only for registration */}
                {mode === "register" && (
                  <TextInput
                    style={styles.input}
                    placeholder="Full Name"
                    value={formData.name}
                    onChangeText={(t) =>
                      setFormData({ ...formData, name: t })
                    }
                  />
                )}

                <TextInput
                  style={styles.input}
                  placeholder="Email"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={formData.email}
                  onChangeText={(t) => setFormData({ ...formData, email: t })}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  secureTextEntry
                  value={formData.password}
                  onChangeText={(t) =>
                    setFormData({ ...formData, password: t })
                  }
                />
                <TouchableOpacity
                  style={[styles.btn, styles.primaryBtn]}
                  onPress={handleFinalize}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnText}>
                      {mode === "login"
                        ? "Enter Portal"
                        : "Complete Registration"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Step 3: Success (Only for Register) */}
            {step === 3 && (
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 40, marginBottom: 10 }}>🎉</Text>
                <Text style={styles.h2}>All Set!</Text>
                <Text style={styles.p}>Your {role} portal is ready.</Text>
                <TouchableOpacity
                  style={[styles.btn, styles.primaryBtn]}
                  onPress={enterDashboardAfterSuccess}
                >
                  <Text style={styles.btnText}>Enter Dashboard</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text
              style={{
                fontSize: 15,
                color: "#ef4444",
                fontWeight: "bold",
                borderColor: "#ef4444",
                borderWidth: 1,
                paddingHorizontal: 20,
                paddingVertical: 10,
                borderRadius: 30,
              }}
            >
              Exit
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalFull: {
    flex: 1,
    padding: 30,
  },
  bordercard: {
    flex: 1,
    maxWidth: 500,
    alignSelf: "center",
    width: "100%",
  },
  stepContent: {
    justifyContent: "center",
    flex: 1,
    marginTop: 40,
    borderColor: "#2bf1ff7d",
    borderWidth: 1,
    borderRadius: 45,
    padding: 16,
  },
  h2: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  p: {
    fontSize: 18,
    color: "#4b5563",
    textAlign: "center",
    marginBottom: 30,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
  },
  modalbtn: {
    marginTop: 50,
  },
  primaryBtn: {
    backgroundColor: "#0b7fab",
    width: "100%",
  },
  choiceBtn: {
    backgroundColor: "#0b7fab",
    width: "100%",
    marginBottom: 12,
  },
  choiceBtnText: {
    color: "#fff",
    fontWeight: "700",
  },
  outlineChoiceBtn: {
    borderWidth: 2,
    borderColor: "#0b7fab",
    width: "100%",
  },
  outlineChoiceText: {
    color: "#0b7fab",
    fontWeight: "700",
  },
  btnText: {
    color: "#fff",
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#f3f4f6",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 8,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#0b7fab",
    marginRight: 12,
  },
  radioActive: {
    backgroundColor: "#0b7fab",
  },
  closeBtn: {
    alignItems: "center",
    padding: 20,
  },
});
