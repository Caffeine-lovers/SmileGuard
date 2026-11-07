import React, { useRef, useCallback, useEffect } from "react";
import { BackHandler, ToastAndroid, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AuthModal from "../components/auth/AuthModal";

export default function LandingPage() {
  const lastBackPressRef = useRef<number>(0);

  const handleBackPress = useCallback(() => {
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
        onClose={() => {
          // Modal is the full page view on LandingPage; navigation is handled by root layout
        }}
        onSuccess={() => {}} // root layout handles redirect
        showCloseButton={false}
      />
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: "#fff" },
};