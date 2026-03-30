import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { signInWithEmailAndPassword } from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebase";

export default function Login() {

  const [loginInput, setLoginInput] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const router = useRouter();

  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!loginInput?.trim() || !password) {
      Alert.alert("Error", "Please enter valid credentials");
      return;
    }
    setLoading(true);
    try {
      let emailToLogin = loginInput.trim();
      if (!emailToLogin.includes("@")) {
        const usersRef = collection(db, "users");
        const q1 = query(usersRef, where("username", "==", loginInput));
        const q2 = query(usersRef, where("phone", "==", loginInput));

        const usernameSnap = await getDocs(q1);
        const phoneSnap = await getDocs(q2);

        if (!usernameSnap.empty) {
          emailToLogin = usernameSnap.docs[0].data().email;
        }
        else if (!phoneSnap.empty) {
          emailToLogin = phoneSnap.docs[0].data().email;
        }
        else {
          Alert.alert("Login Error", "User not found");
          return;
        }
      }

      await signInWithEmailAndPassword(auth, emailToLogin, password);
      router.replace("/(tabs)");

    } catch (error) {
      Alert.alert("Login Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#e8efd9" }}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingBottom: 100 }}>

            {/* Header */}
            <View className="h-64 bg-[#dfe7c7] rounded-b-[60px] p-8 justify-center shadow-sm">
              <Text className="text-4xl font-black text-gray-800 mb-2">
                LifeLedger
              </Text>

              <Text className="text-gray-600 font-bold uppercase tracking-[4px] text-xs">
                Log into your account
              </Text>
            </View>

            {/* Form */}
            <View className="px-8 mt-10">

              {/* Username Field */}
              <View className="mb-6">
                <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-2 ml-2">
                  Username / Email / Mobile
                </Text>

                <View className="bg-[#dfe7c7] rounded-[24px] px-6 py-1 border border-[#cfd8b8] shadow-sm">
                  <TextInput
                    placeholder="Enter details"
                    value={loginInput}
                    onChangeText={setLoginInput}
                    className="text-gray-800 font-bold py-5"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Password Field */}
              <View className="mb-8">
                <Text className="text-gray-500 font-bold uppercase tracking-widest text-[10px] mb-2 ml-2">
                  Password
                </Text>
                <View className="bg-[#dfe7c7] rounded-[24px] px-6 py-1 border border-[#cfd8b8] shadow-sm flex-row items-center">
                  <TextInput
                    placeholder="Enter password"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    className="flex-1 text-gray-800 font-bold py-5"
                    placeholderTextColor="#9ca3af"
                  />

                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="bg-white/40 p-2 rounded-full">
                    <Ionicons
                      name={showPassword ? "eye" : "eye-off"}
                      size={18}
                      color="#2f5d34"
                    />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity className="mt-3 ml-2 self-start">
                  <Text className="text-[#2f5d34] font-bold text-xs uppercase tracking-widest">
                    Forgot Password?
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
                className="bg-[#2f5d34] w-full p-6 rounded-[28px] shadow-lg shadow-green-200 flex-row justify-center items-center"
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (
                    <ActivityIndicator color="white" size="small" />
                ) : (
                    <>
                        <Text className="text-center text-white font-black text-lg uppercase tracking-[2px]">
                        Sign In
                        </Text>
                        <Ionicons name="arrow-forward" size={18} color="white" className="ml-3" />
                    </>
                )}
              </TouchableOpacity>

              {/* Register */}
              <TouchableOpacity
                onPress={() => router.push("/register")}
                className="mt-12 mb-10"
              >
                <Text className="text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                  Don't have an account? <Text className="text-[#2f5d34] font-black underline">Sign Up</Text>
                </Text>
              </TouchableOpacity>

            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}