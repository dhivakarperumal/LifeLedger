import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from "expo-local-authentication";
import { router } from "expo-router";
import { signOut } from "firebase/auth";
import React, { useEffect, useState } from "react";
import { Alert, Modal, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth } from "../../firebase";

const BIOMETRIC_KEY = "is_biometric_enabled";

export default function Settings() {
    const [notifications, setNotifications] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [biometric, setBiometric] = useState(false);
    const [showMethodModal, setShowMethodModal] = useState(false);
    const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
    const [showPinSetup, setShowPinSetup] = useState(false);
    const [tempPin, setTempPin] = useState("");

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const val = await AsyncStorage.getItem(BIOMETRIC_KEY);
            const method = await AsyncStorage.getItem("preferred_security_method");
            setBiometric(val === "true");
            setSelectedMethod(method);
        } catch (e) {
            console.error("Failed to load biometric setting", e);
        }
    };

    const toggleBiometric = async (value: boolean) => {
        if (value) {
            setShowMethodModal(true);
        } else {
            await AsyncStorage.setItem(BIOMETRIC_KEY, "false");
            setBiometric(false);
            setSelectedMethod(null);
            await AsyncStorage.removeItem("preferred_security_method");
        }
    };

    const confirmSecuritySetup = async (method: string) => {
        if (method === "Password" || method === "Pattern") {
            setSelectedMethod(method);
            setShowMethodModal(false);
            setShowPinSetup(true);
            setTempPin("");
            return;
        }

        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();

        const isFaceSupported = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const isFingerSupported = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

        if (method === "Face ID" && !isFaceSupported) {
            Alert.alert("Hardware Error", "Your device does not support Face ID / Facial Recognition.");
            return;
        }

        if (method === "Fingerprint" && !isFingerSupported) {
            Alert.alert("Hardware Error", "Your device does not support Fingerprint scanning.");
            return;
        }

        if (!isEnrolled) {
            Alert.alert("Not Set Up", `Please set up ${method} in your device settings first.`);
            return;
        }

        const result = await LocalAuthentication.authenticateAsync({
            promptMessage: `Verify your ${method} to enable app lock`,
            disableDeviceFallback: true,
            cancelLabel: "Cancel Setup",
        });

        if (result.success) {
            await AsyncStorage.setItem(BIOMETRIC_KEY, "true");
            await AsyncStorage.setItem("preferred_security_method", method);
            setBiometric(true);
            setSelectedMethod(method);
            setShowMethodModal(false);
            Alert.alert("Identity Verified", `${method} has been set as your default unlock method.`);
        }
    };

    const handleSavePin = async () => {
        const minLength = selectedMethod === "Pattern" ? 4 : 4;
        if (tempPin.length < minLength) {
            Alert.alert("Error", `Please complete your ${selectedMethod === "Pattern" ? "4-dot pattern" : "4-digit PIN"}`);
            return;
        }
        await AsyncStorage.setItem(BIOMETRIC_KEY, "true");
        await AsyncStorage.setItem("preferred_security_method", selectedMethod!);
        await AsyncStorage.setItem("app_lock_pin", tempPin);
        setBiometric(true);
        setShowPinSetup(false);
        setTempPin("");
        Alert.alert("Security Updated", `Your ${selectedMethod} has been successfully saved and activated.`);
    };

    const handleLogout = async () => {
        Alert.alert(
            "Confirm Logout",
            "Are you sure you want to sign out?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Logout",
                    style: "destructive",
                    onPress: async () => {
                        await signOut(auth);
                        router.replace("/login");
                    }
                }
            ]
        );
    };

    const SettingItem = ({ icon, label, subLabel, value, onToggle, type = "switch", onPress = () => { } }: any) => (
        <TouchableOpacity
            onPress={onPress}
            activeOpacity={type === "button" ? 0.7 : 1}
            className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 flex-row items-center justify-between mb-4 border border-gray-100"
        >
            <View className="flex-row items-center flex-1 pr-4">
                <View className="bg-emerald-50 w-12 h-12 rounded-2xl items-center justify-center mr-4">
                    <Ionicons name={icon} size={24} color="#2f5d34" />
                </View>
                <View className="flex-1">
                    <Text className="font-extrabold text-gray-800 text-base">{label}</Text>
                    {subLabel && <Text className="text-xs text-gray-400 font-medium">{subLabel}</Text>}
                </View>
            </View>
            {type === "switch" && (
                <Switch
                    value={value}
                    onValueChange={onToggle}
                    trackColor={{ false: "#d1d5db", true: "#4ade80" }}
                    thumbColor="#ffffff"
                />
            )}
            {type === "button" && (
                <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            )}
        </TouchableOpacity>
    );

    return (
        <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1, backgroundColor: "#111827" }}>
            <ScrollView showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View className="bg-gray-900 px-4 py-4 flex-row items-center">

                    <TouchableOpacity onPress={() => router.back()} className="mr-3">
                        <Ionicons name="arrow-back-circle-outline" size={32} color="white" />
                    </TouchableOpacity>

                    <Text className="text-white text-xl font-bold">
                        Settings
                    </Text>

                </View>

                <View className="px-6 bg-white">

                    <Text className="text-gray-400 font-bold text-xs mt-5 uppercase mb-4 ml-1 tracking-widest">Preferences</Text>

                    <SettingItem
                        icon="notifications-outline"
                        label="Push Notifications"
                        subLabel="Receive budget alerts and reminders"
                        value={notifications}
                        onToggle={setNotifications}
                    />

                    <SettingItem
                        icon="moon-outline"
                        label="Dark Mode"
                        subLabel="Switch to dark theme (coming soon)"
                        value={darkMode}
                        onToggle={setDarkMode}
                    />

                    <SettingItem
                        icon="shield-checkmark-outline"
                        label="App Lock Security"
                        subLabel={biometric ? `Active: ${selectedMethod}` : "Secure your app with Fingerprint, Face, Pattern, or PIN"}
                        value={biometric}
                        onToggle={toggleBiometric}
                        onPress={() => biometric && setShowMethodModal(true)}
                        type="switch"
                    />

                    <View className="bg-white p-4 rounded-2xl mb-6 border border-gray-100 flex-row justify-around">
                        <View className="items-center">
                            <Ionicons name="finger-print" size={20} color={biometric && selectedMethod === "Fingerprint" ? "#2f5d34" : "#9ca3af"} />
                            <Text style={{ fontSize: 10, color: biometric && selectedMethod === "Fingerprint" ? "#2f5d34" : "#9ca3af" }} className="mt-1 font-bold">Finger</Text>
                        </View>
                        <View className="items-center">
                            <Ionicons name="scan" size={20} color={biometric && selectedMethod === "Face ID" ? "#2f5d34" : "#9ca3af"} />
                            <Text style={{ fontSize: 10, color: biometric && selectedMethod === "Face ID" ? "#2f5d34" : "#9ca3af" }} className="mt-1 font-bold">Face</Text>
                        </View>
                        <View className="items-center">
                            <Ionicons name="grid" size={20} color={biometric && selectedMethod === "Pattern" ? "#2f5d34" : "#9ca3af"} />
                            <Text style={{ fontSize: 10, color: biometric && selectedMethod === "Pattern" ? "#2f5d34" : "#9ca3af" }} className="mt-1 font-bold">Pattern</Text>
                        </View>
                        <View className="items-center">
                            <Ionicons name="keypad" size={20} color={biometric && (selectedMethod === "Password" || selectedMethod === "PIN") ? "#2f5d34" : "#9ca3af"} />
                            <Text style={{ fontSize: 10, color: biometric && (selectedMethod === "Password" || selectedMethod === "PIN") ? "#2f5d34" : "#9ca3af" }} className="mt-1 font-bold">Password</Text>
                        </View>
                    </View>

                    <Text className="text-gray-400 font-bold text-xs uppercase mt-6 mb-4 ml-1 tracking-widest">Support & Info</Text>

                    <SettingItem
                        icon="help-circle-outline"
                        label="Help & Support"
                        subLabel="Contact our team for help"
                        type="button"
                    />

                    <SettingItem
                        icon="information-circle-outline"
                        label="App Information"
                        subLabel="Version 1.0.0"
                        type="button"
                    />

                    <Text className="text-gray-400 font-bold text-xs uppercase mt-6 mb-4 ml-1 tracking-widest">Danger Zone</Text>

                    <TouchableOpacity
                        onPress={handleLogout}
                        className="bg-red-50 p-6 rounded-3xl border border-red-100 flex-row items-center shadow-lg shadow-red-100 mb-10"
                    >
                        <View className="bg-red-500 w-12 h-12 rounded-2xl items-center justify-center mr-4">
                            <Ionicons name="log-out-outline" size={24} color="white" />
                        </View>
                        <View className="flex-1">
                            <Text className="font-extrabold text-red-600 text-lg">Sign Out</Text>
                            <Text className="text-xs text-red-400 font-medium italic">End your current session</Text>
                        </View>
                        <Ionicons name="arrow-forward" size={18} color="#ef4444" />
                    </TouchableOpacity>

                </View>
            </ScrollView>

            <Modal
                visible={showMethodModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowMethodModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View className="mb-6 items-center">
                            <View className="bg-emerald-50 w-16 h-16 rounded-full items-center justify-center mb-4">
                                <Ionicons name="shield-checkmark" size={32} color="#2f5d34" />
                            </View>
                            <Text className="text-xl font-black text-gray-900">Choose Unlock Method</Text>
                            <Text className="text-gray-400 text-center mt-1 text-sm px-4">
                                Select how you want to unlock the app when it is locked.
                            </Text>
                        </View>

                        <View className="w-full">
                            <TouchableOpacity
                                onPress={() => confirmSecuritySetup("Fingerprint")}
                                className="flex-row items-center p-5 bg-gray-50 rounded-2xl mb-3 border border-gray-100"
                            >
                                <View className="bg-white w-10 h-10 rounded-xl items-center justify-center mr-4 border border-gray-100 shadow-sm">
                                    <Ionicons name="finger-print" size={20} color="#2f5d34" />
                                </View>
                                <Text className="flex-1 font-bold text-gray-700">Fingerprint Unlock</Text>
                                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => confirmSecuritySetup("Face ID")}
                                className="flex-row items-center p-5 bg-gray-50 rounded-2xl mb-3 border border-gray-100"
                            >
                                <View className="bg-white w-10 h-10 rounded-xl items-center justify-center mr-4 border border-gray-100 shadow-sm">
                                    <Ionicons name="scan" size={20} color="#2f5d34" />
                                </View>
                                <Text className="flex-1 font-bold text-gray-700">Face ID / Facial Scan</Text>
                                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => confirmSecuritySetup("Pattern")}
                                className="flex-row items-center p-5 bg-gray-50 rounded-2xl mb-3 border border-gray-100"
                            >
                                <View className="bg-white w-10 h-10 rounded-xl items-center justify-center mr-4 border border-gray-100 shadow-sm">
                                    <Ionicons name="grid" size={20} color="#2f5d34" />
                                </View>
                                <Text className="flex-1 font-bold text-gray-700">Pattern Recognition</Text>
                                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => confirmSecuritySetup("Password")}
                                className="flex-row items-center p-5 bg-gray-50 rounded-2xl mb-6 border border-gray-100"
                            >
                                <View className="bg-white w-10 h-10 rounded-xl items-center justify-center mr-4 border border-gray-100 shadow-sm">
                                    <Ionicons name="keypad" size={20} color="#2f5d34" />
                                </View>
                                <Text className="flex-1 font-bold text-gray-700">PIN or Password</Text>
                                <Ionicons name="chevron-forward" size={16} color="#9ca3af" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowMethodModal(false)}
                                className="w-full py-4 items-center"
                            >
                                <Text className="text-gray-400 font-bold">Cancel Setup</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal
                visible={showPinSetup}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowPinSetup(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View className="bg-emerald-50 w-16 h-16 rounded-full items-center justify-center mb-4">
                            <Ionicons name={selectedMethod === "Pattern" ? "grid" : "keypad"} size={32} color="#2f5d34" />
                        </View>
                        <Text className="text-xl font-black text-gray-900 mb-2">
                            {selectedMethod === "Pattern" ? "Set Your Pattern" : "Set 4-Digit PIN"}
                        </Text>
                        <Text className="text-gray-400 text-center mb-6 px-4">
                            {selectedMethod === "Pattern"
                                ? "Tap 4 dots in your secret order to create your pattern lock."
                                : "This PIN will be used to unlock your app if biometrics are unavailable."}
                        </Text>

                        <View className="flex-row justify-center mb-10">
                            {[1, 2, 3, 4].map((i) => (
                                <View
                                    key={i}
                                    className={`w-4 h-4 rounded-full mx-3 ${tempPin.length >= i ? 'bg-emerald-600' : 'bg-gray-200'}`}
                                />
                            ))}
                        </View>

                        {selectedMethod === "Pattern" ? (
                            <View className="flex-row flex-wrap justify-center w-64">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                                    const oIdx = tempPin.indexOf(num.toString());
                                    return (
                                        <TouchableOpacity
                                            key={num}
                                            activeOpacity={0.7}
                                            onPress={() => {
                                                if (tempPin.length < 4 && !tempPin.includes(num.toString())) {
                                                    setTempPin(prev => prev + num);
                                                }
                                            }}
                                            className={`w-14 h-14 rounded-full m-3 items-center justify-center border-2 ${oIdx !== -1 ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-gray-100'}`}
                                        >
                                            {oIdx !== -1 ? (
                                                <Text className="text-emerald-700 font-black text-xs">{oIdx + 1}</Text>
                                            ) : (
                                                <View className="w-4 h-4 rounded-full bg-gray-200" />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                                <TouchableOpacity onPress={() => setTempPin("")} className="w-full mt-4 items-center">
                                    <Text className="text-emerald-600 font-bold uppercase tracking-tight text-[10px]">Clear Pattern</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View className="flex-row flex-wrap justify-between w-full px-8 max-w-[320px]">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                    <TouchableOpacity
                                        key={num}
                                        onPress={() => tempPin.length < 4 && setTempPin(prev => prev + num)}
                                        className="w-16 h-16 rounded-full bg-gray-50 items-center justify-center mb-4 border border-gray-100"
                                    >
                                        <Text className="text-xl font-bold text-gray-700">{num}</Text>
                                    </TouchableOpacity>
                                ))}
                                {/* Empty space for layout balance */}
                                <View className="w-16 h-16 mb-4" />

                                <TouchableOpacity
                                    onPress={() => tempPin.length < 4 && setTempPin(prev => prev + "0")}
                                    className="w-16 h-16 rounded-full bg-gray-50 items-center justify-center mb-4 border border-gray-100"
                                >
                                    <Text className="text-xl font-bold text-gray-700">0</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setTempPin(prev => prev.slice(0, -1))}
                                    className="w-16 h-16 rounded-full bg-gray-50 items-center justify-center mb-4 border border-gray-100"
                                >
                                    <Ionicons name="backspace-outline" size={24} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity
                            onPress={handleSavePin}
                            className="bg-emerald-800 w-full py-4 rounded-2xl mt-10 shadow-lg"
                        >
                            <Text className="text-white text-center font-black uppercase tracking-widest">
                                {selectedMethod === "Pattern" ? "Save Pattern" : "Save PIN"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShowPinSetup(false)}
                            className="mt-6"
                        >
                            <Text className="text-gray-400 font-bold">Cancel Setup</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        backgroundColor: 'white',
        borderRadius: 40,
        padding: 24,
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 10,
    }
});
