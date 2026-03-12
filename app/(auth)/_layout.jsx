import { Stack, Redirect, usePathname } from "expo-router";
import { useAuth } from "../../context/AuthContext";

export default function RootLayout() {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // wait until auth state loads
  if (!loading) {
    // not logged in → go to login
    if (!user && pathname !== "/login" && pathname !== "/register") {
      return <Redirect href="/login" />;
    }

    // logged in but on auth page → go to home
    if (user && (pathname === "/login" || pathname === "/register")) {
      return <Redirect href="/" />;
    }
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}