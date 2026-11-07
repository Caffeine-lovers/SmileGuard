import React, { useCallback, useEffect, useState } from "react";
import { BackHandler } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@smileguard/supabase-client";
import AuthModal from "../components/auth/AuthModal";

export default function LandingPage() {
  const [modalVisible, setModalVisible] = useState(true);

  const handleBackPress = useCallback(() => {
    BackHandler.exitApp();
    return true;
  }, []);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );
    return () => backSubscription.remove();
  }, [handleBackPress]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted && session?.user) {
        setModalVisible(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted && session?.user) {
        setModalVisible(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <AuthModal
        visible={modalVisible}
        onClose={handleBackPress}
        onSuccess={() => setModalVisible(false)}
        showCloseButton={false}
      />
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: "#fff" },
};
