import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { sendPasswordResetEmail, updateProfile } from "firebase/auth";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebase";

export default function Profile() {
    const router = useRouter();
    const user = auth.currentUser;

    const [name, setName] = useState(user?.displayName || "");
    const [email, setEmail] = useState(user?.email || "");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        if (!user) return;
        const userRef = doc(db, "users", user.uid);
        const unsub = onSnapshot(userRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setPhone(data.phone || "");
                if (data.username) setName(data.username);
            }
        });
        return () => unsub();
    }, [user]);



    const handleUpdate = async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Update Firebase Auth Profile
            await updateProfile(user, { displayName: name });

            // Update Firestore using setDoc with merge to ensure doc exists
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                username: name,
                phone: phone,
                email: email,
                uid: user.uid,
                updatedAt: new Date()
            }, { merge: true });

            Alert.alert("Success", "Profile updated successfully!");
            setIsEditing(false);
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async () => {
        if (!user?.email) return;
        Alert.alert(
            "Change Password",
            "We will send a password reset link to your email. Do you want to proceed?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Send Link",
                    onPress: async () => {
                        try {
                            await sendPasswordResetEmail(auth, user.email!);
                            Alert.alert("Success", "Reset link sent! Please check your email.");
                        } catch (error: any) {
                            Alert.alert("Error", error.message);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView showsVerticalScrollIndicator={false}>

                {/* Header Gradient */}
                <LinearGradient
                    colors={['#1a361d', '#2f5d34']}
                    className="pb-24 pt-8 px-6 rounded-b-[40px] shadow-lg"
                >
                    <View className="flex-row justify-between items-center mb-6">
                        <TouchableOpacity onPress={() => router.back()} className="bg-white/20 p-2 rounded-full">
                            <Ionicons name="arrow-back" size={24} color="white" />
                        </TouchableOpacity>
                        <Text className="text-white text-xl font-bold">My Profile</Text>
                        <TouchableOpacity
                            onPress={() => setIsEditing(!isEditing)}
                            className="bg-white/20 p-2 rounded-full"
                        >
                            <Ionicons name={isEditing ? "close" : "create-outline"} size={24} color="white" />
                        </TouchableOpacity>
                    </View>

                    <View className="items-center">
                        <View className="relative">
                            <View className="w-32 h-32 bg-white rounded-full items-center justify-center border-4 border-white/30 shadow-2xl overflow-hidden">
                                <Text className="text-gray-900 text-5xl font-black">{name?.charAt(0) || "U"}</Text>
                            </View>
                            <TouchableOpacity className="absolute bottom-1 right-1 bg-yellow-400 p-2 rounded-full border-2 border-[#2f5d34] shadow-md">
                                <Ionicons name="camera" size={20} color="#1a361d" />
                            </TouchableOpacity>
                        </View>
                        <Text className="text-white text-2xl font-bold mt-4">{name || "User Name"}</Text>
                        <Text className="text-white/70 font-medium">{email}</Text>
                    </View>
                </LinearGradient>

                <View className="px-6 -mt-12">

                    {/* Stats Row */}
                    <View className="flex-row justify-between bg-white p-6 rounded-3xl shadow-sm border border-gray-100 mb-6">
                        <View className="items-center flex-1">
                            <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Status</Text>
                            <Text className="text-[#2f5d34] font-black text-lg">Active</Text>
                        </View>
                        <View className="w-[1px] bg-gray-100 mx-2" />
                        <View className="items-center flex-1">
                            <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Joined</Text>
                            <Text className="text-[#2f5d34] font-black text-lg">2024</Text>
                        </View>
                        <View className="w-[1px] bg-gray-100 mx-2" />
                        <View className="items-center flex-1">
                            <Text className="text-gray-400 text-xs font-bold uppercase mb-1">Rank</Text>
                            <Text className="text-[#2f5d34] font-black text-lg">Pro</Text>
                        </View>
                    </View>

                    {/* Form Section */}
                    <View className="bg-white p-6 rounded-[32px] shadow-sm border border-gray-100 mb-8">
                        <Text className="text-gray-800 text-lg font-bold mb-6">Personal Information</Text>

                        <View className="mb-5">
                            <Text className="text-gray-500 font-bold text-xs uppercase mb-2 ml-1">Full Name</Text>
                            <View className={`flex-row items-center px-4 rounded-2xl border ${isEditing ? 'bg-white border-[#2f5d34]' : 'bg-gray-50 border-gray-100'}`}>
                                <Ionicons name="person-outline" size={20} color={isEditing ? "#2f5d34" : "gray"} />
                                <TextInput
                                    value={name}
                                    onChangeText={setName}
                                    editable={isEditing}
                                    placeholder="Full Name (E.g. John Doe)"
                                    placeholderTextColor="#9ca3af"
                                    className="flex-1 p-4 font-semibold text-gray-800"
                                />
                            </View>
                        </View>

                        <View className="mb-5">
                            <Text className="text-gray-500 font-bold text-xs uppercase mb-2 ml-1">Email Address</Text>
                            <View className="flex-row items-center px-4 rounded-2xl bg-gray-50 border border-gray-100">
                                <Ionicons name="mail-outline" size={20} color="gray" />
                                <TextInput
                                    value={email}
                                    editable={false}
                                    placeholder="Email"
                                    className="flex-1 p-4 font-semibold text-gray-400"
                                />
                            </View>
                        </View>

                        <View className="mb-6">
                            <Text className="text-gray-500 font-bold text-xs uppercase mb-2 ml-1">Phone Number</Text>
                            <View className={`flex-row items-center px-4 rounded-2xl border ${isEditing ? 'bg-white border-[#2f5d34]' : 'bg-gray-50 border-gray-100'}`}>
                                <Ionicons name="call-outline" size={20} color={isEditing ? "#2f5d34" : "gray"} />
                                <TextInput
                                    value={phone}
                                    onChangeText={setPhone}
                                    editable={isEditing}
                                    placeholder="+91 00000 00000"
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="phone-pad"
                                    className="flex-1 p-4 font-semibold text-gray-800"
                                />
                            </View>
                        </View>

                        {isEditing && (
                            <TouchableOpacity
                                onPress={handleUpdate}
                                disabled={loading}
                                className="bg-[#2f5d34] p-5 rounded-2xl flex-row justify-center items-center shadow-lg"
                            >
                                {loading ? (
                                    <Text className="text-white font-bold">Updating...</Text>
                                ) : (
                                    <>
                                        <Ionicons name="checkmark-circle" size={20} color="white" />
                                        <Text className="text-white font-black text-lg ml-2 uppercase tracking-widest">Save Changes</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Account Settings Shortcut */}
                    <Text className="text-gray-800 text-lg font-bold mb-4 ml-1">Account Security</Text>

                    <TouchableOpacity
                        onPress={handlePasswordReset}
                        className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex-row items-center justify-between mb-4"
                    >
                        <View className="flex-row items-center">
                            <View className="bg-orange-50 w-12 h-12 rounded-2xl items-center justify-center mr-4">
                                <Ionicons name="key-outline" size={24} color="#ea580c" />
                            </View>
                            <View>
                                <Text className="font-extrabold text-gray-800 text-base">Change Password</Text>
                                <Text className="text-xs text-gray-400 font-medium">Get a secure reset link via email</Text>
                            </View>
                        </View>
                        <Ionicons name="mail-outline" size={20} color="#9ca3af" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push("/(settingsMore)/settings")}
                        className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex-row items-center justify-between mb-10"
                    >
                        <View className="flex-row items-center">
                            <View className="bg-blue-50 w-12 h-12 rounded-2xl items-center justify-center mr-4">
                                <Ionicons name="shield-checkmark" size={24} color="#1e40af" />
                            </View>
                            <View>
                                <Text className="font-extrabold text-gray-800 text-base">Security & Privacy</Text>
                                <Text className="text-xs text-gray-400 font-medium">Manage app permissions</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#9ca3af" />
                    </TouchableOpacity>

                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
