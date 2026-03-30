import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebase";

export default function Register() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username?.trim() || !email?.trim() || !phone?.trim() || !password || !confirmPassword) {
      Alert.alert("Error", "Please fill all fields with valid information");
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert("Error", "Passwords do not match");
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        username: username,
        email: email,
        phone: phone,
        active: true,
        createdDate: serverTimestamp(),
      });

      Alert.alert("Success", "User Registered Successfully");
      router.replace("/login");

    } catch (error) {
      Alert.alert("Register Error", error.message);
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
          <View style={{ paddingBottom: 120 }}>

            {/* Header */}
            <View className="h-44 bg-[#dfe7c7] rounded-b-[50px] p-8 justify-center shadow-sm">
              <Text className="text-3xl font-black text-gray-800 mb-1">
                Join Us
              </Text>
              <Text className="text-gray-500 font-bold uppercase tracking-[4px] text-[10px]">
                Create your new account
              </Text>
            </View>

            {/* Form */}
            <View className="px-8 mt-8">

              {/* Username */}
              <View className="mb-5">
                <Text className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-2 ml-2">Username</Text>
                <View className="bg-[#dfe7c7] rounded-[20px] px-6 py-1 border border-[#cfd8b8] shadow-sm">
                  <TextInput
                    placeholder="Enter username"
                    value={username}
                    onChangeText={setUsername}
                    className="text-gray-800 font-bold py-4"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Email */}
              <View className="mb-5">
                <Text className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-2 ml-2">Email</Text>
                <View className="bg-[#dfe7c7] rounded-[20px] px-6 py-1 border border-[#cfd8b8] shadow-sm">
                  <TextInput
                    placeholder="Enter email"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    className="text-gray-800 font-bold py-4"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Phone */}
              <View className="mb-5">
                <Text className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-2 ml-2">Phone</Text>
                <View className="bg-[#dfe7c7] rounded-[20px] px-6 py-1 border border-[#cfd8b8] shadow-sm">
                  <TextInput
                    placeholder="Enter phone number"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    className="text-gray-800 font-bold py-4"
                    placeholderTextColor="#9ca3af"
                  />
                </View>
              </View>

              {/* Password */}
              <View className="mb-5">
                <Text className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-2 ml-2">Password</Text>
                <View className="bg-[#dfe7c7] rounded-[20px] px-6 py-1 border border-[#cfd8b8] shadow-sm flex-row items-center">
                  <TextInput
                    placeholder="Enter password"
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                    className="flex-1 text-gray-800 font-bold py-4"
                    placeholderTextColor="#9ca3af"
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="bg-white/40 p-1.5 rounded-full">
                    <Ionicons name={showPassword ? "eye" : "eye-off"} size={16} color="#2f5d34" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm Password */}
              <View className="mb-8">
                <Text className="text-gray-500 font-bold uppercase tracking-widest text-[9px] mb-2 ml-2">Confirm Password</Text>
                <View className="bg-[#dfe7c7] rounded-[20px] px-6 py-1 border border-[#cfd8b8] shadow-sm flex-row items-center">
                  <TextInput
                    placeholder="Confirm password"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    className="flex-1 text-gray-800 font-bold py-4"
                    placeholderTextColor="#9ca3af"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="bg-white/40 p-1.5 rounded-full">
                    <Ionicons name={showConfirmPassword ? "eye" : "eye-off"} size={16} color="#2f5d34" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Register Button */}
              <TouchableOpacity
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.8}
                className="bg-[#2f5d34] w-full p-5 rounded-[24px] shadow-lg shadow-green-100 items-center justify-center flex-row"
                style={{ opacity: loading ? 0.7 : 1 }}
              >
                {loading ? (
                    <ActivityIndicator color="white" size="small" />
                ) : (
                    <Text className="text-white text-center font-black text-base uppercase tracking-widest">Register</Text>
                )}
              </TouchableOpacity>

              {/* Login Link */}
              <TouchableOpacity
                onPress={() => router.push("/login")}
                className="mt-8 mb-10"
              >
                <Text className="text-center text-gray-500 font-bold uppercase tracking-widest text-[10px]">
                  Already have an account? <Text className="text-[#2f5d34] font-black underline">Log In</Text>
                </Text>
              </TouchableOpacity>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}