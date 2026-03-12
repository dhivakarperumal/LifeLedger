import { Stack } from "expo-router";
import { BiometricGuard } from "../components/BiometricGuard";
import { AuthProvider } from "../context/AuthContext";
import './global.css';

export default function RootLayout() {
  return (
    <AuthProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <BiometricGuard />
    </AuthProvider>
  );
}