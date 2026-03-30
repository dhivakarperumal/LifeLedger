import { Stack } from "expo-router";
import { BiometricGuard } from "../components/BiometricGuard";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { DataProvider, useData } from "../context/DataContext";
import { ActivityIndicator, View, Animated, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import './global.css';

export default function RootLayout() {
  return (
    <AuthProvider>
      <DataProvider>
        <AppRoot />
      </DataProvider>
    </AuthProvider>
  );
}

function AppRoot() {
  const { user, loading: authLoading } = useAuth() as any;
  const { isInitialLoadDone } = useData() as any;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const isGlobalLoading = authLoading || (user && !isInitialLoadDone);
    if (isGlobalLoading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [authLoading, user, isInitialLoadDone]);

  const isGlobalLoading = authLoading || (user && !isInitialLoadDone);

  if (isGlobalLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#f9fafb", justifyContent: "center", alignItems: "center" }}>
        <Animated.View style={{ transform: [{ scale: pulseAnim }], marginBottom: 30 }}>
            <View style={{
                width: 100, height: 100, borderRadius: 50,
                backgroundColor: "white", justifyContent: "center", alignItems: "center",
                shadowColor: "#2f5d34", shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.15, shadowRadius: 20, elevation: 10
            }}>
                <Ionicons name="wallet-outline" size={50} color="#2f5d34" />
            </View>
        </Animated.View>
        <Text style={{ fontSize: 18, fontWeight: "800", color: "#1f2937", letterSpacing: 1 }}> LifeLedger </Text>
        <Text style={{ fontSize: 12, fontWeight: "600", color: "#6b7280", marginTop: 8, letterSpacing: 0.5 }}>
            {user ? "Syncing your workspace..." : "Authenticating..."}
        </Text>
        <ActivityIndicator size="small" color="#2f5d34" style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <BiometricGuard />
    </>
  );
}