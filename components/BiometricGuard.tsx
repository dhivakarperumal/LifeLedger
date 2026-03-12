import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, AppState, AppStateStatus, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useAuth } from '../context/AuthContext';

const BIOMETRIC_KEY = "is_biometric_enabled";

export const BiometricGuard = () => {

    const { user, logout } = useAuth() as any;
    const [isLocked, setIsLocked] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [appState, setAppState] = useState(AppState.currentState);
    const [preferredMethod, setPreferredMethod] = useState<string | null>(null);
    const [enteredPin, setEnteredPin] = useState("");
    const [savedPin, setSavedPin] = useState<string | null>(null);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', handleAppStateChange);

        if (user) {
            checkBiometricStatus();
        } else {
            setIsLocked(false);
            setIsLoading(false);
        }

        return () => {
            subscription.remove();
        };
    }, [user]);

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
        if (
            appState.match(/inactive|background/) &&
            nextAppState === 'active'
        ) {
            if (user) {
                checkBiometricStatus();
            }
        }
        setAppState(nextAppState);
    };

    const checkBiometricStatus = async () => {
        try {
            const isEnabled = await AsyncStorage.getItem(BIOMETRIC_KEY);
            const method = await AsyncStorage.getItem("preferred_security_method");
            const pin = await AsyncStorage.getItem("app_lock_pin");
            setPreferredMethod(method);
            setSavedPin(pin);
            setEnteredPin("");

            if (isEnabled === "true") {
                setIsLocked(true);
                if (method !== "Password" && method !== "Pattern") {
                    authenticate(method);
                }
            } else {
                setIsLocked(false);
            }
        } catch (error) {
            console.error("Error checking biometric status:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const authenticate = async (method?: string | null) => {
        try {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            const prompt = method ? `Unlock ${method}` : 'Unlock LifeLedger';

            if (!hasHardware || !isEnrolled) {
                // Device security is enabled but biometrics aren't setup/supported
                // We should still allow fallback to device passcode
                const result = await LocalAuthentication.authenticateAsync({
                    promptMessage: prompt,
                    fallbackLabel: 'Use PIN / Pattern / Password',
                });
                if (result.success) {
                    setIsLocked(false);
                    if (user) {
                        router.replace("/(tabs)");
                    }
                }
                return;
            }

            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: prompt,
                fallbackLabel: 'Use Device Passcode',
                disableDeviceFallback: false,
            });

            if (result.success) {
                setIsLocked(false);
                if (user) {
                    router.replace("/(tabs)");
                }
            } else {
                // Keep it locked if failed
            }
        } catch (error) {
            console.error("Biometric authentication error:", error);
            // Alert.alert("Error", "An error occurred during authentication.");
        }
    };

    return (
        <>
            {(isLocked || isLoading) && (
                <View style={[StyleSheet.absoluteFill, styles.container, { zIndex: 9999 }]}>
                    {isLoading ? (
                        <View style={styles.container} />
                    ) : (
                        <View style={styles.content}>
                            <View style={styles.iconContainer}>
                                <View style={styles.iconCircle}>
                                    <Ionicons
                                        name={
                                            preferredMethod === "Fingerprint" ? "finger-print" :
                                                preferredMethod === "Face ID" ? "scan" :
                                                    preferredMethod === "Pattern" ? "grid" :
                                                        preferredMethod === "Password" ? "keypad" :
                                                            "lock-closed"
                                        }
                                        size={64}
                                        color="#2f5d34"
                                    />
                                </View>
                                <View style={[styles.subIcon, { top: -15, left: -15, opacity: preferredMethod === "Fingerprint" ? 1 : 0.2 }]}>
                                    <Ionicons name="finger-print" size={20} color={preferredMethod === "Fingerprint" ? "#2f5d34" : "#94a3b8"} />
                                </View>
                                <View style={[styles.subIcon, { top: -15, right: -15, opacity: preferredMethod === "Face ID" ? 1 : 0.2 }]}>
                                    <Ionicons name="scan" size={20} color={preferredMethod === "Face ID" ? "#2f5d34" : "#94a3b8"} />
                                </View>
                                <View style={[styles.subIcon, { bottom: -15, left: -15, opacity: preferredMethod === "Pattern" ? 1 : 0.2 }]}>
                                    <Ionicons name="grid" size={20} color={preferredMethod === "Pattern" ? "#2f5d34" : "#94a3b8"} />
                                </View>
                                <View style={[styles.subIcon, { bottom: -15, right: -15, opacity: preferredMethod === "Password" ? 1 : 0.2 }]}>
                                    <Ionicons name="keypad" size={20} color={preferredMethod === "Password" ? "#2f5d34" : "#94a3b8"} />
                                </View>
                            </View>

                            <Text style={styles.title}>{preferredMethod || "Protected"}</Text>
                            <Text style={styles.subtitle}>
                                {preferredMethod
                                    ? `Please verify your identity using ${preferredMethod}`
                                    : "Authorization required to access your budget"}
                            </Text>

                            {(preferredMethod === "Fingerprint" || preferredMethod === "Face ID") && (
                                <TouchableOpacity style={styles.button} onPress={() => authenticate(preferredMethod)}>
                                    <Ionicons name="shield-checkmark" size={24} color="white" style={{ marginRight: 10 }} />
                                    <Text style={styles.buttonText}>Tap to Scan</Text>
                                </TouchableOpacity>
                            )}

                            {(preferredMethod === "Password" || preferredMethod === "Pattern") && (
                                <View className="w-full">
                                    <View className="flex-row justify-center mb-10">
                                        {[1, 2, 3, 4].map((i) => (
                                            <View
                                                key={i}
                                                className={`w-3 h-3 rounded-full mx-3 ${enteredPin.length >= i ? 'bg-emerald-600 shadow-sm' : 'bg-gray-200'}`}
                                            />
                                        ))}
                                    </View>

                                    <View className="flex-row flex-wrap justify-center w-full">
                                        {preferredMethod === "Pattern" ? (
                                            <View className="flex-row flex-wrap justify-center w-64">
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                                                    const orderIndex = enteredPin.indexOf(num.toString());
                                                    return (
                                                        <TouchableOpacity
                                                            key={num}
                                                            activeOpacity={0.8}
                                                            onPress={() => {
                                                                if (enteredPin.length < 4 && !enteredPin.includes(num.toString())) {
                                                                    const newPin = enteredPin + num;
                                                                    setEnteredPin(newPin);
                                                                    if (newPin.length === 4) {
                                                                        if (newPin === savedPin) {
                                                                            setIsLocked(false);
                                                                            router.replace("/(tabs)");
                                                                        } else {
                                                                            Alert.alert("Incorrect Pattern", "Please redraw your secret pattern.");
                                                                            setEnteredPin("");
                                                                        }
                                                                    }
                                                                }
                                                            }}
                                                            className={`w-14 h-14 rounded-full m-3 items-center justify-center border-2 ${orderIndex !== -1 ? 'bg-emerald-50 border-emerald-500 shadow-sm' : 'bg-white border-gray-100'}`}
                                                        >
                                                            {orderIndex !== -1 ? (
                                                                <Text className="text-emerald-700 font-black text-xs">{orderIndex + 1}</Text>
                                                            ) : (
                                                                <View className="w-4 h-4 rounded-full bg-gray-200" />
                                                            )}
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                                <TouchableOpacity onPress={() => setEnteredPin("")} className="w-full mt-6 items-center">
                                                    <Text className="text-emerald-700 font-black tracking-tight text-xs uppercase">Reset Pattern</Text>
                                                </TouchableOpacity>
                                            </View>
                                        ) : (
                                            <View className="flex-row flex-wrap justify-between w-full max-w-[300px]">
                                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                                                    <TouchableOpacity
                                                        key={num}
                                                        onPress={() => {
                                                            if (enteredPin.length < 4) {
                                                                const newPin = enteredPin + num;
                                                                setEnteredPin(newPin);
                                                                if (newPin.length === 4) {
                                                                    if (newPin === savedPin) {
                                                                        setIsLocked(false);
                                                                        router.replace("/(tabs)");
                                                                    } else {
                                                                        Alert.alert("Access Denied", "Incorrect PIN code.");
                                                                        setEnteredPin("");
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        className="w-[32%] h-20 rounded-full bg-white items-center justify-center mb-4 shadow-sm border border-gray-100"
                                                    >
                                                        <Text className="text-2xl font-black text-gray-700">{num}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                                <View className="w-[32%]" />
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        if (enteredPin.length < 4) {
                                                            const newPin = enteredPin + "0";
                                                            setEnteredPin(newPin);
                                                            if (newPin.length === 4) {
                                                                if (newPin === savedPin) {
                                                                    setIsLocked(false);
                                                                    router.replace("/(tabs)");
                                                                } else {
                                                                    Alert.alert("Access Denied", "Incorrect PIN code.");
                                                                    setEnteredPin("");
                                                                }
                                                            }
                                                        }
                                                    }}
                                                    className="w-[32%] h-20 rounded-full bg-white items-center justify-center mb-4 shadow-sm border border-gray-100"
                                                >
                                                    <Text className="text-2xl font-black text-gray-700">0</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => setEnteredPin(prev => prev.slice(0, -1))}
                                                    className="w-[32%] h-20 rounded-full bg-white items-center justify-center mb-4 shadow-sm border border-gray-100"
                                                >
                                                    <Ionicons name="backspace-outline" size={24} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}


                        </View>
                    )}
                </View>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    iconContainer: {
        width: 160,
        height: 160,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    iconCircle: {
        width: 120,
        height: 120,
        backgroundColor: '#e8f1ec',
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#2f5d34",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    subIcon: {
        position: 'absolute',
        backgroundColor: 'white',
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 2,
        borderColor: '#e8f1ec',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#1e293b',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 24,
    },
    button: {
        backgroundColor: '#2f5d34',
        paddingVertical: 18,
        paddingHorizontal: 30,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: "#2f5d34",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
