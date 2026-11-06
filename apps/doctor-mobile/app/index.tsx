import React, { useRef, useCallback, useEffect } from "react";
import { BackHandler, ToastAndroid, Platform, Alert, Keyboard } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AuthModal from "../components/auth/AuthModal";

export default function LandingPage() {
  const lastBackPressRef = useRef<number>(0);

  // Clear any exiting registration flag when landing on welcome screen
  useEffect(() => {
    AsyncStorage.removeItem("@is_exiting_registration").catch(() => {});
  }, []);

  const handleBackPress = useCallback(() => {
    if (Keyboard.isVisible()) {
      Keyboard.dismiss();
      return true;
    }
    const now = Date.now();
    if (now - lastBackPressRef.current < 2000) {
      BackHandler.exitApp();
      return true;
    }
    lastBackPressRef.current = now;
    if (Platform.OS === "android") {
      ToastAndroid.show("Press back again to exit", ToastAndroid.SHORT);
    } else {
      Alert.alert("Exit App", "Are you sure you want to exit SmileGuard?", [
        { text: "Cancel", style: "cancel" },
        { text: "Exit", onPress: () => BackHandler.exitApp() },
      ]);
    }
    return true;
  }, []);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );
    return () => backSubscription.remove();
  }, [handleBackPress]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AuthModal
        visible={true}
        onClose={() => {}} // Do NOT pass handleBackPress here; modal dismissal or sign-in events must not trigger BackHandler.exitApp()
        onSuccess={() => {}} // root layout handles redirect
        showCloseButton={false}
      />
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: "#fff" },
};