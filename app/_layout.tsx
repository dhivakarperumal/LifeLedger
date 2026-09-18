import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect, useRef } from "react";
import {
    ActivityIndicator,
    Animated,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { BiometricGuard } from "../components/BiometricGuard";
import { AuthProvider, useAuth } from "../context/AuthContext";
import { DataProvider, useData } from "../context/DataContext";
import "./global.css";

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
  const segments = useSegments();
  const routeGroup = segments[0];
  const router = useRouter();

  const isGlobalLoading = authLoading || (user && !isInitialLoadDone);

  // Splash animation logic
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;

    if (isGlobalLoading) {
      animation = Animated.loop(
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
        ]),
      );
      animation.start();
    } else {
      pulseAnim.setValue(1);
    }

    return () => {
      if (animation) animation.stop();
    };
  }, [isGlobalLoading]);

  // Routing Auth Guard (useEffect based)
  useEffect(() => {
    if (isGlobalLoading) return;

    const inAuthGroup = routeGroup === "(auth)";

    if (!user && !inAuthGroup) {
      // Not logged in -> kick to login
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Logged in but somehow in auth screen -> kick to home
      router.replace("/(tabs)");
    }
  }, [user, isGlobalLoading, routeGroup]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {isGlobalLoading ? (
        <View style={styles.loadingOverlay}>
          <Animated.View
            style={{ transform: [{ scale: pulseAnim }], marginBottom: 30 }}
          >
            <View style={styles.logoCircle}>
              <Ionicons name="wallet-outline" size={50} color="#2f5d34" />
            </View>
          </Animated.View>
          <Text style={styles.logoText}> LifeLedger </Text>
          <Text style={styles.loadingText}>
            {user ? "Syncing your workspace..." : "Authenticating..."}
          </Text>
          <ActivityIndicator
            size="small"
            color="#2f5d34"
            style={{ marginTop: 24 }}
          />
        </View>
      ) : (
        user && <BiometricGuard />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#f9fafb",
    justifyContent: "center",
    alignItems: "center",
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "white",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2f5d34",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1f2937",
    letterSpacing: 1,
  },
  loadingText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6b7280",
    marginTop: 8,
    letterSpacing: 0.5,
  },
});
