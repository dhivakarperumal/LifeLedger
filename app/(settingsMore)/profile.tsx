import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { deleteUser, sendPasswordResetEmail, signOut, updateProfile } from "firebase/auth";
import { collection, deleteDoc, doc, getDocs, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../../firebase";
import { useAuth } from "../../context/AuthContext";

export default function Profile() {
    const router = useRouter();
    const { user } = useAuth() as any;

    const [name, setName] = useState(user?.displayName || "");
    const [email, setEmail] = useState(user?.email || "");
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
    const [confirmEmail, setConfirmEmail] = useState("");

    // ── Toast ──────────────────────────────────────────────────────────
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
    const toastAnim = useRef(new Animated.Value(-100)).current;

    const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
        setToast({ message, type });
        Animated.sequence([
            Animated.spring(toastAnim, { toValue: 60, useNativeDriver: true, bounciness: 12 }),
            Animated.delay(2500),
            Animated.timing(toastAnim, { toValue: -100, duration: 400, useNativeDriver: true }),
        ]).start(() => setToast(null));
    };

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

            showToast("Profile updated successfully!");
            setIsEditing(false);
        } catch (error: any) {
            showToast(error.message || "Failed to update profile", "error");
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

    const handleDeleteAccount = async () => {
        if (!user || confirmEmail.toLowerCase() !== user.email?.toLowerCase()) return;
        setDeleteLoading(true);
        try {
            const uid = user.uid;
            // Delete all user Firestore collections
            const collectionsToDelete = ["expenses", "income", "transfers", "diaries", "memories", "reminders"];
            for (const col of collectionsToDelete) {
                const q = query(collection(db, col), where("userId", "==", uid));
                const snap = await getDocs(q);
                for (const d of snap.docs) {
                    await deleteDoc(doc(db, col, d.id));
                }
            }
            // Delete user doc
            await deleteDoc(doc(db, "users", uid));
            // Delete Firebase Auth account
            await deleteUser(user);
            await signOut(auth);
            setIsDeleteModalVisible(false);
            router.replace("/");
        } catch (error: any) {
            setDeleteLoading(false);
            if (error.code === "auth/requires-recent-login") {
                Alert.alert(
                    "Re-login Required",
                    "For security, please sign out and sign back in before deleting your account.",
                    [{ text: "OK" }]
                );
            } else {
                showToast(error.message || "Failed to delete account", "error");
            }
        }
    };

    return (
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#111827" }}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ backgroundColor: "#f9fafb" }}
                contentContainerStyle={{ backgroundColor: "#f9fafb", paddingBottom: 40 }}
            >

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
                            <View className={`flex-row items-center px-4 rounded-[20px] border shadow-sm ${isEditing ? 'bg-white border-emerald-600 shadow-emerald-900/10' : 'bg-gray-50 border-gray-100'}`}>
                                <Ionicons name="person-outline" size={20} color={isEditing ? "#059669" : "#9ca3af"} />
                                <TextInput
                                    value={name}
                                    onChangeText={setName}
                                    editable={isEditing}
                                    placeholder="Full Name (E.g. John Doe)"
                                    placeholderTextColor="#9ca3af"
                                    className="flex-1 p-4 font-bold text-[#4b5563]"
                                />
                            </View>
                        </View>

                        <View className="mb-5">
                            <Text className="text-gray-500 font-bold text-xs uppercase mb-2 ml-1">Email Address</Text>
                            <View className="flex-row items-center px-4 rounded-[20px] bg-gray-50 border border-gray-100 shadow-sm shadow-black/5">
                                <Ionicons name="mail-outline" size={20} color="#9ca3af" />
                                <TextInput
                                    value={email}
                                    editable={false}
                                    placeholder="Email"
                                    className="flex-1 p-4 font-bold text-gray-400"
                                />
                            </View>
                        </View>

                        <View className="mb-6">
                            <Text className="text-gray-500 font-bold text-xs uppercase mb-2 ml-1">Phone Number</Text>
                            <View className={`flex-row items-center px-4 rounded-[20px] border shadow-sm ${isEditing ? 'bg-white border-emerald-600 shadow-emerald-900/10' : 'bg-gray-50 border-gray-100'}`}>
                                <Ionicons name="call-outline" size={20} color={isEditing ? "#059669" : "#9ca3af"} />
                                <TextInput
                                    value={phone}
                                    onChangeText={setPhone}
                                    editable={isEditing}
                                    placeholder="+91 00000 00000"
                                    placeholderTextColor="#9ca3af"
                                    keyboardType="phone-pad"
                                    className="flex-1 p-4 font-bold text-[#4b5563]"
                                />
                            </View>
                        </View>

                        {isEditing && (
                            <TouchableOpacity
                                onPress={handleUpdate}
                                disabled={loading}
                                className="bg-[#2f5d34] p-5 rounded-2xl flex-row justify-center items-center shadow-lg"
                                style={{ opacity: loading ? 0.7 : 1 }}
                            >
                                {loading ? (
                                    <ActivityIndicator color="white" size="small" />
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
                        className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex-row items-center justify-between mb-6"
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

                    {/* Danger Zone */}
                    <Text className="text-gray-800 text-lg font-bold mb-4 ml-1">Danger Zone</Text>
                    <TouchableOpacity
                        onPress={() => setIsDeleteModalVisible(true)}
                        className="bg-white p-5 rounded-[32px] shadow-sm border border-red-50 flex-row items-center justify-between mb-10"
                    >
                        <View className="flex-row items-center">
                            <View className="bg-red-50 w-12 h-12 rounded-2xl items-center justify-center mr-4">
                                <Ionicons name="trash-outline" size={24} color="#ef4444" />
                            </View>
                            <View>
                                <Text className="font-extrabold text-red-600 text-base">Delete Account</Text>
                                <Text className="text-xs text-red-400 font-medium">Permanently remove all your data</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#fca5a5" />
                    </TouchableOpacity>

                </View>
            </ScrollView>

            {/* ── Delete Confirmation Modal ── */}
            <Modal visible={isDeleteModalVisible} transparent animationType="fade">
                <KeyboardAvoidingView
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" }}
                    className="flex-1 px-6 justify-center"
                >
                    <View className="bg-white w-full rounded-[40px] p-8 items-center shadow-2xl">
                        <View className="w-20 h-20 rounded-full bg-red-50 items-center justify-center mb-6 border-4 border-white shadow-sm">
                            <Ionicons name="alert-circle" size={48} color="#ef4444" />
                        </View>
                        
                        <Text className="text-2xl font-black text-gray-900 mb-2 text-center">Are you absolute sure?</Text>
                        <Text className="text-gray-500 text-center mb-8 font-medium leading-5 px-2">
                            This action will permanently delete your account and all associated data. This cannot be undone.
                        </Text>

                        <View className="w-full mb-8 bg-red-50/50 p-6 rounded-3xl border border-red-100">
                           <Text className="text-red-800 text-[10px] font-black uppercase tracking-widest mb-3 text-center">Security Verification</Text>
                           <Text className="text-gray-600 text-xs font-bold text-center mb-4">
                             To confirm, please type your email:{"\n"}
                             <Text className="text-red-600 font-black">{user?.email}</Text>
                           </Text>
                           <TextInput
                               value={confirmEmail}
                               onChangeText={setConfirmEmail}
                               placeholder="Type your email here"
                               placeholderTextColor="#fca5a5"
                               autoCapitalize="none"
                               className="bg-white border border-red-200 rounded-2xl p-4 text-center font-black text-red-600 shadow-sm"
                           />
                        </View>

                        <View className="flex-row w-full gap-3">
                            <TouchableOpacity
                                onPress={() => {
                                    setIsDeleteModalVisible(false);
                                    setConfirmEmail("");
                                }}
                                className="flex-1 py-4 rounded-2xl bg-gray-100 items-center justify-center"
                            >
                                <Text className="text-gray-700 font-black text-base">Keep Account</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleDeleteAccount}
                                disabled={deleteLoading || confirmEmail.toLowerCase() !== user?.email?.toLowerCase()}
                                className={`flex-1 py-4 rounded-2xl items-center justify-center shadow-lg shadow-red-500/20 ${confirmEmail.toLowerCase() === user?.email?.toLowerCase() ? 'bg-red-500' : 'bg-red-200'}`}
                            >
                                {deleteLoading ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <Text className="text-white font-black text-base">Delete Forever</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── Toast Notification ── */}
            {toast && (
                <Animated.View
                    style={{
                        position: "absolute",
                        top: 60,
                        left: 20,
                        right: 20,
                        zIndex: 9999,
                        transform: [{ translateY: toastAnim }],
                        backgroundColor: toast.type === "success" ? "#2f5d34" : toast.type === "error" ? "#ef4444" : "#3b82f6",
                        paddingVertical: 14,
                        paddingHorizontal: 20,
                        borderRadius: 20,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 8 },
                        shadowOpacity: 0.2,
                        shadowRadius: 12,
                        elevation: 10,
                    }}
                >
                    <Ionicons
                        name={toast.type === "success" ? "checkmark-circle" : toast.type === "error" ? "alert-circle" : "information-circle"}
                        size={24}
                        color="white"
                    />
                    <Text style={{ color: "white", fontWeight: "800", fontSize: 13, flex: 1 }}>{toast.message}</Text>
                </Animated.View>
            )}
        </SafeAreaView>
    );
}
